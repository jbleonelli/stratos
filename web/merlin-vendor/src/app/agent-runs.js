// Per-org live runtime stats for agents (Track K-3).
//
// The Dashboard → Agents grid shows each agent's "actions today" count
// + "last fired" line. Before K-3 these came from the static AGENTS
// array; now they come from real rows in public.agent_runs that the
// per-agent runtime (api/agents/*) writes every cron tick.
//
// Shape returned:
//   { [agent_id]: { lastRun, actionsToday } | undefined }
// where lastRun carries the agent_runs row fields the UI needs.
//
// Module-scope subscription matches the pattern from merlin-asks.js
// (see memory/supabase_gotchas.md #3 — StrictMode double-invoke can
// leave a hook-scoped channel joined-but-undelivered). Realtime passes
// RLS server-side so consumers only receive rows for orgs they can see.

import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { fetchAllPaginated } from './pagination.js';
import { captureException } from './sentry.js';

// Build the dash-bounded prefix filter for a building. agent_runs
// rows are tagged with the location_id they fired against; per memory
// (multi_building_scoping.md) the canonical scoping is `eq buildingId`
// OR `like buildingId-%`. Applying this at the DB level — instead of
// pulling org-wide rows and filtering client-side — fixes the count
// discrepancies where one busy building's rows fill the 1000-row
// PostgREST cap and starve sibling buildings of historical data.
function buildingScopeOr(buildingId) {
  return `location_id.eq.${buildingId},location_id.like.${buildingId}-%`;
}

const RUNS_BY_ORG = new Map(); // orgId → runs[] (newest first)
const hydrated = new Set();
const hydrating = new Map();
const LISTENERS = new Set();
const MAX_PER_ORG = 500;

let subscribedChannel = null;

function todayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fromRow(r) {
  return {
    id: r.id,
    agent_id: r.agent_id,
    created_at: r.created_at,
    decision: r.decision,
    decision_reason: r.decision_reason,
    confidence: r.confidence ?? null,
    created_override_id: r.created_override_id,
    created_ask_id: r.created_ask_id,
    ask_resolution: r.ask_resolution || null,
    ask_resolved_at: r.ask_resolved_at || null,
    location_id: r.location_id || null,
    // Metrics fields — surfaced on the per-agent detail page (cost,
    // latency, token spend). Small ints / numerics; cheap to include
    // in the hydrate payload.
    latency_ms: r.latency_ms ?? null,
    cost_usd: r.cost_usd != null ? Number(r.cost_usd) : null,
    tokens_in: r.tokens_in ?? null,
    tokens_out: r.tokens_out ?? null,
    model: r.model || null,
    // inputs carries the run's domain/item/client — the contractor agent
    // surface buckets the 'servicing' co-worker's runs by service line off
    // inputs.domain (see contractor-agents.js).
    inputs: r.inputs || null,
  };
}

async function hydrateOrg(orgId) {
  if (!orgId) return;
  if (hydrated.has(orgId)) return;
  if (hydrating.has(orgId)) return hydrating.get(orgId);
  const p = (async () => {
    const { data, error } = await supabase
      .from('agent_runs')
      .select(
        'id, agent_id, created_at, decision, decision_reason, confidence, created_override_id, created_ask_id, ask_resolution, ask_resolved_at, latency_ms, cost_usd, tokens_in, tokens_out, model, location_id, inputs',
      )
      .eq('organization_id', orgId)
      .gte('created_at', todayStartIso())
      .order('created_at', { ascending: false })
      .limit(MAX_PER_ORG);
    hydrated.add(orgId);
    hydrating.delete(orgId);
    if (!error && data) {
      RUNS_BY_ORG.set(orgId, data.map(fromRow));
      emit();
    }
  })();
  hydrating.set(orgId, p);
  return p;
}

function subscribeRealtime() {
  if (subscribedChannel) return;
  subscribedChannel = supabase
    .channel('agent_runs_live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_runs' }, (payload) => {
      const r = payload.new;
      const orgId = r?.organization_id;
      if (!orgId) return;
      // Only buffer rows for orgs a caller has asked about — keeps
      // memory bounded when the module sees realtime from an org we
      // never hydrated (e.g. superadmin viewing multiple workspaces).
      if (!hydrated.has(orgId)) return;
      const list = RUNS_BY_ORG.get(orgId) || [];
      if (list.some((x) => x.id === r.id)) return;
      RUNS_BY_ORG.set(orgId, [fromRow(r), ...list].slice(0, MAX_PER_ORG));
      emit();
    })
    .subscribe();
}

function emit() {
  LISTENERS.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  // One tick delay so supabase-js finishes restoring the session from
  // localStorage before realtime auth piggybacks on it.
  setTimeout(subscribeRealtime, 50);
}

