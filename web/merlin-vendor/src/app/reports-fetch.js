// Live data fetchers for the Reports page. One async function per
// report type that knows how to pull from the right Postgres table
// for the org + range, returns rows in the same shape the existing
// SAMPLE_ROWS arrays use (so PreviewTable + CSV builder can render
// either source without branching).
//
// Coverage today (Track J phase):
//   sla       — device_requests joined to slas
//   incident  — merlin_asks
//   device    — devices (current snapshot, not time-range scoped)
//   financial — INSIGHTS_HQ (in-bundle insight pool)
//
// Other report types still fall through to SAMPLE_ROWS in Reports.jsx.
// They'll wire when their source data lands.

import { supabase } from './supabase.js';
import { INSIGHTS_HQ, INSIGHTS_ECOSYSTEM, trackOf } from './insights-data.js';

// Range spec → number of days back from "now".
export function rangeDays(range) {
  const now = new Date();
  switch (range) {
    case '24h':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), q, 1);
      return Math.max(1, Math.ceil((now - start) / 86_400_000));
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      return Math.max(1, Math.ceil((now - start) / 86_400_000));
    }
    default:
      return 7;
  }
}

function rangeStartIso(range) {
  return new Date(Date.now() - rangeDays(range) * 86_400_000).toISOString();
}

// Format helpers — keep CSV cells human-readable.
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}
function fmtDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

// Build a location-id → name lookup for the org. Used by SLA + incident
// reports so the row's "location" cell shows a human name rather than
// the raw `hq-fl-32-r-...` slug.
async function buildLocationLookup(orgId) {
  if (!orgId) return new Map();
  const { data } = await supabase.from('locations').select('id, name').eq('organization_id', orgId);
  const m = new Map();
  for (const r of data || []) m.set(r.id, r.name);
  return m;
}

// ─────────────────────────── SLA ───────────────────────────
//
// Each row = one device_request, decorated with whether it cleared the
// 20-minute Hygiene SLA. Open requests show response='—' and outcome
// either 'open' (under target) or 'breach' (over target).
async function fetchSlaRows({ orgId, range }) {
  if (!orgId) return [];
  const since = rangeStartIso(range);
  const [{ data: rows }, locLookup] = await Promise.all([
    supabase
      .from('device_requests')
      .select('id, location_id, request_type, first_pressed_at, resolved_at')
      .eq('organization_id', orgId)
      .gte('first_pressed_at', since)
      .order('first_pressed_at', { ascending: false })
      .limit(1000),
    buildLocationLookup(orgId),
  ]);
  const SLA_MIN = 20;
  return (rows || []).map((r) => {
    const startMs = new Date(r.first_pressed_at).getTime();
    const endMs = r.resolved_at ? new Date(r.resolved_at).getTime() : null;
    const latencyMs = endMs != null ? endMs - startMs : null;
    const within = latencyMs != null && latencyMs <= SLA_MIN * 60_000;
    const overdueOpen = latencyMs == null && Date.now() - startMs > SLA_MIN * 60_000;
    const outcome = endMs == null ? (overdueOpen ? 'breach' : 'open') : within ? 'met' : 'breach';
    return {
      time: fmtTime(r.first_pressed_at),
      incident: r.request_type,
      sla_name: 'Hygiene · 20m',
      response: latencyMs != null ? fmtDuration(latencyMs) : '—',
      priority: outcome === 'breach' ? 'high' : 'medium',
      outcome,
      responder: '—',
      location: locLookup.get(r.location_id) || r.location_id,
    };
  });
}

