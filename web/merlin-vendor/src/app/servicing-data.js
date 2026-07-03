// Servicing-board state (Security / Hospitality / Maintenance) — reads the
// org-scoped demo_servicing_state replay fixture + demo_servicing_perf view
// (migration 191), filtered by org + domain. `.eq(organization_id)` keeps it
// leak-proof (belt-and-braces with the table RLS) and satisfies lint:rls.
// Restrooms uses its own hook (imf-restroom-data.js) since it has the IMF-live
// source; these three share one generic shape.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { SERVICING_GROUP_DOMAINS, topDomainOf } from './servicing-areas.js';

const REFRESH_MS = 60_000;
const COLS = 'item, location, hours_since, sla_hours, open_count, sessions_24h, traffic_24h';

export function useServicingState(orgId, domain, opts = {}) {
  const { viewer = false, buildingId = null } = opts;
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    // Contractors viewing a client building read item-level state through the
    // contained SECURITY DEFINER RPC (mig 224) — their own org owns no state.
    const { data, error } =
      viewer && buildingId
        ? await supabase.rpc('servicing_state_for_viewer', { p_building_id: buildingId, p_domain: domain })
        : await supabase.from('demo_servicing_state').select(COLS).eq('organization_id', orgId).eq('domain', domain);
    if (!aliveRef.current) return;
    if (error) captureException(error, { where: 'useServicingState' });
    if (!error) setRows(data || []);
    setLoaded(true);
  }, [orgId, domain, viewer, buildingId]);

  useEffect(() => {
    aliveRef.current = true;
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [load]);

  return { rows, loaded, reload: load };
}

// Mark one servicing item serviced (resets its clock + clears open requests).
// Real, persistent write via the org-scoped SECURITY DEFINER RPC (migration 196).
export async function resolveServicingItem(domain, item) {
  const { error } = await supabase.rpc('servicing_resolve_item', { p_domain: domain, p_item: item });
  if (error) throw error;
}

export function useServicingPerf(orgId, domain) {
  const [perf, setPerf] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!orgId) {
        if (alive) {
          setPerf(null);
          setLoaded(true);
        }
        return;
      }
      const { data, error } = await supabase
        .from('demo_servicing_perf')
        .select('*')
        .eq('organization_id', orgId)
        .eq('domain', domain)
        .maybeSingle();
      if (!alive) return;
      if (error) captureException(error, { where: 'useServicingPerf' });
      if (!error) setPerf(data || null);
      setLoaded(true);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [orgId, domain]);
  return { perf, loaded };
}

// Real adherence history (migration 198). Only the last ~20h is fetched so the
// per-org row count stays well under PostgREST's 1000 cap (≈35 domains × hourly).
const HISTORY_WINDOW_MS = 20 * 3600 * 1000;
const HISTORY_POINTS = 14;

// One domain's series (ascending by time), or null until loaded / when empty.
export function useServicingHistory(orgId, domain) {
  const [series, setSeries] = useState(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!orgId || !domain) {
        if (alive) setSeries(null);
        return;
      }
      const since = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('demo_servicing_history')
        .select('adherence_pct, captured_at')
        .eq('organization_id', orgId)
        .eq('domain', domain)
        .gte('captured_at', since)
        .order('captured_at', { ascending: true });
      if (!alive) return;
      if (error) captureException(error, { where: 'useServicingHistory' });
      const arr = error ? [] : (data || []).map((r) => r.adherence_pct);
      setSeries(arr.length >= 2 ? arr.slice(-HISTORY_POINTS) : null);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [orgId, domain]);
  return series;
}

// Bulk { domain: [adherence,…ascending] } for an org — one query for the whole
// overview / roll-up. Domains with <2 points are omitted (caller falls back to
// synthTrend). Time-windowed to stay under the 1000-row read cap.
export function useServicingHistoryMap(orgId) {
  const [map, setMap] = useState({});
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!orgId) {
        if (alive) setMap({});
        return;
      }
      const since = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('demo_servicing_history')
        .select('domain, adherence_pct, captured_at')
        .eq('organization_id', orgId)
        .gte('captured_at', since)
        .order('captured_at', { ascending: true });
      if (!alive) return;
      if (error) captureException(error, { where: 'useServicingHistoryMap' });
      const g = {};
      for (const r of error ? [] : data || []) {
        (g[r.domain] ||= []).push(r.adherence_pct);
      }
      for (const k of Object.keys(g)) g[k] = g[k].slice(-HISTORY_POINTS);
      setMap(g);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [orgId]);
  return map;
}

