// GetStartedCard — Phase 3 of new-tenant onboarding.
//
// Renders a slim banner at the top of the Briefing page right after a
// fresh tenant has completed the WelcomeModal (PR #522). Walks them
// through the next three steps:
//   1. ✓ Building created  (always ✓ here — WelcomeModal handles it)
//   2. ☐ Enable your first agent  (3 chips → one-click enable)
//   3. ☐ Connect a data source     (CTA appears after step 2)
//   4. ☐ Invite a teammate         (CTA always available)
//
// Self-gates on organizations.setup_progress.done. Once set true
// (by manual ✕ dismiss or all-steps-complete), the card disappears
// forever for that org. Returns null for any org where setup_progress
// is empty (WelcomeModal hasn't run) or done is true.
//
// Each "enable agent" chip calls the existing set_merlin_config RPC
// (same writer the Agentic settings surface uses) so the agent's
// runtime config lands in the canonical place. Defaults match
// AGENT_DEFAULTS from agentic-data.js but are inlined here so this
// component doesn't have to import the whole catalog.

import React, { useEffect, useState } from 'react';
import { Card } from './primitives.jsx';
import { VERTICALS } from './vertical-recommendations.js';
import { useT } from './i18n.js';
import { useGetStartedData, useEnableAgent, useDismissGetStarted } from './queries/onboarding.ts';

const AGENT_LABEL = {
  cleaning: 'Cleaning',
  hvac: 'HVAC',
  space: 'Space',
  supply: 'Supply',
  compliance: 'Compliance',
  security: 'Security',
  energy: 'Energy',
  'cold-chain': 'Cold Chain',
  'pharmacy-temp': 'Pharmacy Temp',
  'predictive-maintenance': 'Predictive Maintenance',
  'asset-tracking': 'Asset Tracking',
  'crowd-flow': 'CrowdFlow',
  'concession-demand': 'ConcessionDemand',
  'incident-choreography': 'IncidentChoreography',
};

