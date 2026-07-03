// Query hooks for contract reports (the printable monthly/weekly report page).
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

// One report by id, with the contract + both org names joined. `maybeSingle`
// returns null when the row doesn't exist or RLS hides it — we surface that as
// an error so the page can show "not found" (matching the prior behaviour).
export function useContractReport(reportId?: string | null) {
  return useQuery({
    queryKey: ['contract-report', reportId],
    enabled: Boolean(reportId),
    queryFn: async () => {
      const { data, error } = await sb
        .from('contract_reports')
        .select(
          `
          id, contract_id, manager_org_id, contractor_org_id,
          period, period_start, period_end,
          snapshot, contractor_note,
          status, sent_at, generated_at,
          contract:contracts!contract_reports_contract_id_fkey(
            id, name, service_kind, currency, monthly_value, status
          ),
          manager_org:organizations!contract_reports_manager_org_id_fkey(id, name),
          contractor_org:organizations!contract_reports_contractor_org_id_fkey(id, name)
        `,
        )
        .eq('id', reportId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Report not found or you don't have access.");
      return data;
    },
  });
}