// Generic latest-action subscription across the 6 agent action tables
// (K-10..K-15). Each card on Dashboard → Agents shows a small pill
// summarising the agent's most recent persisted action; this hook
// wires that across hvac/supply/space/energy/compliance/security in
// one place. Cleaning has route_overrides but renders its own surface
// in Today's plan and isn't included here.
//
// Shape returned by useLatestAgentActions(orgId):
//   { [agentId]: { agentId, kind, summary, applied_at, reason } | undefined }

// Each spec declares the table name + the columns we read for legacy
// (pre-Phase-2C) rendering. Phase 2C adds reason_code + params columns
// (migration 070); the render layer (renderAgentAction in
// ask-render.js) prefers those when present and falls back to the
// legacy summary builder + raw `reason` text for older rows.
// NOTE: `location_id` is required on every SELECT — useLatestAgentActions
// filters by buildingId via `raw.location_id` (line ~248). Without it
// here, `raw.location_id` would be undefined and every action would be
// filtered out for any building. Realtime payloads carry the full row
// already, so this only affects the historical hydrate path. Bug fixed
// 2026-05-16 (was broken since the buildingId filter was added in
// b7ccb09).
const ACTION_TABLES = [
  {
    agentId: 'hvac',
    kind: 'setpoint_change',
    table: 'agent_setpoint_changes',
    select: 'id, organization_id, location_id, zone, delta_c, reason, reason_code, params, applied_at',
    legacySummary: (r) => `${Number(r.delta_c) >= 0 ? '+' : ''}${Number(r.delta_c).toFixed(1)}°C in ${r.zone}`,
    deltaTone: (r) => (Number(r.delta_c) > 0 ? 'warn' : 'accent'),
  },
  {
    agentId: 'supply',
    kind: 'supply_order',
    table: 'agent_supply_orders',
    select: 'id, organization_id, location_id, sku, qty, vendor, reason, reason_code, params, applied_at',
    legacySummary: (r) => `Reorder ${r.sku}${r.qty ? ` × ${r.qty}` : ''}${r.vendor ? ` · ${r.vendor}` : ''}`,
  },
  {
    agentId: 'space',
    kind: 'booking_release',
    table: 'agent_booking_releases',
    select: 'id, organization_id, location_id, room, host, recovered_minutes, reason, reason_code, params, applied_at',
    legacySummary: (r) => `Released ${r.room}${r.recovered_minutes ? ` · +${r.recovered_minutes}m` : ''}`,
  },
  {
    agentId: 'energy',
    kind: 'setback_proposal',
    table: 'agent_setback_proposals',
    select:
      'id, organization_id, location_id, zone, schedule_window, est_savings_kwh, reason, reason_code, params, applied_at',
    legacySummary: (r) => `Proposed setback · ${r.zone}${r.est_savings_kwh ? ` · ~${r.est_savings_kwh} kWh` : ''}`,
  },
  {
    agentId: 'compliance',
    kind: 'evidence_request',
    table: 'agent_audit_evidence',
    select: 'id, organization_id, location_id, artifact, gap_type, severity, reason, reason_code, params, applied_at',
    legacySummary: (r) => `Queued · ${r.artifact}${r.severity ? ` · ${r.severity}` : ''}`,
  },
  {
    agentId: 'security',
    kind: 'escalation',
    table: 'agent_escalations',
    select:
      'id, organization_id, location_id, location_label, severity, recipient, reason, reason_code, params, applied_at',
    legacySummary: (r) => `Escalated · ${r.location_label}${r.severity ? ` · ${r.severity}` : ''}`,
    deltaTone: (r) => (r.severity === 'critical' ? 'risk' : r.severity === 'high' ? 'warn' : 'accent'),
  },
];

// Cache shape: Map<orgId, Map<agentId, action[]>>.
// We keep an ARRAY of actions per agent (newest first) so the
// per-building filter in useLatestAgentActions can walk the list and
// pick the most recent action whose location_id matches the active
// buildingId. Storing only one action per agent (the previous shape)
// broke multi-building tenants: when the org's single latest action
// happened in a different building than the user's active one, the
// filter correctly dropped it but had no fallback rows to surface.
const ACTIONS_BY_ORG = new Map(); // orgId → Map<agentId, action[]>
const ACTION_HYDRATED = new Set(); // orgIds whose initial select ran
const ACTION_LISTENERS = new Set();
let actionsChannel = null;

const ACTIONS_PER_AGENT_CAP = 50; // covers ~5 buildings × ~10 recent each

function emitActions() {
  ACTION_LISTENERS.forEach((fn) => fn());
}

