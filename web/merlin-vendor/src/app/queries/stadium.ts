// Query hooks for the stadium-variant building demo.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

const POLL_MS = 10_000;
const WINDOW_MS = 7 * 24 * 60 * 60_000; // ±7 days around now

// Events for a stadium in a ±7-day window, soonest first. React Query's
// refetchInterval replaces the hand-rolled setInterval the component used to run.
export function useStadiumSchedule(buildingId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['stadium-schedule', buildingId],
    enabled: enabled && Boolean(buildingId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const until = new Date(Date.now() + WINDOW_MS).toISOString();
      const { data, error } = await sb
        .from('stadium_events')
        .select('id, name, sport, starts_at, duration_min, attendance_target, status, metadata, created_at')
        .eq('building_id', buildingId!)
        .gte('starts_at', since)
        .lte('starts_at', until)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type StadiumBuilding = { id?: string | null; variant?: string | null } | null | undefined;

// Live-board composite: the active/upcoming event for a stadium plus the devices
// in its location subtree and recent crowd/concession agent runs. One queryFn
// chains the 4 reads (event → subtree walk → devices → runs) and polls; the
// component just renders the result. Returns { event: null } when nothing's live.
export function useStadiumLiveBoard(building: StadiumBuilding, orgId?: string | null) {
  return useQuery({
    queryKey: ['stadium-live-board', building?.id, orgId],
    enabled: building?.variant === 'stadium' && Boolean(building?.id) && Boolean(orgId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const upper = new Date(Date.now() + 30 * 60_000).toISOString();
      const lower = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data: events } = await sb
        .from('stadium_events')
        .select('id, name, sport, starts_at, duration_min, attendance_target, status, metadata')
        .eq('building_id', building.id)
        .in('status', ['scheduled', 'live'])
        .lte('starts_at', upper)
        .gte('starts_at', lower)
        .order('starts_at', { ascending: true })
        .limit(1);
      const event = events?.[0] || null;
      if (!event) return { event: null, devices: [], runs: [] };

      // Walk the building's location subtree so we only count its devices.
      const { data: locs } = await sb
        .from('locations')
        .select('id, parent_id, name, kind')
        .eq('organization_id', orgId);
      const subtree = new Set([building.id]);
      let added = true;
      while (added) {
        added = false;
        for (const loc of locs || []) {
          if (!subtree.has(loc.id) && loc.parent_id && subtree.has(loc.parent_id)) {
            subtree.add(loc.id);
            added = true;
          }
        }
      }

      const { data: devices } = await sb
        .from('devices')
        .select('id, external_id, kind, telemetry, location_id')
        .eq('organization_id', orgId)
        .in('location_id', Array.from(subtree));
      const { data: runs } = await sb
        .from('agent_runs')
        .select('id, agent_id, decision, decision_reason, confidence, action_payload, created_at')
        .eq('organization_id', orgId)
        .in('agent_id', ['crowd-flow', 'concession-demand'])
        .order('created_at', { ascending: false })
        .limit(6);

      return { event, devices: devices || [], runs: runs || [] };
    },
  });
}

// Heatmap composite: same event + subtree-devices as the live board, but pulls a
// wider/recent agent-run set (3 agents incl. incident-choreography, last hour,
// with location_id) and returns locById so the zone-detail drawer can resolve
// names. Separate from useStadiumLiveBoard because the runs query + locById differ.
export function useStadiumHeatmap(building: StadiumBuilding, orgId?: string | null) {
  return useQuery({
    queryKey: ['stadium-heatmap', building?.id, orgId],
    enabled: building?.variant === 'stadium' && Boolean(building?.id) && Boolean(orgId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const upper = new Date(Date.now() + 30 * 60_000).toISOString();
      const lower = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data: events } = await sb
        .from('stadium_events')
        .select('id, name, sport, starts_at, duration_min, attendance_target, status, metadata')
        .eq('building_id', building.id)
        .in('status', ['scheduled', 'live'])
        .lte('starts_at', upper)
        .gte('starts_at', lower)
        .order('starts_at', { ascending: true })
        .limit(1);
      const event = events?.[0] || null;
      if (!event) return { event: null, devices: [], runs: [], locById: new Map() };

      const { data: locs } = await sb
        .from('locations')
        .select('id, parent_id, name, kind')
        .eq('organization_id', orgId);
      const subtree = new Set([building.id]);
      const locById = new Map();
      (locs || []).forEach((l) => locById.set(l.id, l));
      let added = true;
      while (added) {
        added = false;
        for (const loc of locs || []) {
          if (!subtree.has(loc.id) && loc.parent_id && subtree.has(loc.parent_id)) {
            subtree.add(loc.id);
            added = true;
          }
        }
      }

      const { data: devices } = await sb
        .from('devices')
        .select('id, external_id, kind, telemetry, location_id')
        .eq('organization_id', orgId)
        .in('location_id', Array.from(subtree));
      const { data: runs } = await sb
        .from('agent_runs')
        .select('id, agent_id, decision, decision_reason, confidence, action_payload, created_at, location_id')
        .eq('organization_id', orgId)
        .in('agent_id', ['crowd-flow', 'concession-demand', 'incident-choreography'])
        .gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(30);

      return { event, devices: devices || [], runs: runs || [], locById };
    },
  });
}
