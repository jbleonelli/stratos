// Routes — Phase 8c. A route is a named set of zones + a service type
// + a cadence, with one or more team members assigned to run it.
// Postgres-backed with a localStorage cache for sync reads.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { getSession } from './auth.js';
import { fetchAllPaginated } from './pagination.js';
import { registerAuthAwareCache } from './use-auth-aware-cache.js';

const CACHE_KEY = 'merlin-routes';

export const SERVICE_TYPES = [
  { id: 'surface_clean', label: 'Surface clean', tone: 'info' },
  { id: 'deep_clean', label: 'Deep clean', tone: 'accent' },
  { id: 'empty_bins', label: 'Empty bins', tone: 'info' },
  { id: 'restock', label: 'Restock supplies', tone: 'ok' },
  { id: 'inspection', label: 'Inspection', tone: 'warn' },
  { id: 'patrol', label: 'Patrol', tone: 'info' },
  { id: 'other', label: 'Other', tone: 'info' },
];

export const CADENCE_OPTIONS = [
  { id: 'daily', label: 'Every day', dows: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'weekdays', label: 'Weekdays', dows: [1, 2, 3, 4, 5] },
  { id: 'weekends', label: 'Weekends', dows: [0, 6] },
  { id: 'weekly', label: 'Once per week', dows: [] },
  { id: 'custom', label: 'Custom days…', dows: [] },
];

export const ASSIGNMENT_ROLES = [
  { id: 'primary', label: 'Primary' },
  { id: 'substitute', label: 'Substitute' },
  { id: 'trainee', label: 'Trainee' },
];

export function serviceLabel(id) {
  return SERVICE_TYPES.find((s) => s.id === id)?.label || id;
}
export function serviceTone(id) {
  return SERVICE_TYPES.find((s) => s.id === id)?.tone || 'info';
}

// ────── cache

let cache = {
  routes: [],
  zonesByRoute: {}, // routeId → [{ route_id, zone_id, sort_order }]
  assignsByRoute: {}, // routeId → [{ id, route_id, member_id, role, start_date, end_date }]
};
const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn(snap()));
}
function snap() {
  return {
    routes: cache.routes.slice(),
    zonesByRoute: { ...cache.zonesByRoute },
    assignsByRoute: { ...cache.assignsByRoute },
  };
}

function loadCache() {
  if (typeof window === 'undefined') return;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '') || cache;
  } catch {}
}
function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

loadCache();

// ────── hydration

let hydrated = false;
let hydratingPromise = null;

async function hydrateOnce() {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    // Paginated past PostgREST's 1000-row cap. Routes scale with
    // building × service-type × frequency; route_zones + route_assignments
    // multiply that further.
    // Platform admins bypass per-org RLS (is_platform_admin) and would pull
    // EVERY tenant's routes into this shared cache. Scope them to the active
    // org. Non-admins (customers + contractors) are already correctly scoped by
    // RLS — must NOT filter them or contractor cross-org reads break.
    const orgId = getSession()?.organizationId || null;
    const scopeAdmin = (q) => (getSession()?.isPlatformAdmin && orgId ? q.eq('organization_id', orgId) : q);
    let routesData, zonesData, assignsData;
    try {
      [routesData, zonesData, assignsData] = await Promise.all([
        fetchAllPaginated(() => scopeAdmin(supabase.from('routes').select('*').order('location_id').order('name'))),
        fetchAllPaginated(() => scopeAdmin(supabase.from('route_zones').select('*').order('route_id'))),
        fetchAllPaginated(() => scopeAdmin(supabase.from('route_assignments').select('*').order('route_id'))),
      ]);
    } catch (e) {
      captureException(e, { where: 'hydrateOnce' });
      // eslint-disable-next-line no-console
      console.warn('[routes-data] hydrate failed:', e.message);
      hydrated = true;
      return;
    }
    hydrated = true;
    cache.routes = routesData || [];
    cache.zonesByRoute = {};
    for (const rz of zonesData || []) (cache.zonesByRoute[rz.route_id] ||= []).push(rz);
    cache.assignsByRoute = {};
    for (const a of assignsData || []) (cache.assignsByRoute[a.route_id] ||= []).push(a);
    saveCache();
    emit();
  })();
  return hydratingPromise;
}

// Drop stale cache when the active user changes — otherwise a previous
// user's routes leak into the next user's view on the same browser.
registerAuthAwareCache({
  resetHydrate: () => {
    hydrated = false;
    hydratingPromise = null;
  },
  onSignOut: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    cache = { routes: [], zonesByRoute: {}, assignsByRoute: {} };
    emit();
  },
  onSignIn: () => hydrateOnce(),
});

// ────── reads

export function getRoutes() {
  if (!hydrated) hydrateOnce();
  return snap();
}

export function useRoutes() {
  const [state, setState] = useState(() => snap());
  useEffect(() => {
    const fn = (next) => setState(next);
    listeners.add(fn);
    hydrateOnce();
    return () => listeners.delete(fn);
  }, []);
  return state;
}

