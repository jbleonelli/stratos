// Building zones — Phase 8b. Floor-level sub-locations (restrooms,
// pantries, hallways, offices) that are the units of service for a
// route. Attached to either a custom locations row or a static
// BUILDINGS entry via plain text location_id.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { getSession } from './auth.js';
import { fetchAllPaginated } from './pagination.js';

const CACHE_KEY = 'merlin-zones';

export const ZONE_KINDS = [
  { id: 'restroom', label: 'Restroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'hallway', label: 'Hallway' },
  { id: 'office', label: 'Office' },
  { id: 'conference', label: 'Conference' },
  { id: 'lobby', label: 'Lobby' },
  { id: 'storage', label: 'Storage' },
  { id: 'reception', label: 'Reception' },
  { id: 'utility', label: 'Utility' },
  { id: 'other', label: 'Other' },
];

// Preset "add a standard floor" shortcuts. Tuned for the cleaning-
// focused workflow that started this whole Schedules overhaul.
export const STANDARD_FLOOR_PRESETS = [
  { name: "Women's Restroom", kind: 'restroom' },
  { name: "Men's Restroom", kind: 'restroom' },
  { name: 'Pantry', kind: 'pantry' },
  { name: 'Hallway', kind: 'hallway' },
];

// ────── cache

let cache = { byLocation: {} }; // location_id → [zone rows]
const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn({ ...cache }));
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

// ────── hydration (per-location, lazy)

const hydratedLocations = new Set();
const inFlight = new Map();

async function hydrateLocation(locationId) {
  if (hydratedLocations.has(locationId)) return;
  if (inFlight.has(locationId)) return inFlight.get(locationId);
  const p = (async () => {
    const { data, error } = await supabase
      .from('building_zones')
      .select('*')
      .eq('location_id', locationId)
      .order('floor')
      .order('sort_order')
      .order('name');
    hydratedLocations.add(locationId);
    if (error) captureException(error, { where: 'hydrateLocation' });
    if (!error && data) {
      cache.byLocation[locationId] = data;
      saveCache();
      emit();
    }
  })();
  inFlight.set(locationId, p);
  try {
    await p;
  } finally {
    inFlight.delete(locationId);
  }
}

// ────── reads

export function getZonesForLocation(locationId) {
  if (!locationId) return [];
  if (!hydratedLocations.has(locationId)) hydrateLocation(locationId);
  return (cache.byLocation[locationId] || []).slice();
}

export function useZonesForLocation(locationId) {
  const [list, setList] = useState(() => getZonesForLocation(locationId));
  useEffect(() => {
    const fn = (next) => setList((next.byLocation?.[locationId] || []).slice());
    listeners.add(fn);
    hydrateLocation(locationId);
    return () => listeners.delete(fn);
  }, [locationId]);
  return list;
}

// Group a location's zones by floor, preserving the floor ordering
// that comes back from Postgres (text-sorted; good enough for demo
// floors like '1', '2', '18', '32' if callers pad to width).
export function groupByFloor(zones) {
  const out = {};
  for (const z of zones) (out[z.floor] ||= []).push(z);
  return out;
}

