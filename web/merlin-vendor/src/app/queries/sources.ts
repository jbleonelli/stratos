// Mutation hooks for public.source_catalog writes (contractor-proposed entries).
//
// ⚠️ There is intentionally NO `onSuccess: invalidateQueries` here. The catalog
// list this write feeds — `useContractorAuthoredCatalog` in sources-data.js — is
// realtime-subscribed to the `source_catalog` table, so it refreshes itself the
// instant a write lands. Wiring an invalidate would be a no-op because that read
// isn't React Query (yet). If it ever migrates to RQ, add invalidation of its
// queryKey here.
//
// mutateAsync rejects with the PostgrestError on failure, which preserves the
// caller's existing `catch (e) { onError(e.message); throw e; }` semantics (the
// ProposeForm's SlaForm keeps the form open when onSave rejects).
import { useMutation } from '@tanstack/react-query';
import { sb } from '../db-client';
import type { TablesInsert } from '../../types/db';

// Insert one source_catalog row — a contractor proposing a new data-source
// catalog entry into the customer's org (counterparty_org = contractor).
export function useInsertSourceCatalog() {
  return useMutation({
    mutationFn: async (row: TablesInsert<'source_catalog'>) => {
      const { error } = await sb.from('source_catalog').insert(row);
      if (error) throw error;
    },
  });
}
