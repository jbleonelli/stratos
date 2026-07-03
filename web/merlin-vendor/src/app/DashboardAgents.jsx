// Agents surface — extracted from Dashboard.jsx.
//
// The whole agent-runtime UI cluster: the AgentsPanel grid (general /
// specialized agent cards with live runtime stats), the per-agent
// runtime card, the recent-runs / human-actions feeds, the agent-runs
// timeline, and the EventDrawer (run/action detail flyout). AgentsPanel
// composes the runtime cards + feeds; EventDrawer is opened from the
// agent detail view.
//
// Exported: AgentsPanel (App.jsx mounts it), EventDrawer (AgentDetailView
// opens it). Everything else — RunDetails, AgentRuntimeCard, RecentRunRow,
// HumanActionsFeed, AgentRunsTimeline, FilterChip, the live-line / human-ts
// helpers, etc. — is private to this module.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { filterAgentsForRole } from './roles.js';
import { useT } from './i18n.js';
import { useTranslatedText } from './event-translations.js';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useContractorAgents } from './contractor-agents.js';
import { AGENTS } from './data.js';
import {
  useAgenticConfig,
  AUTONOMY_LEVELS,
  RECENT_AGENT_ACTIONS,
  resolveDataSource,
  AGENT_GROUPS,
  AGENT_GROUP_BY_ID,
} from './agentic-data.js';
import { useRecentActions, relativeTime as relTime } from './incident-actions.js';
import { useAgentRuntimeStats, useLatestAgentActions } from './agent-runs.js';
import { useAgentActionRenderer } from './ask-render.js';
import { useMerlinAsks } from './merlin-asks.js';
import { useBuildingAgentEntitlements } from './building-agent-entitlements.js';

const AUTONOMY_TONE = {
  propose: 'info',
  'auto-low-risk': 'warn',
  'approve-critical': 'accent',
  'full-auto': 'ok',
};

