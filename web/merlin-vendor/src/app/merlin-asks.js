// merlin-asks.js — events-table adapter for the legacy "ask" API.
//
// History: this file used to own a localStorage-cached, realtime-
// subscribed mirror of the public.merlin_asks table — the source of
// truth for "things Merlin wants a human to look at." Phase 4 of the
// events pipeline (see docs/architecture/events-pipeline.md) moves
// that signal onto public.events with a backing agent_run carrying
// decision='ask'. The merlin_asks table is being drained.
//
// Rather than rip out useMerlinAsks / answerAsk from the 7 surfaces
// that still call them (Sidebar bell, Chat, Dashboard, AgentDetailView,
// CallsForAction, HypervisorViewer3D's unified feed, Activity's
// replay-mode path), this module keeps the same exports but rewires
// them to events.js under the hood. Each surface keeps reading the
// same shape; the bytes come from events now.
//
// Followup PR will drop public.merlin_asks once we're confident no
// regressions linger.

import { useMemo } from 'react';
import { supabase } from './supabase.js';
import { logIncidentAction } from './incident-actions.js';
import { useSession } from './auth.js';
import { useEventsForBuilding, resolveEvent } from './events.js';

const DEFAULT_ACTIONS = [
  { id: 'approve', label: 'Approve', tone: 'accent', pastTense: 'approved' },
  { id: 'hold', label: 'Hold', tone: 'ghost', pastTense: 'put on hold' },
  { id: 'dismiss', label: 'Dismiss', tone: 'ghost', pastTense: 'dismissed' },
];

// Mirrors Activity.jsx's ACTIVITY_AGENT_DISPLAY_NAME so the legacy
// (replay-mode) path produces the same short titles as the events
// path. Keeping it duplicated here rather than importing avoids a new
// circular dep between merlin-asks.js → Activity.jsx.
const AGENT_DISPLAY_NAME = {
  cleaning: 'Cleaning & Hygiene',
  hvac: 'HVAC & Comfort',
  space: 'Space Management',
  supply: 'Supplies & Stock',
  compliance: 'Compliance',
  energy: 'Energy',
  security: 'Security & Safety',
  'cold-chain': 'Cold-Chain',
  'pharmacy-temp': 'Pharmacy Temperature',
  'predictive-maintenance': 'Predictive Maintenance',
  'asset-tracking': 'Asset Tracking',
  parking: 'Parking',
  'crowd-flow': 'Crowd Flow',
  'concession-demand': 'Concession Demand',
  'incident-choreography': 'Incident Choreography',
};

// Translate an events row (with embedded agent_run state) into the
// legacy ask shape consumers were written against. Only events that
// represent an awaiting-human decision flow through — see the filter
// in useMerlinAsks.
//
// Two-line layout (same as Activity.jsx's eventToCallShape — PR #769):
//   title: "{Agent display name} · needs approval"  (short, fits)
//   body:  full decision_reason                     (wraps in CallRow)
// This stops the row from rendering the full reasoning paragraph in
// the title slot and overflowing the central card to the right —
// which on replay-mode tenants (Meridian / FEB) was pushing the
// docked ChatPanel off-screen.
function eventToAsk(e) {
  const p = e?.payload || {};
  const agentId = e.processed_by_agent_id || e.kind || null;
  const agentLabel = (agentId && AGENT_DISPLAY_NAME[agentId]) || (agentId ? agentId.replace(/-/g, ' ') : 'Agent');
  const explicitTitle = p.title && p.title !== e.decision_reason ? p.title : null;
  return {
    // We KEEP event uuid as the id. Legacy consumers used `agent-<runId>`
    // but they always treat the id as an opaque key (React render
    // keys + answerAsk lookups) — no parsing.
    id: e.id,
    priority: p.priority || e.severity || 'medium',
    title: explicitTitle || `${agentLabel} · needs approval`,
    // Prefer the agent's rich, decision-ready body (SLA breach, open count, the
    // proposed action) over the terse decision_reason ("X needs attention at Y"),
    // which is too vague to decide on. Falls back to decision_reason when an agent
    // didn't write a fuller body.
    body: p.body || e.decision_reason || null,
    status: p.status || null,
    // Simulator-derived events have a payload.incident_id (or carry
    // the simulator's incident id via external_id 'i-sim-…'). Surface
    // it for any legacy hover-to-jump-to-incident UI.
    incidentId: p.incident_id || (e.external_id && /^i-sim-/.test(e.external_id) ? e.external_id : null),
    incidentTitle: p.incident_title || null,
    actions: Array.isArray(p.actions) && p.actions.length > 0 ? p.actions : DEFAULT_ACTIONS,
    // Surfaces filter "agent vs simulator/human" asks by agentRunId
    // truthiness (see Dashboard). Same semantics carry over.
    agentRunId: e.agent_run_id || null,
    agentId: e.processed_by_agent_id || null,
    locationId: e.location_id || null,
    kind: p.kind || null,
    params: p.params || null,
    createdAt: e.created_at ? new Date(e.created_at).getTime() : Date.now(),
    // Keep the underlying event around so answerAsk can pull the
    // agent_run_id without a second round-trip.
    _event: e,
  };
}

