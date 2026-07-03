// Realtime firehose of every raw event landing in the workspace
// (Track K-25 / K-26 / K-28 / L-2.5).
//
// Vocabulary: an EVENT is the raw thing landing here — simulator
// output, a human action on something, occupant button presses on
// Adaptiv devices, cleaner badge taps. Once an agent picks an event
// up and reasons about it, the agent may turn it into an INCIDENT
// (something with a status, SLA, assignee). This module is firmly on
// the event side; each row carries a derived `source` field so the
// UI can render a small kind pill alongside the title.
//
// Two tables fan in:
//   - public.incident_actions  — pre-existing event spine. Carries
//     simulator seed signal (K-6) + human approve/hold/dismiss
//     actions. Naming asymmetry (table name says "incident") is
//     historical and not worth a migration.
//   - public.device_events     — Adaptiv smart-display events
//     (L-2.1). Ratings, request presses, cleaner badge taps,
//     server-derived request_resolved, heartbeats.
//
// Merged into a single newest-first buffer; both rows normalize to
// the same shape so the FirehosePanel grid renders uniformly.
//
// Module-scope subscription matches the agent_runs / merlin_asks
// pattern (see memory/supabase_gotchas.md #3). Buffers are keyed by
// organization_id so the Firehose only ever shows rows for the
// active workspace — super admins switching between Meridian HQ /
// FEB / FEB2 see each org's stream isolated, even though their RLS
// would otherwise let them read everything.

import { useEffect, useReducer } from 'react';
import { supabase } from './supabase.js';
import { describeDeviceEvent } from './device-events.js';
import { fetchAllPaginated } from './pagination.js';
import { registerAuthAwareCache } from './use-auth-aware-cache.js';

const MAX_BUFFER = 200;
const BUFFER_BY_ORG = new Map(); // orgId → rows[] (newest first)
const TODAY_COUNT_BY_ORG = new Map(); // orgId → integer
let todayCountStartMs = 0; // ms timestamp of "today's midnight" — used to detect rollover.
const LISTENERS = new Set();
const ORG_NAME_BY_ID = new Map();
const DEVICE_EXT_BY_ID = new Map();
const CREW_BY_BADGE = new Map();

const hydratedOrgs = new Set();
const hydratingPromises = new Map();
let subscribedChannel = null;

function emit() {
  LISTENERS.forEach((fn) => fn());
}

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Classify each event row into a small set of sources for the
// firehose's source-column pill. Mapping leans on actor + action
// shape for incident_actions, and on event_type for device_events:
//
//   Simulator — seed-signal output (actor_name='simulator')
//   Operator  — a real person did the action (incident_actions:
//               actor_id is set; device_events: cleaner badge taps,
//               since a cleaner is a human even though the NFC
//               reader sensed the tap)
//   Sensor    — hardware-sensed signal (device_events: occupant
//               button presses, ratings — the device IS sensing
//               occupant input)
//   System    — auto-handled by Merlin / no-actor / server-derived
//               (device_events: request_resolved, heartbeat)
function classifySource(r) {
  // Incident-action rows (legacy spine).
  if (r.kind === 'incident_action' || !r.kind) {
    if (r.actor_name === 'simulator') return 'Simulator';
    if (r.actor_id) return 'Operator';
    if (r.actor_role === 'sensor') return 'Sensor';
    return 'System';
  }
  // Device-event rows.
  switch (r.event_type) {
    case 'rating':
    case 'request_pressed':
    case 'count_threshold':
    case 'count_report':
      return 'Sensor';
    case 'cleaner_check_in':
    case 'cleaner_check_out':
    case 'service_started':
    case 'service_completed':
      return 'Operator';
    case 'request_resolved':
    case 'heartbeat':
    default:
      return 'System';
  }
}

export const SOURCE_TONES = {
  Simulator: 'info',
  Operator: 'accent',
  Sensor: 'warn',
  System: 'off',
};

function fromIncidentRow(r) {
  return {
    id: r.id,
    kind: 'incident_action',
    event_id: r.incident_id, // synonym alias for the new vocab
    title: r.incident_title, // event title in the UI
    priority: r.incident_priority,
    action: r.action,
    actor_name: r.actor_name,
    actor_role: r.actor_role,
    actor_id: r.actor_id,
    location_id: r.location_id,
    organization_id: r.organization_id,
    organization_name: ORG_NAME_BY_ID.get(r.organization_id) || null,
    source: classifySource({ ...r, kind: 'incident_action' }),
    created_at: r.created_at,
    device_external_id: null,
  };
}

