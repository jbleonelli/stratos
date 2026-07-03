// Room-context hook for the Hypervisor right pane.
//
// When a leaf room (Mailroom, Floor 18 SE Restroom, etc.) is
// selected, the right pane should answer three operational questions
// in one shot:
//
//   1. What devices live in this room?
//   2. What zones cover this room (floor-level service zones)?
//   3. What routes serve those zones — for any team / any service?
//
// We derive the answers from three tables:
//
//   · public.devices            — direct match on location_id
//   · public.building_zones     — match on (location_id = building
//     root, floor = numeric extract from the floor name)
//   · public.routes + public.route_zones + public.route_assignments
//     + public.team_members — the chain that turns a zone id into
//     a list of routes + the people who run them.
//
// A room doesn't have a hard FK to a zone — zones are floor-level
// concepts addressed by (building_id, floor_number, kind). We list
// EVERY zone on the room's floor; the user can scan for the one
// covering their room. That's the same model the agents use.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { breadcrumbForAny, loadCustomLocations } from './custom-locations.js';

// Walk parent chain to find the building root + the floor row.
// Uses breadcrumbForAny which walks the raw locations cache (rooms +
// floors are in there, but filtered out of getAllBuildings()).
//
// A floor node is its own "floor" in the chain, so selecting a floor
// directly resolves to the floor's own name (vs walking up from a
// nested room).
function ancestors(node) {
  if (!node?.id) return { buildingRootId: null, floorNumber: null, floorName: null };
  const chain = breadcrumbForAny(node.id);
  let buildingRootId = null;
  let floorName = null;
  for (const c of chain) {
    if (c.kind === 'building' || c.kind === 'ecosystem') buildingRootId = c.id;
    if (c.kind === 'floor') floorName = c.name;
  }
  // If the selected node IS the floor, breadcrumbForAny includes it
  // in the chain so floorName is set from the loop above. Otherwise
  // fall back to the node's own name when its kind is 'floor'.
  if (!floorName && node.kind === 'floor') floorName = node.name;
  let floorNumber = null;
  if (floorName) {
    const m = floorName.match(/(\d+)/);
    floorNumber = m ? m[1] : floorName;
  }
  return { buildingRootId, floorNumber, floorName };
}

const EMPTY = {
  devices: [],
  zones: [],
  routes: [],
  // buildingRootId + floorNumber are needed by editor surfaces that
  // want to write to building_zones (createZone needs both as foreign
  // keys). Exposed so the right-pane ZonesBlock can offer in-place
  // CRUD without re-deriving from the node tree.
  buildingRootId: null,
  floorNumber: null,
  ready: false,
  error: null,
};

export function useRoomContext(node) {
  const [state, setState] = useState(EMPTY);
  // Bump on each refresh() call to re-run the effect — used by
  // editable surfaces (ZonesBlock CRUD) so the right pane stays in
  // sync after a create / rename / delete without remounting.
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    if (!node?.id) {
      setState(EMPTY);
      return;
    }
    // Skip building / ecosystem (whole-tower) + device leaves. Floor
    // nodes now flow through so picking a floor surfaces zones +
    // routes for that floor (devices stay empty because devices
    // attach to rooms, not floors).
    const skipKinds = new Set(['building', 'ecosystem', '__device']);
    if (skipKinds.has(node.kind)) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    (async () => {
      // Make sure the locations cache is hydrated; ancestors() walks
      // it. Idempotent — returns immediately if already loaded.
      loadCustomLocations();
      // Tiny grace so the first hydrate (~80ms) lands before we
      // walk the chain. Without this, the ancestors() result is
      // empty on first render and the right pane never recovers.
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;
      const { buildingRootId, floorNumber } = ancestors(node);

      // 1. Devices in this room. (Schema: column is 'last_seen', not
      // 'last_seen_at' — the typo silently dropped the entire devices
      // result set on first preview run.)
      const devicesP = supabase
        .from('devices')
        .select('id, kind, external_id, model, status, last_seen')
        .eq('location_id', node.id)
        .order('kind', { ascending: true });

      // 2. Zones on this floor (best-effort: same building root, same
      //    floor number string). Skipped when we couldn't derive
      //    a building/floor — the room is loose-rooted.
      const zonesP =
        buildingRootId && floorNumber
          ? supabase
              .from('building_zones')
              .select('id, name, kind, code, floor')
              .eq('location_id', buildingRootId)
              .eq('floor', floorNumber)
              .order('kind')
              .order('name')
          : Promise.resolve({ data: [] });

      const [dRes, zRes] = await Promise.all([devicesP, zonesP]);
      if (cancelled) return;

      const devices = dRes.error ? [] : dRes.data || [];
      const zones = zRes.error ? [] : zRes.data || [];

      // 3. Routes serving any zone on this floor. One round-trip:
      //    pull route_zones rows for the zone ids, then the routes
      //    + assignments + team members in two more queries.
      let routes = [];
      if (zones.length > 0) {
        const zoneIds = zones.map((z) => z.id);
        const { data: rzRows } = await supabase
          .from('route_zones')
          .select('route_id, zone_id, sort_order')
          .in('zone_id', zoneIds);
        const routeIds = [...new Set((rzRows || []).map((r) => r.route_id))];
        if (routeIds.length > 0) {
          const [rRes, aRes] = await Promise.all([
            supabase
              .from('routes')
              .select('id, name, service_type, cadence, expected_start_time, expected_duration_min, active')
              .in('id', routeIds)
              .eq('active', true),
            supabase
              .from('route_assignments')
              .select('route_id, member_id, role, start_date, end_date')
              .in('route_id', routeIds)
              .or('end_date.is.null,end_date.gt.now()'),
          ]);
          const memberIds = [...new Set((aRes.data || []).map((a) => a.member_id))];
          let memberById = {};
          if (memberIds.length > 0) {
            const { data: tRows } = await supabase.from('team_members').select('id, name, role').in('id', memberIds);
            memberById = Object.fromEntries((tRows || []).map((m) => [m.id, m]));
          }
          // Group zones + assignments under each route for render.
          const routeRows = rRes.data || [];
          const assignmentsByRoute = {};
          for (const a of aRes.data || []) {
            if (!assignmentsByRoute[a.route_id]) assignmentsByRoute[a.route_id] = [];
            assignmentsByRoute[a.route_id].push({
              role: a.role,
              member: memberById[a.member_id] || null,
            });
          }
          const zonesByRoute = {};
          for (const rz of rzRows || []) {
            if (!zonesByRoute[rz.route_id]) zonesByRoute[rz.route_id] = [];
            const z = zones.find((x) => x.id === rz.zone_id);
            if (z) zonesByRoute[rz.route_id].push(z);
          }
          routes = routeRows.map((r) => ({
            ...r,
            assignments: assignmentsByRoute[r.id] || [],
            zones: zonesByRoute[r.id] || [],
          }));
        }
      }

      if (cancelled) return;
      setState({ devices, zones, routes, buildingRootId, floorNumber, ready: true, error: null });
    })().catch((err) => {
      if (cancelled) return;
      setState({
        devices: [],
        zones: [],
        routes: [],
        buildingRootId: null,
        floorNumber: null,
        ready: true,
        error: err?.message || String(err),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [node?.id, tick]);

  return { ...state, refresh };
}
