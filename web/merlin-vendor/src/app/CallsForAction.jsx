// Operations → Calls for action.
//
// Canonical triage view for every pending call-for-action (formerly
// "ask"). The chat bar still surfaces the same items via Chat.jsx →
// PendingAsksStack — both share the merlin_asks table and stay in
// sync via realtime, so approving here drops the row out of the chat
// stack on every open client.
//
// Items shown: anything in merlin_asks for the active org. Filter
// pills let users narrow by source agent. Sorted by priority (rank
// in merlin-asks.js) then recency.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill } from './primitives.jsx';
import { AGENTS } from './data.js';
// (legacy merlin-asks imports dropped — CallRow is invoked directly
// by Activity with its handleAnswer prop; this file no longer talks
// to merlin-asks.)
import { useAskRenderer } from './ask-render.js';
import { useTranslatedText } from './event-translations.js';
import { useAgentRunById } from './agent-runs.js';
import { useSession } from './auth.js';
import { useT } from './i18n.js';
import { useSL } from './servicing-i18n.js';
import { useFormatRelative } from './locale-format.js';

const PRIORITY_TONE = { critical: 'risk', high: 'warn', medium: 'info', low: 'info', info: 'info' };
// EN/FR pairs for the priority pill + action buttons (sl() picks the side).
const PRIORITY_LABEL = {
  critical: ['critical', 'critique'],
  high: ['high', 'élevé'],
  medium: ['medium', 'moyen'],
  normal: ['normal', 'normal'],
  low: ['low', 'faible'],
  info: ['info', 'info'],
};
const ACTION_LABEL = {
  approve: ['Approve', 'Approuver'],
  hold: ['Hold', 'Suspendre'],
  dismiss: ['Dismiss', 'Ignorer'],
  modify: ['Modify', 'Modifier'],
};
const AGENT_LABEL = Object.fromEntries(AGENTS.map((a) => [a.id, a.name.replace(/\s*&.*$/, '')]));

function ageString(ts) {
  const ms = Date.now() - (ts || Date.now());
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// The standalone CallsForActionPage was retired when Activity.jsx
// became the unified incidents/calls surface (PR #195-era IA rework).
// CallRow is still exported below and reused by Activity.jsx. Knip
// cleanup 2026-05-12.

const ACTION_BTN_STYLES = {
  accent: { background: 'var(--accent)', color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: 'var(--text-soft)', border: '1px solid var(--border)' },
};

export function CallRow({ call, busy, onAnswer, onOpenAgent }) {
  const tone = PRIORITY_TONE[call.priority] || 'info';
  const sl = useSL();
  const fmtRel = useFormatRelative();
  const renderAsk = useAskRenderer();
  const rendered = renderAsk(call);
  // Translate writer-supplied free-form text on read. `localized` is true only
  // when renderAsk used a per-kind DICT template (already in the UI language);
  // everything else (servicing, freeform, unknown kinds) is source-language
  // prose that needs translating — the previous `kind === 'freeform'` check
  // missed 'servicing' asks, leaving them English on a French UI.
  const needsTx = rendered.localized === false;
  const txTitle = useTranslatedText(needsTx ? rendered.title || '' : '');
  const txBody = useTranslatedText(needsTx ? rendered.body || '' : '');
  const title = needsTx ? txTitle || rendered.title : rendered.title;
  const body = needsTx ? txBody || rendered.body : rendered.body;
  const [answeringId, setAnsweringId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const click = async (actionId) => {
    if (busy) return;
    setAnsweringId(actionId);
    try {
      await onAnswer(actionId);
    } finally {
      setAnsweringId(null);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${tone === 'risk' ? 'var(--risk)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)'}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Leftmost priority dot removed — the coloured left-border + the
            priority pill already convey severity, and a blue (info) dot
            clashed with the pink agent eyebrow on medium cards. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title stays single-line (agent label + verb is short) so
              the right-side controls (priority pill, agent button, age,
              chevron) always have room. */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          {/* Body wraps up to 2 lines via line-clamp so long
              decision_reason strings stay readable without forcing the
              row off-screen. Click to expand for the full text. */}
          {!expanded && body && body !== title && (
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-dim)',
                marginTop: 2,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {body}
            </div>
          )}
        </div>
        {call.priority && (
          <Pill tone={tone}>
            {PRIORITY_LABEL[call.priority]
              ? sl(PRIORITY_LABEL[call.priority][0], PRIORITY_LABEL[call.priority][1])
              : call.priority}
          </Pill>
        )}
        {call.agentId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenAgent?.(call.agentId);
            }}
            title="Open this agent's runtime card"
            style={{
              padding: '3px 8px',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.1,
              textTransform: 'uppercase',
              background: 'color-mix(in oklch, var(--accent) 10%, var(--surface))',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 4,
              cursor: onOpenAgent ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            <Icon.merlin size={9} />
            {AGENT_LABEL[call.agentId] || call.agentId}
          </button>
        )}
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: 'var(--mono)',
            flexShrink: 0,
            minWidth: 56,
            textAlign: 'right',
          }}
        >
          {call.createdAt ? fmtRel(call.createdAt) : ageString(call.createdAt)}
        </span>
        <Icon.chevD
          size={11}
          style={{
            color: 'var(--text-faint)',
            transform: expanded ? 'none' : 'rotate(-90deg)',
            transition: 'transform .15s',
          }}
        />
      </div>

      {/* Action buttons — ALWAYS visible (not gated on expanded).
          Was previously hidden inside the expanded panel which made
          the row look like it had empty pills below it (the user
          had to click to discover the actions). 2026-05-23. */}
      {(call.actions || []).length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '0 12px 10px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(call.actions || []).map((a) => {
            const base = ACTION_BTN_STYLES[a.tone] || ACTION_BTN_STYLES.ghost;
            return (
              <button
                key={a.id}
                onClick={(e) => {
                  e.stopPropagation();
                  click(a.id);
                }}
                disabled={busy}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy && answeringId !== a.id ? 0.5 : 1,
                  transition: 'opacity .12s',
                  ...base,
                }}
              >
                {answeringId === a.id
                  ? '…'
                  : ACTION_LABEL[a.id]
                    ? sl(ACTION_LABEL[a.id][0], ACTION_LABEL[a.id][1])
                    : a.label}
              </button>
            );
          })}
        </div>
      )}

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
          {body && (
            <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, padding: '10px 0' }}>{body}</div>
          )}

          {/* Agent context — confidence, reasoning, model + latency.
              Shown only for agent-pushed asks (those with agentRunId).
              Gives reviewers the WHY before they approve / hold. */}
          {call.agentRunId && <AgentContextPanel agentRunId={call.agentRunId} agentId={call.agentId} />}
        </div>
      )}
    </div>
  );
}