// Configured SLA windows (hours) per servicing domain — the source of truth for
// the boards' SLA target, from public.servicing_sla_targets (migration 199).
// Returns { domain: sla_hours }. The board falls back to the fixture's per-row
// sla_hours when a target row is absent (they're kept in sync by apply_servicing_sla).
export function useServicingSlaTargets(orgId) {
  const [map, setMap] = useState({});
  const load = useCallback(async () => {
    if (!orgId) {
      setMap({});
      return;
    }
    const { data, error } = await supabase
      .from('servicing_sla_targets')
      .select('domain, sla_hours')
      .eq('organization_id', orgId);
    if (error) captureException(error, { where: 'useServicingSlaTargets' });
    const m = {};
    for (const r of error ? [] : data || []) m[r.domain] = Number(r.sla_hours);
    setMap(m);
  }, [orgId]);
  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);
  return { map, reload: load };
}

// The Schedules route backing a servicing domain (Step D — the program link).
// Each board's items are route_tasks under one auto-generated route per (org,
// domain); this returns that route's metadata so the board can show it's driven
// by a real route + cadence, not a fixture. Reads route_tasks (org-scoped) +
// the embedded route.
export function useServicingRoute(orgId, domain) {
  const [route, setRoute] = useState(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!orgId || !domain) {
        if (alive) setRoute(null);
        return;
      }
      const { data, error } = await supabase
        .from('route_tasks')
        .select(
          'routes!route_id(id, name, cadence, service_type, expected_start_time, contract:contracts!contract_id(id, name, monthly_value, currency, contractor:organizations!contractor_org_id(id, name)))',
        )
        .eq('organization_id', orgId)
        .eq('servicing_domain', domain)
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (error) captureException(error, { where: 'useServicingRoute' });
      setRoute(error ? null : data?.routes || null);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [orgId, domain]);
  return route;
}

// Set the configured SLA window (hours) for a servicing domain — org-scoped
// SECURITY DEFINER RPC (migration 199) that upserts the target and propagates it
// onto the board immediately. Callable by any authenticated member of the org.
export async function setServicingSlaTarget(domain, hours) {
  const { error } = await supabase.rpc('set_servicing_sla_target', { p_domain: domain, p_hours: hours });
  if (error) throw error;
}