export function routeZoneIds(routeId) {
  return (cache.zonesByRoute[routeId] || []).sort((a, b) => a.sort_order - b.sort_order).map((rz) => rz.zone_id);
}

export function routeAssignments(routeId) {
  return (cache.assignsByRoute[routeId] || []).slice();
}

// ────── writes

export async function createRoute(payload) {
  const row = {
    name: payload.name?.trim() || 'Untitled route',
    description: payload.description?.trim() || null,
    location_id: payload.location_id,
    service_type: payload.service_type || 'surface_clean',
    cadence: payload.cadence || 'daily',
    cadence_days: payload.cadence_days || [],
    expected_start_time: payload.expected_start_time || null,
    expected_duration_min: payload.expected_duration_min ?? null,
    active: payload.active !== false,
    organization_id: getSession()?.organizationId || null,
    // Only include sla_threshold_min when the caller explicitly sets it
    // so this code keeps working before migration 021 runs.
    ...(payload.sla_threshold_min != null && { sla_threshold_min: Number(payload.sla_threshold_min) }),
  };
  const { data, error } = await supabase.from('routes').insert(row).select().single();
  if (error) throw new Error(error.message);
  cache.routes = [...cache.routes, data];
  cache.zonesByRoute[data.id] = [];
  cache.assignsByRoute[data.id] = [];
  saveCache();
  emit();
  return data;
}

export async function updateRoute(id, patch) {
  const clean = {};
  for (const k of [
    'name',
    'description',
    'location_id',
    'service_type',
    'cadence',
    'cadence_days',
    'expected_start_time',
    'expected_duration_min',
    'active',
    'sla_threshold_min',
  ]) {
    if (patch[k] !== undefined) clean[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  }
  const { data, error } = await supabase.from('routes').update(clean).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  cache.routes = cache.routes.map((r) => (r.id === id ? data : r));
  saveCache();
  emit();
  return data;
}

export async function deleteRoute(id) {
  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  cache.routes = cache.routes.filter((r) => r.id !== id);
  delete cache.zonesByRoute[id];
  delete cache.assignsByRoute[id];
  saveCache();
  emit();
}

// Replace the full zone set for a route. zoneIds preserves the
// sequence callers want the route to visit zones in.
export async function setRouteZones(routeId, zoneIds) {
  const del = await supabase.from('route_zones').delete().eq('route_id', routeId);
  if (del.error) throw new Error(del.error.message);
  let inserted = [];
  if (zoneIds.length > 0) {
    const orgId = getSession()?.organizationId || null;
    const rows = zoneIds.map((zoneId, i) => ({
      route_id: routeId,
      zone_id: zoneId,
      sort_order: i + 1,
      organization_id: orgId,
    }));
    const { data, error } = await supabase.from('route_zones').insert(rows).select();
    if (error) throw new Error(error.message);
    inserted = data;
  }
  cache.zonesByRoute[routeId] = inserted;
  saveCache();
  emit();
  return inserted;
}

export async function addAssignment(routeId, memberId, role = 'primary') {
  const { data, error } = await supabase
    .from('route_assignments')
    .insert({
      route_id: routeId,
      member_id: memberId,
      role,
      organization_id: getSession()?.organizationId || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  cache.assignsByRoute[routeId] = [...(cache.assignsByRoute[routeId] || []), data];
  saveCache();
  emit();
  return data;
}

export async function removeAssignment(assignmentId, routeId) {
  const { error } = await supabase.from('route_assignments').delete().eq('id', assignmentId);
  if (error) throw new Error(error.message);
  cache.assignsByRoute[routeId] = (cache.assignsByRoute[routeId] || []).filter((a) => a.id !== assignmentId);
  saveCache();
  emit();
}

// ────── display helpers

export function cadenceLabel(route) {
  const o = CADENCE_OPTIONS.find((c) => c.id === route.cadence);
  if (!o) return route.cadence;
  if (route.cadence !== 'custom') return o.label;
  const days = (route.cadence_days || []).slice().sort();
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map((d) => names[d]).join(', ') || 'Custom';
}

// Does the cadence cover this day-of-week? Used by Phase 8d to figure
// out which routes run today.
export function routeRunsOn(route, dow) {
  if (route.cadence === 'daily') return true;
  if (route.cadence === 'weekdays') return dow >= 1 && dow <= 5;
  if (route.cadence === 'weekends') return dow === 0 || dow === 6;
  if (route.cadence === 'weekly') return dow === 1; // default to Monday for weekly
  if (route.cadence === 'custom') return (route.cadence_days || []).includes(dow);
  return false;
}

// Phase 10f: does this route apply to the given building? True if the
// route's location is that building directly, OR the building lives
// somewhere inside the route's ecosystem subtree. `descendantIds` is
// passed in to avoid the cycle import with custom-locations.
export function routeAppliesToBuilding(route, buildingId, descendantIds) {
  if (!route?.location_id || !buildingId) return false;
  if (route.location_id === buildingId) return true;
  try {
    return descendantIds(route.location_id).has(buildingId);
  } catch {
    return false;
  }
}
