// Per-agent detail page — opened by clicking an agent card body on
// Dashboard → Agents. Surfaces the metrics and history that don't fit
// on the summary card: success rate, avg latency, cost-to-date, full
// runs history, errors-only filter, and a config snapshot with a
// jump-to-Agentic link.
//
// Data sources:
//   - useAgentRuntimeStats(orgId) → today's runs (already hydrated)
//   - useLatestAgentActions(orgId) → most recent applied action
//   - useMerlinAsks() → pending calls for action filtered to this agent
//   - useAgenticConfig() → autonomy / cap / data sources for the snapshot

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { AGENTS } from './data.js';
import { useAgentRuntimeStats, useLatestAgentActions } from './agent-runs.js';
import { useMerlinAsks } from './merlin-asks.js';
import { useAgenticConfig, AUTONOMY_LEVELS, resolveDataSource } from './agentic-data.js';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useContractorAgents } from './contractor-agents.js';
import { relativeTime as relTime } from './incident-actions.js';
import { useTranslatedText } from './event-translations.js';
import { useAgentActionRenderer } from './ask-render.js';
import { useT } from './i18n.js';
import { EventDrawer } from './DashboardAgents.jsx';

const AUTONOMY_TONE = {
  'full-auto': 'risk',
  'auto-low-risk': 'warn',
  'approve-critical': 'info',
  propose: 'accent',
};

const DECISION_TONE = {
  act: 'var(--ok)',
  ask: 'var(--warn)',
  skip: 'var(--text-soft)',
  error: 'var(--risk)',
};

