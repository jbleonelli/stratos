// Browser-side chat dispatcher.
// Tries the /api/chat serverless function first (which proxies to Claude).
// Falls back to the canned mockClaude responses ONLY when the backend is
// genuinely absent (401 "no_api_key" / 404 not-deployed) so demos still work
// locally / on preview. A REAL failure of a live backend (5xx, empty stream,
// SSE upstream error, network drop, timeout) throws instead — the caller shows
// a graceful retry — so we never present an unrelated canned line as a real
// answer, and the failure is reported (here + server-side) instead of swallowed.

import { mockClaudeComplete } from './mockClaude.js';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { roomDirectoryFor } from './custom-locations.js';
import { equipmentDirectory } from './predict-equipment.js';
import { forecastDirectory } from './predict-forecast.js';
import { complianceDirectoriesForChat } from './compliance-data.js';
import { vendorDirectory } from './vendors-data.js';
import { getLanguage } from './i18n.js';

// Cached after the first failed call so we don't keep hitting a missing
// endpoint on every message in a session. Reset on full page reload.
let preferMock = false;

// Returns { text, actions } so callers can render Claude's reply AND
// execute any tool calls (e.g. add_metrics_widget) it requested.
// `onChunk(evt)` fires once per SSE event so the UI can render text
// deltas as they arrive (cuts perceived latency by ~50 %). Mock
// fallback emits a single synthetic chunk so callers don't need to
// branch on streaming vs. non-streaming.
export async function chatComplete({
  text,
  role,
  building,
  tone,
  context,
  widgetCatalog,
  currentLayout,
  history,
  onChunk,
  personaKind,
  serviceLine,
  surface,
  fast,
  lang,
  image,
}) {
  if (preferMock) {
    const reply = await mockClaudeComplete({ text, role, building, tone });
    if (onChunk) onChunk({ type: 'text', delta: reply });
    return { text: reply, actions: [] };
  }

  // Abort a hung request after 45s so the chat never stalls silently.
  // Vercel's maxDuration caps the function itself; this protects the browser
  // from a dropped connection or other edge case.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    // Attach the Supabase access token so the server can attribute
    // spend in claude_usage_events. Best-effort — chat works fine
    // without auth; only cost attribution suffers when it's missing.
    const headers = { 'content-type': 'application/json' };
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
    } catch {
      /* ignore — proceed without auth */
    }

    // Real per-building compliance grounding (obligations + certifications),
    // pulled from building_compliance_overview — NOT static fixtures. Skipped
    // for the slim contractor payload (irrelevant to a contractor's chat) and
    // fail-soft (returns empty dirs → chat simply omits the block). Buildings
    // with no compliance profile (IMF, etc.) get empty dirs → Merlin won't bluff.
    const slim = personaKind === 'contractor_manager';
    const complianceDirs = slim
      ? { compliance: [], certifications: [] }
      : await complianceDirectoriesForChat(building?.id);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // Contractors get a SLIM building payload — the heavy building-owner
        // directories (equipment, forecast, compliance, certifications,
        // vendors, room directory) are irrelevant to a contractor's portfolio
        // chat and were bloating the prompt enough to slow both prefill and
        // decode (≈8s answers). Their grounding comes from `context` (contracts
        // + analytics) instead.
        message: text,
        role,
        // Optional image attachment ({ media_type, data:base64 }) for Claude vision.
        image,
        building: serializeBuilding(building, { slim, complianceDirs }),
        context,
        widgetCatalog,
        currentLayout,
        history,
        personaKind,
        serviceLine,
        surface,
        fast,
        // Output language for the reply. Prefer an explicit lang from the
        // caller (sourced from the user's saved profile preference, which is
        // authoritative even during the brief first-load window before the
        // i18n module has applied it); fall back to the live UI language.
        lang: lang || getLanguage(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      clearTimeout(timer);
      // 401 (no key) / 404 (function not deployed, e.g. vite dev) = the backend is
      // genuinely ABSENT → fall back to canned demo responses for the rest of the
      // session (preview/local demos). Any other status is a REAL failure of a
      // live backend: do NOT fabricate a canned answer (it reads as Merlin
      // hallucinating an unrelated reply, e.g. a room-release line in answer to a
      // restroom question) — throw so the caller shows a graceful retry message,
      // and don't latch preferMock so the next message retries the real backend.
      if (res.status === 401 || res.status === 404) {
        preferMock = true;
        const reply = await mockClaudeComplete({ text, role, building, tone });
        if (onChunk) onChunk({ type: 'text', delta: reply });
        return { text: reply, actions: [] };
      }
      throw new Error(`chat backend returned ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream') && res.body) {
      // SSE path — stream tokens as they arrive.
      const result = await consumeSseStream(res.body, onChunk);
      clearTimeout(timer);
      if (result.text.trim() || result.actions.length > 0) return result;
      // Backend answered 200 but the stream was empty — a real failure, not a
      // missing backend. Surface it gracefully (see !res.ok note) rather than a
      // canned answer.
      throw new Error('empty chat stream');
    }

    // Non-streaming JSON fallback (kept for completeness, e.g. older
    // function deployments still serving the old response shape).
    clearTimeout(timer);
    const data = await res.json();
    const replyText = typeof data.text === 'string' ? data.text : '';
    const actions = Array.isArray(data.actions) ? data.actions : [];
    if (replyText.trim() || actions.length > 0) {
      if (onChunk && replyText) onChunk({ type: 'text', delta: replyText });
      return { text: replyText, actions };
    }
    throw new Error('empty chat response');
  } catch (err) {
    clearTimeout(timer);
    // 401/404 returned the demo mock above and never reach here. Everything that
    // lands here is a REAL failure of a live backend (5xx, empty stream/response,
    // SSE upstream error, network drop, or the 45s abort). Report it (so the
    // failure is no longer invisible — pairs with the server-side captureError in
    // api/chat.ts) and rethrow for the caller's graceful offline message; never
    // fabricate a canned reply on a configured backend. Skip user aborts.
    if (err?.name !== 'AbortError') {
      try {
        captureException(err instanceof Error ? err : new Error(String(err)), { where: 'chatComplete' });
      } catch {
        /* noop */
      }
    }
    throw err;
  }
}

// Read SSE events from the streaming response. Each event is a single
// `data: <json>\n\n` line. Forwards `text` events to onChunk so the
// caller can render them incrementally; collects `action` events into
// the final return value.
async function consumeSseStream(body, onChunk) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  const actions = [];
  let upstreamError = null;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!line.startsWith('data: ')) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (evt.type === 'text') {
          if (typeof evt.delta === 'string') {
            fullText += evt.delta;
            if (onChunk) onChunk(evt);
          }
        } else if (evt.type === 'action') {
          actions.push({ id: evt.id, tool: evt.tool, args: evt.args || {} });
        } else if (evt.type === 'error') {
          upstreamError = evt.message || 'upstream_error';
        }
        // 'done' is implicit — the stream simply ends.
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* best-effort */
    }
  }

  if (upstreamError && !fullText.trim() && actions.length === 0) {
    throw new Error(upstreamError);
  }
  return { text: fullText, actions };
}

// Strip non-serializable fields and only send what the backend needs for context.
// roomDirectory: pulled from the cached locations table so the system
// prompt can list named singleton rooms (Mailroom, Boardroom, Server
// Room, …) and aggregate counts for high-volume kinds (200 restrooms,
// 144 meeting rooms). Without this Merlin replied 'I don't have a
// Mailroom in this view' even though the Hypervisor tree showed one.
function serializeBuilding(b, { slim = false, complianceDirs } = {}) {
  if (!b) return null;
  const { compliance = [], certifications = [] } = complianceDirs || {};
  const base = {
    id: b.id,
    name: b.name,
    addr: b.addr,
    kind: b.kind,
    variant: b.variant,
    floors: b.floors,
    branches: b.branches,
    displays: b.displays,
    sensors: b.sensors,
    occupancy: b.occupancy,
    peakToday: b.peakToday,
  };
  // Slim payload (contractor chat): keep the room directory — a facility-
  // services contractor legitimately asks about restrooms, zones, and named
  // rooms they service ("les sanitaires") — but drop the heavy building-owner
  // PREDICT/INNOVATE directories below (equipment fleet, forecast, compliance,
  // certifications, vendor marketplace), which the contractor persona never
  // answers from and which only bloat the prompt.
  if (slim) return { ...base, roomDirectory: roomDirectoryFor(b.id) };
  return {
    ...base,
    roomDirectory: roomDirectoryFor(b.id),
    // PREDICT → Maintenance fleet, so Merlin can speak to any asset shown
    // on that page (e.g. "LED Driver Bank · Floor 22") without refusing for
    // lack of grounding. Demo fixtures today; swap for real predictive-
    // maintenance agent runs when they land. See predict-equipment.js.
    equipment: equipmentDirectory(),
    // PREDICT → Forecast signals (VOC/CO₂/load/occupancy), same reason —
    // e.g. "Conference Zone B" isn't a canonical room. See predict-forecast.js.
    forecast: forecastDirectory(),
    // ANTICIPATE → Compliance obligations — REAL per-building rows from
    // building_compliance_overview (jurisdiction × occupancy × systems), so
    // Merlin answers "are we compliant on X" grounded in this building's actual
    // status (NFPA/ASHRAE/ADA for HQ; ERP/ARS/HACCP for PSG). Fetched upstream
    // in chatComplete; empty for buildings with no profile. See compliance-data.js.
    compliance,
    // Voluntary certifications (LEED, ENERGY STAR, WELL, ISO 14001, HQE…) — same
    // real per-building source, so Merlin can speak to where the building stands.
    certifications,
    // INNOVATE marketplace catalog — so Merlin can answer "what about 75F?"
    // and "which of these would fit this building?" grounded in the real
    // vendor list. See vendors-data.js (module snapshot).
    vendors: vendorDirectory(),
  };
}
