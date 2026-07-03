// Devices — Phase H-2. Postgres-backed device fleet, scoped per
// building. Replaces the frozen client-side FLEET export in
// devices-data.js that every surface used to render regardless of
// active org or building.
//
// Shape mirrors routes-data.js: a single in-memory cache + listener
// set, one RLS-scoped hydrate-on-mount, derived views as pure helpers
// on top. No localStorage persistence — a 50-floor tower can have
// 3,000+ rows and JSON-serializing that on every write is the wrong
// trade. Cold start refetches from Postgres.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { getSession } from './auth.js';
import { descendantIds } from './custom-locations.js';
import { captureException } from './sentry.js';

// ────── static kind metadata (visual shapes, not persisted)
// The DB stores `kind` as one of these ids; this map carries the
// display label, icon name, description, and default uplink/power
// characteristics that the UI renders around the row. Moving this
// into a table is an option later; for now the ten types evolve
// rarely and live alongside the icon imports.

export const DEVICE_KINDS = {
  display_touch: {
    label: 'Touch eInk Display',
    short: 'Touch eInk',
    sku: 'ADX-TD-12',
    icon: 'display',
    desc: '12" touch eInk panel · LTE-M uplink + BLE aggregator · NFC check-in · 10 feedback buttons · 3-year battery',
    uplink: 'lte',
    power: 'battery',
  },
  display_eink: {
    label: 'eInk Display',
    short: 'eInk',
    sku: 'ADX-ED-7',
    icon: 'display',
    desc: '7" passive eInk status panel · LTE-M uplink + BLE aggregator · 5-year battery',
    uplink: 'lte',
    power: 'battery',
  },
  display_sdg: {
    label: 'Smart Display',
    short: 'SDG',
    sku: 'ADX-SDG-7',
    icon: 'display',
    desc: '7" passive eInk restroom display · LTE-M uplink · NFC cleaning check-in · 5-year battery',
    uplink: 'lte',
    power: 'battery',
  },
  smart_display_classic: {
    label: 'Smart Display Classic',
    short: 'SDC',
    sku: 'ADX-SDC-V1',
    icon: 'display',
    desc: '7" e-ink panel · 4 physical side buttons · embedded NFC reader · LTE backhaul · 3-year battery · manual on-site firmware update only',
    uplink: 'lte',
    power: 'battery',
  },
  people_counter_basic: {
    label: 'People Counter Basic',
    short: 'PCB',
    sku: 'ADX-PCB-V1',
    icon: 'people',
    desc: 'PIR-only people counter · LTE backhaul · 3-year battery · interval reporting + programmable threshold trip · two variants: PCB-V1B (BLE-updatable firmware) and PCB-V1L (manual-only firmware)',
    uplink: 'lte',
    power: 'battery',
  },
  smart_logger_basic: {
    label: 'Smart Logger Basic',
    short: 'SLB',
    sku: 'ADX-SLB-V1',
    icon: 'badge',
    desc: '6-button service logger for cleaning + security crews · NFC badge reader · Begin / End service + 4 operator-configurable service buttons · LTE backhaul · 3-year battery',
    uplink: 'lte',
    power: 'battery',
  },
  parking_spot_sensor: {
    label: 'Parking Spot Sensor',
    short: 'PSS',
    sku: 'ADX-PSS-V1',
    icon: 'beacon',
    desc: 'In-ground BLE magnetometer puck \u00b7 per-spot occupancy detection \u00b7 5\u20137 year battery \u00b7 uplinks via PCB-style aggregator',
    uplink: 'ble',
    power: 'battery',
  },
  ev_charger: {
    label: 'EV Charger',
    short: 'EVC',
    sku: 'OCPP-1.6',
    icon: 'bolt',
    desc: '3rd-party OCPP-compatible charger \u00b7 session start/end + fault notifications \u00b7 wired AC or DC fast',
    uplink: 'mqtt',
    power: 'wired',
  },
  airq: {
    label: 'Air Quality',
    short: 'Air Q',
    sku: 'ADX-AQ-3',
    icon: 'air',
    desc: 'TVOC + CO\u2082 + PM 2.5 + humidity · BLE · 3-year battery',
    uplink: 'ble',
    power: 'battery',
  },
  occupancy: {
    label: 'Occupancy Sensor',
    short: 'Occ',
    sku: 'ADX-OC-2',
    icon: 'people',
    desc: 'mmWave + PIR presence · BLE · 3-year battery',
    uplink: 'ble',
    power: 'battery',
  },
  pc_counter: {
    label: 'People Counter',
    short: 'PC',
    sku: 'ADX-PC-2',
    icon: 'people',
    desc: 'Dual mmWave + PIR entry/exit counter · LTE-M cellular · 3-year battery',
    uplink: 'lte',
    power: 'battery',
  },
  camera: {
    label: 'Camera',
    short: 'Cam',
    sku: 'ADX-CM-4K',
    icon: 'camera',
    desc: '4K edge-AI camera with on-device privacy blur · BLE event-only · 3-year Li-SOCl\u2082 D-cell pack',
    uplink: 'ble',
    power: 'battery',
  },
  badge: {
    label: 'Badge Reader',
    short: 'Badge',
    sku: 'ADX-BR-1',
    icon: 'badge',
    desc: 'NFC + BLE dual-protocol reader · 3-year battery',
    uplink: 'ble',
    power: 'battery',
  },
  leak: {
    label: 'Water Leak Sensor',
    short: 'Leak',
    sku: 'ADX-WL-1',
    icon: 'droplet',
    desc: 'Capacitive leak puck · 5-year battery · BLE',
    uplink: 'ble',
    power: 'battery',
  },
  beacon: {
    label: 'Asset Beacon',
    short: 'Beacon',
    sku: 'ADX-AB-1',
    icon: 'beacon',
    desc: 'BLE 5.1 direction-finding beacon · 3-year coin cell',
    uplink: 'ble',
    power: 'battery',
  },
};