function composeAction(spec, row) {
  return {
    agentId: spec.agentId,
    kind: spec.kind,
    // Phase 2C: surface the structured payload + a source-language
    // legacy summary. Consumers call renderAgentAction(t, action) to
    // get a localized {summary, reason} pair; the helper prefers
    // params + reason_code and falls back to legacySummary + reason
    // for pre-Phase-2C rows.
    params: row.params || null,
    reason_code: row.reason_code || null,
    legacySummary: spec.legacySummary(row),
    tone: spec.deltaTone ? spec.deltaTone(row) : 'accent',
    applied_at: row.applied_at,
    reason: row.reason || null,
    raw: row,
  };
}

function ingestActionRow(spec, row) {
  const orgId = row.organization_id;
  if (!orgId || !ACTION_HYDRATED.has(orgId)) return;
  let perAgent = ACTIONS_BY_ORG.get(orgId);
  if (!perAgent) {
    perAgent = new Map();
    ACTIONS_BY_ORG.set(orgId, perAgent);
  }
  const list = perAgent.get(spec.agentId) || [];
  // De-dup by row id (realtime can echo a row that was already in the
  // hydrate result if the timing is unlucky).
  if (list.some((x) => x.raw?.id === row.id)) return;
  const action = composeAction(spec, row);
  // Insert in sorted position (newest first), keep cap.
  let inserted = false;
  for (let i = 0; i < list.length; i += 1) {
    if (new Date(action.applied_at) >= new Date(list[i].applied_at)) {
      list.splice(i, 0, action);
      inserted = true;
      break;
    }
  }
  if (!inserted) list.push(action);
  if (list.length > ACTIONS_PER_AGENT_CAP) list.length = ACTIONS_PER_AGENT_CAP;
  perAgent.set(spec.agentId, list);
  emitActions();
}

async function hydrateActionsForOrg(orgId) {
  if (!orgId || ACTION_HYDRATED.has(orgId)) return;
  ACTION_HYDRATED.add(orgId);
  // Fetch the latest N rows per table so per-building filtering has
  // enough fallback rows to find a recent action in EACH building the
  // org operates. limit(1) was the original shape; it broke as soon as
  // an org had more than one building (the single latest row pinned
  // the cache to whichever building got the last action).
  await Promise.all(
    ACTION_TABLES.map(async (spec) => {
      const { data } = await supabase
        .from(spec.table)
        .select(spec.select)
        .eq('organization_id', orgId)
        .order('applied_at', { ascending: false })
        .limit(ACTIONS_PER_AGENT_CAP);
      if (data && data.length) {
        for (const row of data) ingestActionRow(spec, row);
      }
    }),
  );
}

function subscribeActions() {
  if (actionsChannel) return;
  // One channel with one INSERT subscription per table. supabase-js v2
  // does support multiple .on() bindings on a channel as long as they
  // target different tables (the gotcha is two bindings on the *same*
  // table — see memory/supabase_gotchas.md #1).
  let ch = supabase.channel('agent_actions_live');
  for (const spec of ACTION_TABLES) {
    ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: spec.table }, (payload) =>
      ingestActionRow(spec, payload.new),
    );
  }
  actionsChannel = ch.subscribe();
}

if (typeof window !== 'undefined') {
  setTimeout(subscribeActions, 60);
}

export function useLatestAgentActions(orgId, buildingId) {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!orgId) return;
    ACTION_LISTENERS.add(bump);
    hydrateActionsForOrg(orgId);
    return () => {
      ACTION_LISTENERS.delete(bump);
    };
  }, [orgId]);
  if (!orgId) return {};
  const perAgent = ACTIONS_BY_ORG.get(orgId);
  if (!perAgent) return {};
  // Materialize to a plain object keyed by agentId. When buildingId is
  // set, walk the per-agent array (newest first) and pick the most
  // recent action whose location_id matches the active building or its
  // subtree (`mde-fl-1-r-restroom-w` matches `mde`). Pre-fix we cached
  // only one action per agent for the whole org, so when the latest
  // org-wide action lived in a different building, the filter dropped
  // it with no fallback and the UI rendered empty.
  const out = {};
  for (const [agentId, list] of perAgent) {
    if (!Array.isArray(list) || list.length === 0) continue;
    if (!buildingId) {
      out[agentId] = list[0];
      continue;
    }
    const match = list.find((a) => locationInBuilding(a.raw?.location_id, buildingId));
    if (match) out[agentId] = match;
  }
  return out;
}

// Subtree match on the location-id prefix scheme (`hq`, `hq-fl-1`,
// `hq-fl-1-r-restroom`, …). Dash-bounded so `feb` doesn't match `feb2`.
function locationInBuilding(locationId, buildingId) {
  if (!locationId) return false;
  if (locationId === buildingId) return true;
  return locationId.startsWith(buildingId + '-');
}