function fromDeviceEventRow(r) {
  const ext = DEVICE_EXT_BY_ID.get(r.device_id) || null;
  // CREW_BY_BADGE is keyed by `${org}:${badge}` (cross-org firehose), so hand
  // describeDeviceEvent a thin per-org adapter that resolves against this row's
  // organization_id.
  const crewByBadge = { get: (badge) => CREW_BY_BADGE.get(`${r.organization_id}:${badge}`) };
  const desc = describeDeviceEvent({ event_type: r.event_type, payload: r.payload }, { crewByBadge });
  // Title is just the human-readable description now; the device id
  // lives in its own column in the firehose grid (no need to prefix).
  // Falls back to a UUID prefix in device_external_id if the device
  // map hasn't seen this id yet (e.g. a device added post-hydrate).
  const deviceLabel = ext || `dev-${(r.device_id || '').slice(0, 8)}`;
  return {
    id: r.id,
    kind: 'device_event',
    event_id: null,
    title: desc.title,
    priority: null,
    action: r.event_type,
    actor_name: null,
    actor_role: null,
    actor_id: null,
    location_id: r.location_id,
    organization_id: r.organization_id,
    organization_name: ORG_NAME_BY_ID.get(r.organization_id) || null,
    source: classifySource({ kind: 'device_event', event_type: r.event_type }),
    created_at: r.created_at,
    device_external_id: ext,
    device_label: deviceLabel,
    event_type: r.event_type,
  };
}

// Pre-warm the org-name + device-external-id + crew-by-badge maps
// so rows render with friendly labels. Done once per session, not
// per-org, since these labels are global. RLS scopes the underlying
// rows to what the caller can see.
let labelsHydrated = false;
let labelsHydratingPromise = null;
async function hydrateLabelsOnce() {
  if (labelsHydrated) return;
  if (labelsHydratingPromise) return labelsHydratingPromise;
  labelsHydratingPromise = (async () => {
    // Paginated past PostgREST's 1000-row cap. devices in particular
    // crosses the cap once a customer has 1000+ panels (Meridian alone
    // is at 1959 today across the full fleet).
    //
    // rls-scope-ok: this is a deliberately CROSS-ORG firehose — super
    // admins switch between Meridian / FEB / FEB2 and the per-org BUFFERs
    // (hydrateOrg) keep streams isolated, but these label maps are global
    // on purpose. The crew map keys by `${org}:${badge}` so badge_uid
    // reuse across tenants can't collapse names. See PR #953.
    let orgs = [],
      devices = [],
      crew = [];
    try {
      [orgs, devices, crew] = await Promise.all([
        fetchAllPaginated(() => supabase.from('organizations').select('id, name').order('id')),
        fetchAllPaginated(() => supabase.from('devices').select('id, external_id').order('id')),
        // rls-scope-ok: cross-org firehose crew labels, keyed by `${org}:${badge}` (see above).
        fetchAllPaginated(() =>
          supabase.from('team_members').select('badge_uid, name, organization_id').order('badge_uid'),
        ),
      ]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[event-firehose] labels hydrate failed:', e.message);
    }
    for (const o of orgs) ORG_NAME_BY_ID.set(o.id, o.name);
    for (const d of devices) {
      if (d.external_id) DEVICE_EXT_BY_ID.set(d.id, d.external_id);
    }
    // This is a deliberately cross-org firehose (super admins switch between
    // Meridian / FEB / FEB2), and badge_uid repeats across tenants — so key the
    // crew map by (org, badge) to stop one org's cleaner name resolving against
    // another's event. Lookups in fromDeviceEventRow use the event's org id.
    for (const m of crew) {
      if (m.badge_uid) CREW_BY_BADGE.set(`${m.organization_id}:${m.badge_uid}`, { name: m.name });
    }
    labelsHydrated = true;
  })();
  return labelsHydratingPromise;
}

async function hydrateOrg(orgId) {
  if (!orgId) return;
  if (hydratedOrgs.has(orgId)) return;
  if (hydratingPromises.has(orgId)) return hydratingPromises.get(orgId);
  const p = (async () => {
    await hydrateLabelsOnce();
    todayCountStartMs = startOfTodayMs();
    const todayIso = new Date(todayCountStartMs).toISOString();

    // Pull last MAX_BUFFER rows from each table for THIS org only,
    // then merge — newest first across both. Today counts use
    // head-only queries so they include rows beyond the buffer cap.
    const [iaBuf, deBuf, iaCount, deCount] = await Promise.all([
      supabase
        .from('incident_actions')
        .select(
          'id, incident_id, incident_title, incident_priority, action, actor_name, actor_role, actor_id, location_id, organization_id, created_at',
        )
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(MAX_BUFFER),
      supabase
        .from('device_events')
        .select('id, event_type, payload, device_id, location_id, organization_id, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(MAX_BUFFER),
      supabase
        .from('incident_actions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', todayIso),
      supabase
        .from('device_events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', todayIso),
    ]);

    const merged = [...(iaBuf.data || []).map(fromIncidentRow), ...(deBuf.data || []).map(fromDeviceEventRow)]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, MAX_BUFFER);

    BUFFER_BY_ORG.set(orgId, merged);
    TODAY_COUNT_BY_ORG.set(orgId, (iaCount.count ?? 0) + (deCount.count ?? 0));
    hydratedOrgs.add(orgId);
    hydratingPromises.delete(orgId);
    emit();
  })();
  hydratingPromises.set(orgId, p);
  return p;
}

// Drop stale per-org buffers when the active user changes — otherwise a
// previous session's firehose rows leak into the next user's view on
// the same browser. Per-org Set semantics mean we have to clear all the
// org-keyed Maps here, not just a single hydrated flag.
registerAuthAwareCache({
  resetHydrate: () => {
    hydratedOrgs.clear();
    hydratingPromises.clear();
    BUFFER_BY_ORG.clear();
    TODAY_COUNT_BY_ORG.clear();
  },
  onSignOut: () => emit(),
  // onSignIn intentionally omitted — hydration here is lazy per-org
  // (callers pass orgId via useEventFirehose hook), so the next mount
  // triggers a fresh hydrate on its own.
});

function ingestNewRow(row) {
  const orgId = row.organization_id;
  // Only buffer rows for orgs the caller has hydrated — keeps memory
  // bounded when realtime delivers rows from other orgs (super admins
  // can see everything via RLS).
  if (!orgId || !hydratedOrgs.has(orgId)) return;
  const list = BUFFER_BY_ORG.get(orgId) || [];
  if (list.some((x) => x.id === row.id)) return;
  BUFFER_BY_ORG.set(orgId, [row, ...list].slice(0, MAX_BUFFER));
  // Reset the "today" counter on day rollover so the pill goes back
  // to 1 at midnight instead of accumulating yesterday's total.
  const nowStart = startOfTodayMs();
  if (nowStart !== todayCountStartMs) {
    todayCountStartMs = nowStart;
    for (const k of TODAY_COUNT_BY_ORG.keys()) TODAY_COUNT_BY_ORG.set(k, 0);
  }
  const rowMs = new Date(row.created_at).getTime();
  if (rowMs >= todayCountStartMs) {
    TODAY_COUNT_BY_ORG.set(orgId, (TODAY_COUNT_BY_ORG.get(orgId) || 0) + 1);
  }
  emit();
}

function subscribeRealtime() {
  if (subscribedChannel) return;
  subscribedChannel = supabase
    .channel('event_firehose_live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incident_actions' }, (payload) => {
      const r = payload.new;
      if (!r) return;
      ingestNewRow(fromIncidentRow(r));
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'device_events' }, (payload) => {
      const r = payload.new;
      if (!r) return;
      ingestNewRow(fromDeviceEventRow(r));
    })
    .subscribe();
}

