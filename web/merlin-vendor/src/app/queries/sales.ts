// Query + mutation hooks for the /platform sales-inquiries inbox.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sb } from '../db-client';
import type { TablesUpdate } from '../../types/db';

// Recent sales inquiries (RLS admits platform admins only). Newest first.
export function useSalesInquiries() {
  return useQuery({
    queryKey: ['sales-inquiries'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('sales_inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Patch one inquiry (status / notes); invalidate the list on success.
export function useUpdateSalesInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'sales_inquiries'> }) => {
      const { error } = await sb.from('sales_inquiries').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-inquiries'] }),
  });
}