// Find a single agent_runs row by id within the org's hydrated cache.
// Used by CallRow to surface the agent's confidence + decision_reason
// + model + latency on a CTA so reviewers have context to approve/hold.
// Returns null while hydrating or if the run isn't in this org.
export function useAgentRunById(orgId, runId) {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!orgId) return;
    LISTENERS.add(bump);
    hydrateOrg(orgId);
    return () => {
      LISTENERS.delete(bump);
    };
  }, [orgId]);
  if (!orgId || !runId) return null;
  const runs = RUNS_BY_ORG.get(orgId) || [];
  return runs.find((r) => r.id === runId) || null;
}

// Pending-ask rows grouped by location_id AND by agent_id, scoped to
// a building's subtree.
//
// Why this doesn't reuse the per-org RUNS_BY_ORG cache: that cache
// hydrates only today's rows (.gte created_at, today) because the
// Dashboard "actions today" metric needs that window. Pending asks
// accumulate over days/weeks — at the time of the 3D viewer launch,
// ~99.9% of unresolved asks were older than today, so the cached set
// surfaced ~0 alerting floors. This hook does its own targeted fetch
// (all unresolved asks across all time, for this org) and subscribes
// to a per-mount channel for INSERT (new ask) + UPDATE (resolution).
//
// Module-level optimistic-removal channel. resolvePendingAgentAsk
// adds a runId here the instant a user clicks Approve/Hold on a CTA
// card; every active usePendingAsksByLocation hook drops that runId
// from its local Map without waiting for the realtime UPDATE to
// echo back (which can take 200-500ms over a flaky network and
// makes the button look dead).
const OPTIMISTIC_REMOVED_LISTENERS = new Set();

