// Backing data for the global command palette (⌘K).
//
// One async function: searchEntities(query, { orgId, limit }) → { rooms,
// devices, people, slas, routes, zones }. Each list is a small array of
// already-shaped result rows ready for render. Six parallel `ilike` queries
// hit six tables; RLS scopes everything to the active org so a contractor
// can't search across a manager's data they don't own.
//
// Per-entity result shape (consistent across types):
//   { kind, id, title, subtitle?, meta?, navigate: { type, ...payload } }
//
// kind is one of: 'room' | 'building' | 'floor' | 'device' | 'person'
//                 | 'sla' | 'route' | 'zone'
// navigate is consumed by the palette's click handler:
//   type='url'     → navigateTo(payload.url)
//   type='hyper'   → set the merlinHyperPending hint + navigate to /
//                    (Hypervisor consumes the hint on mount)
//   type='view'    → set merlinView in localStorage + navigate to /
//
// This file is intentionally framework-light — no React hooks. The
// palette component owns debounce, loading state, and keyboard nav.

import { supabase } from './supabase.js';

const KIND_LABELS = {
  room: 'Room',
  building: 'Building',
  floor: 'Floor',
  device: 'Device',
  person: 'Person',
  sla: 'SLA',
  route: 'Route',
  zone: 'Zone',
};

export function kindLabel(k) {
  return KIND_LABELS[k] || k;
}