export function GetStartedCard({ organizationId, onOpenChat }) {
  const tT = useT();
  // Read + auto-complete polling now lives in the React Query data layer
  // (useGetStartedData), which runs the same load cycle every 15s and writes
  // back setup_progress when it detects work done elsewhere. We mirror its
  // result into local state so the existing optimistic-update paths (enable a
  // chip, dismiss the card) keep working unchanged.
  const { data: queryState } = useGetStartedData(organizationId);
  const [state, setState] = useState({ status: 'loading' });
  const enableAgentMut = useEnableAgent(organizationId);
  const dismissMut = useDismissGetStarted(organizationId);

  // Sync the query result into local view-model state. We only overwrite when
  // the query produces a definite answer (show/hide); a local optimistic
  // `hide` (just-dismissed) is preserved until the next definite query result.
  useEffect(() => {
    if (queryState) setState(queryState);
  }, [queryState]);

  if (state.status !== 'show') return null;

  // Contractor branch — completely different surface from the
  // real-estate flow. Different steps, different data source, no
  // agent / source / vertical concepts.
  if (state.orgKind === 'contractor') {
    return (
      <ContractorCard
        tT={tT}
        organizationId={organizationId}
        setupProgress={state.setupProgress}
        crewCount={state.crewCount}
        contractCount={state.contractCount}
        onDismiss={async () => {
          await dismissMut.mutateAsync(state.setupProgress);
          setState({ status: 'hide' });
        }}
        onOpenChat={onOpenChat}
      />
    );
  }

  const { setupProgress, enabledSet, agentsCfg, firstDecisionRun } = state;

  const recommended = Array.isArray(setupProgress.recommended_agents) ? setupProgress.recommended_agents : [];
  // Show up to 3 unenabled-yet recommendations as chips.
  const chips = recommended.filter((id) => !enabledSet.has(id)).slice(0, 3);
  const firstAgentEnabled = !!setupProgress.first_agent_enabled_at || enabledSet.size > 0;
  const dataSourceConnected = !!setupProgress.data_source_connected_at;
  const teammateInvited = !!setupProgress.first_invite_sent_at;

  // Tailored hint for step 3: look up the minimum_signal text for the
  // most-recently-enabled agent in the user's vertical. Falls back to
  // a generic line if we don't have a specific hint.
  const vertical = setupProgress.vertical_picked || 'other';
  const verticalConfig = VERTICALS[vertical];
  // Heuristic: "most recently enabled" = the enabled agent that's
  // earliest in the recommended list AND in enabledSet. (We don't
  // track per-agent enabled_at timestamps yet.)
  const recentlyEnabled = recommended.find((id) => enabledSet.has(id));
  const sourceHint =
    recentlyEnabled && verticalConfig?.minimum_signal?.[recentlyEnabled]
      ? tT('onboarding.card.step_source.body_hint', {
          agent: AGENT_LABEL[recentlyEnabled] || recentlyEnabled,
          hint: verticalConfig.minimum_signal[recentlyEnabled],
        })
      : tT('onboarding.card.step_source.body_default');

  async function enableAgent(agentId) {
    const result = await enableAgentMut.mutateAsync({ agentId, agentsCfg, setupProgress });
    if (!result.ok) return;
    const nextAgentsCfg = result.nextAgentsCfg;

    // Optimistic update — next poll picks up the canonical state.
    setState((s) => ({
      ...s,
      enabledSet: new Set([...s.enabledSet, agentId]),
      agentsCfg: nextAgentsCfg,
      setupProgress: {
        ...s.setupProgress,
        first_agent_enabled_at: s.setupProgress.first_agent_enabled_at || new Date().toISOString(),
      },
    }));
  }

  async function dismiss() {
    await dismissMut.mutateAsync(setupProgress);
    setState({ status: 'hide' });
  }

  return (
    <Card style={{ marginBottom: 16, padding: 18, background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {tT('onboarding.card.title')}
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: 12,
            padding: '2px 8px',
          }}
        >
          {tT('onboarding.card.dismiss')}
        </button>
      </div>

      <Step
        done
        label={tT('onboarding.card.step_building.label')}
        body={
          setupProgress.vertical_picked === 'other'
            ? tT('onboarding.card.step_building.body_other')
            : tT('onboarding.card.step_building.body_one', {
                vertical: setupProgress.vertical_picked || 'your vertical',
              })
        }
      />

      <Step
        done={firstAgentEnabled}
        label={tT('onboarding.card.step_agent.label')}
        body={
          firstAgentEnabled
            ? tT(
                enabledSet.size === 1
                  ? 'onboarding.card.step_agent.body_done_one'
                  : 'onboarding.card.step_agent.body_done_many',
                { n: enabledSet.size },
              )
            : chips.length > 0
              ? tT('onboarding.card.step_agent.body_pending')
              : tT('onboarding.card.step_agent.body_empty')
        }
      >
        {!firstAgentEnabled && chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {chips.map((id) => (
              <button
                key={id}
                onClick={() => enableAgent(id)}
                style={{
                  background: 'var(--accent-soft, #FCE4F0)',
                  color: 'var(--accent, #D946EF)',
                  border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                  borderRadius: 16,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.1,
                  cursor: 'pointer',
                }}
              >
                {tT('onboarding.card.step_agent.chip_enable', { label: AGENT_LABEL[id] || id })}
              </button>
            ))}
          </div>
        )}
      </Step>

      {firstAgentEnabled && (
        <Step
          done={dataSourceConnected}
          label={tT('onboarding.card.step_source.label')}
          body={dataSourceConnected ? tT('onboarding.card.step_source.body_done') : sourceHint}
          cta={
            !dataSourceConnected && {
              label: tT('onboarding.card.step_source.cta'),
              href: '/customer/operations?section=sources',
            }
          }
        />
      )}

      {/* First-decision celebration (PR #525). Lands inline once an
          enabled agent has produced its first run — the "ahh, it's
          actually doing something" moment. Auto-disappears when the
          user dismisses the whole card. */}
      {firstDecisionRun && (
        <div
          style={{
            marginTop: 8,
            marginBottom: 12,
            padding: 12,
            background: 'color-mix(in oklch, var(--ok) 8%, transparent)',
            border: '1px solid color-mix(in oklch, var(--ok) 25%, transparent)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'var(--ok, #16A34A)',
              marginBottom: 4,
            }}
          >
            {tT('onboarding.card.celebration.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            {tT('onboarding.card.celebration.body', {
              agent: AGENT_LABEL[firstDecisionRun.agent_id] || firstDecisionRun.agent_id,
              decision: firstDecisionRun.decision,
            })}
            <div style={{ marginTop: 4, color: 'var(--text-dim)' }}>
              {(firstDecisionRun.decision_reason || '').slice(0, 200) || tT('onboarding.card.celebration.no_reason')}
            </div>
          </div>
        </div>
      )}

      <Step
        done={teammateInvited}
        label={tT('onboarding.card.step_invite.label')}
        body={
          teammateInvited ? tT('onboarding.card.step_invite.body_done') : tT('onboarding.card.step_invite.body_pending')
        }
        cta={
          !teammateInvited && {
            label: tT('onboarding.card.step_invite.cta'),
            href: '/customer/admin?section=users',
          }
        }
      />

      {/* Chat-hook entrypoint (PR #524). Uses the Briefing's existing
          onOpenChat callback — same pattern AttentionCard uses for
          "tell me about this incident". Prefills the first message so
          Merlin lands mid-conversation about onboarding. */}
      {onOpenChat && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--rule, #E5E7EB)',
            fontSize: 12,
            color: 'var(--text-dim)',
          }}
        >
          <button
            onClick={() => onOpenChat('Help me set up Merlin for my workspace — what should I do first?')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent, #D946EF)',
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
              letterSpacing: 0.1,
            }}
          >
            {tT('onboarding.card.chat_hook')}
          </button>
        </div>
      )}
    </Card>
  );
}

