// @ts-check
// Per-contract cost basis a contractor enters (crew / rate / hours / supplies)
// → REAL cost-to-serve & margin on the Savings page (was modeled). Reads are
// scoped to the contractor's own org (contract_costs.contractor_org_id, RLS =
// contract-party); writes go through the contract-party-guarded RPC (mig 215).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

// Returns { costs: { [contract_id]: basis }, loaded, error, reload }.
export function useContractCosts(contractorOrgId) {
  const [costs, setCosts] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!contractorOrgId) {
      setCosts({});
      setLoaded(true);
      return;
    }
    // lint:rls — scoped to the caller's contractor org (this table keys on
    // contractor_org_id, not organization_id). RLS further contains to contract
    // parties.
    const { data, error: err } = await supabase
      .from('contract_costs')
      .select('contract_id, crew_count, hourly_rate, hours_per_week, supplies_monthly, currency')
      .eq('contractor_org_id', contractorOrgId);
    if (err) {
      captureException(err, { where: 'useContractCosts' });
      setError(err);
    } else {
      const m = {};
      for (const r of data || []) m[r.contract_id] = r;
      setCosts(m);
      setError(null);
    }
    setLoaded(true);
  }, [contractorOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  return { costs, loaded, error, reload: load };
}

// Save a contract's cost basis (contractor party only — enforced server-side).
export async function setContractCosts(contractId, { crewCount, hourlyRate, hoursPerWeek, suppliesMonthly, currency }) {
  const { error } = await supabase.rpc('set_contract_costs', {
    p_contract_id: contractId,
    p_crew_count: crewCount,
    p_hourly_rate: hourlyRate,
    p_hours_per_week: hoursPerWeek,
    p_supplies_monthly: suppliesMonthly,
    p_currency: currency || 'USD',
  });
  if (error) throw error;
}