// Three-way device classification: displays, sensors, loggers.
// Used by FleetHero (Devices.jsx) and the Sidebar building picker —
// kept here so both sides of the split stay in sync as new device
// classes ship. Anything not in DISPLAY_KINDS or LOGGER_KINDS rolls
// into "sensors" (the catch-all bucket — air quality, occupancy,
// people counters, leak, beacon, camera, badge).
export const DISPLAY_KINDS = new Set(['display_touch', 'display_eink', 'display_sdg', 'smart_display_classic']);

export const LOGGER_KINDS = new Set(['smart_logger_basic']);

export function kindLabel(k) {
  return DEVICE_KINDS[k]?.label || k;
}

// ────── in-memory cache
// Flat array — fleet queries filter by location_id, so an object map
// would buy nothing. Listeners re-render consumers on mutation.

let cache = { devices: [] };
const listeners = new Set();

function emit() {
  const snap = { devices: cache.devices.slice() };
  listeners.forEach((fn) => fn(snap));
}

// ────── hydration
// One-shot. RLS scopes the read to (a) orgs the caller is a member
// of, plus (b) any building covered by an active contract the
// caller's org holds. A contractor sees exactly the manager-owned
// devices on their served sites; a manager sees their own fleet.

let hydrated = false;
let hydratingPromise = null;

async function hydrateOnce() {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    // PostgREST defaults to limit=1000 per request. With multiple
    // workspaces in scope (Meridian 787 + FEB1 581 + FEB2 581 ≈ 1.9k)
    // the unbounded select silently truncated, hiding entire ecosystems.
    // Page through until exhausted; keeps the cache complete.
    // Platform admins bypass per-org RLS (is_platform_admin) and would load
    // EVERY tenant's fleet into this shared store. Scope them to the active
    // org. Non-admins (customers + contractors) are already correctly scoped by
    // RLS — must NOT filter them or a contractor's manager-owned device view
    // breaks (contractors read the manager org's devices, not their own org's).
    const orgId = getSession()?.organizationId || null;
    const scopeAdmin = (q) => (getSession()?.isPlatformAdmin && orgId ? q.eq('organization_id', orgId) : q);
    const PAGE = 1000;
    const all = [];
    for (let from = 0; ; from += PAGE) {
      // rls-perf-ok: customers rely on RLS scoping; devices_read is hoisted +
      // guarded (mig 266) so it collapses to an indexed organization_id check
      // (~7ms), well under the 8s timeout that this read used to trip.
      const { data, error } = await scopeAdmin(
        supabase.from('devices').select('*').order('location_id').order('kind').order('external_id'),
      ).range(from, from + PAGE - 1);
      if (error) {
        // A failed read (e.g. an RLS-perf statement timeout — see migration 266)
        // must NOT be cached as an empty fleet: that silently renders
        // "0 devices · add your first" for orgs that actually have devices.
        // Report it and leave the store UN-hydrated so the next mount retries,
        // rather than freezing a false-empty fleet until a full page reload.
        captureException(error, { where: 'devices-store:hydrate', orgId });
        hydratingPromise = null;
        return;
      }
      const rows = data || [];
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    hydrated = true;
    cache.devices = all;
    emit();
  })();
  return hydratingPromise;
}

// ────── reads

