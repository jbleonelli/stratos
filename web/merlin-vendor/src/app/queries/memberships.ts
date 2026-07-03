// Query hooks for a user's org memberships. First hook of the React Query
// data layer (Phase 2) — the reference pattern for the rest:
//   1. typed query against `sb` (the schema-typed client),
//   2. transform inside queryFn so components consume view-models, not rows,
//   3. a stable queryKey, and `enabled` to skip until inputs are ready.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

export type OtherMembership = { id: string; name: string; slug: string | null };

// Active workspaces the user belongs to OTHER than the current one — used by the
// suspended-org landing to offer a switch. Excludes the current org, non-active
// orgs, and the platform-admin 'adaptiv' org (a gate, not a workspace).
export function useOtherMemberships(userId?: string | null, currentOrgId?: string | null) {
  return useQuery({
    queryKey: ['memberships', 'other', userId, currentOrgId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<OtherMembership[]> => {
      const { data, error } = await sb
        .from('organization_members')
        .select('org_id, organizations(id, name, slug, kind, lifecycle_state)')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? [])
        .filter(
          (m) =>
            m.org_id !== currentOrgId &&
            m.organizations?.lifecycle_state === 'active' &&
            m.organizations?.kind !== 'adaptiv',
        )
        .map((m) => ({
          id: m.org_id,
          name: m.organizations?.name || '—',
          slug: m.organizations?.slug ?? null,
        }));
    },
  });
}

export type WorkspaceMembership = {
  id: string;
  name: string;
  slug: string | null;
  kind: string | null;
  lifecycleState: string;
  role: string | null;
};

// All of a user's workspaces (for the sidebar switcher) — every non-deleted,
// non-'adaptiv' org they belong to, with their role, oldest-joined first.
// (Unlike useOtherMemberships this keeps the current + non-active orgs.)
export function useWorkspaceMemberships(userId?: string | null) {
  return useQuery({
    queryKey: ['memberships', 'workspace', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<WorkspaceMembership[]> => {
      const { data } = await sb
        .from('organization_members')
        .select('org_id, role, organizations(id, name, slug, kind, lifecycle_state)')
        .eq('user_id', userId!)
        .order('joined_at', { ascending: true });
      return (
        (data ?? [])
          .filter((m) => m.organizations && m.organizations.lifecycle_state !== 'deleted')
          // Hide kind='adaptiv' — the platform-admin gate, not a workspace.
          .filter((m) => m.organizations.kind !== 'adaptiv')
          .map((m) => ({
            id: m.org_id,
            name: m.organizations?.name || '—',
            slug: m.organizations?.slug ?? null,
            kind: m.organizations?.kind ?? null,
            lifecycleState: m.organizations?.lifecycle_state || 'active',
            role: m.role ?? null,
          }))
      );
    },
  });
}
