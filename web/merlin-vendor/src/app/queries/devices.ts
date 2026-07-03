// Query + mutation hooks for public.devices (device-detail surface).
//
// The device-detail page reads a single device row (org-scoped, by external_id)
// once at mount — there's no realtime on the `devices` row itself (the live
// streams are events/messages/cleanings/sessions, handled by their own hooks in
// device-events.js). So a one-shot useQuery mirrors the prior behavior exactly.
//
// The operator-editable config cards (PCB / SLB) patch `telemetry` and previously
// pushed the returned row back up via an `onDeviceUpdated` callback. The mutation
// now invalidates the device query instead, so the page refetches the fresh row.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sb } from '../db-client';
import type { TablesUpdate } from '../../types/db';

// One device row, scoped to the caller's org and addressed by its external_id
// (the value in the URL). Returns null when missing — callers treat null as
// "not found", matching the prior `error || !data` branch.
export function useDevice(orgId?: string | null, externalId?: string | null) {
  return useQuery({
    queryKey: ['device', orgId, externalId],
    enabled: Boolean(orgId && externalId),
    queryFn: async () => {
      const { data, error } = await sb
        .from('devices')
        .select('*')
        .eq('organization_id', orgId as string)
        .eq('external_id', externalId as string)
        .maybeSingle();
      if (error) return null;
      return data ?? null;
    },
  });
}

// Patch one device row by id (operator-editable telemetry config). On success,
// invalidate the device read so the page refetches the fresh row.
export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'devices'> }) => {
      const { error } = await sb.from('devices').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device'] }),
  });
}
