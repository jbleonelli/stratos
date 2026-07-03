// Chat asks / decisions UI — extracted from Chat.jsx.
//
// The in-chat surfaces for agent-pushed "calls for action": CallsBanner (the
// click-through breadcrumb that also inlines any CRITICAL asks) and
// InlineDecisions (the stacked decision list seeded into the thread). Both
// compose AskCard (a single ask with its Approve/Hold actions); the renderer +
// tone/label consts are private to this module.
//
// ChatPanel composes CallsBanner + InlineDecisions and passes the onAnswer /
// onOpenAgent / onOpenCalls handlers down.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Dot, MerlinAvatar } from './primitives.jsx';
import { useT } from './i18n.js';
import { useAskRenderer } from './ask-render.js';
import { useTranslatedText } from './event-translations.js';
import { AGENTS } from './data.js';

// Shared presentational consts for the AskCard below (used by both
// CallsBanner and InlineDecisions).
const PRIORITY_TONE = { critical: 'risk', high: 'warn', medium: 'info', low: 'info', info: 'info' };

const ACTION_BTN_STYLES = {
  accent: { background: 'var(--accent)', color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: 'var(--text-soft)', border: '1px solid var(--border)' },
};

// agent_id → short label for the "from <Agent> agent" pill on K-2b asks.
const AGENT_LABEL = Object.fromEntries(AGENTS.map((a) => [a.id, a.name.replace(/\s*&.*$/, '')]));

// Inline decisions list dropped into the conversation when the Decisions bubble
// is tapped: a one-line Merlin lead-in + every live pending ask as an actionable
// AskCard (Approve / Hold resolve them in place). The list is live — it shrinks
// as you act, and shows an all-clear once empty.
export function InlineDecisions({ asks, onAnswer, onOpenAgent, onOpenCalls }) {
  const n = asks.length;
  const crit = asks.filter((a) => a.priority === 'critical').length;
  const lead =
    n === 0
      ? 'All your decisions are cleared — nothing waiting on you right now.'
      : `You have ${n} decision${n > 1 ? 's' : ''} waiting${crit > 0 ? ` — I'd clear the ${crit} critical one${crit > 1 ? 's' : ''} first` : ' — quickest wins first'}. Approve or hold each below.`;
  return (
    <div style={{ display: 'flex', gap: 8, maxWidth: '100%', animation: 'merlinFadeIn .3s ease' }}>
      <MerlinAvatar size={22} />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '14px 14px 14px 4px',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {lead}
        </div>
        {asks.map((ask) => (
          <AskCard key={ask.id} ask={ask} onAnswer={onAnswer} onOpenAgent={onOpenAgent} />
        ))}
        {n > 0 && onOpenCalls && (
          <button
            onClick={onOpenCalls}
            style={{
              alignSelf: 'flex-start',
              padding: '5px 10px',
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Open full queue →
          </button>
        )}
      </div>
    </div>
  );
}

function AskCard({ ask, onAnswer, onOpenAgent }) {
  const t = useT();
  const tone = PRIORITY_TONE[ask.priority] || 'info';
  const renderAsk = useAskRenderer();
  const rendered = renderAsk(ask);
  // Free-form rows (servicing / freeform / unknown kinds) get their
  // writer-supplied text translated on read. Structured rows are already
  // localized via the dictionary — renderAsk reports which via `localized`,
  // so passing '' short-circuits the hook for those. (The old check only
  // caught kind==='freeform' and left 'servicing' asks English on a FR UI.)
  const needsTx = rendered.localized === false;
  const txTitle = useTranslatedText(needsTx ? rendered.title || '' : '');
  const txBody = useTranslatedText(needsTx ? rendered.body || '' : '');
  const title = needsTx ? txTitle || rendered.title : rendered.title;
  const body = needsTx ? txBody || rendered.body : rendered.body;
  const [answering, setAnswering] = useState(null);
  const busy = answering !== null;

  const click = async (actionId) => {
    if (busy) return;
    setAnswering(actionId);
    try {
      await onAnswer(ask.id, actionId);
    } finally {
      setAnswering(null);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--accent-line)',
        borderLeft: `3px solid ${tone === 'risk' ? 'var(--risk)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)'}`,
        borderRadius: 10,
        animation: 'merlinFadeIn .25s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '8px 10px 6px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Dot tone={tone} size={6} style={{ marginTop: 6, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.35 }}>{title}</div>
          {body && (
            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>{body}</div>
          )}
          {ask.agentId && (
            <button
              onClick={() => onOpenAgent?.(ask.agentId)}
              title={t('ask.open_agent_runtime')}
              style={{
                marginTop: 6,
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.1,
                textTransform: 'uppercase',
                lineHeight: 1.4,
                background: 'color-mix(in oklch, var(--accent) 10%, var(--surface))',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 4,
                cursor: onOpenAgent ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon.merlin size={9} />
              {t('ask.from_agent', { agent: AGENT_LABEL[ask.agentId] || ask.agentId })}
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          padding: 6,
          background: 'var(--surface-2)',
          display: 'flex',
          gap: 6,
          borderTop: '1px solid var(--border)',
        }}
      >
        {(ask.actions || []).map((a, _i) => {
          const base = ACTION_BTN_STYLES[a.tone] || ACTION_BTN_STYLES.ghost;
          const isPrimary = a.tone === 'accent';
          return (
            <button
              key={a.id}
              onClick={() => click(a.id)}
              disabled={busy}
              style={{
                flex: isPrimary ? 1 : 0,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy && answering !== a.id ? 0.5 : 1,
                transition: 'opacity .12s',
                ...base,
              }}
            >
              {answering === a.id ? '…' : a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