// Cross-domain Servicing roll-up for an org: per-top-domain { total, overdue,
// open, areas, adh (item-weighted) } + an `overall` summary. Shared by the
// Services roll-up landing and the MONITOR → Now strip so both show the same
// numbers. Bathrooms (cleaning) is folded in from the restroom perf view.
export function useServicingRollup(building, orgId, opts = {}) {
  const isImf = building?.variant === 'imf';
  const buildingId = building?.id || null;
  // `viewer` routes the read through the contained, viewer-aware RPC so a
  // CONTRACTOR viewing a CLIENT building sees the roll-up for ONLY their
  // contracted service lines (and the building owner sees everything). Used by
  // the Hypervisor SERVICING panel. IMF has no contractors, so it keeps the
  // direct org read (which also carries the IMF-live restroom source).
  const viewer = !!opts.viewer && !!buildingId && !isImf;
  const [byTop, setByTop] = useState({});
  const [subRows, setSubRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!orgId) {
        if (alive) {
          setByTop({});
          setLoaded(true);
        }
        return;
      }

      // Normalize both paths to one rows array of
      // { domain, items_total, overdue_now, open_now, adherence_pct } — the RPC
      // already folds restrooms in as a `cleaning_restrooms` row, so the direct
      // path appends the equivalent restroom row to match.
      let rows = [];
      if (viewer) {
        const { data } = await supabase.rpc('servicing_rollup_for_viewer', { p_building_id: buildingId });
        rows = data || [];
      } else {
        const { data } = await supabase
          .from('demo_servicing_perf')
          .select('domain, items_total, overdue_now, open_now, adherence_pct')
          .eq('organization_id', orgId);
        rows = data || [];
        const bathQ = isImf
          ? supabase
              .from('imf_cleaning_perf')
              .select('restrooms_total, overdue_now, open_requests_now, sla_adherence_pct')
              .maybeSingle()
          : supabase
              .from('demo_cleaning_perf')
              .select('restrooms_total, overdue_now, open_requests_now, sla_adherence_pct')
              .eq('organization_id', orgId)
              .maybeSingle();
        const { data: bd } = await bathQ;
        if (bd) {
          rows = rows.concat([
            {
              domain: 'cleaning_restrooms',
              items_total: bd.restrooms_total,
              overdue_now: bd.overdue_now,
              open_now: bd.open_requests_now,
              adherence_pct: bd.sla_adherence_pct,
            },
          ]);
        }
      }

      const acc = {};
      const ensure = (k) => (acc[k] ||= { total: 0, overdue: 0, open: 0, adhNum: 0, areas: 0 });
      rows.forEach((r) => {
        const top = topDomainOf(r.domain);
        if (!SERVICING_GROUP_DOMAINS.includes(top)) return;
        const a = ensure(top);
        a.total += r.items_total || 0;
        a.overdue += r.overdue_now || 0;
        a.open += r.open_now || 0;
        a.adhNum += (r.adherence_pct || 0) * (r.items_total || 0);
        a.areas += 1;
      });
      const out = {};
      for (const k of SERVICING_GROUP_DOMAINS) {
        const a = acc[k];
        out[k] =
          !a || a.total === 0
            ? null
            : { total: a.total, overdue: a.overdue, open: a.open, areas: a.areas, adh: Math.round(a.adhNum / a.total) };
      }
      if (!alive) return;
      setByTop(out);
      setSubRows(rows);
      setLoaded(true);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [orgId, isImf, viewer, buildingId]);

  const overall = useMemo(() => {
    let total = 0,
      overdue = 0,
      open = 0,
      adhNum = 0;
    for (const k of SERVICING_GROUP_DOMAINS) {
      const s = byTop[k];
      if (s) {
        total += s.total;
        overdue += s.overdue;
        open += s.open;
        adhNum += s.adh * s.total;
      }
    }
    return { total, overdue, open, adh: total ? Math.round(adhNum / total) : null };
  }, [byTop]);

  return { byTop, overall, loaded, rows: subRows };
}

// The actual open/overdue ITEMS across a contractor's contracted lines (mig 234),
// for grounding Merlin chat so it can name specifics. Viewer-contained: a
// contractor sees only their lines. Returns [{ line, item, hours_over, open_count }].
export function useServicingOpenItems(building, orgId) {
  const buildingId = building?.id || null;
  const isImf = building?.variant === 'imf';
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!orgId || !buildingId || isImf) {
      setItems([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data } = await supabase.rpc('servicing_open_items_for_viewer', { p_building_id: buildingId });
      if (!alive) return;
      setItems(data || []);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, buildingId, isImf]);
  return { items, loaded };
}

// "Make Merlin act": dispatch a fix from the UI (mig 235). Inserts an in-progress
// crew dispatch for the contractor's primary building → lands under In-progress
// in the Activity feed. Returns the new agent_run id.
export async function contractorDispatch({ line, title, detail } = {}) {
  const { data, error } = await supabase.rpc('contractor_dispatch', {
    p_line: line || null,
    p_title: title || null,
    p_detail: detail || null,
  });
  if (error) throw error;
  return data;
}

