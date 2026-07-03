// Query hooks for the worker PWA (Merlin Mobile "My Day"). A dependent chain:
// member → today's routes → a route's tasks. React Query's `enabled` gates each
// step so they fire in order without manual orchestration.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sb } from '../db-client';
import { routeRunsOn } from '../routes-data.js';
import { todayStr, dowOf } from '../route-overrides-data.js';
import { startOfTodayIso } from '../mobile-utils.js';

// The worker's team_member row (null when their login isn't linked to one).
export function useWorkerMember(userId?: string | null) {
  return useQuery({
    queryKey: ['worker-member', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await sb
        .from('team_members')
        .select('id, name, team, role, initials')
        .eq('user_id', userId)
        .maybeSingle();
      return data ?? null;
    },
  });
}

type WorkerMember = { id?: string | null } | null | undefined;

// Today's active routes the member is assigned to, soonest first. Depends on the
// member row, so it's gated until that resolves.
export function useWorkerRoutes(member: WorkerMember) {
  return useQuery({
    queryKey: ['worker-routes', member?.id],
    enabled: Boolean(member?.id),
    queryFn: async () => {
      const { data: assigns, error } = await sb
        .from('route_assignments')
        .select(
          'role, route_id, routes(id, name, service_type, cadence, cadence_days, expected_start_time, expected_duration_min, location_id, sla_threshold_min, active, contract_id)',
        )
        .eq('member_id', member.id);
      if (error) return [];
      const dow = dowOf(todayStr());
      return (assigns || [])
        .map((a) => ({ ...a.routes, myRole: a.role }))
        .filter((r) => r && r.active !== false && routeRunsOn(r, dow))
        .sort((a, b) => (a.expected_start_time || '').localeCompare(b.expected_start_time || ''));
    },
  });
}

// Active tasks for one route, in checklist order (used by the per-route drawer).
export function useRouteTasks(routeId?: string | null) {
  return useQuery({
    queryKey: ['route-tasks', routeId],
    enabled: Boolean(routeId),
    queryFn: async () => {
      const { data } = await sb
        .from('route_tasks')
        .select(
          'id, name, description, zone_id, cadence, sla_minutes, last_completed_at, checklist_item_order, building_zones(id, name)',
        )
        .eq('route_id', routeId)
        .eq('active', true)
        .order('checklist_item_order', { ascending: true });
      return data ?? [];
    },
  });
}

// One route's active tasks PLUS which of them THIS worker already completed
// today (so the simulation's crew/agent completions don't pre-check the list).
// Returns { tasks, doneAt } where doneAt maps route_task_id → completed_at ISO.
export function useWorkerRouteTasks(routeId?: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['worker-route-tasks', routeId, userId],
    enabled: Boolean(routeId),
    queryFn: async () => {
      const { data } = await sb
        .from('route_tasks')
        .select('id, name, description, zone_id, cadence, sla_minutes, checklist_item_order, building_zones(id, name)')
        .eq('route_id', routeId)
        .eq('active', true)
        .order('checklist_item_order', { ascending: true });
      const tasks = data ?? [];
      const doneAt: Record<string, string> = {};
      if (tasks.length && userId) {
        const ids = tasks.map((t) => t.id);
        const { data: comps } = await sb
          .from('route_task_completions')
          .select('route_task_id, completed_at')
          .eq('completed_by', userId)
          .gte('completed_at', startOfTodayIso())
          .in('route_task_id', ids);
        for (const c of comps ?? []) doneAt[c.route_task_id] = c.completed_at;
      }
      return { tasks, doneAt };
    },
  });
}

// Tap-to-complete one route task (SECURITY DEFINER worker_complete_route_task).
// On success, patch the cached { tasks, doneAt } so the row checks off instantly
// without a refetch — mirrors the old local doneAt update.
export function useCompleteRouteTask(routeId?: string | null, userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await sb.rpc('worker_complete_route_task', { p_route_task_id: taskId });
      if (error) throw error;
      return (data as string) || new Date().toISOString();
    },
    onSuccess: (completedAt, taskId) => {
      qc.setQueryData(
        ['worker-route-tasks', routeId, userId],
        (old: { tasks: unknown[]; doneAt: Record<string, string> } | undefined) =>
          old ? { ...old, doneAt: { ...old.doneAt, [taskId]: completedAt } } : old,
      );
    },
  });
}
