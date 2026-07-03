// Shared locations — persisted in Postgres so they're visible across
// every user/browser. Static BUILDINGS from data.js stay client-side as
// demo seed; anything created via the Admin → Locations UI lives in
// public.locations + public.location_devices.

import { useEffect, useState } from 'react';
import { BUILDINGS as STATIC_BUILDINGS } from './data.js';
import { supabase } from './supabase.js';
import { getSession } from './auth.js';
import { fetchAllPaginated } from './pagination.js';
import { registerAuthAwareCache } from './use-auth-aware-cache.js';
import { triggerQuantitySync } from './subscription-data.js';

// ────── in-memory cache so reads stay synchronous
let customCache = {}; // { [locationId]: locationRecord }
let devicesCache = {}; // { [locationId]: Array<row> }
let hydrated = false;
let hydratingPromise = null;

// Phase H-6: the locations table now also stores tree-interior nodes
// (floors, rooms) for the Hypervisor tree view. Those should NEVER
// appear in the building/workspace picker — only top-level buildings
// and ecosystems are pickable. Allowlist by kind: anything that's
// not a recognised pickable kind stays in customCache (so
// breadcrumbFor / childrenOf still work) but is filtered out of the
// picker materializers.
const PICKABLE_KINDS = new Set(['building', 'ecosystem']);
function isPickable(rec) {
  // Pre-Phase-H-6 rows had no `kind` set (legacy demo seeds). Treat
  // missing kind as pickable to avoid hiding old buildings; any new
  // row has a kind set explicitly by its seeder.
  if (!rec || !rec.kind) return true;
  return PICKABLE_KINDS.has(rec.kind);
}

const listeners = new Set();
const deviceListeners = new Set();

function emit() {
  listeners.forEach((fn) => fn({ ...customCache }));
}
function emitDevices(locationId) {
  deviceListeners.forEach((fn) => fn(locationId, devicesCache[locationId] || []));
}

// ────── schema shape helpers (db row ↔ client record)

function fromRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    variant: r.variant || undefined,
    name: r.name,
    addr: r.addr || '',
    floors: r.floors || 1,
    sqft: r.sqft || '—',
    displays: r.displays || 0,
    sensors: r.sensors || 0,
    occupancy: r.occupancy != null ? Number(r.occupancy) : 0.5,
    peakToday: r.peak_today != null ? Number(r.peak_today) : 0.7,
    branches: r.branches || undefined,
    sites: Array.isArray(r.sites) ? r.sites : [],
    parentId: r.parent_id || null,
    custom: r.custom !== false,
    // Phase 14g: map coordinates. Nullable both ways.
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    // Phase J-3: keep the owning org so the building picker can
    // filter out rows that aren't part of the active workspace.
    organizationId: r.organization_id || null,
  };
}

function toRow(rec) {
  // PR2: honor rec.organizationId when the caller explicitly stamps it
  // (so a contractor creating under a contracted FM building can inherit
  // the FM's org — see createChildLocation), and fall back to the session
  // org otherwise.
  const orgId = rec.organizationId || getSession()?.organizationId || null;
  return {
    id: rec.id,
    kind: rec.kind,
    variant: rec.variant || null,
    name: rec.name,
    addr: rec.addr || null,
    floors: rec.floors ?? 1,
    sqft: rec.sqft || null,
    displays: rec.displays ?? 0,
    sensors: rec.sensors ?? 0,
    occupancy: rec.occupancy ?? 0.5,
    peak_today: rec.peakToday ?? 0.7,
    branches: rec.branches ?? null,
    sites: rec.sites || [],
    parent_id: rec.parentId || null,
    custom: rec.custom !== false,
    organization_id: orgId,
    // owner_org_id + manager_org_id are NOT NULL on `locations`. They
    // matter for the contractor-managed-buildings split (an FM org owns
    // the building; a contractor org may manage day-to-day ops). For
    // self-serve creation both default to the writing org — callers
    // can override later via Hypervisor. Without this default, every
    // first building creation for a fresh tenant 23502s. Bit us in
    // FirstRunEmpty smoke-test 2026-05-18.
    owner_org_id: rec.ownerOrgId || orgId,
    manager_org_id: rec.managerOrgId || orgId,
  };
}

// ────── hydration: first call fetches everything, subsequent calls reuse.