export function AgentsPanel({ building, role, onAskMerlin, request, onOpenCalls, onOpenAgentic, onOpenAgentDetail }) {
  const t = useT();
  // Selected event for the right-side detail drawer (operator action
  // OR agent run). Shape: { kind: 'human'|'run', data }.
  const [selectedEvent, setSelectedEvent] = useState(null);
  // Building-scoped: per-building overrides for 'merlin' + 'agents'
  // shadow org defaults. The runtime cards reflect what's actually
  // configured for this building.
  const [config] = useAgenticConfig(building?.id || null);
  const session = useSession();
  const allRoleAgents = filterAgentsForRole(AGENTS, role?.id);
  // Per-building entitlements (migration 117). Grandfathered customers
  // see every agent entitled; new buildings start empty and the admin
  // picks which agents to unlock (1 free, $99/mo per extra).
  //
  // 2026-05-19: the previous fallback "show all agents until hydrated"
  // caused a flash on fresh tenants (PRO TEST) — 12 agents rendered as
  // Running for ~200ms before the hook resolved and 11 snapped into
  // Locked. Inverted: gate the lists on `ready` so the brief empty
  // state is correct rather than the brief full state being wrong.
  // The empty state itself is invisible because we render a "loading"
  // placeholder below until the hook hydrates.
  const { entitled, ready: entitlementsReady } = useBuildingAgentEntitlements(session?.organizationId, building?.id);
  // Contractor tailoring: a contractor owns no buildings, so entitlements are
  // empty. Scope the panel to the current service line's agents instead, so a
  // cleaning contractor sees cleaning/supply/compliance/servicing, a security
  // contractor sees security/compliance/servicing, etc.
  const activeOrg = useActiveOrg();
  const isContractorOrg = activeOrg?.kind === 'contractor';
  // Contractor roster: ONE specialized agent per service line on the active
  // contracts (Cleaning / Security / Hospitality / Maintenance), each with live
  // runtime derived from the 'servicing' co-worker's runs bucketed by domain
  // (contractor-agents.js). The owner-side AGENTS catalog isn't what a
  // facilities contractor operates, so we don't borrow it. Owner orgs keep the
  // entitlement-gated AGENTS grid below.
  const contractorAgents = useContractorAgents(session?.organizationId, activeOrg?.kind);
  const agents = isContractorOrg
    ? contractorAgents.roster
    : entitlementsReady
      ? allRoleAgents.filter((a) => entitled.has(a.id))
      : [];
  const recentByAgent = useMemo(() => {
    const out = {};
    for (const a of RECENT_AGENT_ACTIONS) {
      if (!out[a.agent]) out[a.agent] = a;
    }
    return out;
  }, []);
  // Live runtime stats (K-3) for agents wired up to the per-agent
  // runtime in api/agents/*. Agents without a runtime (still static,
  // waiting on K-2) get undefined — card falls back to recentByAgent.
  const runtime = useAgentRuntimeStats(session?.organizationId);
  // K-10..K-15: latest persisted action per agent (hvac/supply/space/
  // energy/compliance/security). Cleaning has its own surface in
  // Today's plan so it isn't included here. Scoped to the active
  // building so multi-building tenants (Meridian HQ + MDE + MHC under
  // one org) don't blend each other's agent activity.
  const latestActions = useLatestAgentActions(session?.organizationId, building?.id);
  // K-7: count agent-pushed asks awaiting human approval. Filtered to
  // ones with agentRunId set so simulator/human asks don't double-count.
  // Building-scoped so AgentsPanel inside a per-building dashboard
  // doesn't surface asks from another building.
  const allAsks = useMerlinAsks(building?.id);
  const pendingAgentAsks = allAsks.filter((a) => a.agentRunId);
  const pendingByAgent = {};
  for (const a of pendingAgentAsks) {
    if (!a.agentId) continue;
    pendingByAgent[a.agentId] = (pendingByAgent[a.agentId] || 0) + 1;
  }

  // Per-agent lookup maps. For contractors these come from the line roster
  // (config / runtime / pending derived from the bucketed 'servicing' runs);
  // for owner orgs they're the owner-side config + agent_runs as before. Using
  // plain objects (not closures) keeps the downstream useMemo deps honest.
  const cfgMap = isContractorOrg ? contractorAgents.cfgById : config.agents;
  const liveMap = isContractorOrg ? contractorAgents.byLine : runtime;
  const pendMap = isContractorOrg
    ? Object.fromEntries(Object.entries(contractorAgents.byLine).map(([k, v]) => [k, v.pendingAsks || 0]))
    : pendingByAgent;

  // Agent bar deep-link: when the caller routes here with a specific
  // agentId in the request, scroll that card into view and briefly
  // highlight it. Dedupe on `request.at` so StrictMode + HMR re-runs
  // don't cancel each other's smooth scrolls. Use direct scrollTop
  // assignment — scrollIntoView(smooth) was unreliable under React's
  // double-effect lifecycle here.
  const cardRefs = useRef({});
  const [highlighted, setHighlighted] = useState(null);
  const lastServedAt = useRef(null);
  useEffect(() => {
    const id = request?.agentId;
    const at = request?.at;
    if (!id || !at || lastServedAt.current === at) return;
    let attempts = 0;
    let scheduled;
    let fadeTimer;
    const tryScroll = () => {
      const el = cardRefs.current[id];
      if (!el) {
        if (attempts++ < 10) {
          scheduled = setTimeout(tryScroll, 50);
        }
        return;
      }
      const main = el.closest('main');
      if (main) {
        // Direct scrollTop — scrollTo({ behavior: 'smooth' }) doesn't
        // animate on this parent (flex column with overflow:auto),
        // but direct assignment works reliably.
        const target = Math.max(0, el.offsetTop - main.clientHeight / 2 + el.offsetHeight / 2);
        main.scrollTop = target;
      } else {
        el.scrollIntoView({ block: 'center' });
      }
      lastServedAt.current = at;
      setHighlighted(id);
      fadeTimer = setTimeout(() => setHighlighted(null), 2800);
    };
    scheduled = setTimeout(tryScroll, 80);
    return () => {
      if (scheduled) clearTimeout(scheduled);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [request?.at, request?.agentId]);

  // Live recent activity: flatten today's runs across every agent,
  // sort newest-first, take the top 12. Skips are filtered out — the
  // agent's own card already surfaces the latest tick via "Last ran X
  // ago · reason", and surfacing every empty heartbeat here turns the
  // feed into noise (especially on tenants with one ticking agent and
  // no work to do).
  const recentRuns = useMemo(() => {
    const flat = [];
    for (const agent of agents) {
      const runs = liveMap[agent.id]?.runs || [];
      for (const r of runs) {
        if (r.decision === 'skip') continue;
        flat.push({ ...r, _agentName: agent.name });
      }
    }
    flat.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return flat.slice(0, 12);
  }, [agents, liveMap]);

  // Filter + sort controls for the agent grid. Disabled agents always
  // get their own collapsible section below the main grid — the
  // filter pills only operate on the enabled set.
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'active' | 'pending'
  const [sortMode, setSortMode] = useState('name'); // 'name' | 'activity' | 'pending'
  useState(false);

  const enabledAgents = useMemo(() => agents.filter((a) => cfgMap[a.id]?.enabled !== false), [agents, cfgMap]);
  useMemo(() => agents.filter((a) => cfgMap[a.id]?.enabled === false), [agents, cfgMap]);

  const visibleAgents = useMemo(() => {
    let list = enabledAgents.slice();
    if (filterMode === 'active') {
      list = list.filter((a) => a.status === 'active');
    } else if (filterMode === 'pending') {
      list = list.filter((a) => (pendMap[a.id] || 0) > 0);
    }
    list.sort((a, b) => {
      if (sortMode === 'activity') {
        const av = liveMap[a.id]?.actionsToday ?? -1;
        const bv = liveMap[b.id]?.actionsToday ?? -1;
        if (av !== bv) return bv - av;
      } else if (sortMode === 'pending') {
        const av = pendMap[a.id] || 0;
        const bv = pendMap[b.id] || 0;
        if (av !== bv) return bv - av;
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [enabledAgents, filterMode, sortMode, liveMap, pendMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      {/* KPI strip hidden 2026-05-23 per JB — Running-agents pill row
          below already exposes the active/total count; the other
          counters were redundant with the Activity surface. */}

      {/* Agent grid */}
      <Card pad={false}>
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.sparkle size={13} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agents.running')}</div>
          <Pill tone="accent">{enabledAgents.length}</Pill>
          <div style={{ flex: 1 }} />
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            <FilterChip active={filterMode === 'all'} onClick={() => setFilterMode('all')}>
              {t('agents.filter.all', { n: enabledAgents.length })}
            </FilterChip>
            <FilterChip active={filterMode === 'active'} onClick={() => setFilterMode('active')}>
              {t('agents.filter.active', { n: enabledAgents.filter((a) => a.status === 'active').length })}
            </FilterChip>
            <FilterChip active={filterMode === 'pending'} onClick={() => setFilterMode('pending')}>
              {t('agents.filter.with_pending', { n: enabledAgents.filter((a) => (pendMap[a.id] || 0) > 0).length })}
            </FilterChip>
          </div>
          {/* Sort selector */}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            <option value="name">{t('agents.sort.name')}</option>
            <option value="activity">{t('agents.sort.activity')}</option>
            <option value="pending">{t('agents.sort.pending')}</option>
          </select>
        </div>
        {/* While the entitlement hook is loading, show a quiet loading
            line instead of the no-match copy (which would imply "you
            have agents but none match the filter," misleading). The
            no-match copy still fires when the user actively narrows
            via the filter pills above. */}
        {!entitlementsReady ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
            {t('agents.loading')}
          </div>
        ) : visibleAgents.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
            {t('agents.no_match')}
          </div>
        ) : (
          /* Two presentation groups — General / Specialized (2026-06-04).
             Membership derives from agentic-data.js's AGENT_GROUP_BY_ID;
             current filter + sort still apply WITHIN each group, and any
             unmapped agent falls into Specialized so nothing disappears. */
          <>
            {AGENT_GROUPS.map((grp) => {
              const groupAgents = visibleAgents.filter((a) => (AGENT_GROUP_BY_ID[a.id] || 'specialized') === grp.id);
              if (groupAgents.length === 0) return null;
              return (
                <div key={grp.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 16px 0',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {t(grp.labelKey)}
                    <Pill>{groupAgents.length}</Pill>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: 10,
                      padding: 12,
                    }}
                  >
                    {groupAgents.map((agent) => {
                      const cfg = cfgMap[agent.id];
                      const recent = recentByAgent[agent.id];
                      const isHighlighted = highlighted === agent.id;
                      return (
                        <div
                          key={agent.id}
                          ref={(el) => {
                            cardRefs.current[agent.id] = el;
                          }}
                          style={{
                            outline: isHighlighted ? '2px solid var(--accent)' : '2px solid transparent',
                            outlineOffset: 2,
                            borderRadius: 10,
                            transition: 'outline-color .3s ease',
                          }}
                        >
                          <AgentRuntimeCard
                            agent={agent}
                            cfg={cfg}
                            recent={recent}
                            live={liveMap[agent.id]}
                            latestAction={isContractorOrg ? null : latestActions[agent.id] || null}
                            pendingAsks={pendMap[agent.id] || 0}
                            allSources={config.dataSources}
                            onAskMerlin={() => onAskMerlin?.(t('dash.ask.about_agent', { name: agent.name }))}
                            onOpenCalls={onOpenCalls ? () => onOpenCalls(agent.id) : null}
                            onOpenAgentic={onOpenAgentic ? () => onOpenAgentic(agent.id) : null}
                            onOpenDetail={onOpenAgentDetail ? () => onOpenAgentDetail(agent.id) : null}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
        {/* Disabled agents section retired 2026-05-28 — JB asked them
            hidden from MONITOR / AI Agents entirely. Disabled-agent
            config still lives in /platform → Agentic; the operator-
            facing AgentsPanel just lists what's actually running.
            `disabledAgents` is kept around as a derived value (used
            elsewhere on the page) — only the render is gone. */}
      </Card>

      {/* Recent operator actions — real audit stream, live across users */}
      <HumanActionsFeed onSelect={(r) => setSelectedEvent({ kind: 'human', data: r })} />

      {/* Live recent agent activity — flattened from agent_runs across
          every agent. Replaces the prior static placeholder. */}
      <Card pad={false}>
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Dot tone="ok" size={5} pulse />
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agents.recent_activity')}</div>
          <Pill>{recentRuns.length}</Pill>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.1,
              fontWeight: 700,
            }}
          >
            {t('agents.today_live_from')}
          </div>
        </div>
        {recentRuns.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
            {t('agents.no_runs_today')}
          </div>
        ) : (
          <div>
            {recentRuns.map((r, i) => (
              <RecentRunRow
                key={r.id}
                run={r}
                last={i === recentRuns.length - 1}
                onSelect={() => setSelectedEvent({ kind: 'run', data: r })}
              />
            ))}
          </div>
        )}
      </Card>

      <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

// Right-side drawer for inspecting an operator action or agent run.
// Slides in from the right; click backdrop or X to close. Two payloads:
//   - { kind: 'human', data: row }  → operator audit log row
//   - { kind: 'run',   data: row }  → agent_runs row
export function EventDrawer({ event, onClose }) {
  useEffect(() => {
    if (!event) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, onClose]);
  if (!event) return null;
  const { kind, data } = event;
  const isRun = kind === 'run';
  const title = isRun
    ? `${data._agentName || data.agent_id || 'Agent run'} · ${data.decision || '—'}`
    : `${data.action || 'Action'} — ${data.incident_title || data.incident_id || ''}`;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'merlinFadeIn 140ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '92vw',
          height: '100vh',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-16px 0 48px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            {isRun ? 'Agent run' : 'Operator action'}
          </div>
          <div
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: '4px 8px',
              fontSize: 13,
              fontWeight: 700,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-dim)',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
          {isRun ? <RunDetails run={data} /> : <HumanActionDetails action={data} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RunDetails({ run }) {
  const fields = [
    ['Agent', run._agentName || run.agent_id],
    ['Decision', run.decision],
    ['Confidence', run.confidence != null ? `${Math.round(run.confidence)}%` : null],
    ['Resolution', run.ask_resolution],
    ['Created', run.created_at ? new Date(run.created_at).toLocaleString() : null],
    ['Run ID', run.id],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FieldGrid fields={fields} />
      {run.decision_reason && <FieldBlock label="Reasoning" value={run.decision_reason} />}
      {run.action_payload && (
        <FieldBlock
          label="Action payload"
          value={
            typeof run.action_payload === 'string' ? run.action_payload : JSON.stringify(run.action_payload, null, 2)
          }
          mono
        />
      )}
    </div>
  );
}

function HumanActionDetails({ action }) {
  const fields = [
    ['Operator', action.actor_name || action.actor_email || action.actor_id],
    ['Action', action.action],
    ['Incident', action.incident_title || action.incident_id],
    ['Created', action.created_at ? new Date(action.created_at).toLocaleString() : null],
    ['Action ID', action.id],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FieldGrid fields={fields} />
      {action.note && <FieldBlock label="Note" value={action.note} />}
    </div>
  );
}

function FieldGrid({ fields }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 12px' }}>
      {fields
        .filter(([_, v]) => v != null && v !== '')
        .map(([k, v]) => (
          <React.Fragment key={k}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
                paddingTop: 2,
              }}
            >
              {k}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-word' }}>{String(v)}</div>
          </React.Fragment>
        ))}
    </div>
  );
}

function FieldBlock({ label, value, mono = false }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--text)',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 12px',
          fontFamily: mono ? 'var(--mono)' : 'inherit',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Reset for buttons that wrap a Pill — strip the default button chrome
// so the pill itself is the visible affordance, with hover cursor.
const pillButtonReset = {
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  display: 'inline-flex',
};

// One row in the live agent_runs feed below the agent grid. Tier C
// wiring: useTranslatedText on the free-form decision_reason so the
// reasoning shows in the active language.
function RecentRunRow({ run: r, last, onSelect }) {
  const t = useT();
  const decisionColor = liveLineTone(r.decision);
  const sourceReason = r.decision_reason || '';
  const translatedReason = useTranslatedText(sourceReason);
  const reason = sourceReason ? translatedReason || sourceReason : '';
  return (
    <div
      onClick={onSelect || undefined}
      onMouseEnter={(e) => {
        if (onSelect) e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (onSelect) e.currentTarget.style.background = 'transparent';
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 160px minmax(0, 1fr) 56px 72px',
        gap: 12,
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        fontSize: 12,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background-color .12s',
      }}
    >
      <div
        style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}
        title={new Date(r.created_at).toLocaleString()}
      >
        {relTime(r.created_at)}
      </div>
      <div
        style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {r._agentName}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-soft)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={reason || ''}
      >
        {reason || liveLineText(r, t) || '—'}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textAlign: 'right',
        }}
      >
        {r.confidence != null ? `${Math.round(r.confidence)}%` : '—'}
      </div>
      <div>
        <span
          style={{
            padding: '2px 7px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.1,
            textTransform: 'uppercase',
            borderRadius: 3,
            background: 'color-mix(in oklch, ' + decisionColor + ' 14%, var(--surface))',
            color: decisionColor,
            border: '1px solid color-mix(in oklch, ' + decisionColor + ' 30%, transparent)',
          }}
        >
          {r.ask_resolution === 'approved'
            ? 'approved'
            : r.ask_resolution === 'dismissed'
              ? 'dismissed'
              : r.decision === 'ask'
                ? 'pending'
                : r.decision || '—'}
        </span>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: 'var(--font)',
      }}
    >
      {children}
    </button>
  );
}

const ACTION_LABEL = {
  approve: 'human.action.approved',
  hold: 'human.action.held',
  escalate: 'human.action.escalated',
  reassign: 'human.action.reassigned',
  pin: 'human.action.pinned',
  unpin: 'human.action.unpinned',
  dismiss: 'human.action.dismissed',
  note: 'human.action.noted',
};
const ACTION_TONE = {
  approve: 'ok',
  hold: 'warn',
  escalate: 'risk',
  reassign: 'info',
  pin: 'accent',
  unpin: 'info',
  dismiss: 'off',
  note: 'info',
};

function HumanActionsFeed({ onSelect }) {
  const t = useT();
  const rows = useRecentActions(8);
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Dot tone="accent" size={5} pulse />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agents.recent_human_actions')}</div>
        <Pill>{rows.length}</Pill>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {rows.length > 0 ? t('human.actions.last', { when: relTime(rows[0].created_at) }) : t('human.actions.no_yet')}
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '24px 16px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          {t('human.actions.empty')}
        </div>
      ) : (
        <div>
          {rows.map((r, i) => (
            <div
              key={r.id}
              onClick={onSelect ? () => onSelect(r) : undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 140px minmax(0, 1fr) 90px',
                gap: 12,
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 12,
                cursor: onSelect ? 'pointer' : 'default',
                transition: 'background-color .12s',
              }}
              onMouseEnter={(e) => {
                if (onSelect) e.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                if (onSelect) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                {relTime(r.created_at)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.actor_name || t('human.actions.someone')}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-soft)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: 'var(--text-dim)' }}>
                  {ACTION_LABEL[r.action] ? t(ACTION_LABEL[r.action]) : r.action}
                </span>{' '}
                {r.incident_title || r.incident_id}
              </div>
              <div>
                <Pill tone={ACTION_TONE[r.action] || 'info'}>{r.action}</Pill>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AgentRuntimeCard({
  agent,
  cfg,
  recent,
  live,
  latestAction,
  pendingAsks = 0,
  allSources,
  onOpenCalls,
  onOpenAgentic,
  onOpenDetail,
}) {
  const t = useT();
  const IconC = Icon[cfg?.icon || 'sparkle'] || Icon.sparkle;
  const enabled = cfg?.enabled ?? true;
  const autonomy = AUTONOMY_LEVELS.find((a) => a.id === cfg?.autonomy);
  const autonomyTone = AUTONOMY_TONE[cfg?.autonomy] || 'info';
  const linkedSources = (cfg?.dataSources || [])
    .slice(0, 3)
    .map((ref) => resolveDataSource({ dataSources: allSources || {} }, ref));
  const statusTone = !enabled ? 'off' : agent.status === 'active' ? 'ok' : 'warn';
  // When the agent is wired to real runtime (K-1/K-2), the number + last
  // line come from agent_runs. Any live signal (today-run OR latest
  // persisted action) means we should show the real count even if 0;
  // only fall back to the static filler when nothing live exists at all.
  const hasAnyLive = !!(live || latestAction);
  const actionsDisplay = hasAnyLive ? (live?.actionsToday ?? 0) : agent.actions;
  // Headline number stays = "actions landed today" (truth). When that's
  // 0 but the agent has unresolved asks, tone the number warn instead
  // of accent so the card reads "alive, awaiting review" rather than
  // "dead". Pending count also gets its own pill below for clarity.
  const showAwaiting = hasAnyLive && actionsDisplay === 0 && pendingAsks > 0;
  // K-9: timeline of today's runs, expandable.
  const timeline = live?.runs || [];
  const [expanded, setExpanded] = useState(false);
  // Tier C: translate the lastRun reason on read so the "Last ran X
  // · {reason}" footer shows in the active language. liveLineText
  // truncates after we feed it the translated string.
  const lastRunReason = live?.lastRun?.decision_reason || '';
  const translatedLastRun = useTranslatedText(lastRunReason);
  const lastRunForLine = lastRunReason
    ? { ...live.lastRun, decision_reason: translatedLastRun || lastRunReason }
    : live?.lastRun;

  return (
    <div
      onClick={onOpenDetail || undefined}
      style={{
        padding: 12,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: enabled ? 1 : 0.7,
        cursor: onOpenDetail ? 'pointer' : 'default',
        transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={
        onOpenDetail
          ? (e) => {
              e.currentTarget.style.borderColor = 'var(--accent-line)';
            }
          : undefined
      }
      onMouseLeave={
        onOpenDetail
          ? (e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }
          : undefined
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            flexShrink: 0,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconC size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {agent.name}
            </div>
            <Dot tone={statusTone} size={5} pulse={enabled && agent.status === 'active'} />
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              marginTop: 2,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {agent.tag}
          </div>
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--mono)',
            color: showAwaiting ? 'var(--warn)' : 'var(--accent)',
            lineHeight: 1,
          }}
          title={
            live
              ? showAwaiting
                ? t(pendingAsks === 1 ? 'agents.tooltip.awaiting_one' : 'agents.tooltip.awaiting_many', {
                    n: pendingAsks,
                  })
                : t('agents.tooltip.live')
              : t('agents.tooltip.static')
          }
        >
          {actionsDisplay}
        </div>
      </div>

      {(autonomy || pendingAsks > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {autonomy &&
            (onOpenAgentic ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAgentic();
                }}
                title={t('agents.tooltip.open_agentic')}
                style={pillButtonReset}
              >
                <Pill tone={autonomyTone}>{autonomy.label}</Pill>
              </button>
            ) : (
              <Pill tone={autonomyTone}>{autonomy.label}</Pill>
            ))}
          {pendingAsks > 0 &&
            (onOpenCalls ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCalls();
                }}
                title={t('agents.tooltip.open_calls')}
                style={pillButtonReset}
              >
                <Pill tone="warn">
                  {t(pendingAsks === 1 ? 'agents.calls_awaiting_one' : 'agents.calls_awaiting_many', {
                    n: pendingAsks,
                  })}
                </Pill>
              </button>
            ) : (
              <Pill tone="warn">
                {t(pendingAsks === 1 ? 'agents.calls_awaiting_one' : 'agents.calls_awaiting_many', { n: pendingAsks })}
              </Pill>
            ))}
          {cfg?.confidence != null && <Pill>{t('agents.confidence_floor', { n: cfg.confidence })}</Pill>}
          {cfg?.maxActionsPerHour != null && (
            <Pill>{t('agents.actions_per_hour_cap', { n: cfg.maxActionsPerHour })}</Pill>
          )}
        </div>
      )}

      {linkedSources.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-dim)',
              fontWeight: 700,
              letterSpacing: 0.1,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {t('agents.reads_from')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {linkedSources.map((s, i) => (
              <span
                key={i}
                title={s.name}
                style={{
                  padding: '3px 7px',
                  fontSize: 10.5,
                  fontWeight: 600,
                  background: 'color-mix(in oklch, var(--accent) 8%, var(--surface))',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 4,
                }}
              >
                {s.name}
              </span>
            ))}
            {(cfg?.dataSources?.length ?? 0) > 3 && (
              <span style={{ fontSize: 10.5, color: 'var(--text-dim)', padding: '3px 4px' }}>
                +{cfg.dataSources.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {latestAction && <AgentActionPill action={latestAction} />}

      <div
        style={{
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
          fontSize: 10.5,
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {live?.lastRun ? (
            <>
              {t('agents.last_ran')} <b style={{ color: 'var(--text-soft)' }}>{relTime(live.lastRun.created_at)}</b>
              {' · '}
              <span style={{ color: liveLineTone(live.lastRun.decision) }}>{liveLineText(lastRunForLine, t)}</span>
            </>
          ) : recent ? (
            <>
              {t('agents.last_fired')} <b style={{ color: 'var(--text-soft)' }}>{humanTsAgent(recent.ts)}</b> ·{' '}
              <span style={{ color: 'var(--text-soft)' }}>{recent.action}</span>
            </>
          ) : (
            t('agents.no_recent_activity')
          )}
        </div>
        {timeline.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            title={
              expanded
                ? t('agents.hide_today_runs')
                : t(timeline.length === 1 ? 'agents.show_today_runs_one' : 'agents.show_today_runs_many', {
                    n: timeline.length,
                  })
            }
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: 'var(--text-dim)',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10.5,
              fontWeight: 600,
            }}
          >
            <span>{timeline.length}</span>
            <Icon.chevD
              size={10}
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
            />
          </button>
        )}
      </div>

      {expanded && timeline.length > 0 && <AgentRunsTimeline runs={timeline} />}
    </div>
  );
}

// Per-agent action kind → icon + tone for the pill rendered above the
// "Last ran" footer on each card. Keeps the visual language consistent
// across the 6 action-bearing agents.
const ACTION_KIND_ICON = {
  setpoint_change: 'bolt',
  supply_order: 'supply',
  booking_release: 'floor',
  setback_proposal: 'bolt',
  audit_evidence: 'shield',
  escalation: 'badge',
};

function AgentActionPill({ action }) {
  const IconC = Icon[ACTION_KIND_ICON[action.kind] || 'sparkle'] || Icon.sparkle;
  const accentVar = action.tone === 'risk' ? 'var(--risk)' : action.tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
  const renderAction = useAgentActionRenderer();
  const { summary, reason } = renderAction(action);
  return (
    <div
      style={{
        fontSize: 10.5,
        lineHeight: 1.4,
        padding: '6px 8px',
        background: 'color-mix(in oklch, ' + accentVar + ' 7%, var(--surface))',
        border: '1px solid color-mix(in oklch, ' + accentVar + ' 30%, transparent)',
        borderRadius: 6,
        color: 'var(--text-soft)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
      title={reason || ''}
    >
      <IconC size={10} style={{ color: accentVar, flexShrink: 0 }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{relTime(action.applied_at)}</span>
    </div>
  );
}

function AgentRunsTimeline({ runs }) {
  // Render the agent's today-runs as a vertical timeline. Each row is
  // its own component so useTranslatedText can fire per-row.
  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 8,
        borderTop: '1px dashed var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
      {runs.slice(0, 50).map((r) => (
        <AgentTimelineRow key={r.id} run={r} />
      ))}
    </div>
  );
}

// Per-run row inside AgentRunsTimeline. Tier C — translates the
// free-form decision_reason on read.
function AgentTimelineRow({ run: r }) {
  const t = useT();
  const sourceReason = r.decision_reason || '';
  const translatedReason = useTranslatedText(sourceReason);
  const reason = sourceReason ? translatedReason || sourceReason : '';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 60px 1fr',
        columnGap: 8,
        alignItems: 'baseline',
        fontSize: 10.5,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
        {relTime(r.created_at)}
      </div>
      <div>
        <span
          style={{
            padding: '1px 6px',
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.1,
            textTransform: 'uppercase',
            borderRadius: 3,
            background: 'color-mix(in oklch, ' + liveLineTone(r.decision) + ' 14%, var(--surface))',
            color: liveLineTone(r.decision),
            border: '1px solid color-mix(in oklch, ' + liveLineTone(r.decision) + ' 30%, transparent)',
          }}
        >
          {r.decision}
        </span>
        {r.confidence != null && (
          <span style={{ marginLeft: 4, fontSize: 9.5, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
            {r.confidence}%
          </span>
        )}
      </div>
      <div style={{ color: 'var(--text-soft)', minWidth: 0 }}>
        {reason || <span style={{ color: 'var(--text-dim)' }}>{t('agents.timeline.no_reason')}</span>}
        {r.ask_resolution && (
          <span style={{ marginLeft: 4, color: 'var(--text-dim)' }}>
            {t('agents.timeline.human_acted', { action: r.ask_resolution })}
          </span>
        )}
      </div>
    </div>
  );
}

function liveLineText(run, t) {
  if (!run) return '';
  const reason = (run.decision_reason || '').trim();
  // Truncate long model reasoning so it fits the single line.
  const trimmed = reason.length > 110 ? reason.slice(0, 107) + '…' : reason;
  if (trimmed) return trimmed;
  // Fallback when no reason was captured.
  if (!t) return run.decision;
  return (
    {
      act: t('agents.line.took_action'),
      ask: t('agents.line.proposed'),
      skip: t('agents.line.skipped'),
      error: t('agents.line.error'),
    }[run.decision] || run.decision
  );
}

function liveLineTone(decision) {
  return (
    {
      act: 'var(--ok)',
      ask: 'var(--warn)',
      skip: 'var(--text-soft)',
      error: 'var(--risk)',
    }[decision] || 'var(--text-soft)'
  );
}

function humanTsAgent(iso) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const today = new Date('2026-04-21T12:00:00');
  const days = Math.round((today - d) / 86400000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (days === 0) return `today ${hh}:${mm}`;
  if (days === 1) return `yesterday ${hh}:${mm}`;
  return `${days}d ago`;
}
