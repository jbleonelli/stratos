// React hooks over the public.events table. Phase 3 of
// docs/architecture/events-pipeline.md: surfaces switch from merging
// agent_runs + merlin_asks + simulator incidents to reading events.
//
// Shape returned by useEventsForBuilding:
//   Array<{
//     id, organization_id, location_id,
//     source_kind, source_ref, kind, severity, payload, external_id,
//     processed_by_agent_id, processed_at, agent_run_id,
//     resolved, resolved_at, resolved_reason,
//     created_at,
//     // joined from agent_runs (null when no agent has touched it yet)
//     decision, decision_reason, confidence, ask_resolution,
//   }>
//
// All-time fetch, not just today — pending events accumulate over days
// the same way pending agent_runs asks did. Realtime: subscribes to
// public.events INSERT + UPDATE.

import { useEffect, useId, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { fetchAllPaginated } from './pagination.js';
import { captureException } from './sentry.js';

// Background reconcile interval. Realtime is the primary update path, but it can
// miss events (reconnects, REPLICA-IDENTITY quirks). A periodic refetch keeps
// long-lived consumers — notably the persistent chat overlay's "N decisions
// waiting" — converged to the DB truth instead of drifting from a freshly
// mounted view (the Activity page), which is what made the two disagree.
const EVENTS_RECONCILE_MS = 30000;

// Dash-bounded prefix match — same scoping helper applied to
// usePendingAsksByLocation. 'hq' matches 'hq', 'hq-fl-32', 'hq-fl-32-r-restroom-w'.
function buildingScopeOr(buildingId) {
  return `location_id.eq.${buildingId},location_id.like.${buildingId}-%`;
}
function locationInBuilding(locationId, buildingId) {
  if (!locationId) return false;
  if (locationId === buildingId) return true;
  return locationId.startsWith(buildingId + '-');
}

// Embed-syntax for the join. agent_run_id → agent_runs is the FK
// installed by migration 165. PostgREST resolves it automatically.
const EVENT_SELECT = `
  id, organization_id, location_id,
  source_kind, source_ref, kind, severity, payload, external_id,
  processed_by_agent_id, processed_at, agent_run_id,
  resolved, resolved_at, resolved_reason,
  created_at,
  agent_runs!agent_run_id ( decision, decision_reason, confidence, ask_resolution, ask_resolved_at, action_type, action_payload )
`;

// Flatten the nested agent_runs object into the top-level event row
// so consumers don't have to remember the embed shape.
function flatten(row) {
  if (!row) return row;
  const r = row.agent_runs || null;
  return {
    ...row,
    decision: r?.decision || null,
    decision_reason: row.payload?.decision_reason ?? r?.decision_reason ?? null,
    confidence: row.payload?.confidence ?? r?.confidence ?? null,
    ask_resolution: r?.ask_resolution || null,
    ask_resolved_at: r?.ask_resolved_at || null,
    action_type: r?.action_type || null,
    action_payload: r?.action_payload || null,
    agent_runs: undefined,
  };
}

/**
 * Read events for a building.
 *
 * @param {string} orgId
 * @param {string} buildingId
 * @param {object} options
 * @param {boolean} [options.includeResolved=false]   include resolved=true rows
 * @param {string}  [options.processingState]         'pending' | 'agent_acted' | 'awaiting_human' | undefined (all)
 * @param {number}  [options.limit=200]               cap on rows
 */
export function useEventsForBuilding(orgId, buildingId, options = {}) {
  const { includeResolved = false, processingState, limit = 200 } = options;
  const channelId = useId();
  const [rows, setRows] = useState([]);
  // Loaded = "initial fetch completed (success or empty)". Surfaces
  // who-knows-what to consumers that want to show a loader before the
  // first hydrate vs an empty-state after it. Resets every time the
  // (orgId, buildingId, options) key changes so a building switch
  // shows the loader again. Exposed as a property on the returned
  // array — most callers iterate the rows and ignore .loaded; the
  // Activity page checks it to gate its AdaptivLoader.
  const [loaded, setLoaded] = useState(false);

  // Memoise the option-derived strings so the effect doesn't refetch
  // on every render just because the options object identity changed.
  const optKey = `${!!includeResolved}|${processingState || ''}|${limit}`;

  useEffect(() => {
    if (!orgId || !buildingId) {
      setRows([]);
      // No fetch to run, so this counts as "loaded" (nothing to wait for).
      setLoaded(true);
      return undefined;
    }
    setLoaded(false);
    let alive = true;

    const load = async () => {
      let q = supabase
        .from('events')
        .select(EVENT_SELECT)
        .eq('organization_id', orgId)
        .or(buildingScopeOr(buildingId))
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!includeResolved) q = q.eq('resolved', false);
      if (processingState === 'pending') q = q.is('processed_at', null);
      if (processingState === 'agent_acted') q = q.not('processed_at', 'is', null);
      // 'awaiting_human' requires the join — filter client-side after fetch.

      // Honour `limit` as a real cap. fetchAllPaginated ignores the
      // PostgREST .limit() (it overrides with .range() per page), so
      // a 200-row Activity feed was silently returning all ~1855 rows
      // on Meridian after the migration-168 backfill. For small limits
      // we use a single fetch with .limit() so the page actually
      // honours it; for large limits we paginate but cap the result.
      // null = the fetch FAILED (vs [] = succeeded-but-empty). On failure we keep
      // the rows we already have rather than blanking the feed — the 30s reconcile
      // would otherwise wipe Activity/chat on every transient error.
      let data = null;
      try {
        if (limit <= 1000) {
          const { data: rows1, error } = await q;
          if (!error) data = rows1 || [];
        } else {
          data = await fetchAllPaginated(() => q);
          if (data && data.length > limit) data = data.slice(0, limit);
        }
      } catch (e) {
        captureException(e, { where: 'events:useEventsForBuilding' });
        data = null;
      }
      if (!alive) return;
      if (data === null) {
        setLoaded(true);
        return;
      }
      let flat = data.filter((r) => locationInBuilding(r.location_id, buildingId)).map(flatten);
      if (processingState === 'awaiting_human') {
        flat = flat.filter((r) => r.decision === 'ask' && !r.ask_resolution);
      }
      setRows(flat);
      setLoaded(true);
    };

    load();
    // Reconcile periodically so a missed realtime event can't leave a long-lived
    // consumer (the chat overlay) stuck on a stale ask count.
    const pollId = setInterval(load, EVENTS_RECONCILE_MS);

    // Per-mount channel topic (suffixed with useId per
    // supabase_gotchas note — same topic + two subscribers throws).
    const ch = supabase
      .channel(`events_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.organization_id !== orgId) return;
        if (!locationInBuilding(row.location_id, buildingId)) return;

        if (payload.eventType === 'DELETE') {
          setRows((prev) => prev.filter((r) => r.id !== row.id));
          return;
        }
        // INSERT or UPDATE — refetch the affected row with its join.
        (async () => {
          const { data } = await supabase.from('events').select(EVENT_SELECT).eq('id', row.id).maybeSingle();
          if (!data) return;
          const f = flatten(data);
          // Apply filter rules at the listener level too.
          if (!includeResolved && f.resolved) {
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          if (processingState === 'pending' && f.processed_at) {
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          if (processingState === 'awaiting_human' && !(f.decision === 'ask' && !f.ask_resolution)) {
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          setRows((prev) => {
            const filtered = prev.filter((r) => r.id !== row.id);
            return [f, ...filtered].slice(0, limit);
          });
        })();
      })
      .subscribe();

    return () => {
      alive = false;
      clearInterval(pollId);
      try {
        supabase.removeChannel(ch);
      } catch {
        /* noop */
      }
    };
  }, [orgId, buildingId, channelId, optKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach `loaded` as a non-enumerable property so existing callers
  // that iterate the array (Hypervisor, Briefing, useMerlinAsks adapter)
  // see no change in shape; Activity reads `events.loaded` to gate
  // its loading state. useMemo so the array identity is stable across
  // re-renders when neither rows nor loaded changed.
  return useMemo(() => {
    const arr = rows.slice();
    Object.defineProperty(arr, 'loaded', { value: loaded, enumerable: false });
    return arr;
  }, [rows, loaded]);
}

// Coarse severity buckets for the cockpit incident summary. Mirrors the SEV
// map in KpiCockpit (which owns the colours + labels); kept here so the
// counting lives next to the query.
const INCIDENT_SEV = {
  critical: ['critical'],
  major: ['high', 'major'],
  minor: ['medium', 'moderate', 'minor', 'warning'],
  low: ['low', 'info', 'informational'],
};
function incidentBucket(sev) {
  const s = String(sev || '').toLowerCase();
  for (const k of ['critical', 'major', 'minor', 'low']) {
    if (INCIDENT_SEV[k].includes(s)) return k;
  }
  return 'low';
}

/**
 * Org-wide incident summary for the FM KPI cockpit.
 *
 * Deliberately NOT building-location scoped, unlike useEventsForBuilding. The
 * per-building prefix filter (`location_id = 'hq' OR 'hq-%'`) silently drops
 * the ~46% of agent events that carry a NULL location_id — exactly the org-
 * level incidents (energy / space / compliance / security) an FM cares about —
 * which left the cockpit's "Incident summary" reading 0. This counts the whole
 * org's OPEN incidents by severity (the actionable load) plus a 48h closed
 * count for context, matching the cockpit's other org-wide KPIs (devices,
 * overdue items). Fetch-on-mount; the cockpit shows an "Updated HH:MM" stamp.
 *
 * @param {string|null} orgId
 * @returns {{ total:number, open:number, closed:number,
 *             counts:{critical:number,major:number,minor:number,low:number},
 *             loaded:boolean }}
 */
export function useOrgIncidentSummary(orgId) {
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    counts: { critical: 0, major: 0, minor: 0, low: 0 },
    loaded: false,
  });

  useEffect(() => {
    if (!orgId) {
      setSummary({ total: 0, open: 0, closed: 0, counts: { critical: 0, major: 0, minor: 0, low: 0 }, loaded: true });
      return undefined;
    }
    let alive = true;
    setSummary((s) => ({ ...s, loaded: false }));
    (async () => {
      try {
        // Open (unresolved) incidents — only the severity column. Paginated to
        // dodge PostgREST's 1000-row cap even though open counts run small.
        const openRows = await fetchAllPaginated(() =>
          supabase.from('events').select('severity').eq('organization_id', orgId).eq('resolved', false),
        );
        // Closed in the last 48h — a head count only, for the "closed" pill.
        const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        const { count: closed } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('resolved', true)
          .gte('created_at', since);
        if (!alive) return;
        const counts = { critical: 0, major: 0, minor: 0, low: 0 };
        for (const r of openRows || []) counts[incidentBucket(r.severity)] += 1;
        const open = (openRows || []).length;
        setSummary({ total: open, open, closed: closed || 0, counts, loaded: true });
      } catch {
        if (alive)
          setSummary({
            total: 0,
            open: 0,
            closed: 0,
            counts: { critical: 0, major: 0, minor: 0, low: 0 },
            loaded: true,
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgId]);

  return summary;
}

// Resolve an event from a human action (Approve / Hold / Dismiss).
// When the event has a backing agent_run with decision='ask', this
// also writes ask_resolution back to agent_runs so the existing
// resolvedAgentRuns hook picks it up.
export async function resolveEvent(eventId, resolution) {
  if (!eventId) return;
  // Optimistic: caller can drop the row from its local map after this
  // returns. Realtime UPDATE will confirm.
  const { data: evt } = await supabase.from('events').select('id, agent_run_id').eq('id', eventId).maybeSingle();

  if (evt?.agent_run_id) {
    await supabase
      .from('agent_runs')
      .update({
        ask_resolution: resolution,
        ask_resolved_at: new Date().toISOString(),
      })
      .eq('id', evt.agent_run_id);
  }

  const reason =
    resolution === 'approve'
      ? 'agent_acted'
      : resolution === 'hold' || resolution === 'dismiss'
        ? 'human_dismissed'
        : 'human_dismissed';

  await supabase
    .from('events')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_reason: reason,
    })
    .eq('id', eventId);
}