async function hydrateOnce() {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    // Paginated past PostgREST's 1000-row cap. Meridian alone is 411
    // rows (1 building + 50 floors + 360 rooms); customers with bigger
    // location trees would silently truncate without paging.
    // Platform admins bypass per-org RLS (is_platform_admin) and would load
    // EVERY tenant's location tree into customCache (which backs every
    // BuildingSwitcher). Scope them to the active org. Non-admins (customers +
    // contractors) are already correctly scoped by RLS — must NOT filter them
    // or a contractor's managed-building view breaks.
    const orgId = getSession()?.organizationId || null;
    const scopeAdmin = (q) => (getSession()?.isPlatformAdmin && orgId ? q.eq('organization_id', orgId) : q);
    try {
      // rls-perf-ok: customers rely on RLS scoping; locations_read is hoisted +
      // indexed (mig 265), so the whole-org scan stays well under the 8s timeout.
      const data = await fetchAllPaginated(() => scopeAdmin(supabase.from('locations').select('*').order('id')));
      customCache = Object.fromEntries(data.map((r) => [r.id, fromRow(r)]));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[custom-locations] hydrate failed:', e.message);
    }
    hydrated = true;
    emit();
  })();
  return hydratingPromise;
}

// Drop stale cache when the active user changes — otherwise a previous
// user's location tree (or platform admin's cross-org view) leaks into
// the next user's view on the same browser. This is the most acute leak
// of the seven modules: customCache backs every BuildingSwitcher.
registerAuthAwareCache({
  resetHydrate: () => {
    hydrated = false;
    hydratingPromise = null;
  },
  onSignOut: () => {
    customCache = {};
    devicesCache = {};
    emit();
  },
  onSignIn: () => hydrateOnce(),
});

async function hydrateDevicesFor(locationId) {
  if (devicesCache[locationId]) return devicesCache[locationId];
  const { data, error } = await supabase
    .from('location_devices')
    .select('row_data')
    .eq('location_id', locationId)
    .order('created_at', { ascending: true });
  devicesCache[locationId] = error ? [] : data.map((r) => r.row_data);
  emitDevices(locationId);
  return devicesCache[locationId];
}

// ────── public sync reads (cached)

export function loadCustomLocations() {
  // Kick off hydration in the background; first call returns whatever's
  // cached so far (may be empty on the very first render).
  if (!hydrated) hydrateOnce();
  return { ...customCache };
}

export function getAllBuildings() {
  // Filter out tree-interior nodes (floors, rooms) — they live in
  // the same `locations` table but aren't pickable as buildings.
  const merged = { ...STATIC_BUILDINGS, ...loadCustomLocations() };
  const out = {};
  for (const [id, rec] of Object.entries(merged)) {
    if (isPickable(rec)) out[id] = rec;
  }
  return out;
}

// Phase J-3 / L-1.5: buildings scoped to the active org. STATIC_BUILDINGS
// (hq, hospital, nybank, imf) are visual templates — they're only
// surfaced in the picker when their corresponding DB row actually
// exists for this workspace. Lets us delete e.g. nybank from the DB
// and have it disappear from the switcher, while keeping the static
// def around as a recipe for the day we want to re-introduce it.
export function getBuildingsForOrg(orgId) {
  const out = {};
  const custom = loadCustomLocations();
  // Static defs only render when there's a matching DB row for this
  // org. The DB row is the authority on visibility; the static def
  // adds visual polish (colors, hero copy, ascii art) on top.
  for (const [id, staticDef] of Object.entries(STATIC_BUILDINGS)) {
    const dbRow = custom[id];
    if (!dbRow) continue;
    if (dbRow.organizationId && dbRow.organizationId !== orgId) continue;
    if (!isPickable(dbRow)) continue;
    out[id] = { ...staticDef, ...dbRow };
  }
  // Non-static (purely DB-defined) buildings for this org. Tree-
  // interior rows (floors/rooms — kind not in PICKABLE_KINDS) are
  // skipped so the workspace picker only shows real buildings.
  for (const [id, rec] of Object.entries(custom)) {
    if (STATIC_BUILDINGS[id]) continue; // handled above
    if (!isPickable(rec)) continue;
    if (!rec.organizationId || rec.organizationId === orgId) {
      out[id] = rec;
    }
  }
  return out;
}

