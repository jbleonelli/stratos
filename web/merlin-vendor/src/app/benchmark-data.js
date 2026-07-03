// benchmark-data.js — reads the per-building benchmark dataset
// (public.building_benchmark_metrics, migration 270) for the org-admin
// Building Benchmark page. Org-scoped via RLS; the numbers are curated demo
// fixtures (benchmark-light), so no realtime subscription — a one-shot fetch.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

export function useBuildingBenchmarks(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data, error } = await supabase
        .from('building_benchmark_metrics')
        .select(
          'location_id, building_name, region, sla_compliance_pct, sla_breaches_mtd, servicing_adherence_pct, monthly_cost, currency, penalties_mtd, open_incidents, critical_incidents, equipment_uptime_pct, equipment_mtbf_days',
        )
        .eq('organization_id', orgId);
      if (!alive) return;
      if (error) {
        captureException(error, { where: 'useBuildingBenchmarks' });
        setRows([]);
      } else {
        setRows(
          (data || []).map((r) => ({
            locationId: r.location_id,
            name: r.building_name,
            region: r.region || '',
            slaCompliance: Number(r.sla_compliance_pct),
            breaches: r.sla_breaches_mtd,
            adherence: Number(r.servicing_adherence_pct),
            monthlyCost: Number(r.monthly_cost),
            currency: r.currency || 'USD',
            penalties: Number(r.penalties_mtd),
            openIncidents: r.open_incidents,
            criticalIncidents: r.critical_incidents,
            uptime: Number(r.equipment_uptime_pct),
            mtbf: r.equipment_mtbf_days,
          })),
        );
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId]);

  return { rows, loaded };
}