function Step({ done, label, body, cta, children }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: done ? 'var(--ok, #16A34A)' : 'transparent',
          border: done ? 'none' : '1.5px solid var(--rule, #CBD5E1)',
          color: 'white',
          fontSize: 12,
          fontWeight: 700,
          marginTop: 1,
        }}
      >
        {done ? '✓' : ''}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: -0.05,
            color: done ? 'var(--text-dim)' : 'var(--text)',
            textDecoration: done ? 'none' : 'none',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.45 }}>{body}</div>
        {children}
        {cta && (
          <a
            href={cta.href}
            style={{
              display: 'inline-block',
              marginTop: 6,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent, #D946EF)',
              textDecoration: 'none',
              letterSpacing: 0.1,
            }}
          >
            {cta.label}
          </a>
        )}
      </div>
    </div>
  );
}

// Contractor variant of the Get-started card. Lives in this file so
// the conditional render path stays simple. The shape is identical
// to the real-estate card — same Card + same Step rows + same
// dismiss + same chat-hook — only the data sources + step labels
// differ. The Phase 6 design doc has the full rationale.
function ContractorCard({ tT, setupProgress, crewCount, contractCount, onDismiss, onOpenChat }) {
  const crewAdded = !!setupProgress.first_crew_added_at || crewCount > 0;
  const contractAdded = !!setupProgress.first_contract_added_at || contractCount > 0;
  const teammateInvited = !!setupProgress.first_invite_sent_at;

  return (
    <Card style={{ marginBottom: 16, padding: 18, background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {tT('onboarding.contractor.card.eyebrow')}
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: 12,
            padding: '2px 8px',
          }}
        >
          {tT('onboarding.card.dismiss')}
        </button>
      </div>

      <Step
        done={crewAdded}
        label={tT('onboarding.contractor.card.step_crew.label')}
        body={
          crewAdded
            ? tT('onboarding.contractor.card.step_crew.body_done', { n: crewCount })
            : tT('onboarding.contractor.card.step_crew.body_pending')
        }
        cta={
          !crewAdded && {
            label: tT('onboarding.contractor.card.step_crew.cta'),
            href: '/customer/admin?section=crew',
          }
        }
      />

      <Step
        done={contractAdded}
        label={tT('onboarding.contractor.card.step_contract.label')}
        body={
          contractAdded
            ? tT('onboarding.contractor.card.step_contract.body_done', { n: contractCount })
            : tT('onboarding.contractor.card.step_contract.body_pending')
        }
        cta={
          !contractAdded && {
            label: tT('onboarding.contractor.card.step_contract.cta'),
            href: '/customer/operations?section=contracts',
          }
        }
      />

      <Step
        done={teammateInvited}
        label={tT('onboarding.card.step_invite.label')}
        body={
          teammateInvited ? tT('onboarding.card.step_invite.body_done') : tT('onboarding.card.step_invite.body_pending')
        }
        cta={
          !teammateInvited && {
            label: tT('onboarding.card.step_invite.cta'),
            href: '/customer/admin?section=users',
          }
        }
      />

      {onOpenChat && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--rule, #E5E7EB)',
            fontSize: 12,
            color: 'var(--text-dim)',
          }}
        >
          <button
            onClick={() => onOpenChat('Help me set up Merlin for my contractor workspace — what should I do first?')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent, #D946EF)',
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
              letterSpacing: 0.1,
            }}
          >
            {tT('onboarding.card.chat_hook')}
          </button>
        </div>
      )}
    </Card>
  );
}
