// Query hooks for the contractor app.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

// Buildings the contractor touches: managed (via an active contract's locations)
// + self-owned top-level locations. Managed entries win on overlap. Sorted by name.
export function useContractorBuildings(orgId?: string | null) {
  return useQuery({
    queryKey: ['contractor-buildings', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const [contractsRes, ownRes] = await Promise.all([
        sb
          .from('contracts')
          .select(
            `
            id, name, service_kind, status, start_date, end_date,
            manager_org_id,
            manager_org:organizations!contracts_manager_org_id_fkey(id, name),
            contract_locations(location_id, locations(id, name, kind))
          `,
          )
          .eq('contractor_org_id', orgId)
          .eq('status', 'active'),
        sb
          .from('locations')
          .select('id, name, kind')
          .eq('organization_id', orgId)
          .in('kind', ['building', 'ecosystem'])
          .is('parent_id', null),
      ]);

      const map = new Map();
      if (!contractsRes.error && contractsRes.data) {
        for (const c of contractsRes.data) {
          for (const cl of c.contract_locations || []) {
            const loc = cl.locations;
            if (!loc?.id) continue;
            const cur = map.get(loc.id) || {
              id: loc.id,
              name: loc.name,
              kind: loc.kind || 'building',
              ownership: 'managed',
              managerOrgId: c.manager_org_id,
              managerName: c.manager_org?.name || '—',
              contracts: [],
            };
            cur.contracts.push({ id: c.id, name: c.name, service_kind: c.service_kind });
            map.set(loc.id, cur);
          }
        }
      }
      if (!ownRes.error && ownRes.data) {
        for (const loc of ownRes.data) {
          if (map.has(loc.id)) continue;
          map.set(loc.id, {
            id: loc.id,
            name: loc.name,
            kind: loc.kind || 'building',
            ownership: 'self',
            managerOrgId: null,
            managerName: null,
            contracts: [],
          });
        }
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

// Active contracts the caller's contractor org owns, with the customer org +
// covered locations embedded. Fuels the "Propose new agreement" contract picker
// in Operations → SLAs (the picker carries customer + service_kind + covered
// locations into the new agreement).
export function useContractorActiveContracts(orgId?: string | null) {
  return useQuery({
    queryKey: ['contractor-active-contracts', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await sb
        .from('contracts')
        .select(
          `
          id, name, service_kind, status, start_date, end_date,
          manager_org_id, contractor_org_id,
          manager_org:organizations!contracts_manager_org_id_fkey(id, name, slug),
          contract_locations(location_id, locations(id, name))
        `,
        )
        .eq('contractor_org_id', orgId)
        .eq('status', 'active')
        .order('start_date', { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

// Contracts where the caller's org is the contractor (RLS also enforces it).
// FK columns selected directly because Proposals/Reports key isContractor off them.
export function useContractorContracts(orgId?: string | null) {
  return useQuery({
    queryKey: ['contractor-contracts', orgId],
    queryFn: async () => {
      if (!orgId) return [];
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
        .eq('contractor_org_id', orgId)
        .order('status', { ascending: true })
        .order('start_date', { ascending: false });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[contractor] contracts fetch failed:', error.message);
        return [];
      }
      return data || [];
    },
  });
}