/**
 * Legacy-shape read of agent asks awaiting human action, scoped to one
 * building. Now backed by public.events.
 *
 * @param {string|null} [buildingId]
 */
export function useMerlinAsks(buildingId) {
  const session = useSession();
  const orgId = session?.organizationId || null;
  // We only want events where the agent decided to 'ask' and a human
  // hasn't resolved them yet. useEventsForBuilding's 'awaiting_human'
  // filter already encodes that pair.
  const events = useEventsForBuilding(orgId, buildingId || null, {
    includeResolved: false,
    processingState: 'awaiting_human',
    limit: 200,
  });
  return useMemo(() => events.map(eventToAsk), [events]);
}

// ────── mutations
//
// answerAsk delegates to resolveEvent (event + agent_run update in
// lockstep) and — on approve — fires the agent's proposed action via
// /api/agents/apply-ask so a real downstream row lands in the per-
// agent action table. Mirrors src/app/agent-runs.js
// resolvePendingAgentAsk which already does this for My Day.

export async function answerAsk(askId, actionId, locationId = null) {
  if (!askId) return null;

  // Look up the event so we can find the backing agent_run_id.
  // resolveEvent itself does a similar lookup but we need the run id
  // here for both apply-ask and the audit log entry below.
  const { data: evt } = await supabase
    .from('events')
    .select('id, agent_run_id, kind, payload, created_at')
    .eq('id', askId)
    .maybeSingle();

  if (!evt) {
    // eslint-disable-next-line no-console
    console.warn('[merlin-asks] answerAsk: event not found', askId);
    return null;
  }

  const runId = evt.agent_run_id;
  const title = evt.payload?.title || evt.payload?.decision_reason || evt.kind || 'ask';

  // 1. Write the resolution to both events + agent_runs.
  await resolveEvent(askId, actionId);

  // 2. On approve, fire the agent's proposed action via apply-ask
  //    using the runId path (PR #642 extended apply-ask to accept
  //    runId directly so we don't need a merlin_asks row to pivot
  //    through). Best-effort — failures log + still surface the
  //    confirmation toast.
  if (runId && actionId === 'approve') {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const apiBase =
          typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
            ? 'https://merlin.adaptiv.systems'
            : '';
        const res = await fetch(`${apiBase}/api/agents/apply-ask`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ runId }),
        });
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn('[merlin-asks] apply-ask non-2xx:', res.status, await res.text());
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[merlin-asks] apply-ask threw:', e?.message);
    }
  }

  // 3. Audit-log the human action for incident_actions rollups —
  //    same call the legacy answerAsk path made.
  try {
    await logIncidentAction({
      incidentId: evt.payload?.incident_id || askId,
      incidentTitle: title,
      incidentPriority: evt.payload?.priority || null,
      action: actionId,
      locationId,
    });
  } catch {
    // best-effort
  }

  // Return the same chat-confirmation string the legacy path returned.
  const def = DEFAULT_ACTIONS.find((a) => a.id === actionId);
  const verb = def?.pastTense || `${actionId}ed`;
  return `You ${verb} — ${title}`;
}

export function pushAskFromSuggestion(_suggestion, _incidents) {
  // intentional no-op — see header above
}

export function seedCannedAsks() {
  // intentional no-op — see header above
}