function formatLatency(ms, t) {
  if (ms == null) return '—';
  if (ms < 1000) return t ? t('adv.latency_ms', { n: ms }) : `${ms}ms`;
  return t ? t('adv.latency_s', { n: (ms / 1000).toFixed(1) }) : `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd) {
  if (usd == null) return '—';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function AgentDetailView({ building, agentId, onBack, onOpenAgentic, onOpenCalls }) {
  const t = useT();
  const session = useSession();
  const activeOrg = useActiveOrg();
  const runtime = useAgentRuntimeStats(session?.organizationId);
  const latestActions = useLatestAgentActions(session?.organizationId, building?.id);
  const allCalls = useMerlinAsks(building?.id);
  const [config] = useAgenticConfig(building?.id || null);

  // Contractor agents are specialized per service line, backed by the
  // 'servicing' co-worker's runs bucketed by domain (contractor-agents.js).
  // For a contractor, resolve the agent + its live runtime + synthetic config
  // from that roster; owner orgs use the AGENTS catalog + per-agent agent_runs.
  const isContractor = activeOrg?.kind === 'contractor';
  const cAgents = useContractorAgents(session?.organizationId, activeOrg?.kind);
  const lineAgent = isContractor ? cAgents.roster.find((a) => a.id === agentId) : null;

  const agent = lineAgent || AGENTS.find((a) => a.id === agentId);
  const live = lineAgent ? cAgents.byLine[agentId] : runtime[agentId];
  const latestAction = lineAgent ? null : latestActions[agentId] || null;
  const cfg = lineAgent ? cAgents.cfgById[agentId] : config.agents?.[agentId];
  const runs = live?.runs || [];
  // Contractor asks are filed under the 'servicing' agent, so filtering allCalls
  // by the line id yields none — use the line bucket's pending count instead.
  const pendingCalls = lineAgent
    ? Array.from({ length: live?.pendingAsks || 0 })
    : allCalls.filter((c) => c.agentId === agentId);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Derived metrics across today's runs.
  const metrics = useMemo(() => {
    let actsLanded = 0; // act + approved-ask
    let errors = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let totalCost = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    for (const r of runs) {
      if (r.decision === 'act' || r.ask_resolution === 'approved') actsLanded += 1;
      if (r.decision === 'error') errors += 1;
      if (r.latency_ms != null) {
        totalLatency += r.latency_ms;
        latencyCount += 1;
      }
      if (r.cost_usd != null) totalCost += r.cost_usd;
      if (r.tokens_in) tokensIn += r.tokens_in;
      if (r.tokens_out) tokensOut += r.tokens_out;
    }
    // Success rate: of runs that produced a decisive outcome (acts +
    // errors), what fraction landed an action? Skips and unresolved
    // asks are neutral — they're the model saying "nothing to do" or
    // "ask the human", neither a success nor a failure on its own.
    const decisive = actsLanded + errors;
    const successRate = decisive > 0 ? actsLanded / decisive : null;
    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null;
    return {
      runs: runs.length,
      actsLanded,
      errors,
      successRate,
      avgLatency,
      totalCost,
      tokensIn,
      tokensOut,
    };
  }, [runs]);

  const visibleRuns = errorsOnly ? runs.filter((r) => r.decision === 'error') : runs;

  if (!agent) {
    return (
      <main style={{ flex: 1, padding: 'var(--pad)' }}>
        <button onClick={onBack} style={backButtonStyle}>
          <Icon.chevR size={11} style={{ transform: 'rotate(180deg)' }} /> {t('sidebar.agents')}
        </button>
        <div style={{ marginTop: 24, fontSize: 14, color: 'var(--text-dim)' }}>
          {t('adv.unknown_agent', { id: agentId })}
        </div>
      </main>
    );
  }

  const IconC = Icon[cfg?.icon || 'sparkle'] || Icon.sparkle;
  const enabled = cfg?.enabled ?? true;
  const autonomy = AUTONOMY_LEVELS.find((a) => a.id === cfg?.autonomy);
  const autonomyTone = AUTONOMY_TONE[cfg?.autonomy] || 'info';
  const linkedSources = (cfg?.dataSources || []).map((ref) =>
    resolveDataSource({ dataSources: config.dataSources || {} }, ref),
  );

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
    >
      {/* Breadcrumb. Back link now returns to MONITOR → AI Agents
          (the surface the user clicked the agent from). Previously it
          went to Dashboard / My Day which was the wrong return path
          when entering via the AI Agents tab. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
        <button onClick={onBack} style={backButtonStyle}>
          <Icon.chevR size={11} style={{ transform: 'rotate(180deg)' }} /> {t('sidebar.agents')}
        </button>
        <span>·</span>
        <span style={{ color: 'var(--text)' }}>{agent.name}</span>
      </div>

      {/* Hero */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconC size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{agent.name}</h2>
              <Dot
                tone={!enabled ? 'off' : agent.status === 'active' ? 'ok' : 'warn'}
                size={6}
                pulse={enabled && agent.status === 'active'}
              />
              <Pill tone={!enabled ? 'off' : 'ok'}>
                {!enabled
                  ? t('adv.status.disabled')
                  : agent.status === 'active'
                    ? t('adv.status.active')
                    : agent.status}
              </Pill>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>{agent.tag}</div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {autonomy &&
                (onOpenAgentic ? (
                  <button
                    onClick={() => onOpenAgentic(agentId)}
                    title={t('agents.edit_in_agentic')}
                    style={pillButtonReset}
                  >
                    <Pill tone={autonomyTone}>{autonomy.label}</Pill>
                  </button>
                ) : (
                  <Pill tone={autonomyTone}>{autonomy.label}</Pill>
                ))}
              {cfg?.confidence != null && <Pill>{t('adv.confidence_floor', { n: cfg.confidence })}</Pill>}
              {cfg?.maxActionsPerHour != null && <Pill>{t('adv.cap_per_hour', { n: cfg.maxActionsPerHour })}</Pill>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {onOpenAgentic && (
              <button onClick={() => onOpenAgentic(agentId)} style={primaryBtn}>
                <Icon.sparkle size={11} /> {t('adv.edit_in_agentic')}
              </button>
            )}
            {pendingCalls.length > 0 && onOpenCalls && (
              <button onClick={() => onOpenCalls(agentId)} style={ghostBtn}>
                {pendingCalls.length === 1
                  ? t('adv.calls_triage_one', { n: pendingCalls.length })
                  : t('adv.calls_triage_many', { n: pendingCalls.length })}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Metrics strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <MetricCard label={t('adv.metric.runs')} value={metrics.runs} mono />
        <MetricCard label={t('adv.metric.actions')} value={metrics.actsLanded} tone="ok" mono />
        <MetricCard
          label={t('adv.metric.calls_outstanding')}
          value={pendingCalls.length}
          tone={pendingCalls.length > 0 ? 'warn' : 'off'}
          mono
        />
        <MetricCard
          label={t('adv.metric.success_rate')}
          value={metrics.successRate == null ? '—' : `${Math.round(metrics.successRate * 100)}%`}
          sub={
            metrics.errors > 0
              ? metrics.errors === 1
                ? t('adv.errors_one', { n: metrics.errors })
                : t('adv.errors_many', { n: metrics.errors })
              : null
          }
          tone={
            metrics.successRate == null
              ? 'off'
              : metrics.successRate >= 0.95
                ? 'ok'
                : metrics.successRate >= 0.7
                  ? 'warn'
                  : 'risk'
          }
          mono
        />
        <MetricCard label={t('adv.metric.avg_latency')} value={formatLatency(metrics.avgLatency, t)} mono />
        {/* COST TODAY hidden per JB (2026-06-19) — replay agents are $0 and the
            figure reads as noise; the runtime story is runs/actions/latency. */}
      </div>

      {/* Latest persisted action — single most-recent applied effect */}
      {latestAction && <LatestActionCard action={latestAction} />}

      {/* Runs history */}
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
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agents.todays_runs')}</div>
          <Pill>
            {errorsOnly && runs.length !== visibleRuns.length
              ? t('adv.runs_count_filtered', { n: visibleRuns.length, total: runs.length })
              : visibleRuns.length}
          </Pill>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setErrorsOnly((v) => !v)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: errorsOnly ? 'color-mix(in oklch, var(--risk) 14%, transparent)' : 'transparent',
              color: errorsOnly ? 'var(--risk)' : 'var(--text-dim)',
              border: `1px solid ${errorsOnly ? 'color-mix(in oklch, var(--risk) 35%, transparent)' : 'var(--border)'}`,
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            {errorsOnly
              ? t('adv.errors_only_active')
              : metrics.errors > 0
                ? t('adv.errors_only_with_count', { n: metrics.errors })
                : t('adv.errors_only_label')}
          </button>
        </div>
        {visibleRuns.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
            {errorsOnly ? t('adv.no_errors_today') : t('adv.no_runs_today')}
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {visibleRuns.map((r, i) => (
              <RunRow
                key={r.id}
                r={r}
                last={i === visibleRuns.length - 1}
                onSelect={() => setSelectedEvent({ kind: 'run', data: { ...r, _agentName: agent?.name } })}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Config snapshot — read-only mirror of Agentic */}
      {linkedSources.length > 0 && (
        <Card>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.1,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            {t('adv.reads_from')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {linkedSources.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: 'color-mix(in oklch, var(--accent) 8%, var(--surface))',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 5,
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </main>
  );
}

// ─── helpers + small components ───

const backButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  background: 'transparent',
  color: 'var(--text-dim)',
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: 5,
  fontFamily: 'var(--font)',
};

const primaryBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  padding: '7px 14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};

const ghostBtn = {
  padding: '7px 14px',
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};

const pillButtonReset = {
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  display: 'inline-flex',
};

// Most-recent applied action card. Extracted so it can call
// useAgentActionRenderer + useTranslatedText (hooks can't run inside
// the parent's conditional render). The renderer hands back a
// localized {summary, reason} pair; the reason then goes through the
// on-read translation cache for the case where it carries free-form
// writer prose (English) rather than a structured kind+params body.
function LatestActionCard({ action }) {
  const t = useT();
  const renderAction = useAgentActionRenderer();
  const { summary, reason } = renderAction(action);
  const translatedReason = useTranslatedText(reason || '');
  return (
    <Card>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.1,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {t('adv.latest_action')}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.45 }}>
        {summary || action.legacySummary || '—'}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-dim)' }}>
        {relTime(action.applied_at)}
        {translatedReason ? <> · {translatedReason}</> : null}
      </div>
    </Card>
  );
}

// One row in the runs timeline. Pulled out so each row can independently
// translate its decision_reason via useTranslatedText (Phase 3 i18n).
function RunRow({ r, last, onSelect }) {
  const t = useT();
  const tone = DECISION_TONE[r.decision] || 'var(--text-soft)';
  const reason = useTranslatedText(r.decision_reason || '');
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
        gridTemplateColumns: '78px 70px minmax(0, 1fr) 64px 64px 70px',
        gap: 12,
        alignItems: 'baseline',
        padding: '8px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        fontSize: 11.5,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background-color .12s',
      }}
    >
      <div
        style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}
        title={new Date(r.created_at).toLocaleString()}
      >
        {relTime(r.created_at)}
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
            background: 'color-mix(in oklch, ' + tone + ' 14%, var(--surface))',
            color: tone,
            border: '1px solid color-mix(in oklch, ' + tone + ' 30%, transparent)',
          }}
        >
          {r.ask_resolution || r.decision || '—'}
        </span>
      </div>
      <div
        style={{ color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={reason || ''}
      >
        {reason || '—'}
      </div>
      <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', textAlign: 'right' }}>
        {r.confidence != null ? `${Math.round(r.confidence)}%` : '—'}
      </div>
      <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', textAlign: 'right' }}>
        {formatLatency(r.latency_ms, t)}
      </div>
      <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', textAlign: 'right' }}>
        {formatCost(r.cost_usd)}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone, mono }) {
  const color =
    tone === 'ok'
      ? 'var(--ok)'
      : tone === 'warn'
        ? 'var(--warn)'
        : tone === 'risk'
          ? 'var(--risk)'
          : tone === 'accent'
            ? 'var(--accent)'
            : tone === 'off'
              ? 'var(--text-faint)'
              : 'var(--text)';
  return (
    <Card>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.1,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          fontFamily: mono ? 'var(--mono)' : 'var(--font)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}
