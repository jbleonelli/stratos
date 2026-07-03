// Per-device data hooks for the DeviceDetailPage. (Track L-2.4)
//
// Two hooks, both scoped to a single device_id and both with realtime
// subscriptions. Unlike agent-runs.js / merlin-asks.js, the data here
// is consumed by exactly one component (DeviceDetailPage) at a time —
// when you navigate to /device/<external_id> only one device is shown.
// So no module-scope cache; each hook owns its own state, and the
// subscription tears down on unmount.
//
//   useDeviceEvents(deviceId, limit)
//     → newest device_events for this device, with INSERTs streaming
//       in. Used by the Activity card.
//
//   useDeviceCleanings(deviceId, limit)
//     → newest COMPLETED cleaning visits (kind='clean', ended_at not
//       null). Used by the Telemetry "last clean" tile and the e-ink
//       screen mockup's "last 5 cleanings" panel. We refetch on any
//       device_visits change for the device — cleaning visits become
//       visible only on UPDATE (when ended_at gets set), and refetch
//       is simpler than reconciling INSERT-then-UPDATE state.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { subscribeToChanges } from './realtime-channel.js';
import { captureException } from './sentry.js';
import { getSession } from './auth.js';
import { fetchAllPaginated } from './pagination.js';

export function useDeviceEvents(deviceId, limit = 50) {
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setEvents([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);

    (async () => {
      const { data, error } = await supabase
        .from('device_events')
        .select('id, event_type, payload, occurred_at, created_at')
        .eq('device_id', deviceId)
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setEvents(error || !data ? [] : data);
      setLoaded(true);
    })();

    const unsubscribe = subscribeToChanges({
      topic: `device_events_${deviceId}`,
      bindings: [
        {
          table: 'device_events',
          event: 'INSERT',
          filter: `device_id=eq.${deviceId}`,
          onChange: (payload) => {
            const r = payload.new;
            if (!r) return;
            setEvents((prev) => {
              if (prev.some((e) => e.id === r.id)) return prev;
              const next = [r, ...prev];
              return next.length > limit ? next.slice(0, limit) : next;
            });
          },
        },
      ],
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [deviceId, limit]);

  return { events, loaded };
}

// Raw device uplinks. The live device webhook (/api/devices/uplink) maps each
// MessageV3 into public.events with source_ref='device:<id>' — NOT the legacy
// device_events table the Activity card reads (that stays empty for real
// devices). This hook is the source of truth for "every message the device
// sent": keepalives, badge scans, counts, ratings, requests, joins, positions.
// Fetches the FULL history (paginated past PostgREST's 1000-row cap); new
// uplinks stream in via realtime INSERT on source_ref.
export function useDeviceMessages(deviceId) {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setMessages([]);
      setLoaded(false);
      return;
    }
    const ref = `device:${deviceId}`;
    let cancelled = false;
    setLoaded(false);

    (async () => {
      let rows = [];
      try {
        rows = await fetchAllPaginated(() =>
          supabase
            // rls-scope-ok: narrowed to one device via source_ref=device:<id>; the
            // events table is per-tenant RLS-protected (events_select_contractor),
            // so even a platform admin only reads this single device's messages.
            .from('events')
            .select('id, kind, severity, payload, external_id, location_id, created_at')
            .eq('source_ref', ref)
            .order('created_at', { ascending: false }),
        );
      } catch (e) {
        captureException(e, { where: 'device-events:messages' });
        rows = [];
      }
      if (cancelled) return;
      setMessages(rows);
      setLoaded(true);
    })();

    const unsubscribe = subscribeToChanges({
      topic: `device_messages_${deviceId}`,
      bindings: [
        {
          table: 'events',
          event: 'INSERT',
          filter: `source_ref=eq.${ref}`,
          onChange: (payload) => {
            const r = payload.new;
            if (!r) return;
            setMessages((prev) => (prev.some((e) => e.id === r.id) ? prev : [r, ...prev]));
          },
        },
      ],
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [deviceId]);

  return { messages, loaded };
}

export function useDeviceCleanings(deviceId, limit = 5) {
  const [cleanings, setCleanings] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setCleanings([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);

    async function refresh() {
      const { data, error } = await supabase
        .from('device_visits')
        .select('id, kind, badge_uid, team_member_id, started_at, ended_at')
        .eq('device_id', deviceId)
        .eq('kind', 'clean')
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setCleanings(error || !data ? [] : data);
      setLoaded(true);
    }

    refresh();

    // device_visits change shape (INSERT then UPDATE-when-ended), so
    // listen to all change types and refetch — keeps the reconciliation
    // logic out of the client.
    const unsubscribe = subscribeToChanges({
      topic: `device_visits_${deviceId}`,
      bindings: [
        {
          table: 'device_visits',
          event: '*',
          filter: `device_id=eq.${deviceId}`,
          onChange: () => {
            if (!cancelled) refresh();
          },
        },
      ],
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [deviceId, limit]);

  return { cleanings, loaded };
}

// Convert an event row into a human-readable line for the Activity
// card. Returns { icon, title, hint } strings/keys; the component
// supplies the actual icon component + styles.
//
// `ctx` (optional) lets callers resolve identifiers to friendlier
// labels: ctx.crewByBadge is a Map<badge_uid, { name }> built from
// the team_members roster — when present, SLB service events render
// "Maria Lopez began Restroom check" instead of "Service started · …".
// SDC cleaner events keep their badge UIDs because the SDC pool
// (BADGE-000001..) isn't mapped to roster members today.
export function describeDeviceEvent(event, ctx) {
  const p = event?.payload || {};
  const crewName = ctx?.crewByBadge?.get?.(p.badge_uid)?.name || null;
  switch (event?.event_type) {
    case 'rating':
      return {
        iconKey: 'sparkle',
        title: `Rated ${p.stars ?? '—'} star${p.stars === 1 ? '' : 's'}`,
        hint: null,
      };
    case 'request_pressed':
      return {
        iconKey: 'bell',
        title: `${formatRequestType(p.request_type)} requested`,
        hint: null,
      };
    case 'cleaner_check_in':
      return {
        iconKey: 'badge',
        title:
          p.intent === 'request_resolution'
            ? `Cleaner badge-in (${formatRequestType(p.request_type) || 'resolution'})`
            : 'Cleaner badge-in (clean)',
        hint: p.badge_uid ? `Badge ${p.badge_uid}` : null,
      };
    case 'cleaner_check_out':
      return {
        iconKey: 'badge',
        title: 'Cleaner badge-out',
        hint: p.badge_uid ? `Badge ${p.badge_uid}` : null,
      };
    case 'request_resolved':
      return {
        iconKey: 'check',
        title: `${formatRequestType(p.request_type) || 'Request'} resolved`,
        hint: null,
      };
    case 'heartbeat':
      return {
        iconKey: 'bolt',
        title: 'Heartbeat',
        hint:
          [p.battery_pct != null ? `${p.battery_pct}% battery` : null, p.firmware ? `fw ${p.firmware}` : null]
            .filter(Boolean)
            .join(' · ') || null,
      };
    case 'count_threshold':
      return {
        iconKey: 'warn',
        title: `Threshold trip · ${p.count ?? '—'} (limit ${p.threshold ?? '—'})`,
        hint: p.battery_pct != null ? `${p.battery_pct}% battery` : null,
      };
    case 'count_report':
      return {
        iconKey: 'people',
        title: `Count report · ${p.count ?? '—'}${p.window_min ? ` over ${p.window_min}m` : ''}`,
        hint: p.battery_pct != null ? `${p.battery_pct}% battery` : null,
      };
    case 'service_started': {
      const code = formatServiceCode(p.service_code);
      const who = crewName || (p.badge_uid ? `Badge ${p.badge_uid}` : 'Crew');
      return {
        iconKey: 'badge',
        title: `${who} began ${code || 'service'}`,
        hint: crewName && p.badge_uid ? `Badge ${p.badge_uid}` : null,
      };
    }
    case 'service_completed': {
      const who = crewName || (p.badge_uid ? `Badge ${p.badge_uid}` : 'Crew');
      return {
        iconKey: 'check',
        title: `${who} ended service`,
        hint: crewName && p.badge_uid ? `Badge ${p.badge_uid}` : null,
      };
    }
    default:
      return { iconKey: 'dots', title: event?.event_type || 'event', hint: null };
  }
}

function formatRequestType(t) {
  if (!t) return null;
  return (
    {
      toilet_paper: 'Toilet paper',
      liquid_soap: 'Liquid soap',
      paper_towels: 'Paper towels',
      maintenance: 'Maintenance',
    }[t] || t
  );
}

// SLB service codes are operator-configurable per device; the seed
// ships two canonical sets (cleaning + security). This map covers
// both — anything unknown falls through to a Title Cased version of
// the code so a custom button still renders sensibly.
function formatServiceCode(code) {
  if (!code) return null;
  const KNOWN = {
    RESTROOM: 'Restroom check',
    FLOOR_SWEEP: 'Floor sweep',
    TRASH: 'Trash collection',
    DEEP_CLEAN: 'Deep clean',
    PATROL: 'Patrol',
    INCIDENT_CHECK: 'Incident check',
    ESCORT: 'Escort',
    LOCKUP: 'Lockup',
  };
  if (KNOWN[code]) return KNOWN[code];
  return String(code)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Hook for the SLB Activity / "Latest session" surfaces. Returns the
// newest service sessions for this device, with realtime updates that
// refetch on any change (sessions go INSERT then UPDATE-when-ended,
// same shape as device_visits — refetch keeps reconciliation simple).
export function useDeviceServiceSessions(deviceId, limit = 10) {
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setSessions([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);

    async function refresh() {
      const { data, error } = await supabase
        .from('device_service_sessions')
        .select('id, service_code, badge_uid, team_member_id, started_at, ended_at')
        .eq('device_id', deviceId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setSessions(error || !data ? [] : data);
      setLoaded(true);
    }

    refresh();

    const unsubscribe = subscribeToChanges({
      topic: `device_service_sessions_${deviceId}`,
      bindings: [
        {
          table: 'device_service_sessions',
          event: '*',
          filter: `device_id=eq.${deviceId}`,
          onChange: () => {
            if (!cancelled) refresh();
          },
        },
      ],
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [deviceId, limit]);

  return { sessions, loaded };
}

// Mini-hook for resolving badge UIDs to crew member names. Used by
// SLB surfaces so the Activity card and "Latest session" tile read
// "Maria Lopez" instead of "BADGE-CRW-001". Cached at module scope —
// the roster changes rarely.
let crewCache = null;
let crewHydrated = false;
let crewHydrating = null;
const crewListeners = new Set();

async function hydrateCrewOnce() {
  if (crewHydrated) return crewCache;
  if (crewHydrating) return crewHydrating;
  crewHydrating = (async () => {
    // Platform admins bypass per-org RLS (is_platform_admin), so an unfiltered
    // read pulls every tenant's crew and the badge_uid → member map collapses
    // across orgs (badge UIDs repeat per tenant). Scope admins to the active
    // org. Non-admin customers are already correctly scoped by RLS.
    const orgId = getSession()?.organizationId || null;
    let q = supabase.from('team_members').select('badge_uid, name, team, role, initials');
    if (getSession()?.isPlatformAdmin && orgId) q = q.eq('organization_id', orgId);
    const { data } = await q;
    crewHydrated = true;
    crewHydrating = null;
    const map = new Map();
    for (const m of data || []) {
      if (m.badge_uid) map.set(m.badge_uid, m);
    }
    crewCache = map;
    crewListeners.forEach((fn) => fn(crewCache));
    return crewCache;
  })();
  return crewHydrating;
}

export function useCrewByBadge() {
  const [map, setMap] = useState(crewCache);
  useEffect(() => {
    crewListeners.add(setMap);
    if (!crewHydrated) hydrateCrewOnce();
    else setMap(crewCache);
    return () => {
      crewListeners.delete(setMap);
    };
  }, []);
  return map; // null until first hydrate completes
}