// Org-scoped version of useAllBuildings — reads the caller's
// current session.organizationId and filters customCache buildings
// by it. Prefer this in surfaces that render a picker or assume a
// single active workspace (topbar, sidebar, admin).
//
// Returns a proxy-like object with an extra `__ready` flag so callers
// that auto-correct stale state can wait for the first DB hydrate
// before acting. Without this, an auto-select fires against only the
// static building set (first render) and stomps the persisted pick.
export function useBuildingsForActiveOrg() {
  const [state, setState] = useState(() => {
    const orgId = getSession()?.organizationId || null;
    return { buildings: getBuildingsForOrg(orgId), ready: hydrated };
  });
  useEffect(() => {
    const fn = () => {
      const orgId = getSession()?.organizationId || null;
      setState({ buildings: getBuildingsForOrg(orgId), ready: true });
    };
    listeners.add(fn);
    hydrateOnce().then(fn);
    return () => listeners.delete(fn);
  }, []);
  // Preserve the previous return shape (a plain map of id → building)
  // by stashing `ready` on a non-enumerable property so iteration over
  // the buildings set is unaffected.
  const result = state.buildings;
  Object.defineProperty(result, '__ready', { value: state.ready, enumerable: false, configurable: true });
  return result;
}

export function getDevicesForLocation(locationId) {
  // If we haven't fetched yet, kick it off — callers get [] for now
  // and re-render when the fetch completes (via the hook below).
  if (!(locationId in devicesCache)) hydrateDevicesFor(locationId);
  return devicesCache[locationId] || [];
}

export function useDevicesForLocation(locationId) {
  const [rows, setRows] = useState(() => getDevicesForLocation(locationId));
  useEffect(() => {
    const fn = (id, next) => {
      if (id === locationId) setRows(next.slice());
    };
    deviceListeners.add(fn);
    hydrateDevicesFor(locationId).then((next) => setRows((next || []).slice()));
    return () => deviceListeners.delete(fn);
  }, [locationId]);
  return rows;
}

// ────── public async writes

export async function createBuilding({ id, name, addr, floors, sqft, displays, sensors, parentId }) {
  if (!id || !name) throw new Error('ID and name required.');
  await hydrateOnce();
  if (STATIC_BUILDINGS[id] || customCache[id]) throw new Error('A location with this ID already exists.');

  const rec = {
    id,
    kind: 'building',
    name,
    addr: addr || '',
    floors: +floors || 1,
    sqft: sqft || '—',
    displays: +displays || 0,
    sensors: +sensors || 0,
    occupancy: 0.5,
    peakToday: 0.7,
    parentId: parentId || null,
    custom: true,
  };
  const { data, error } = await supabase.from('locations').insert(toRow(rec)).select().single();
  if (error) throw new Error(error.message);
  customCache[data.id] = fromRow(data);
  emit();
  // Pro orgs are billed per-building. No-op for everyone else.
  triggerQuantitySync();
  return customCache[data.id];
}

export async function createEcosystem({ id, name, addr, sites, parentId }) {
  if (!id || !name) throw new Error('ID and name required.');
  await hydrateOnce();
  if (STATIC_BUILDINGS[id] || customCache[id]) throw new Error('A location with this ID already exists.');

  const safeSites = Array.isArray(sites) ? sites : [];
  const rec = {
    id,
    kind: 'ecosystem',
    variant: 'custom',
    name,
    addr: addr || '',
    branches: safeSites.length,
    sites: safeSites,
    displays: 0,
    sensors: 0,
    floors: 1,
    sqft: '—',
    occupancy: 0.5,
    peakToday: 0.7,
    parentId: parentId || null,
    custom: true,
  };
  const { data, error } = await supabase.from('locations').insert(toRow(rec)).select().single();
  if (error) throw new Error(error.message);
  customCache[data.id] = fromRow(data);
  emit();
  return customCache[data.id];
}

