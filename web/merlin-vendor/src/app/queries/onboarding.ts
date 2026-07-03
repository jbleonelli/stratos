// Query + mutation hooks for the first-run onboarding picker (WelcomeModal).
// First useMutation in the data layer — the reference pattern for writes:
// mutationFn does the work, onSuccess invalidates the gate so the modal closes.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sb } from '../db-client';
import type { Json, TablesUpdate } from '../../types/db';
import { listVerticals } from '../vertical-recommendations.js';

// The org's setup state, used to decide whether to show the picker.
export function useOrgSetupGate(organizationId?: string | null) {
  return useQuery({
    queryKey: ['org-setup-gate', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await sb
        .from('organizations')
        .select('setup_progress, kind')
        .eq('id', organizationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Persist the picked vertical: write setup_progress, then create a default
// building if the org has none (skipped for 'other' — no variant to write).
export function usePickVertical(organizationId?: string | null, organizationName?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (verticalKey: string) => {
      const v = listVerticals().find((x) => x.key === verticalKey);
      const variant = v?.variant ?? null;
      const recommended = v?.recommended ?? [];

      const setupProgress = { vertical_picked: verticalKey, recommended_agents: recommended, done: false };
      const { error: upErr } = await sb
        .from('organizations')
        .update({ setup_progress: setupProgress })
        .eq('id', organizationId!);
      if (upErr) throw new Error(`org update: ${upErr.message}`);

      if (verticalKey !== 'other') {
        const { data: existing } = await sb
          .from('locations')
          .select('id')
          .eq('organization_id', organizationId!)
          .eq('kind', 'building')
          .limit(1);
        if (!existing || existing.length === 0) {
          await sb.from('locations').insert({
            id: `${verticalKey}-hq`,
            organization_id: organizationId!,
            owner_org_id: organizationId!,
            manager_org_id: organizationId!,
            kind: 'building',
            variant,
            name: `${organizationName || 'Your'} HQ`,
            custom: false,
          });
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-setup-gate', organizationId] }),
  });
}

// ── GetStartedCard (Briefing onboarding checklist) ────────────────────────────
// One-click-enable defaults for the recommended-agent chips. Conservative:
// `propose` = always asks for human approval; `confidence: 50` surfaces even
// medium-confidence decisions. Mirrors the inlined constant the card used to own.
const ONE_CLICK_DEFAULTS = {
  enabled: true,
  autonomy: 'propose',
  confidence: 50,
  maxActionsPerHour: 6,
};

export type FirstDecisionRun = {
  id: string;
  agent_id: string;
  decision: string;
  decision_reason: string | null;
  created_at: string;
};

// The card's view-model. A discriminated union so the component can switch on
// `status` exactly as it did with its old local state shape.
export type GetStartedState =
  | { status: 'hide' }
  | {
      status: 'show';
      orgKind: 'contractor';
      setupProgress: Record<string, unknown>;
      crewCount: number;
      contractCount: number;
    }
  | {
      status: 'show';
      orgKind?: undefined;
      setupProgress: Record<string, unknown>;
      enabledSet: Set<string>;
      agentsCfg: Record<string, { enabled?: boolean } & Record<string, unknown>>;
      firstDecisionRun: FirstDecisionRun | null;
    };

// The whole onboarding-card load cycle: reads org setup state, then (real-estate)
// merlin_config / source / member / first-run polling, or (contractor) crew /
// contract / member polling — auto-stamping setup_progress when it detects work
// the user did elsewhere. Polled every 15s so ✓s land without a callback wired
// into every upstream flow. Behavior matches the card's old `load()` exactly,
// including the write-backs that happen mid-poll.
export function useGetStartedData(organizationId?: string | null) {
  return useQuery<GetStartedState>({
    queryKey: ['get-started', organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: 15_000,
    queryFn: async (): Promise<GetStartedState> => {
      try {
        const { data: org, error: oe } = await sb
          .from('organizations')
          .select('setup_progress, kind')
          .eq('id', organizationId!)
          .maybeSingle();
        if (oe || !org) return { status: 'hide' };

        const sp = ((org.setup_progress as Record<string, unknown>) || {}) as Record<string, unknown>;
        const orgKind = (org.kind as string | null) || null;
        const isContractor = orgKind === 'contractor';

        if (sp.done === true) return { status: 'hide' };
        // Real-estate orgs gate on vertical_picked (set by WelcomeModal).
        // Contractor orgs skip the WelcomeModal entirely — their card shows on
        // first sign-in, no gate needed.
        if (!isContractor && !sp.vertical_picked) return { status: 'hide' };

        // Contractor branch — different data, different steps, no merlin_config /
        // agent / source_connection polling. Count team_members + contracts.
        if (isContractor) {
          const updates: Record<string, unknown> = {};
          const { count: crewCount } = await sb
            .from('team_members')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId!);
          const { count: contractCount } = await sb
            .from('contracts')
            .select('id', { count: 'exact', head: true })
            .eq('contractor_org_id', organizationId!);
          const { count: memberCount } = await sb
            .from('organization_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('org_id', organizationId!);
          if (!sp.first_crew_added_at && crewCount && crewCount > 0) {
            updates.first_crew_added_at = new Date().toISOString();
          }
          if (!sp.first_contract_added_at && contractCount && contractCount > 0) {
            updates.first_contract_added_at = new Date().toISOString();
          }
          if (!sp.first_invite_sent_at && memberCount && memberCount > 1) {
            updates.first_invite_sent_at = new Date().toISOString();
          }
          const nextSp = Object.keys(updates).length > 0 ? { ...sp, ...updates } : sp;
          if (Object.keys(updates).length > 0) {
            await sb
              .from('organizations')
              .update({ setup_progress: nextSp as Json })
              .eq('id', organizationId!);
          }
          return {
            status: 'show',
            orgKind: 'contractor',
            setupProgress: nextSp,
            crewCount: crewCount || 0,
            contractCount: contractCount || 0,
          };
        }

        // Read merlin_config to know which agents are already enabled.
        const { data: cfgRows } = await sb
          .from('merlin_config')
          .select('section, value')
          .eq('organization_id', organizationId!)
          .is('location_id', null)
          .eq('section', 'agents')
          .maybeSingle();
        const agentsCfg = (cfgRows?.value && typeof cfgRows.value === 'object' ? cfgRows.value : {}) as Record<
          string,
          { enabled?: boolean } & Record<string, unknown>
        >;
        const enabledSet = new Set(
          Object.entries(agentsCfg)
            .filter(([, v]) => v?.enabled === true)
            .map(([k]) => k),
        );

        // Auto-complete detection: when the user actually connects a source or
        // invites a teammate elsewhere, reflect it here without callbacks.
        const updates: Record<string, unknown> = {};

        if (!sp.data_source_connected_at) {
          const { count: sourceCount } = await sb
            .from('source_connection')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId!);
          if (sourceCount && sourceCount > 0) {
            updates.data_source_connected_at = new Date().toISOString();
          }
        }

        if (!sp.first_invite_sent_at) {
          const { count: memberCount } = await sb
            .from('organization_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('org_id', organizationId!);
          // > 1 because the owner is always a member; the first invite tips to >=2.
          if (memberCount && memberCount > 1) {
            updates.first_invite_sent_at = new Date().toISOString();
          }
        }

        // First-decision celebration: an enabled agent + a run in the last hour.
        // Stamp first_agent_run_at once so we don't re-celebrate across sessions.
        let firstDecisionRun: FirstDecisionRun | null = null;
        if (enabledSet.size > 0 && !sp.first_agent_run_at) {
          const since = new Date(Date.now() - 60 * 60_000).toISOString();
          const { data: firstRuns } = await sb
            .from('agent_runs')
            .select('id, agent_id, decision, decision_reason, created_at')
            .eq('organization_id', organizationId!)
            .in('agent_id', Array.from(enabledSet))
            .in('decision', ['act', 'ask', 'skip'])
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .limit(1);
          if (firstRuns && firstRuns.length > 0) {
            const r = firstRuns[0];
            firstDecisionRun = {
              id: r.id,
              agent_id: r.agent_id,
              decision: r.decision as string,
              decision_reason: r.decision_reason ?? null,
              created_at: r.created_at as string,
            };
            updates.first_agent_run_at = firstDecisionRun.created_at;
          }
        }

        // Persist any new completions and merge locally so the next render shows ✓.
        const nextSp = Object.keys(updates).length > 0 ? { ...sp, ...updates } : sp;
        if (Object.keys(updates).length > 0) {
          await sb
            .from('organizations')
            .update({ setup_progress: nextSp as Json })
            .eq('id', organizationId!);
        }

        return { status: 'show', setupProgress: nextSp, enabledSet, agentsCfg, firstDecisionRun };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[GetStartedCard] load failed', (e as Error)?.message);
        return { status: 'hide' };
      }
    },
  });
}

// Enable one recommended agent via the canonical set_merlin_config RPC (same
// writer the Agentic settings surface uses), then stamp first_agent_enabled_at on
// the first enable. Returns the next agents config so the caller can optimistically
// update. Invalidates the card so the next poll picks up canonical state.
export function useEnableAgent(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      agentsCfg,
      setupProgress,
    }: {
      agentId: string;
      agentsCfg: Record<string, Record<string, unknown>>;
      setupProgress: Record<string, unknown>;
    }) => {
      const nextAgentsCfg = {
        ...agentsCfg,
        [agentId]: { ...(agentsCfg[agentId] || {}), ...ONE_CLICK_DEFAULTS },
      };
      const { error: ae } = await sb.rpc('set_merlin_config', {
        p_org_id: organizationId!,
        p_location_id: null as unknown as string,
        p_section: 'agents',
        p_value: nextAgentsCfg as Json,
      });
      if (ae) {
        // eslint-disable-next-line no-console
        console.warn('[GetStartedCard] enable failed', ae.message);
        return { ok: false as const, nextAgentsCfg };
      }

      // Stamp first_agent_enabled_at on the first enable.
      if (!setupProgress.first_agent_enabled_at) {
        await sb
          .from('organizations')
          .update({
            setup_progress: { ...setupProgress, first_agent_enabled_at: new Date().toISOString() } as Json,
          })
          .eq('id', organizationId!);
      }
      return { ok: true as const, nextAgentsCfg };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['get-started', organizationId] }),
  });
}

// Dismiss the card forever for this org: setup_progress.done = true.
export function useDismissGetStarted(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (setupProgress: Record<string, unknown>) => {
      const patch: TablesUpdate<'organizations'> = {
        setup_progress: { ...setupProgress, done: true } as Json,
      };
      const { error } = await sb.from('organizations').update(patch).eq('id', organizationId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['get-started', organizationId] }),
  });
}