// Fleet counts a la useAppData — drives the Devices hero tiles. Pure
// over the devices array so tests can call it directly.
export function computeFleetCounts(devices) {
  const counts = { total: devices.length, online: 0, degraded: 0, offline: 0, updating: 0, provisioning: 0 };
  for (const d of devices) {
    if (counts[d.status] != null) counts[d.status]++;
  }
  return counts;
}

// Group by kind — powers the type-breakdown tiles and the deployment
// planner (which kinds have how many units in which zone).
export function groupByKind(devices) {
  const by = {};
  for (const d of devices) (by[d.kind] ||= []).push(d);
  return by;
}

export function groupByZone(devices) {
  const by = { _unzoned: [] };
  for (const d of devices) {
    const key = d.zone_id || '_unzoned';
    (by[key] ||= []).push(d);
  }
  return by;
}

// The main hook. Returns devices for the passed building, plus pre-
// computed counts/groupings so consumers don't re-derive on every
// render. `ready` flips true after the first hydrate completes — UI
// can show a skeleton vs an empty-state vs real data based on it.
export function useDevices(building) {
  const [state, setState] = useState(() => ({ devices: cache.devices.slice(), ready: hydrated }));

  useEffect(() => {
    const fn = (snap) => setState({ devices: snap.devices, ready: true });
    listeners.add(fn);
    hydrateOnce().then(() => setState({ devices: cache.devices.slice(), ready: true }));
    return () => listeners.delete(fn);
  }, []);

  const scoped = useMemo(() => {
    if (!building?.id) return [];
    // Ecosystems aggregate devices from every descendant location
    // (regions, branches, sub-buildings). Without this walk, a parent
    // ecosystem like `feb` shows zero devices — its 581 SLBs are
    // attached to the region children (`feb-nyc`, `feb-long-island`,
    // …), not to `feb` itself.
    if (building?.kind === 'ecosystem') {
      const allowed = descendantIds(building.id);
      return state.devices.filter((d) => d.location_id && allowed.has(d.location_id));
    }
    // Buildings: prefix-match with dash separator so devices placed at
    // floor or room level (e.g. 'hq-fl-3-r-…') still belong to their
    // building ('hq'). The dash is required so 'feb' doesn't match
    // 'feb2-…' devices — id boundaries are dash-delimited.
    const prefix = building.id + '-';
    return state.devices.filter((d) => d.location_id === building.id || (d.location_id || '').startsWith(prefix));
  }, [state.devices, building?.id, building?.kind]);

  // Re-derive counts/groupings only when the scoped list changes.
  const counts = useMemo(() => computeFleetCounts(scoped), [scoped]);
  const byKind = useMemo(() => groupByKind(scoped), [scoped]);
  const byZone = useMemo(() => groupByZone(scoped), [scoped]);

  return { devices: scoped, counts, byKind, byZone, ready: state.ready };
}

// ────── view-model shim
// The existing DevicesUI.jsx + DeviceView.jsx read ~80 device fields in
// the shape devices-data.js produced (flat `type`/`battery`/`lte`/
// `embedded`/etc. on the row). Rather than rewrite every reference for
// H-4, we map DB rows through this single helper at the Devices.jsx
// handoff. Field map:
//
//   row.kind             → vm.type
//   row.external_id      → vm.id
//   row.aggregator_id    → vm.aggregator_id (resolved to external_id)
//   row.battery_pct      → vm.battery
//   row.firmware_latest  → vm.fw_latest
//   row.firmware_updating → vm.fw_updating
//   row.firmware_progress_pct → vm.fw_progress
//   row.telemetry.*      → spread onto vm (rssi, lte, embedded, etc.)
//   row.floor            → vm.floor + derived vm.zone + vm.location label
//   row.uplink (lowercase) → vm.uplink (uppercased for display)
//
// A future phase can migrate the UI to native DB fields and drop this.

// Client-side zone buckets for the scope picker — same shape the old
// Meridian-only ZONES array had, now generalized to any building.
export function computeZones(maxFloor) {
  const zones = [{ id: 'all', name: 'All floors', short: 'All' }];
  if (!maxFloor || maxFloor < 1) return zones;
  if (maxFloor <= 10) {
    // Small buildings — just All + Base & mech (if any devices on 0).
    zones.push({ id: 'bmech', name: 'Base / mechanical', short: 'Base & mech' });
    return zones;
  }
  const third = Math.ceil(maxFloor / 3);
  zones.push({ id: 'low', name: `Floors 1–${third}`, short: 'Low rise', floors: [1, third] });
  zones.push({
    id: 'mid',
    name: `Floors ${third + 1}–${2 * third}`,
    short: 'Mid rise',
    floors: [third + 1, 2 * third],
  });
  zones.push({
    id: 'high',
    name: `Floors ${2 * third + 1}–${maxFloor}`,
    short: 'High rise',
    floors: [2 * third + 1, maxFloor],
  });
  zones.push({ id: 'bmech', name: 'Base / mechanical', short: 'Base & mech' });
  return zones;
}