// Trim + lowercase so callers don't have to. Returns null for empty queries
// (callers should skip the round-trip entirely in that case).
function normalizeQuery(q) {
  const trimmed = (q || '').trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Escape PostgREST `ilike` wildcards (% and _) so a literal % in a query
// doesn't match everything. Backslash-escape per the ilike spec.
function escapeIlike(s) {
  return String(s).replace(/[\\%_]/g, (m) => '\\' + m);
}

export async function searchEntities(rawQuery, { limit = 8 } = {}) {
  const query = normalizeQuery(rawQuery);
  const EMPTY = { rooms: [], devices: [], people: [], slas: [], routes: [], zones: [] };
  if (!query) return EMPTY;
  const needle = `%${escapeIlike(query)}%`;

  // Six parallel queries. We DON'T add an explicit org_id filter — RLS
  // already handles tenant scoping naturally:
  //   - Regular tenant users see only their own org's rows.
  //   - Contractors see their own org + every contracted-subtree row
  //     (via is_contractor_on_location etc). Critical: Lisa needs to
  //     find Meridian rooms when she's working a Meridian contract.
  //   - Platform admins see every tenant — intentional from the
  //     command palette; cross-tenant search is useful when triaging.
  // Each query's failure is swallowed — the palette should still render
  // results for surfaces the user CAN reach.
  const [locsRes, devicesRes, peopleRes, slasRes, routesRes, zonesRes] = await Promise.all([
    supabase.from('locations').select('id, name, kind, parent_id').ilike('name', needle).limit(limit),
    supabase
      .from('devices')
      .select('id, external_id, kind, model, location_id')
      .or(`external_id.ilike.${needle},model.ilike.${needle}`)
      .limit(limit),
    supabase.from('team_members').select('id, name, role').ilike('name', needle).limit(limit),
    supabase
      .from('slas')
      .select('id, name, domain, metric_kind')
      .or(`name.ilike.${needle},domain.ilike.${needle}`)
      .limit(limit),
    supabase.from('routes').select('id, name, service_type, cadence').ilike('name', needle).limit(limit),
    supabase
      .from('building_zones')
      .select('id, name, kind, code, floor, location_id')
      .or(`name.ilike.${needle},code.ilike.${needle}`)
      .limit(limit),
  ]);

  // ────── Shape each result row uniformly. Subtitle is the small
  // gray line under the title; meta is a right-aligned pill chip.
  // Navigate hints stay declarative — the palette decides where to go.

  const rooms = [];
  const buildings = [];
  const floors = [];
  for (const r of locsRes.data || []) {
    if (r.kind === 'building' || r.kind === 'ecosystem') {
      buildings.push({
        kind: 'building',
        id: r.id,
        title: r.name,
        subtitle: r.kind,
        navigate: { type: 'hyper', buildingId: r.id, selectId: r.id },
      });
    } else if (r.kind === 'floor') {
      floors.push({
        kind: 'floor',
        id: r.id,
        title: r.name,
        subtitle: 'Floor',
        navigate: { type: 'hyper', buildingId: r.parent_id, selectId: r.id },
      });
    } else {
      rooms.push({
        kind: 'room',
        id: r.id,
        title: r.name,
        subtitle: r.kind,
        navigate: { type: 'hyper', buildingId: rootIdOf(r.id), selectId: r.id },
      });
    }
  }

  const devices = (devicesRes.data || []).map((d) => ({
    kind: 'device',
    id: d.id,
    title: d.external_id || d.kind,
    subtitle: [d.kind, d.model].filter(Boolean).join(' · '),
    // /device/<external_id> exists as a top-level route (DeviceDetailPage).
    navigate: { type: 'url', url: `/device/${encodeURIComponent(d.external_id)}` },
  }));

  const people = (peopleRes.data || []).map((p) => ({
    kind: 'person',
    id: p.id,
    title: p.name,
    subtitle: p.role || 'Crew member',
    // No per-person detail page yet — drop into Admin → Members.
    navigate: { type: 'view', view: 'admin' },
  }));

  const slas = (slasRes.data || []).map((s) => ({
    kind: 'sla',
    id: s.id,
    title: s.name,
    subtitle: [s.domain, s.metric_kind].filter(Boolean).join(' · '),
    // No per-SLA URL — Insights surfaces them all; cheap close-enough.
    navigate: { type: 'view', view: 'insights' },
  }));

  const routes = (routesRes.data || []).map((r) => ({
    kind: 'route',
    id: r.id,
    title: r.name,
    subtitle: [r.service_type, r.cadence].filter(Boolean).join(' · '),
    // Hypervisor's RouteDetailCard takes a routeId — we stash it as a
    // separate hint key. Same merlinView path otherwise.
    navigate: { type: 'hyper', routeId: r.id },
  }));

  const zones = (zonesRes.data || []).map((z) => ({
    kind: 'zone',
    id: z.id,
    title: z.name,
    subtitle: [z.kind, z.code, z.floor && `Floor ${z.floor}`].filter(Boolean).join(' · '),
    // Zones live under a building's floor; nav to the floor node so
    // the right pane shows the floor context with this zone in the
    // ZONES list. (Direct selection of a zone isn't a tree thing —
    // zones aren't in the locations table.)
    navigate: { type: 'hyper', buildingId: z.location_id, selectId: floorIdOf(z.location_id, z.floor) },
  }));

  return {
    rooms: [...buildings, ...floors, ...rooms].slice(0, limit),
    devices,
    people,
    slas,
    routes,
    zones,
  };
}

// Derive the building root id from a deep room id by lopping off
// suffixes. Meridian convention: `hq-fl-32-r-floor-32-conf-alder` →
// `hq`. Falls back to the input if there's no `-` (already a root).
function rootIdOf(id) {
  if (!id) return null;
  const i = id.indexOf('-');
  return i === -1 ? id : id.slice(0, i);
}

// Compose a floor id from the building + floor number. Same Meridian
// convention. Won't match if the tenant uses a different id scheme;
// the Hypervisor's select-hint consumer falls back to just opening
// the building when the exact id isn't found.
function floorIdOf(buildingId, floor) {
  if (!buildingId || !floor) return null;
  return `${buildingId}-fl-${floor}`;
}

// Total result count for the "N results" footer.
export function totalCount(results) {
  if (!results) return 0;
  return (
    (results.rooms?.length || 0) +
    (results.devices?.length || 0) +
    (results.people?.length || 0) +
    (results.slas?.length || 0) +
    (results.routes?.length || 0) +
    (results.zones?.length || 0)
  );
}

// Flatten the grouped result map into a single ordered list (rooms
// first, then devices, etc.) for arrow-key keyboard navigation.
// Caller uses the index returned here.
export function flattenResults(results) {
  if (!results) return [];
  return [
    ...results.rooms,
    ...results.devices,
    ...results.people,
    ...results.slas,
    ...results.routes,
    ...results.zones,
  ];
}
