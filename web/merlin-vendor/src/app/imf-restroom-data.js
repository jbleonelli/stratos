// Restroom cleaning state for the Restroom Board.
//
// Two sources, same columns, dispatched by org so the board is source-agnostic:
//   • IMF → the LIVE imf_restroom_state view (migration 185), device-derived,
//     hardcoded to IMF (security_invoker).
//   • Every other org (Meridian + demos) → the org-scoped demo_restroom_state
//     replay fixture (migration 189). The `.eq(organization_id)` keeps it
//     leak-proof (belt-and-braces with the table RLS) and satisfies lint:rls.
// See docs/architecture/imf-abm-cleaning-loop.md + protect_meridian_demo.md
// (Meridian inherits the cleaning capability with its own data — no IMF leak).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

const REFRESH_MS = 60_000;
const RESTROOM_COLS =
  'restroom, building, floor, last_cleaned_at, hours_since_clean, crew_taps_24h, open_requests, floor_footfall_24h';

export function useRestroomState(building, orgId, opts = {}) {
  const { viewer = false } = opts;
  const isImf = building?.variant === 'imf';
  const buildingId = building?.id || null;
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // A failed read must NOT read as "no restroom data for this building".
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!isImf && !orgId) {
        if (alive) {
          setRows([]);
          setLoaded(true);
        }
        return;
      }
      // Contractors viewing a client building read restrooms through the contained
      // SECURITY DEFINER RPC (mig 225) — their own org owns no restroom state.
      let data, err;
      if (viewer && buildingId) {
        ({ data, error: err } = await supabase.rpc('restroom_state_for_viewer', { p_building_id: buildingId }));
      } else {
        const q = isImf
          ? supabase.from('imf_restroom_state').select(RESTROOM_COLS)
          : supabase.from('demo_restroom_state').select(RESTROOM_COLS).eq('organization_id', orgId);
        ({ data, error: err } = await q);
      }
      if (!alive) return;
      if (err) {
        captureException(err, { where: 'useRestroomState' });
        setError(err);
      } else {
        setRows(data || []);
        setError(null);
      }
      setLoaded(true);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isImf, orgId, viewer, buildingId, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { rows, loaded, error, refresh };
}

// Cleaning performance (rolling 7d) — one row. IMF → imf_cleaning_perf (live);
// other orgs → demo_cleaning_perf (org-scoped fixture aggregate).
export function useCleaningPerf(building, orgId) {
  const isImf = building?.variant === 'imf';
  const [perf, setPerf] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!isImf && !orgId) {
        if (alive) {
          setPerf(null);
          setLoaded(true);
        }
        return;
      }
      const q = isImf
        ? supabase.from('imf_cleaning_perf').select('*').maybeSingle()
        : supabase.from('demo_cleaning_perf').select('*').eq('organization_id', orgId).maybeSingle();
      const { data, error } = await q;
      if (!alive) return;
      if (!error) setPerf(data || null);
      setLoaded(true);
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isImf, orgId]);
  return { perf, loaded };
}

// Urgency sort: open requests first, then most-overdue (null hours = no crew
// data on record, sorted last). Matches the cleaning agent's prioritisation.
export function sortByUrgency(rows) {
  return [...rows].sort((a, b) => {
    if ((b.open_requests || 0) !== (a.open_requests || 0)) return (b.open_requests || 0) - (a.open_requests || 0);
    const ah = a.hours_since_clean == null ? -1 : a.hours_since_clean;
    const bh = b.hours_since_clean == null ? -1 : b.hours_since_clean;
    return bh - ah;
  });
}