// Real per-floor sensor readings for the Hypervisor SENSING view (mig 240).
// Returns a Map<floorLocationId, { value, unit }> for the active metric — the 4
// ambient metrics come from the airq device fabric, occupancy from the real
// people-counter count_report events. Viewer-scoped RPC (owner or a contractor
// with a contract on the building's org). Polls so the heatmap feels live.
// No-ops (empty map) when no metric is selected.
export function useBuildingSensorReadings(building, orgId, metric) {
  const [byFloor, setByFloor] = useState(() => new Map());
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!building?.id || !orgId || !metric) {
      setByFloor(new Map());
      setLoaded(false);
      return undefined;
    }
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('building_sensor_readings', {
        p_building: building.id,
        p_metric: metric,
      });
      if (!alive) return;
      if (error) captureException(error, { where: 'useBuildingSensorReadings' });
      const m = new Map();
      for (const r of error ? [] : data || []) m.set(r.location_id, { value: Number(r.value), unit: r.unit });
      setByFloor(m);
      setLoaded(true);
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [building?.id, orgId, metric]);
  return { byFloor, loaded };
}

// Per-equipment reliability (MTTR/MTBF) for the KPI Cockpit (mig 241). Viewer-
// scoped: the building owner (FM) sees all equipment; a contractor sees only the
// equipment in their contracted service lines. Polled so the cockpit reads live.
export function useEquipmentReliability(building, orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!building?.id || !orgId) {
      setRows([]);
      setLoaded(false);
      return undefined;
    }
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('equipment_reliability_for_viewer', { p_building: building.id });
      if (!alive) return;
      if (error) captureException(error, { where: 'useEquipmentReliability' });
      setRows(error ? [] : data || []);
      setLoaded(true);
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [building?.id, orgId]);
  return { rows, loaded };
}

// Owner CAPEX/OPEX budget lines for the KPI Cockpit (mig 242). FM/owner-only —
// RLS scopes to the owning org (no viewer RPC; contractors never read this).
export function useBuildingBudgets(orgId, fy = 2026) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('building_budgets')
        .select('kind, category, budget, actual, currency, sort')
        .eq('organization_id', orgId)
        .eq('fy', fy)
        .order('sort', { ascending: true });
      if (!alive) return;
      setRows(data || []);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, fy]);
  const capex = useMemo(() => rows.filter((r) => r.kind === 'capex'), [rows]);
  const opex = useMemo(() => rows.filter((r) => r.kind === 'opex'), [rows]);
  const currency = rows[0]?.currency || 'USD';
  return { capex, opex, currency, loaded };
}

// HSE (health & safety) + CX (customer experience) KPIs for the cockpit (mig 243).
// Role-differentiated by ORG OWNERSHIP — each org reads its OWN row (RLS): the FM
// sees building safety + occupant experience, a contractor sees crew safety +
// client-rating. Static (slow-moving KPIs, no drift).
export function useOrgKpis(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('org_kpis')
        .select('panel, metric, value, target, unit, higher_is_better, sort')
        .eq('organization_id', orgId)
        .order('sort', { ascending: true });
      if (!alive) return;
      setRows(data || []);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId]);
  const hse = useMemo(() => rows.filter((r) => r.panel === 'hse'), [rows]);
  const cx = useMemo(() => rows.filter((r) => r.panel === 'cx'), [rows]);
  return { hse, cx, loaded };
}

// Deterministic 7-point adherence trend ending at the current value. Seeded by a
// stable string (domain/item) so it doesn't flicker between renders, and wanders
// gently (±6pts) around `current` — a believable "last 7 days" without a history
// table (which would read empty on a freshly-seeded demo org). Clamped 40–100.
export function synthTrend(seed, current, points = 7) {
  let h = 2166136261;
  for (let i = 0; i < (seed || '').length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const cur = Math.max(40, Math.min(100, current ?? 85));
  const out = [];
  let v = cur - (rand() * 8 - 2); // start a touch below/around current
  for (let i = 0; i < points - 1; i++) {
    v += rand() * 6 - 3;
    out.push(Math.max(40, Math.min(100, Math.round(v))));
  }
  out.push(Math.round(cur)); // last point is the real number
  return out;
}

// Urgency: open items first, then most overdue.
export function sortByUrgency(rows) {
  return [...rows].sort((a, b) => {
    if ((b.open_count || 0) !== (a.open_count || 0)) return (b.open_count || 0) - (a.open_count || 0);
    return (b.hours_since ?? -1) - (a.hours_since ?? -1);
  });
}
