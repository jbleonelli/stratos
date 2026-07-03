// Query hooks for contracts.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

// One contract by id with both party orgs + linked locations embedded. RLS admits
// both parties. Returns null when the row is missing or hidden (the drawer treats
// that the same as loading — a pre-existing behaviour we preserve).
export function useContractById(contractId?: string | null) {
  return useQuery({
    queryKey: ['contract', contractId],
    enabled: Boolean(contractId),
    queryFn: async () => {
      const { data, error } = await sb
        .from('contracts')
        .select(
          `
          id, name, service_kind, status, start_date, end_date,
          sla_summary, monthly_value, currency, terms,
          manager_org_id, contractor_org_id,
          manager_org:organizations!contracts_manager_org_id_fkey(id, name, slug),
          contractor_org:organizations!contracts_contractor_org_id_fkey(id, name, slug),
          contract_locations(location_id, locations(id, name))
        `,
        )
        .eq('id', contractId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}