// Natural-sort floor keys so '2' comes before '18' (text sort would
// put '18' first).
export function sortedFloors(zones) {
  const floors = Array.from(new Set(zones.map((z) => z.floor)));
  return floors.sort((a, b) => {
    const na = Number(a),
      nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
}

// ────── writes

export async function createZone({ locationId, floor, name, kind, code, sortOrder }) {
  if (!locationId || !floor || !name) throw new Error('locationId, floor, and name are required.');
  const row = {
    location_id: locationId,
    floor: String(floor).trim(),
    name: name.trim(),
    kind: kind || 'other',
    code: code?.trim() || null,
    sort_order: sortOrder ?? 0,
    organization_id: getSession()?.organizationId || null,
  };
  const { data, error } = await supabase.from('building_zones').insert(row).select().single();
  if (error) throw new Error(error.message);
  cache.byLocation[locationId] = [...(cache.byLocation[locationId] || []), data];
  saveCache();
  emit();
  return data;
}

export async function updateZone(id, patch) {
  const clean = {};
  for (const k of ['floor', 'name', 'kind', 'code', 'sort_order']) {
    if (patch[k] !== undefined) clean[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  }
  const { data, error } = await supabase.from('building_zones').update(clean).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  const list = cache.byLocation[data.location_id] || [];
  cache.byLocation[data.location_id] = list.map((z) => (z.id === id ? data : z));
  saveCache();
  emit();
  return data;
}

export async function deleteZone(id, locationId) {
  const { error } = await supabase.from('building_zones').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (locationId) {
    cache.byLocation[locationId] = (cache.byLocation[locationId] || []).filter((z) => z.id !== id);
    saveCache();
    emit();
  }
}

// Insert the standard set of cleaning-focused zones for a floor in one
// bulk operation. Skips any preset that already exists on that floor
// by name (case-insensitive) so running the preset twice is safe.
export async function addStandardFloor(locationId, floor) {
  const existing = (cache.byLocation[locationId] || []).filter((z) => z.floor === String(floor));
  const existingNames = new Set(existing.map((z) => z.name.toLowerCase()));
  const orgId = getSession()?.organizationId || null;
  const toInsert = STANDARD_FLOOR_PRESETS.filter((p) => !existingNames.has(p.name.toLowerCase())).map((p, i) => ({
    location_id: locationId,
    floor: String(floor),
    name: p.name,
    kind: p.kind,
    sort_order: existing.length + i + 1,
    organization_id: orgId,
  }));
  if (toInsert.length === 0) return [];
  const { data, error } = await supabase.from('building_zones').insert(toInsert).select();
  if (error) throw new Error(error.message);
  cache.byLocation[locationId] = [...(cache.byLocation[locationId] || []), ...data];
  saveCache();
  emit();
  return data;
}

export function zoneKindLabel(kind) {
  return ZONE_KINDS.find((k) => k.id === kind)?.label || 'Other';
}

// ────── aggregate zone counts (for tree rollups — Phase 9b)

let zoneCounts = {}; // locationId → count
let zoneCountsHydrated = false;
let zoneCountsPromise = null;
const zoneCountListeners = new Set();
function emitCounts() {
  zoneCountListeners.forEach((fn) => fn({ ...zoneCounts }));
}

async function hydrateZoneCounts() {
  if (zoneCountsHydrated) return;
  if (zoneCountsPromise) return zoneCountsPromise;
  zoneCountsPromise = (async () => {
    // Paginated past PostgREST's 1000-row cap. A tenant with many
    // buildings × zones-per-building can cross that quickly.
    // Platform admins bypass per-org RLS (is_platform_admin) and would count
    // EVERY tenant's zones here. Scope them to the active org. Non-admins
    // (customers + contractors) are already correctly scoped by RLS — must NOT
    // filter them or contractor cross-org reads break.
    const orgId = getSession()?.organizationId || null;
    const scopeAdmin = (q) => (getSession()?.isPlatformAdmin && orgId ? q.eq('organization_id', orgId) : q);
    let data = null,
      error = null;
    try {
      data = await fetchAllPaginated(() =>
        scopeAdmin(supabase.from('building_zones').select('location_id').order('location_id')),
      );
    } catch (e) {
      error = e;
      captureException(e, { where: 'hydrateZoneCounts' });
    }
    zoneCountsHydrated = true;
    if (!error && data) {
      const counts = {};
      for (const row of data) counts[row.location_id] = (counts[row.location_id] || 0) + 1;
      zoneCounts = counts;
      emitCounts();
    }
  })();
  return zoneCountsPromise;
}

// Hook returning { locationId → count } for every building that has
// zones. One query per mount instead of N per-building hydrations; a
// good fit for the tree view where we want totals per subtree.
export function useAllZoneCounts() {
  const [counts, setCounts] = useState(() => ({ ...zoneCounts }));
  useEffect(() => {
    const fn = (next) => setCounts(next);
    zoneCountListeners.add(fn);
    hydrateZoneCounts();
    return () => zoneCountListeners.delete(fn);
  }, []);
  return counts;
}

// ────── full-zone cache (for ecosystem-scope route pickers, Phase 10f)

let allZonesCache = [];
let allZonesHydrated = false;
let allZonesPromise = null;
const allZonesListeners = new Set();
function emitAllZones() {
  allZonesListeners.forEach((fn) => fn(allZonesCache.slice()));
}

async function hydrateAllZones() {
  if (allZonesHydrated) return;
  if (allZonesPromise) return allZonesPromise;
  allZonesPromise = (async () => {
    // Scope platform admins to the active org (is_platform_admin RLS bypass
    // would otherwise load every tenant's zones into this picker cache).
    const orgId = getSession()?.organizationId || null;
    const scopeAdmin = (q) => (getSession()?.isPlatformAdmin && orgId ? q.eq('organization_id', orgId) : q);
    let data = null,
      error = null;
    try {
      data = await fetchAllPaginated(() =>
        scopeAdmin(supabase.from('building_zones').select('*').order('location_id').order('floor').order('sort_order')),
      );
    } catch (e) {
      error = e;
      captureException(e, { where: 'hydrateAllZones' });
    }
    allZonesHydrated = true;
    if (!error && data) {
      allZonesCache = data;
      emitAllZones();
    }
  })();
  return allZonesPromise;
}

// Hook returning every zone row across every building. One query,
// filtered client-side by callers. Feeds the Route modal's zone
// picker when the route's location is an ecosystem (the zones come
// from N descendant buildings, not one).
export function useAllZones() {
  const [rows, setRows] = useState(() => allZonesCache.slice());
  useEffect(() => {
    const fn = (next) => setRows(next);
    allZonesListeners.add(fn);
    hydrateAllZones();
    return () => allZonesListeners.delete(fn);
  }, []);
  return rows;
}
