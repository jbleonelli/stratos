// Query hooks for location-tree reads.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

export type BuildingLocationRow = {
  id: string;
  parent_id: string | null;
  name: string | null;
  kind: string | null;
  model_url: string | null;
  model_scale: number | null;
  model_offset_y: number | null;
};

export type BuildingSubtree = {
  // The in-building rows (building row + every descendant). [] = empty.
  rows: BuildingLocationRow[];
  // Non-null only when the subtree read itself errored (so the viewer can
  // surface the message). Resolving an empty scope org is NOT an error.
  error: string | null;
};

// Every location row under a building (floors + the deeper rows the 3D
// viewer walks through to attribute an alert to its floor). Two sequential
// reads, preserved exactly from HypervisorViewer3D's original useEffect:
//   1. Resolve the building's OWNER org from the (RLS-readable) building row,
//      falling back to the prop orgId. They differ for a contractor viewing a
//      CLIENT building — the contractor's org owns no floor rows but RLS lets
//      them read the client's contracted subtree.
//   2. Pull every row in that org, then dash-bounded prefix-filter in JS to
//      this building's subtree (PostgREST has no prefix-match operator). The
//      org filter is a perf bound; RLS is the real gate.
export function useBuildingSubtree(buildingId?: string | null, orgId?: string | null) {
  return useQuery<BuildingSubtree>({
    queryKey: ['building-subtree', buildingId, orgId],
    enabled: Boolean(buildingId),
    queryFn: async () => {
      const { data: bRow } = await sb
        .from('locations')
        .select('organization_id')
        .eq('id', buildingId as string)
        .maybeSingle();
      const scopeOrg = bRow?.organization_id || orgId;
      if (!scopeOrg) {
        return { rows: [], error: null };
      }
      const { data, error: e } = await sb
        .from('locations')
        .select('id, parent_id, name, kind, model_url, model_scale, model_offset_y')
        .eq('organization_id', scopeOrg);
      if (e) {
        return { rows: [], error: e.message };
      }
      const all = (data || []) as BuildingLocationRow[];
      // Dash-bounded prefix match: keep this building's rows + every
      // descendant (`feb` matches `feb` and `feb-…` but never `feb2`).
      const inBuilding = all.filter((r) => r.id === buildingId || (r.id && r.id.startsWith(buildingId + '-')));
      return { rows: inBuilding, error: null };
    },
  });
}