// Agent decision context — surfaces confidence, reasoning,
// model + latency for an ask backed by an agent_runs row. Hides
// itself silently if the run isn't reachable (cache miss, cross-org,
// or row landed on the server but our cache hasn't seen it yet).
function AgentContextPanel({ agentRunId }) {
  const t = useT();
  const session = useSession();
  const fmtRel = useFormatRelative();
  const run = useAgentRunById(session?.organizationId, agentRunId);
  const reasonText = useTranslatedText(run?.decision_reason || '');

  if (!run) return null;

  // Confidence in agent_runs is stored as a percentage (0-100) on
  // existing rows but the agent runtime may emit 0-1 floats too.
  // Detect and normalize: <=1 → multiply, otherwise treat as already
  // percent. Clamp to [0, 100] so a malformed row can't render
  // '7800% confidence'.
  const confRaw = run.confidence != null ? Number(run.confidence) : null;
  const confPct =
    confRaw == null ? null : Math.max(0, Math.min(100, Math.round(confRaw <= 1 ? confRaw * 100 : confRaw)));
  const confTone = confPct == null ? 'neutral' : confPct >= 80 ? 'ok' : confPct >= 60 ? 'warn' : 'risk';
  const confColor =
    confTone === 'ok'
      ? 'var(--ok)'
      : confTone === 'warn'
        ? 'var(--warn)'
        : confTone === 'risk'
          ? 'var(--risk)'
          : 'var(--text-dim)';
  const reason = reasonText || run.decision_reason;

  return (
    <div
      style={{
        marginTop: 4,
        marginBottom: 8,
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header row — agent + sparkle + 'why I'm asking' label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Icon.sparkle size={11} style={{ color: 'var(--accent)' }} />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {t('cta.agent_context.label')}
        </span>
        {confPct != null && <Pill tone={confTone}>{t('cta.agent_context.confidence', { pct: confPct })}</Pill>}
      </div>

      {/* Confidence bar — visual reinforcement of the % pill so the
          eye catches it without reading. Hidden when no confidence. */}
      {confPct != null && (
        <div
          style={{
            height: 4,
            borderRadius: 4,
            background: 'color-mix(in oklch, var(--text-faint) 30%, transparent)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: confPct + '%',
              height: '100%',
              background: confColor,
              transition: 'width .35s ease',
            }}
          />
        </div>
      )}

      {/* Reasoning — the agent's prose explanation of why it's
          asking, translated to the reader's language. */}
      {reason && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{reason}</div>}

      {/* Footer — latency + when. Small typography so it reads as
          metadata, not content. The underlying model is intentionally
          NOT surfaced — end users shouldn't know which Anthropic
          model decided. The model field stays available on the row
          for back-office debugging via the AgentDetailView. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontFamily: 'var(--mono)',
        }}
      >
        {run.latency_ms != null && (
          <span>{t('cta.agent_context.latency', { ms: Math.round(run.latency_ms).toLocaleString() })}</span>
        )}
        {run.created_at && (
          <span>
            {t('cta.agent_context.decided')} {fmtRel(run.created_at)}
          </span>
        )}
      </div>
    </div>
  );
}
