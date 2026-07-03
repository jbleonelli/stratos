// Query hook for the Hypervisor location tree (LocationTree.jsx).
//
// Hydrates the whole org's location tree in one go (Meridian worst case is
// 411 rows, well under the PostgREST 1000 cap) and, when the Hypervisor admin
// tree asks for it (`includeDevices`), the org's devices alongside — so leaves
// can render under their owning location node.
//
// ⚠️ This read is NOT realtime-subscribed. The original component refetched via
// two manual triggers: a `refreshTick` bumped after every create/rename/delete
// mutation (those go through the custom-locations/zones helpers), and a parent-
// supplied `refreshSignal` (e.g. after a CSV bulk-load). Both are folded into
// the queryKey here, so a bump of either still forces a refetch — behaviour is
// identical to the old useEffect hydrate.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';
import type { Tables } from '../../types/db';

type LocationNode = Pick<Tables<'locations'>, 'id' | 'parent_id' | 'name' | 'kind'>;
type DeviceRow = Pick<Tables<'devices'>, 'id' | 'external_id' | 'kind' | 'location_id'>;

export interface LocationTreeData {
  // Flat map of all loaded nodes by id. Children are derived on demand.
  nodes: Record<string, LocationNode>;
  // Devices keyed by location_id. Empty unless includeDevices=true.
  devicesByLocation: Record<string, DeviceRow[]>;
}

export function useLocationTree(orgId?: string | null, includeDevices = false, refreshTick = 0, refreshSignal = 0) {
  return useQuery<LocationTreeData>({
    queryKey: ['location-tree', orgId, includeDevices, refreshTick, refreshSignal],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const locReq = sb
        .from('locations')
        .select('id, parent_id, name, kind')
        .eq('organization_id', orgId as string);
      // Devices live alongside locations in the Hypervisor admin tree. Pulled
      // in the same hydrate so the tree can render leaves under their owning
      // location node. Meridian today has ~800 devices — the PostgREST cap
      // matters here; a future iteration can paginate.
      const devReq = includeDevices
        ? sb
            // NOTE: devices has no `name` column. Friendly labels come from
            // external_id (or kind as last resort) at render time. Adding
            // `name` here used to silently break the whole fetch and leave
            // devicesByLocation empty — Hypervisor would render 0 devices.
            .from('devices')
            .select('id, external_id, kind, location_id')
            .eq('organization_id', orgId as string)
        : null;

      const [locRes, devRes] = await Promise.all([locReq, devReq]);

      if (locRes.error) {
        // eslint-disable-next-line no-console
        console.warn('[LocationTree] locations fetch failed:', locRes.error.message);
        return { nodes: {}, devicesByLocation: {} };
      }
      const nodes: Record<string, LocationNode> = {};
      for (const r of locRes.data || []) nodes[r.id] = r;

      const devicesByLocation: Record<string, DeviceRow[]> = {};
      if (includeDevices) {
        if (devRes && !devRes.error) {
          for (const d of devRes.data || []) {
            if (!d.location_id) continue;
            if (!devicesByLocation[d.location_id]) devicesByLocation[d.location_id] = [];
            devicesByLocation[d.location_id].push(d);
          }
        } else if (devRes?.error) {
          // eslint-disable-next-line no-console
          console.warn('[LocationTree] devices fetch failed:', devRes.error.message);
        }
      }
      return { nodes, devicesByLocation };
    },
  });
}