if (typeof window !== 'undefined') {
  setTimeout(subscribeRealtime, 70);
}

// Dash-bounded prefix match — same helper applied to useMerlinAsks +
// useLatestAgentActions. Mirrors building tree structure: 'hq' matches
// 'hq' and 'hq-floor-32-east-restroom' (a descendant) but not 'hq2'.
// Rows with null location_id fall through (kept visible) so ecosystem
// + device-without-location events stay readable on every building.
function matchesBuilding(rowLocId, buildingId) {
  if (!buildingId) return true;
  if (!rowLocId) return true;
  return rowLocId === buildingId || rowLocId.startsWith(buildingId + '-');
}

/**
 * @param {string} orgId
 * @param {string} [buildingId] When provided, the returned rows are
 *   filtered to those whose location_id matches this building (or any
 *   descendant). todayCount stays org-wide — the firehose's per-day
 *   pill represents the org's total daily activity, building scoping
 *   only affects what's listed below.
 */
export function useEventFirehose(orgId, buildingId) {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!orgId) return;
    LISTENERS.add(bump);
    hydrateOrg(orgId);
    return () => {
      LISTENERS.delete(bump);
    };
  }, [orgId]);
  const allRows = (orgId && BUFFER_BY_ORG.get(orgId)) || [];
  const rows = buildingId ? allRows.filter((r) => matchesBuilding(r.location_id, buildingId)) : allRows;
  return {
    rows,
    todayCount: (orgId && TODAY_COUNT_BY_ORG.get(orgId)) || 0,
  };
}