// Channel topic is suffixed with useId() per the supabase_gotchas
// note — same topic + two subscribers throws "cannot add
// postgres_changes callbacks". useId is stable across renders within
// a single mount, so resubscribe doesn't fight itself.
//
// Returned shape: Map<locationId, Map<agentId, Row[]>> where
// Row = { id, agent_id, location_id, decision_reason, created_at }.
// The viewer counts pills via rows.length and renders an alerts
// list when a pill is clicked; both reads come off the same array.
export function usePendingAsksByLocation(orgId, buildingId, options = {}) {
  // Note: TODAY filtering is INTENTIONALLY done in the viewer, not
  // the hook. If we narrow the SELECT to today's rows, the agent
  // filter buttons + the floor-pill computation all see a tiny
  // dataset and the agent buttons disappear when there's no today
  // activity. Keeping all-time data here means the buttons stay
  // stable and only the per-pill counts react to the toggle.
  const { livePaused = false } = options;
  const channelId = useId();
  const [byLocation, setByLocation] = useState(() => new Map());
  // Stable refs the realtime handler reads — avoids resubscribing
  // every time the toggle flips (which would trigger a full refetch +
  // resubscribe loop). The initial-fetch effect below DOES depend on
  // nowFilter (filter change → refetch); livePaused only gates the
  // realtime payload handler.
  const livePausedRef = useRef(livePaused);
  livePausedRef.current = livePaused;

  // Listen for optimistic removals from resolvePendingAgentAsk. When
  // the user clicks Approve/Hold, the helper emits the runId here and
  // we drop it from byLocation immediately — no waiting for the
  // realtime UPDATE round-trip.
  useEffect(() => {
    const onRemove = (runId) => {
      setByLocation((prev) => {
        const m = new Map();
        let changed = false;
        for (const [locKey, inner] of prev) {
          const newInner = new Map();
          let innerChanged = false;
          for (const [agent, rows] of inner) {
            const filtered = rows.filter((r) => r.id !== runId);
            if (filtered.length !== rows.length) innerChanged = true;
            if (filtered.length > 0) newInner.set(agent, filtered);
          }
          if (innerChanged) changed = true;
          if (newInner.size > 0) m.set(locKey, newInner);
        }
        return changed ? m : prev;
      });
    };
    OPTIMISTIC_REMOVED_LISTENERS.add(onRemove);
    return () => {
      OPTIMISTIC_REMOVED_LISTENERS.delete(onRemove);
    };
  }, []);

  useEffect(() => {
    if (!orgId || !buildingId) {
      setByLocation(new Map());
      return undefined;
    }
    let alive = true;

    // Initial hydrate. Filter by decision + null resolution so the
    // payload is just unresolved asks. PR #643: scope to the building
    // at the DB level (dash-bounded prefix on location_id) so we don't
    // get truncated by sibling buildings filling the 1000-row cap.
    // Use fetchAllPaginated so even buildings with >1000 pending asks
    // come back complete (Meridian HQ has ~1,835).
    (async () => {
      let data;
      try {
        data = await fetchAllPaginated(() =>
          supabase
            .from('agent_runs')
            .select('id, location_id, agent_id, decision, ask_resolution, decision_reason, created_at')
            .eq('organization_id', orgId)
            .eq('decision', 'ask')
            .is('ask_resolution', null)
            .not('location_id', 'is', null)
            .or(buildingScopeOr(buildingId))
            .order('created_at', { ascending: false }),
        );
      } catch (e) {
        captureException(e, { where: 'agent-runs:hydrate' });
        data = [];
      }
      if (!alive) return;
      const m = new Map();
      for (const r of data || []) {
        // DB-side OR already scoped to this building, but defensive
        // client-side check stays in case future filters relax.
        if (!locationInBuilding(r.location_id, buildingId)) continue;
        const agentId = r.agent_id || 'unknown';
        let inner = m.get(r.location_id);
        if (!inner) {
          inner = new Map();
          m.set(r.location_id, inner);
        }
        const arr = inner.get(agentId) || [];
        arr.push({
          id: r.id,
          agent_id: agentId,
          location_id: r.location_id,
          decision_reason: r.decision_reason || null,
          created_at: r.created_at,
        });
        inner.set(agentId, arr);
      }
      setByLocation(m);
    })();

    // Realtime. event:'*' so a single binding catches both INSERT
    // (new pending ask) and UPDATE (resolution flips ask_resolution
    // from null to set). The chained-on-drops-handlers gotcha only
    // applies when two .on()s target the same table on the same
    // channel; we have one binding per channel.
    const ch = supabase
      .channel(`hyper3d_pending_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, (payload) => {
        // LIVE pause: short-circuit before any state mutation.
        // The channel stays subscribed (so unpause resumes
        // instantly), we just drop incoming payloads.
        if (livePausedRef.current) return;
        const row = payload.new || payload.old;
        if (!row || row.organization_id !== orgId) return;
        if (!locationInBuilding(row.location_id, buildingId)) return;
        setByLocation((prev) => {
          const m = new Map(prev);
          const locId = row.location_id;
          const agentId = row.agent_id || 'unknown';
          // Helper: add a row to the per-agent inner array.
          const pushRow = (locKey, agent, r) => {
            let inner = m.get(locKey);
            if (!inner) {
              inner = new Map();
              m.set(locKey, inner);
            }
            const arr = (inner.get(agent) || []).slice();
            if (!arr.some((x) => x.id === r.id)) arr.unshift(r);
            inner.set(agent, arr);
          };
          // Helper: remove a row by id from the per-agent array.
          const removeRowById = (locKey, agent, id) => {
            const inner = m.get(locKey);
            if (!inner) return;
            const arr = (inner.get(agent) || []).filter((x) => x.id !== id);
            if (arr.length === 0) {
              inner.delete(agent);
              if (inner.size === 0) m.delete(locKey);
            } else {
              inner.set(agent, arr);
            }
          };
          const newRow = payload.new && {
            id: payload.new.id,
            agent_id: agentId,
            location_id: payload.new.location_id,
            decision_reason: payload.new.decision_reason || null,
            created_at: payload.new.created_at,
          };
          if (payload.eventType === 'INSERT') {
            if (payload.new.decision === 'ask' && !payload.new.ask_resolution && newRow) {
              pushRow(locId, agentId, newRow);
            }
          } else if (payload.eventType === 'UPDATE') {
            // CRITICAL: payload.old only carries the primary key
            // unless REPLICA IDENTITY FULL is set on agent_runs
            // (it isn't). So `payload.old.ask_resolution` is
            // always undefined and the old wasPending check was
            // dead code. Drive purely off payload.new instead —
            // idempotent add/remove based on current row state.
            const isPending = !payload.new?.ask_resolution && payload.new?.decision === 'ask';
            if (!isPending && payload.new?.id) {
              removeRowById(locId, agentId, payload.new.id);
            } else if (isPending && newRow) {
              pushRow(locId, agentId, newRow);
            }
          } else if (payload.eventType === 'DELETE') {
            // Same REPLICA IDENTITY caveat — payload.old only has
            // the primary key. Remove by id unconditionally.
            if (payload.old?.id) removeRowById(locId, agentId, payload.old.id);
          }
          return m;
        });
      })
      .subscribe();

    return () => {
      alive = false;
      try {
        supabase.removeChannel(ch);
      } catch {
        /* noop */
      }
    };
  }, [orgId, buildingId, channelId]);

  return byLocation;
}

// All agent_runs for a building's subtree — pending AND resolved.
// Sibling of usePendingAsksByLocation; that one filters to unresolved
// asks for the pills/flash, this one feeds the Activity panel where
// the operator wants to see the full event timeline (All / CTAs /
// Open / Resolved tabs).
//
// `enabled` short-circuits the hook when the Activity panel is
// closed — we don't want to pay for a second realtime channel +
// 1000-row hydrate when the operator isn't looking at the feed.
export function useAllAsksByLocation(orgId, buildingId, enabled = false) {
  const channelId = useId();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!enabled || !orgId || !buildingId) {
      setRows([]);
      return undefined;
    }
    let alive = true;

    (async () => {
      // PR #643: scope to the building at the DB level + paginate.
      // The old code did `.limit(1000)` then client-filtered by
      // buildingId — for orgs with sibling buildings (Meridian HQ
      // alongside MDE + MHC), the 1000-slot quota filled with sibling
      // rows and starved HQ's history, leading to "CTAs 52" when the
      // pills said ~315.
      let data;
      try {
        data = await fetchAllPaginated(() =>
          supabase
            .from('agent_runs')
            .select(
              'id, location_id, agent_id, decision, ask_resolution, ask_resolved_at, decision_reason, created_at, created_ask_id',
            )
            .eq('organization_id', orgId)
            .not('location_id', 'is', null)
            .or(buildingScopeOr(buildingId))
            .order('created_at', { ascending: false }),
        );
      } catch (e) {
        captureException(e, { where: 'agent-runs:hydrate' });
        data = [];
      }
      if (!alive) return;
      const list = [];
      for (const r of data || []) {
        if (!locationInBuilding(r.location_id, buildingId)) continue;
        list.push({
          id: r.id,
          agent_id: r.agent_id || 'unknown',
          location_id: r.location_id,
          decision: r.decision || null,
          decision_reason: r.decision_reason || null,
          ask_resolution: r.ask_resolution || null,
          ask_resolved_at: r.ask_resolved_at || null,
          created_at: r.created_at,
          created_ask_id: r.created_ask_id || null,
        });
      }
      setRows(list);
    })();

    // Realtime — wide net (event: '*' on agent_runs for this org).
    const ch = supabase
      .channel(`hyper3d_activity_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.organization_id !== orgId) return;
        if (!locationInBuilding(row.location_id, buildingId)) return;
        setRows((prev) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const r = payload.new;
            const next = prev.slice();
            if (!next.some((x) => x.id === r.id)) {
              next.unshift({
                id: r.id,
                agent_id: r.agent_id || 'unknown',
                location_id: r.location_id,
                decision: r.decision || null,
                decision_reason: r.decision_reason || null,
                ask_resolution: r.ask_resolution || null,
                ask_resolved_at: r.ask_resolved_at || null,
                created_at: r.created_at,
                created_ask_id: r.created_ask_id || null,
              });
            }
            return next.slice(0, 1000);
          }
          if (payload.eventType === 'UPDATE' && payload.new) {
            const r = payload.new;
            return prev.map((x) =>
              x.id === r.id
                ? {
                    ...x,
                    decision: r.decision || x.decision,
                    decision_reason: r.decision_reason || x.decision_reason,
                    ask_resolution: r.ask_resolution || null,
                    ask_resolved_at: r.ask_resolved_at || null,
                  }
                : x,
            );
          }
          if (payload.eventType === 'DELETE' && payload.old) {
            return prev.filter((x) => x.id !== payload.old.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      alive = false;
      try {
        supabase.removeChannel(ch);
      } catch {
        /* noop */
      }
    };
  }, [orgId, buildingId, channelId, enabled]);

  return rows;
}

// Recent asset-tracking agent runs INCLUDING skips, for a building's
// subtree — the data source for the Hypervisor ASSETS tab. The other
// surfaces are actionable-item oriented: useLiveAgentRuns drops skips, and
// the events-based Merlin path never sees them (a skip decision emits no
// event). But the ASSETS view's whole job is to show coverage — the floors
// the asset-tracking agent is actively monitoring and finding "all assets
// within geofence" (skip) — not just breaches. So this hook reads agent_runs
// directly with no decision filter, scoped + paginated like
// useAllAsksByLocation. Tab-gated via `enabled` so it never fetches unless
// the ASSETS tab is open. Returns AlertRow-shaped rows the 3D viewer's
// per-floor popup already knows how to render.
export function useAssetTrackingRuns(orgId, buildingId, enabled = false, sinceMinutes = 24 * 60) {
  const channelId = useId();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!enabled || !orgId || !buildingId) {
      setRows([]);
      return undefined;
    }
    let alive = true;
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();

    (async () => {
      let data;
      try {
        data = await fetchAllPaginated(() =>
          supabase
            .from('agent_runs')
            .select('id, location_id, agent_id, decision, decision_reason, confidence, created_at, ask_resolution')
            .eq('organization_id', orgId)
            .eq('agent_id', 'asset-tracking')
            .not('location_id', 'is', null)
            .gte('created_at', since)
            .or(buildingScopeOr(buildingId))
            .order('created_at', { ascending: false }),
        );
      } catch (e) {
        captureException(e, { where: 'agent-runs:hydrate' });
        data = [];
      }
      if (!alive) return;
      const list = [];
      for (const r of data || []) {
        if (!locationInBuilding(r.location_id, buildingId)) continue;
        list.push({
          id: r.id,
          agent_id: r.agent_id || 'asset-tracking',
          location_id: r.location_id,
          decision: r.decision || null,
          decision_reason: r.decision_reason || null,
          confidence: r.confidence ?? null,
          created_at: r.created_at,
          ask_resolution: r.ask_resolution || null,
        });
      }
      setRows(list);
    })();

    const ch = supabase
      .channel(`hyper3d_assets_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.organization_id !== orgId) return;
        // INSERT/UPDATE carry agent_id; DELETE's payload.old is PK-only
        // (REPLICA IDENTITY default) so we can't confirm the agent — let
        // those through and dedupe/remove by id below.
        if (payload.new && payload.new.agent_id !== 'asset-tracking') return;
        if (!locationInBuilding(row.location_id, buildingId)) return;
        setRows((prev) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const r = payload.new;
            if (prev.some((x) => x.id === r.id)) return prev;
            return [
              {
                id: r.id,
                agent_id: r.agent_id,
                location_id: r.location_id,
                decision: r.decision || null,
                decision_reason: r.decision_reason || null,
                confidence: r.confidence ?? null,
                created_at: r.created_at,
                ask_resolution: r.ask_resolution || null,
              },
              ...prev,
            ].slice(0, 1000);
          }
          if (payload.eventType === 'UPDATE' && payload.new) {
            const r = payload.new;
            return prev.map((x) =>
              x.id === r.id
                ? {
                    ...x,
                    decision: r.decision || x.decision,
                    decision_reason: r.decision_reason || x.decision_reason,
                    ask_resolution: r.ask_resolution || null,
                  }
                : x,
            );
          }
          if (payload.eventType === 'DELETE' && payload.old) {
            return prev.filter((x) => x.id !== payload.old.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      alive = false;
      try {
        supabase.removeChannel(ch);
      } catch {
        /* noop */
      }
    };
  }, [orgId, buildingId, channelId, enabled, sinceMinutes]);

  return rows;
}

export function useAgentRuntimeStats(orgId) {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!orgId) return;
    LISTENERS.add(bump);
    hydrateOrg(orgId);
    return () => {
      LISTENERS.delete(bump);
    };
  }, [orgId]);

  const runs = (orgId && RUNS_BY_ORG.get(orgId)) || [];
  const byAgent = {};
  for (const r of runs) {
    if (!byAgent[r.agent_id]) byAgent[r.agent_id] = { lastRun: null, actionsToday: 0, pendingAsks: 0, runs: [] };
    const s = byAgent[r.agent_id];
    if (!s.lastRun) s.lastRun = r; // runs are already desc-sorted
    // "Action today" means an outcome that landed downstream — either
    // (a) the agent decided 'act' and its applier wrote a row, or
    // (b) the agent decided 'ask' and a human later approved it,
    // which goes through /api/agents/apply-ask and writes the same
    // downstream row (just with a human in the loop). Without (b),
    // "approve-critical" / "propose" autonomy modes always read 0
    // even though approved asks ARE landing actions.
    if (r.decision === 'act' || r.ask_resolution === 'approved') s.actionsToday += 1;
    // Pending asks: agent proposed an action today and a human hasn't
    // resolved it yet. Used by the UI to distinguish "agent is alive
    // but awaiting review" from "agent did nothing", since both would
    // otherwise read as a flat 0 in the actions count.
    if (r.decision === 'ask' && !r.ask_resolution) s.pendingAsks += 1;
    s.runs.push(r);
  }
  return byAgent;
}

// Recently-resolved asks for the My Day "Merlin handled these" card.
//
// useLatestAgentActions already covers actions the agent successfully
// applied to a per-agent table (route_overrides, agent_setpoint_changes,
// etc). But many My Day CTAs come from simulator/heartbeat agent_runs
// rows that DON'T carry an action_payload — apply-ask is a no-op for
// those, so nothing lands in the action tables, so the handled card
// stays stale even after the user clicks Approve.
//
// This hook fills the gap by reading recently-resolved agent_runs
// directly (rows where decision='ask' AND ask_resolution is set).
// Output shape mirrors useLatestAgentActions so the Briefing
// HandledSection can merge both streams and sort by timestamp.
export function useRecentResolvedAgentRuns(orgId, buildingId, limit = 10) {
  const channelId = useId();
  const [rows, setRows] = useState([]);
  // `loaded` flag — same pattern as useEventsForBuilding (PR #773).
  // Attached as a non-enumerable property on the returned array so
  // Briefing can gate its loader until both this hook and
  // useLatestAgentActions have hydrated. Without it, the "handled"
  // card flashes one source, then the merge re-sorts visibly.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orgId || !buildingId) {
      setRows([]);
      setLoaded(true);
      return undefined;
    }
    setLoaded(false);
    let alive = true;

    (async () => {
      let data;
      try {
        data = await fetchAllPaginated(() =>
          supabase
            // rls-scope-ok: scoped by .eq('organization_id', orgId) below (the comment block separates the call from the filter, so the lint can't see it)
            .from('agent_runs')
            // ask_resolution='approve' only — Hold and Dismiss aren't
            // meaningful "Merlin handled this" content. Dismiss in
            // particular includes nightly cron-sweep cleanup (PR #774),
            // which would otherwise dominate the card with stale-ask
            // noise on multi-building demo tenants.
            .select('id, location_id, agent_id, decision, decision_reason, ask_resolution, ask_resolved_at, created_at')
            .eq('organization_id', orgId)
            .eq('decision', 'ask')
            .eq('ask_resolution', 'approve')
            .not('ask_resolved_at', 'is', null)
            .or(buildingScopeOr(buildingId))
            .order('ask_resolved_at', { ascending: false })
            .limit(limit),
        );
      } catch (e) {
        captureException(e, { where: 'agent-runs:hydrate' });
        data = [];
      }
      if (!alive) return;
      const out = (data || [])
        .filter((r) => locationInBuilding(r.location_id, buildingId))
        .slice(0, limit)
        .map(toResolvedActionShape);
      setRows(out);
      setLoaded(true);
    })();

    // Realtime — listen for UPDATE events that flip ask_resolution.
    const ch = supabase
      .channel(`recent_resolved_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.organization_id !== orgId) return;
        if (!locationInBuilding(row.location_id, buildingId)) return;
        // Only care about newly-approved asks (UPDATE with
        // ask_resolution='approve' + decision='ask'). Hold/dismiss
        // don't belong in the "Merlin handled these" card.
        if (payload.eventType !== 'UPDATE' || !payload.new) return;
        if (payload.new.decision !== 'ask' || payload.new.ask_resolution !== 'approve') return;
        setRows((prev) => {
          const filtered = prev.filter((r) => r.runId !== payload.new.id);
          return [toResolvedActionShape(payload.new), ...filtered].slice(0, limit);
        });
      })
      .subscribe();

    return () => {
      alive = false;
      try {
        supabase.removeChannel(ch);
      } catch {
        /* noop */
      }
    };
  }, [orgId, buildingId, channelId, limit]);

  // Attach `loaded` as a non-enumerable property so existing callers
  // that iterate the array (Briefing.handledItems merge) see no shape
  // change; the loader gate reads `.loaded`. useMemo so the array
  // identity is stable when neither rows nor loaded changed.
  return useMemo(() => {
    const arr = rows.slice();
    Object.defineProperty(arr, 'loaded', { value: loaded, enumerable: false });
    return arr;
  }, [rows, loaded]);
}