export function zoneForFloor(floor, maxFloor) {
  if (floor == null || floor <= 0) return 'bmech';
  if (!maxFloor || maxFloor <= 10) return 'low'; // unused for small buildings
  const third = Math.ceil(maxFloor / 3);
  if (floor <= third) return 'low';
  if (floor <= 2 * third) return 'mid';
  return 'high';
}

// Derive the "Floor 32 · East" style location label the old UI shows.
// We don't carry this in the DB (too coupled to the Meridian narrative),
// so we synthesize it from floor + a stable hash of the device id so
// the same row always renders the same side.
function locationLabel(row) {
  if (row.floor == null) return row.room || '—';
  if (row.floor <= 0) return 'Base · Mech';
  // Stable 0..3 bucket from uuid for consistent East/West/North/South.
  const h = (row.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const sides = ['East', 'West', 'North', 'South'];
  return `Floor ${row.floor} · ${sides[h % 4]}`;
}

// Map a raw DB row to the flat shape the old UI components expect.
// `aggregatorByUuid` is a { [uuid]: external_id } lookup so child
// sensors report their aggregator the way the old mock did.
export function toViewModel(row, { aggregatorByUuid = {}, maxFloor = 50 } = {}) {
  const t = row.telemetry || {};
  // Last-packet age: prefer an explicit telemetry value, else derive from the
  // real `last_seen` column (so DB devices that don't carry a synthetic
  // last_packet_s still show a real "Xm ago" instead of "NaNh ago").
  const lastPacketS =
    t.last_packet_s != null
      ? t.last_packet_s
      : row.last_seen
        ? Math.max(0, Math.round((Date.now() - new Date(row.last_seen).getTime()) / 1000))
        : null;
  return {
    // identity
    id: row.external_id || row.id,
    uuid: row.id,
    type: row.kind,
    aggregator_id: row.aggregator_id ? aggregatorByUuid[row.aggregator_id] || row.aggregator_id : null,

    // placement
    floor: row.floor,
    zone: zoneForFloor(row.floor, maxFloor),
    location: locationLabel(row),
    location_id: row.location_id, // raw id (e.g. 'imf-hq1-f10') — gates live-pilot rendering
    room: row.room,

    // state
    status: row.status,
    uplink: (row.uplink || '').toUpperCase(),

    // battery + firmware
    battery: row.battery_pct,
    battery_days_remaining: t.battery_days_remaining,
    battery_chemistry: row.battery_chemistry,
    battery_swappable: row.battery_swappable,
    firmware: row.firmware,
    fw_latest: row.firmware_latest,
    fw_behind: !!row.firmware_latest && row.firmware !== row.firmware_latest,
    fw_updating: row.firmware_updating,
    fw_progress: row.firmware_progress_pct,

    // timestamps
    install_date: row.install_date,
    last_seen: row.last_seen,
    created_at: row.created_at,
    last_packet_s: lastPacketS,
    uptime: t.uptime_pct,

    // sparse/per-kind telemetry
    rssi: t.rssi,
    lte: t.lte || null,
    embedded: t.embedded || null,
    display_tech: t.display_tech || null,
    ble_role: t.ble_role || null,
    ble_children: 0, // filled below if this row is an aggregator
    temp_c: t.temp_c,
    sensor: t.sensor,

    // fault
    error: row.error,
  };
}

// Derive "active rollouts" from device firmware state — H-5. A rollout
// is active for a kind when at least one device is behind (firmware !=
// firmware_latest) or actively updating. Groups the fleet by kind,
// counts lifecycle stages, and returns the shape the old static
// DEPLOYMENTS array used so DeploymentsSection + DeploymentsPage can
// consume it without a rewrite.

export function computeActiveRollouts(fleet) {
  // Group by kind, keyed on target firmware (firmware_latest).
  const byKindTarget = {};
  for (const d of fleet) {
    if (!d.fw_latest) continue;
    const key = `${d.type}::${d.fw_latest}`;
    (byKindTarget[key] ||= { kind: d.type, target: d.fw_latest, devices: [] }).devices.push(d);
  }

  const rollouts = [];
  for (const { kind, target, devices } of Object.values(byKindTarget)) {
    let planned = 0,
      installing = 0,
      live = 0;
    for (const d of devices) {
      if (d.fw_updating) installing++;
      else if (d.firmware === target) live++;
      else if (d.fw_behind) planned++;
    }
    const total = planned + installing + live;
    if (total === 0) continue;
    // No active work — everyone's already on target. Skip.
    if (planned === 0 && installing === 0) continue;

    rollouts.push({
      id: `rollout-${kind}`,
      name: `${kindLabel(kind)} firmware ${target}`,
      type: kind,
      zone: null,
      stages: { planned, shipped: 0, installing, live },
      pct: total ? +(live / total).toFixed(2) : 0,
      eta: null,
      owner: null,
      firmware: true,
      target,
      total,
    });
  }
  // Largest rollouts first — they're the headline for the page.
  rollouts.sort((a, b) => b.total - a.total);
  return rollouts;
}

// Hook that returns the fleet for a building in the old mock's flat
// shape. Used by Devices.jsx (and anything else that hasn't migrated to
// native DB rows yet). Also computes `ble_children` on aggregators.
export function useFleetViewModel(building) {
  const { devices, counts, byZone, ready } = useDevices(building);

  const viewModel = useMemo(() => {
    const aggregatorByUuid = {};
    for (const d of devices) if (d.external_id) aggregatorByUuid[d.id] = d.external_id;
    const maxFloor = devices.reduce((m, d) => Math.max(m, d.floor || 0), 0) || 50;
    const vms = devices.map((d) => toViewModel(d, { aggregatorByUuid, maxFloor }));
    // Count children per aggregator (external_id).
    const childCount = {};
    for (const vm of vms) if (vm.aggregator_id) childCount[vm.aggregator_id] = (childCount[vm.aggregator_id] || 0) + 1;
    for (const vm of vms) if (vm.ble_role === 'aggregator') vm.ble_children = childCount[vm.id] || 0;
    return vms;
  }, [devices]);

  const zoneOptions = useMemo(() => {
    const maxFloor = devices.reduce((m, d) => Math.max(m, d.floor || 0), 0) || 0;
    return computeZones(maxFloor);
  }, [devices]);

  return { fleet: viewModel, counts, byZone, zoneOptions, ready };
}

// Workspace-wide fleet counts grouped by location, classified into
// displays + sensors. Powers the Sidebar building picker's sub-label
// so it shows the actual fleet rather than the static numbers stored
// on locations.displays / locations.sensors at seed time.
//
// One module-scope cache + listener set, shared across all callers.
// Hydrates on first useFleetCountsByLocation() call; subsequent calls
// return the cached map. We don't subscribe to realtime here — the
// picker is rarely viewed and a stale-by-a-few-minutes count is fine
// (devices rarely get added or removed in normal operation).
let countsCache = null;
let countsHydrated = false;
let countsHydrating = null;
const countsListeners = new Set();

async function hydrateCountsOnce() {
  if (countsHydrated) return countsCache;
  if (countsHydrating) return countsHydrating;
  countsHydrating = (async () => {
    // Scope platform admins to the active org (is_platform_admin RLS bypass
    // would otherwise count every tenant's devices into this per-location map).
    const orgId = getSession()?.organizationId || null;
    // rls-perf-ok: customers rely on RLS scoping; devices_read is hoisted +
    // guarded (mig 266) → indexed organization_id check, well under the timeout.
    let cq = supabase.from('devices').select('location_id, kind');
    if (getSession()?.isPlatformAdmin && orgId) cq = cq.eq('organization_id', orgId);
    const { data, error } = await cq;
    countsHydrated = true;
    countsHydrating = null;
    if (error || !data) {
      countsCache = new Map();
    } else {
      const map = new Map();
      for (const r of data) {
        if (!r.location_id) continue;
        let entry = map.get(r.location_id);
        if (!entry) {
          entry = { displays: 0, sensors: 0, loggers: 0, total: 0 };
          map.set(r.location_id, entry);
        }
        if (DISPLAY_KINDS.has(r.kind)) entry.displays += 1;
        else if (LOGGER_KINDS.has(r.kind)) entry.loggers += 1;
        else entry.sensors += 1;
        entry.total += 1;
      }
      countsCache = map;
    }
    countsListeners.forEach((fn) => fn(countsCache));
    return countsCache;
  })();
  return countsHydrating;
}

export function useFleetCountsByLocation() {
  const [counts, setCounts] = useState(countsCache);
  useEffect(() => {
    countsListeners.add(setCounts);
    if (!countsHydrated) hydrateCountsOnce();
    else setCounts(countsCache);
    return () => {
      countsListeners.delete(setCounts);
    };
  }, []);
  return counts; // null until first hydrate completes
}
