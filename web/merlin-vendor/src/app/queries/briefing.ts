// Query hooks for the Briefing page.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

// "Today at a glance" rollup for a building (RPC), polled every minute so the
// route-progress summary stays live.
export function useNowGlance(buildingId?: string | null) {
  return useQuery({
    queryKey: ['now-glance', buildingId],
    enabled: Boolean(buildingId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await sb.rpc('now_today_glance', { p_location_id: buildingId });
      return data ?? null;
    },
  });
}