// Map a resolved agent_runs row into the same shape Briefing's
// HandledSection expects from useLatestAgentActions. The card reads
// agentId / kind / legacySummary / applied_at / reason / tone.
//
// Resolved-ask rows don't carry the structured agent-action `kind`
// (route_override, setpoint_change, etc) — that lives on the per-
// agent action tables which useLatestAgentActions reads. Here all we
// have is decision_reason, so we render a clean two-line layout:
//   title:    "Approved · Energy"          (verb + agent display name)
//   subtitle: "{when} · {decision_reason}" (full reasoning)
// instead of repeating the truncated reason in both lines.
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
  // sister-agent stadium kinds
  'crowd-flow': 'Crowd Flow',
  'concession-demand': 'Concession Demand',
  'incident-choreography': 'Incident Choreography',
};

function toResolvedActionShape(r) {
  const kindByResolution = {
    approve: 'approved',
    hold: 'on_hold',
    dismiss: 'dismissed',
    expired: 'expired',
  };
  const verb =
    r.ask_resolution === 'approve'
      ? 'Approved'
      : r.ask_resolution === 'hold'
        ? 'Held'
        : r.ask_resolution === 'dismiss'
          ? 'Dismissed'
          : 'Resolved';
  const agentLabel = AGENT_DISPLAY_NAME[r.agent_id] || (r.agent_id ? r.agent_id.replace(/-/g, ' ') : 'agent');
  return {
    runId: r.id,
    agentId: r.agent_id || 'unknown',
    kind: kindByResolution[r.ask_resolution] || 'resolved',
    params: null,
    reason_code: null,
    legacySummary: `${verb} · ${agentLabel}`,
    tone:
      r.ask_resolution === 'approve'
        ? 'accent'
        : r.ask_resolution === 'hold'
          ? 'warn'
          : r.ask_resolution === 'dismiss'
            ? 'info'
            : 'info',
    applied_at: r.ask_resolved_at || r.created_at,
    reason: r.decision_reason || null,
    raw: r,
  };
}
