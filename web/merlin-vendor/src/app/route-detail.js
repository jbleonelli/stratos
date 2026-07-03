// @ts-check
// Route-detail hook for the Hypervisor right pane.
//
// When a route is clicked from inside a floor/room context, the pane
// swaps to a RouteDetailCard that needs:
//
//   1. The route row (name, service_type, cadence, expected_*).
//   2. The zones it covers (in stop order) — building_zones rows.
//   3. The team assignments (primary + substitute + trainee).
//   4. Recent activity on the floors the route covers — derived
//      from device_events because there is no route_runs table yet.
//      We use the fact that device.location_id follows the canonical
//      pattern 'hq-fl-{N}-r-...' so a per-floor prefix match gives
//      us the device set without walking the locations tree.
//
// The activity feed is intentionally event-derived: "how busy is this
// route's territory" is a useful proxy for "is the route being run"
// until route execution tracking lands. The UI labels this clearly so
// it's not mistaken for a real audit log.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const EMPTY = {
  route: null,
  zones: [],
  assignments: [],
  activity: [],
  floors: [],
  deviceCount: 0,
  ready: false,
  error: null,
};

export function useRouteDetail(routeId) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!routeId) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState(EMPTY);

    (async () => {
      const { data: route, error: rErr } = await supabase
        .from('routes')
        .select(
          'id, name, description, location_id, service_type, cadence, cadence_days, expected_start_time, expected_duration_min, active, created_at, updated_at',
        )
        .eq('id', routeId)
        .single();
      if (cancelled) return;
      if (rErr || !route) {
        setState({ ...EMPTY, ready: true, error: rErr?.message || 'route not found' });
        return;
      }

      const [rzRes, aRes] = await Promise.all([
        supabase.from('route_zones').select('zone_id, sort_order').eq('route_id', routeId).order('sort_order'),
        supabase
          .from('route_assignments')
          .select('member_id, role, start_date, end_date')
          .eq('route_id', routeId)
          .or('end_date.is.null,end_date.gt.now()'),
      ]);
      if (cancelled) return;

      const zoneIds = (rzRes.data || []).map((r) => r.zone_id);
      const memberIds = [...new Set((aRes.data || []).map((a) => a.member_id))];

      const [zRes, mRes] = await Promise.all([
        zoneIds.length > 0
          ? supabase.from('building_zones').select('id, name, kind, code, floor').in('id', zoneIds)
          : Promise.resolve({ data: [] }),
        memberIds.length > 0
          ? supabase.from('team_members').select('id, name, role, team, initials').in('id', memberIds)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const zoneById = Object.fromEntries((zRes.data || []).map((z) => [z.id, z]));
      const memberById = Object.fromEntries((mRes.data || []).map((m) => [m.id, m]));
      const sortedZones = (rzRes.data || []).map((rz) => zoneById[rz.zone_id]).filter(Boolean);
      const assignments = (aRes.data || []).map((a) => ({
        ...a,
        member: memberById[a.member_id] || null,
      }));

      const floors = [...new Set(sortedZones.map((z) => z.floor).filter(Boolean))];

      let activity = [];
      let deviceCount = 0;

      if (floors.length > 0 && route.location_id) {
        // location_id pattern: '<building>-fl-<N>-r-<room>'. A
        // per-floor like-prefix turns the route's floor coverage
        // into a concrete device set without walking the parents
        // table.
        const orFilters = floors.map((f) => `location_id.like.${route.location_id}-fl-${f}-*`).join(',');
        const { data: devices } = await supabase.from('devices').select('id').or(orFilters);
        deviceCount = (devices || []).length;

        if (deviceCount > 0) {
          const deviceIds = (devices || []).map((d) => d.id);
          const eventTypes = eventTypesForService(route.service_type);
          const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
          let q = supabase
            .from('device_events')
            .select('id, event_type, payload, occurred_at, device_id')
            .in('device_id', deviceIds)
            .gte('occurred_at', sinceIso)
            .order('occurred_at', { ascending: false })
            .limit(40);
          if (eventTypes.length > 0) q = q.in('event_type', eventTypes);
          const { data: events } = await q;
          activity = events || [];
        }
      }

      if (cancelled) return;
      setState({
        route,
        zones: sortedZones,
        assignments,
        activity,
        floors,
        deviceCount,
        ready: true,
        error: null,
      });
    })().catch((err) => {
      if (cancelled) return;
      setState({ ...EMPTY, ready: true, error: err?.message || String(err) });
    });

    return () => {
      cancelled = true;
    };
  }, [routeId]);

  return state;
}

// Map a route's service_type to the device_event event_types that
// reflect that work happening on the floor. Empty array means "show
// all event types" — used for service_type='other'.
function eventTypesForService(serviceType) {
  switch (serviceType) {
    case 'surface_clean':
    case 'deep_clean':
    case 'empty_bins':
      return ['cleaner_check_in', 'cleaner_check_out', 'service_started', 'service_completed'];
    case 'restock':
      return ['service_started', 'service_completed', 'request_resolved'];
    case 'inspection':
    case 'patrol':
      return ['service_started', 'service_completed'];
    default:
      return [];
  }
}