// ─────────────────────────── Incident ───────────────────────────
//
// One row per ask-event. status derives from resolved + the linked
// agent_run.ask_resolution; "merlin_auto" tells the reader whether
// the agent acted directly (resolved_reason='agent_acted') or routed
// the question to a human.
async function fetchIncidentRows({ orgId, range }) {
  if (!orgId) return [];
  const since = rangeStartIso(range);
  const { data: rows } = await supabase
    .from('events')
    .select(
      'id, severity, payload, resolved, resolved_reason, processed_by_agent_id, created_at, agent_runs!agent_run_id(ask_resolution, decision)',
    )
    .eq('organization_id', orgId)
    .gte('created_at', since)
    .not('agent_run_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);
  return (rows || []).map((r) => ({
    time: fmtTime(r.created_at),
    priority: r.severity || r.payload?.priority || 'medium',
    title: r.payload?.title || r.payload?.decision_reason || 'Untitled',
    location: '—',
    status: humanizeEventStatus(r),
    merlin_auto: r.resolved_reason === 'agent_acted' ? 'Yes' : r.processed_by_agent_id ? 'No (human)' : '—',
    approver: r.agent_runs?.ask_resolution ? 'Logged' : '—',
    duration: '—',
  }));
}

function humanizeEventStatus(r) {
  if (r.resolved) {
    if (r.resolved_reason === 'agent_acted') return 'Auto-resolved';
    const ar = r.agent_runs?.ask_resolution;
    if (ar === 'approve') return 'Resolved';
    if (ar === 'hold') return 'On hold';
    if (ar === 'dismiss') return 'Dismissed';
    return 'Resolved';
  }
  if (r.agent_runs?.decision === 'ask') return 'Open';
  return 'Open';
}

// ─────────────────────────── Device ───────────────────────────
//
// One row per device in the current building (or every device in the
// org if the building scope is the whole workspace). Snapshot view —
// the range selector doesn't apply because devices don't have a
// time series the same way requests do.
async function fetchDeviceRows({ orgId, building }) {
  if (!orgId) return [];
  let q = supabase
    .from('devices')
    .select('id, external_id, kind, status, location_id, battery_pct, firmware, last_seen, install_date')
    .eq('organization_id', orgId)
    .order('kind')
    .limit(2000);
  // Building scope: prefix-match on location_id (same shape as the
  // devicesForBuilding hook in devices-store.js).
  if (building?.id && building.kind !== 'ecosystem') {
    q = q.or(`location_id.eq.${building.id},location_id.like.${building.id}-%`);
  }
  const [{ data: devices }, locLookup] = await Promise.all([q, buildLocationLookup(orgId)]);
  return (devices || []).map((d) => {
    // Uptime % approximation from last_seen + install_date. If the
    // device is offline we surface 0%; otherwise back-calculate days
    // since install minus a tiny gap penalty per stale-minutes.
    let uptime = '—';
    if (d.install_date) {
      const days = Math.max(1, Math.round((Date.now() - new Date(d.install_date).getTime()) / 86_400_000));
      const minStale = d.last_seen ? Math.max(0, (Date.now() - new Date(d.last_seen).getTime()) / 60_000) : 0;
      const downtimeFrac = Math.min(0.5, minStale / (days * 1440));
      uptime = `${(100 - downtimeFrac * 100).toFixed(1)}%`;
    }
    return {
      id: d.external_id || d.id.slice(0, 8),
      type: prettyDeviceKind(d.kind),
      location: locLookup.get(d.location_id) || d.location_id,
      status: capitalize(d.status || 'unknown'),
      uptime,
      battery: d.battery_pct != null ? `${d.battery_pct}%` : '—',
      firmware: d.firmware || '—',
    };
  });
}

function prettyDeviceKind(k) {
  return (
    {
      smart_display_classic: 'Smart Display Classic',
      people_counter_basic: 'People Counter Basic',
      smart_logger_basic: 'Smart Logger Basic',
      bacnet_thermostat: 'BACnet Thermostat',
      onvif_camera: 'ONVIF Camera',
      hid_badge_reader: 'HID Badge Reader',
    }[k] || k
  );
}
function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

// ─────────────────────────── Financial ───────────────────────────
//
// Reads directly from the bundled insight pool — no DB roundtrip. The
// realized-$ column lights up for status='implemented' rows since
// those carry impact.amount; everything else shows realized=$0.
function fetchFinancialRows({ building }) {
  const isImf = building?.variant === 'imf';
  const isEco = building?.kind === 'ecosystem';
  const pool = isImf ? [] : isEco ? INSIGHTS_ECOSYSTEM : INSIGHTS_HQ;
  return pool
    .filter((i) => trackOf(i) === 'financial')
    .map((i) => {
      const usd = (n) => '$' + (n || 0).toLocaleString();
      const dollars = i.impact_kind === 'dollars' ? Number(i.impact?.amount || 0) : 0;
      return {
        insight: i.title,
        category: prettyCategory(i.category),
        impact: dollars > 0 ? usd(dollars) : '—',
        status: prettyStatus(i.status),
        realized: i.status === 'implemented' && dollars > 0 ? usd(dollars) : '$0',
      };
    });
}

function prettyCategory(c) {
  return (
    {
      cleaning: 'Cleaning',
      hvac: 'HVAC',
      space: 'Space',
      supply: 'Supply',
      energy: 'Energy',
      security: 'Security',
      maintenance: 'Maintenance',
      compliance: 'Compliance',
      lighting: 'Lighting',
      reliability: 'Reliability',
    }[c] || c
  );
}
function prettyStatus(s) {
  return (
    {
      new: 'New',
      in_review: 'In review',
      approved: 'Approved',
      implemented: 'Implemented',
      dismissed: 'Dismissed',
    }[s] || s
  );
}

// ─────────────────────────── Public entry ───────────────────────────
//
// Returns rows for the requested type. Resolves to null on error so
// the caller can fall back to SAMPLE_ROWS without showing a stale
// preview while loading.
export async function fetchReportRows({ type, range, orgId, building }) {
  try {
    if (type === 'sla') return await fetchSlaRows({ orgId, range });
    if (type === 'incident') return await fetchIncidentRows({ orgId, range });
    if (type === 'device') return await fetchDeviceRows({ orgId, building });
    if (type === 'financial') return fetchFinancialRows({ building });
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[reports-fetch] ${type} failed:`, err);
    return null;
  }
}

// Which types fetch from real sources today. Reports.jsx uses this to
// decide whether to show a "live data" indicator + skip the sample
// fallback for 0-row results.
export const LIVE_REPORT_TYPES = new Set(['sla', 'incident', 'device', 'financial']);