// Phase 2 of the Hypervisor admin rework. Creates a tree-interior
// child node (floor / restroom / meeting_room / zone / etc.) under
// any existing parent the caller has write access to. RLS enforces
// the access check; we just slug-ify the id deterministically and
// fan out the row write.
//
// Caller passes:
//   { parentId, kind, name, idHint? }
// We derive id = parentId + '-' + slug(idHint || kind + name) when
// the parent has a stable id like 'hq' / 'hq-fl-32'. This keeps the
// dash-bounded prefix-match contract that existing helpers rely on
// (devicesForBuilding, locationDescendants, etc.).
export async function createChildLocation({ parentId, kind, name, idHint = null }) {
  if (!parentId) throw new Error('parentId required');
  if (!kind) throw new Error('kind required');
  if (!name?.trim()) throw new Error('name required');
  await hydrateOnce();
  const parent = customCache[parentId];
  if (!parent) throw new Error(`Parent location ${parentId} not found in tree.`);

  const slug = (idHint || `${kind}-${name}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const baseId = `${parentId}-${slug}`;
  // Suffix on collision so two siblings named the same don't break.
  let id = baseId;
  let n = 2;
  while (customCache[id]) {
    id = `${baseId}-${n}`;
    n += 1;
  }

  const rec = {
    id,
    kind,
    name: name.trim(),
    addr: '',
    floors: 1,
    sqft: '—',
    displays: 0,
    sensors: 0,
    occupancy: 0.5,
    peakToday: 0.7,
    parentId,
    custom: true,
    // PR2: a contractor admin creating a floor/room under a contracted
    // FM building inherits the FM's organization_id from the parent,
    // not the caller's session org. RLS expects this stamping for the
    // `_contractor_managed` write policies to pass. For non-contractor
    // flows the parent's org equals the caller's session org so this
    // is a no-op rename of where the org id comes from.
    organizationId: parent.organizationId || getSession()?.organizationId || null,
  };
  const { data, error } = await supabase.from('locations').insert(toRow(rec)).select().single();
  if (error) throw new Error(error.message);
  customCache[data.id] = fromRow(data);
  emit();
  return customCache[data.id];
}

// PR3 — Contractor self-serve. Creates a brand-new top-level building
// row owned by the caller's org (must be a contractor-kind org per
// RLS). Used by ContractorApp's Buildings tab "+ New building" CTA so
// a contractor can spin up a building they service without an FM
// counterparty.
// Contractor org alternative create-building path. Contractor Pro is
// flat-priced (quantity always 1), so triggerQuantitySync is intentionally
// not wired here — the sync endpoint would no-op anyway. Left documented
// so a future contractor-tiered pricing change has a known TODO.
export async function createTopLevelBuilding({ name }) {
  if (!name?.trim()) throw new Error('name required');
  await hydrateOnce();
  const session = getSession();
  const orgId = session?.organizationId;
  if (!orgId) throw new Error('no active org');

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'building';
  let id = slug;
  let n = 2;
  while (customCache[id]) {
    id = `${slug}-${n}`;
    n += 1;
  }

  const rec = {
    id,
    kind: 'building',
    name: name.trim(),
    parentId: null,
    custom: true,
    organizationId: orgId,
  };
  const { data, error } = await supabase.from('locations').insert(toRow(rec)).select().single();
  if (error) throw new Error(error.message);
  customCache[data.id] = fromRow(data);
  emit();
  return customCache[data.id];
}

// Phase 4 — bulk-load helper for the Hypervisor admin CSV import.
// Takes [{ parentId, kind, name, idHint? }, …] and creates them
// sequentially. Returns { ok, failed } where ok is the count of
// successful creates and failed is an array of { row, error }
// for the rows that didn't make it. Sequential rather than
// parallel because the slug-collision retry logic in
// createChildLocation reads the latest cache state — running them
// in parallel would race on collision suffixes.
export async function bulkCreateChildLocations(rows) {
  const safe = Array.isArray(rows) ? rows : [];
  let ok = 0;
  const failed = [];
  for (let i = 0; i < safe.length; i += 1) {
    const r = safe[i];
    try {
      await createChildLocation(r);
      ok += 1;
    } catch (e) {
      failed.push({ row: r, index: i, error: e?.message || String(e) });
    }
  }
  return { ok, failed };
}

export async function deleteLocation(id) {
  // Peek at the row before deletion so we know whether to fire the
  // per-building quantity sync. Floors/rooms don't count against Pro
  // billing, and Hypervisor bulk-delete can churn through hundreds of
  // them — gating on kind here avoids hammering the sync endpoint.
  const wasBuilding = (customCache[id] || STATIC_BUILDINGS[id])?.kind === 'building';
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw new Error(error.message);
  delete customCache[id];
  delete devicesCache[id];
  emit();
  emitDevices(id);
  if (wasBuilding) triggerQuantitySync();
}

// Update an existing location (name / addr / parent / floors / etc.).
// The id and `custom` flag are immutable — id is referenced from zones,
// routes, etc. Cycle protection: if the new parent is this row or any
// of its descendants, the update is rejected client-side. Phase 14a
// promoted the four seeded buildings (hq, hospital, nybank, imf) into
// real DB rows, so editing them is allowed now — the former
// STATIC_BUILDINGS guard is dropped. RLS remains the authority on
// "is this user allowed to write"; the DB row has to exist for the
// update to succeed, which it will for any location the UI shows.
export async function updateLocation(id, patch) {
  if (!id) throw new Error('id required');
  if (!customCache[id]) throw new Error('This location is not backed by a database row yet.');

  if (patch.parentId) {
    if (patch.parentId === id) throw new Error('A location cannot be its own parent.');
    if (isAncestor(id, patch.parentId)) {
      throw new Error('Cannot make a descendant of this location its parent (would create a cycle).');
    }
  }

  const clean = {};
  const fields = ['name', 'addr', 'floors', 'sqft', 'displays', 'sensors', 'branches'];
  for (const k of fields) {
    if (patch[k] !== undefined) clean[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  }
  // Accept either parentId (legacy callers) or parent_id (shared
  // LocationDrawer that uses the DB-native snake_case shape).
  if (patch.parentId !== undefined) clean.parent_id = patch.parentId || null;
  if (patch.parent_id !== undefined) clean.parent_id = patch.parent_id || null;
  // Phase 14g: lat/lng patches accept numbers or empty-string (→ null)
  if (patch.latitude !== undefined) clean.latitude = patch.latitude === '' ? null : Number(patch.latitude);
  if (patch.longitude !== undefined) clean.longitude = patch.longitude === '' ? null : Number(patch.longitude);

  const { data, error } = await supabase.from('locations').update(clean).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  customCache[data.id] = fromRow(data);
  emit();
  return customCache[data.id];
}

export async function addDevicesToLocation(locationId, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) return devicesCache[locationId] || [];

  const orgId = getSession()?.organizationId || null;
  const payload = safeRows.map((row) => ({
    location_id: locationId,
    kind: /display|sdg|screen/i.test(row.type || '') ? 'display' : 'sensor',
    row_data: row,
    organization_id: orgId,
  }));
  const { error } = await supabase.from('location_devices').insert(payload);
  if (error) throw new Error(error.message);

  // Recount + push new counts onto the location record so the Admin
  // tile shows the updated display/sensor totals.
  devicesCache[locationId] = [...(devicesCache[locationId] || []), ...safeRows];
  const displays = devicesCache[locationId].filter((d) => /display|sdg|screen/i.test(d.type || '')).length;
  const sensors = devicesCache[locationId].length - displays;
  const { data: updated, error: upErr } = await supabase
    .from('locations')
    .update({ displays, sensors })
    .eq('id', locationId)
    .select()
    .single();
  if (!upErr && updated) {
    customCache[updated.id] = fromRow(updated);
    emit();
  }
  emitDevices(locationId);
  return devicesCache[locationId];
}

// Phase 14a: does this location have a real DB row? After the 14a
// migration every building visible in the UI should — the seeded
// statics were backfilled — but a UI that hydrated before the
// migration might not yet know about them. This is the gate for
// Edit / Delete / History buttons: if it's not in the DB, we can't
// update or audit it.
export function isDbBacked(id) {
  return !!customCache[id];
}

// ────── tree helpers (Phase 9a)

// Return the breadcrumb chain for a location as an array of records,
// root ecosystem first, target last. Walks parentId up through the
// merged static + custom map; null-safe on broken links.
export function breadcrumbFor(locationId) {
  const all = getAllBuildings();
  const chain = [];
  const seen = new Set();
  let cur = all[locationId];
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? all[cur.parentId] : null;
  }
  return chain;
}

// Return direct children of an ecosystem. Merges two sources:
//  1. Legacy `sites` JSONB on the parent (pre-Phase-9a ecosystems
//     carried their children inline, not as rows).
//  2. Any real location rows with parent_id = ecosystemId.
export function childrenOf(ecosystemId) {
  const all = getAllBuildings();
  const parent = all[ecosystemId];
  const fromRows = Object.values(all).filter((b) => b.parentId === ecosystemId);
  const fromSites = Array.isArray(parent?.sites) ? parent.sites : [];
  // Deduplicate: sites may reference ids that also exist as real rows.
  const seen = new Set(fromRows.map((r) => r.id));
  const legacySites = fromSites.filter((s) => !seen.has(s.id));
  return [...fromRows, ...legacySites];
}

// Like breadcrumbFor() but walks the RAW customCache rather than the
// pickable subset returned by getAllBuildings(). Required by callers
// that need to walk through tree-interior nodes (floors, rooms) — for
// example the Hypervisor right-pane room-context hook needs to walk
// from a Mailroom up through its floor to the building root, neither
// of which is in getAllBuildings()'s output.
export function breadcrumbForAny(locationId) {
  if (!locationId) return [];
  const all = customCache;
  if (!all) return [];
  const chain = [];
  const seen = new Set();
  let cur = all[locationId];
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? all[cur.parentId] : null;
  }
  return chain;
}

// True if `ancestorId` appears anywhere in `descendantId`'s parent chain.
// Used to prevent cycles when assigning a parent, and for rollups later.
export function isAncestor(ancestorId, descendantId) {
  const all = getAllBuildings();
  const seen = new Set();
  let cur = all[descendantId];
  while (cur && !seen.has(cur.id)) {
    if (cur.parentId === ancestorId) return true;
    seen.add(cur.id);
    cur = cur.parentId ? all[cur.parentId] : null;
  }
  return false;
}

// ────── Location edit history (Phase 13a — audit log reader)
// Fetched on demand per location, not hydrated globally. No cache —
// history is viewed rarely and we always want fresh rows.
export async function fetchLocationHistory(locationId, limit = 50) {
  if (!locationId) return [];
  const { data, error } = await supabase
    .from('location_edits')
    .select('id, action, before_value, after_value, actor_id, actor_name, created_at')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[locations] history fetch failed:', error.message);
    return [];
  }
  return data || [];
}

export function useLocationHistory(locationId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!locationId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchLocationHistory(locationId).then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);
  return { rows, loading };
}

// All location ids in the subtree rooted at `rootId` (inclusive).
// Walks both parent_id rows AND legacy `sites` JSONB children.
export function descendantIds(rootId) {
  const out = new Set();
  const walk = (id) => {
    if (!id || out.has(id)) return;
    out.add(id);
    for (const child of childrenOf(id)) walk(child.id);
  };
  walk(rootId);
  return out;
}

// Compact room directory for the chat system prompt — gives Merlin a
// concrete inventory of what rooms exist in the selected building so
// it can recognize them by name (e.g. 'Mailroom', 'Boardroom', 'Server
// Room') instead of replying 'I don't have a Mailroom in this view'.
//
// Returns:
//   { floors: 50,
//     namedRooms: [{ kind, name }, ...],     // singleton-ish kinds (mailroom, lobby, dock, …)
//     repeatedRooms: { restroom: 200, meeting_room: 144, ... }
//   }
//
// `namedRooms` enumerates rooms whose kind appears <= NAMED_ROOM_CAP
// times — meeting_room and restroom (200/144) get aggregated so the
// prompt stays compact; the eight singleton kinds (mailroom / lobby /
// dock / cafeteria / boardroom / auditorium / server_room / amenity)
// get listed by name.
const NAMED_ROOM_CAP = 12;
export function roomDirectoryFor(buildingId) {
  if (!buildingId) return null;
  // customCache holds every locations row including floors + rooms;
  // getAllBuildings() filters those out for the picker. Read directly.
  const all = customCache;
  if (!all || Object.keys(all).length === 0) return null;
  // Subtree walk using parent_id (rooms tend to be children of floors,
  // floors are children of the building root).
  const subtreeIds = new Set();
  const queue = [buildingId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (subtreeIds.has(id)) continue;
    subtreeIds.add(id);
    for (const rec of Object.values(all)) {
      if (rec.parentId === id) queue.push(rec.id);
    }
  }
  let floors = 0;
  const byKind = new Map(); // kind -> [{ id, name }, ...]
  for (const id of subtreeIds) {
    const rec = all[id];
    if (!rec || rec.id === buildingId) continue;
    if (rec.kind === 'floor') {
      floors += 1;
      continue;
    }
    if (!byKind.has(rec.kind)) byKind.set(rec.kind, []);
    byKind.get(rec.kind).push({ id: rec.id, name: rec.name });
  }
  const namedRooms = [];
  const repeatedRooms = {};
  for (const [kind, rooms] of byKind.entries()) {
    if (rooms.length <= NAMED_ROOM_CAP) {
      for (const r of rooms) namedRooms.push({ kind, name: r.name });
    } else {
      repeatedRooms[kind] = rooms.length;
    }
  }
  // Stable readable order: alphabetical by kind then name.
  namedRooms.sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name));
  return { floors, namedRooms, repeatedRooms };
}

// Per-kind floor/room counts for a building — factual tree stats for the
// Building page. Same subtree walk as roomDirectoryFor, but returns plain
// counts: { floors, totalRooms, byKind: { <kind>: count } }. Reads customCache
// directly (holds floors + rooms, which the picker filters out), so it works
// for any building the caller can read (incl. a contractor's client building
// via RLS). Null until the cache hydrates.
export function roomKindCountsFor(buildingId) {
  if (!buildingId) return null;
  const all = customCache;
  if (!all || Object.keys(all).length === 0) return null;
  const subtreeIds = new Set();
  const queue = [buildingId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (subtreeIds.has(id)) continue;
    subtreeIds.add(id);
    for (const rec of Object.values(all)) {
      if (rec.parentId === id) queue.push(rec.id);
    }
  }
  let floors = 0;
  let totalRooms = 0;
  const byKind = {};
  for (const id of subtreeIds) {
    const rec = all[id];
    if (!rec || rec.id === buildingId) continue;
    if (rec.kind === 'floor') {
      floors += 1;
      continue;
    }
    byKind[rec.kind] = (byKind[rec.kind] || 0) + 1;
    totalRooms += 1;
  }
  return { floors, totalRooms, byKind };
}

// Reactive version — re-counts when the locations cache hydrates/changes.
export function useRoomKindCounts(buildingId) {
  const [counts, setCounts] = useState(() => roomKindCountsFor(buildingId));
  useEffect(() => {
    const fn = () => setCounts(roomKindCountsFor(buildingId));
    listeners.add(fn);
    hydrateOnce().then(fn);
    fn();
    return () => listeners.delete(fn);
  }, [buildingId]);
  return counts;
}

// The authoritative location record for a building, straight from the hydrated
// cache (the full DB row: addr, sqft, displays, sensors, occupancy, lat/long, …).
// Prefer this over a possibly-static `building` prop for factual display — e.g.
// a contractor's active `building` is the static template (no coordinates), but
// the client building's real row IS in the cache via RLS. Null until hydrated.
export function useBuildingRecord(buildingId) {
  const [rec, setRec] = useState(() => (buildingId ? customCache[buildingId] || null : null));
  useEffect(() => {
    const fn = () => setRec(buildingId ? customCache[buildingId] || null : null);
    listeners.add(fn);
    hydrateOnce().then(fn);
    fn();
    return () => listeners.delete(fn);
  }, [buildingId]);
  return rec;
}

// Flatten the tree into a DFS walk, producing picker-friendly options
// with breadcrumb labels and a depth counter. Siblings cluster under
// their parent so native <select> dropdowns read like a tree even
// without nested markup. Pass kind to filter ('building', 'ecosystem'
// or null for all).
export function flattenTreeForPicker(buildings, { kind = null } = {}) {
  const tree = buildTree(buildings);
  const out = [];
  const walk = (node, depth) => {
    if (kind === null || node.kind === kind) {
      const chain = breadcrumbFor(node.id)
        .map((c) => c.name)
        .join(' › ');
      out.push({ id: node.id, label: chain || node.name, depth, kind: node.kind });
    }
    (node.children || []).forEach((c) => walk(c, depth + 1));
  };
  tree.forEach((n) => walk(n, 0));
  return out;
}

// Build a nested tree from the flat building map. Returns an array of
// top-level nodes ({ ...building, children: [...] }) sorted by name.
// Orphaned children (parent_id refers to something missing) appear at
// the top level.
export function buildTree(buildings) {
  const byParent = {};
  for (const b of Object.values(buildings)) {
    const pid = b.parentId && buildings[b.parentId] ? b.parentId : '__ROOT__';
    (byParent[pid] ||= []).push(b);
  }
  const attachChildren = (b) => ({
    ...b,
    children: (byParent[b.id] || []).map(attachChildren).sort((a, z) => a.name.localeCompare(z.name)),
  });
  return (byParent['__ROOT__'] || []).map(attachChildren).sort((a, z) => a.name.localeCompare(z.name));
}
