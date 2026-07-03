// Mutation hooks for public.slas writes (agreement-scope CRUD).
//
// ⚠️ There is intentionally NO `onSuccess: invalidateQueries` here. The SLA list
// views these writes feed — `useAuthoredAgreements` (contractor surface) and
// `useSlas` (admin surface) in slas-data.js — are realtime-subscribed to the
// `slas` table, so they refresh themselves the instant a write lands. Wiring an
// invalidate would be a no-op because those reads aren't React Query (yet). If
// they ever migrate to RQ, add invalidation of their queryKey here.
//
// mutateAsync rejects with the PostgrestError on failure, which preserves the
// callers' existing `catch (e) { setError(e.message); throw e; }` semantics
// (SlaRow keeps the row in edit mode when onSave rejects).
import { useMutation } from '@tanstack/react-query';
import { sb } from '../db-client';
import type { TablesInsert, TablesUpdate } from '../../types/db';

// Create one SLA row — propose a new agreement, or propose a new version of an
// accepted one.
export function useInsertSla() {
  return useMutation({
    mutationFn: async (row: TablesInsert<'slas'>) => {
      const { error } = await sb.from('slas').insert(row);
      if (error) throw error;
    },
  });
}

// Patch one SLA row by id — edit-in-place pending terms, or cancel a pending
// proposal (`{ active: false }`).
export function useUpdateSla() {
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'slas'> }) => {
      const { error } = await sb.from('slas').update(patch).eq('id', id);
      if (error) throw error;
    },
  });
}

// Hard-delete one SLA row by id.
export function useDeleteSla() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('slas').delete().eq('id', id);
      if (error) throw error;
    },
  });
}
