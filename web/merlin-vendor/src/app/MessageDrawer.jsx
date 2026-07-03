// MessageDrawer — global slide-in right panel for inspecting any
// "message" in the app (agent_run, merlin_ask, activity event,
// incident, etc.). Phase 1 supports type='agent_run' wired from the
// Hypervisor 3D Agents-mode cards; other types will plug in as the
// pattern proves out.
//
// Usage:
//   import { openMessage, closeMessage } from './MessageDrawer.jsx';
//   openMessage({ type: 'agent_run', id, payload });
//
// The drawer is mounted once at ShellFrame level in App.jsx so any
// surface can call openMessage without prop-drilling a callback.
//
// Listener pattern matches agent-runs.js — module-scoped Set of
// React forceUpdates, single state read on render. Avoids prop
// drilling and React-context overhead.

import React, { useEffect, useReducer } from 'react';
import { breadcrumbForAny } from './custom-locations.js';
import { colorForAgent } from './agent-colors.js';

// Per-decision visual treatment (status pill at top of the body).
const DECISION_TONE = {
  act: { label: 'Acted', bg: '#10b981', fg: '#fff' },
  ask: { label: 'Asked', bg: '#f59e0b', fg: '#fff' },
  skip: { label: 'Skipped', bg: '#94a3b8', fg: '#fff' },
  error: { label: 'Error', bg: '#ef4444', fg: '#fff' },
};

const RESOLUTION_TONE = {
  approve: { label: 'Approved', bg: '#10b981', fg: '#fff' },
  hold: { label: 'On hold', bg: '#f59e0b', fg: '#fff' },
  dismiss: { label: 'Dismissed', bg: '#94a3b8', fg: '#fff' },
  expired: { label: 'Expired', bg: '#94a3b8', fg: '#fff' },
};

let activeMessage = null;
const LISTENERS = new Set();

function emit() {
  LISTENERS.forEach((fn) => fn());
}

export function openMessage(msg) {
  activeMessage = msg || null;
  emit();
}

export function closeMessage() {
  if (!activeMessage) return;
  activeMessage = null;
  emit();
}

function useActiveMessage() {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    LISTENERS.add(bump);
    return () => {
      LISTENERS.delete(bump);
    };
  }, []);
  return activeMessage;
}

function useEscClose() {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeMessage();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

export function MessageDrawer() {
  useEscClose();
  const msg = useActiveMessage();
  const open = !!msg;

  return (
    <>
      {/* Transparent click-catcher — closes the drawer when the user
          clicks outside it. No backdrop blur/dim per JB so the canvas
          stays fully visible while the drawer is open. */}
      <div
        onClick={closeMessage}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 100,
        }}
      />
      <aside
        role="dialog"
        aria-label="Message details"
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: '92vw',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {msg ? <MessageBody msg={msg} /> : null}
      </aside>
    </>
  );
}

function MessageBody({ msg }) {
  if (msg.type === 'agent_run') return <AgentRunBody payload={msg.payload} />;
  if (msg.type === 'sensing') return <SensingBody payload={msg.payload} />;
  return <UnknownTypeBody msg={msg} />;
}

// Sensing drawer — a real per-floor sensor reading (Hypervisor → Sensing
// tab), not an agent run. Shows the metric, its value, the in-range/alert
// status, and the floor, so "Details" isn't an empty shell.
function SensingBody({ payload }) {
  if (!payload) {
    return (
      <>
        <PlainHeader title="Sensor reading" subtitle="No details loaded" />
        <div style={{ padding: 18, fontSize: 13, color: 'var(--text-dim)' }}>Empty payload.</div>
      </>
    );
  }
  const metricLabel =
    {
      airquality: 'Air quality',
      temperature: 'Temperature',
      occupancy: 'Occupancy',
      humidity: 'Humidity',
      noise: 'Noise',
    }[payload.metric] ||
    payload.metric ||
    'Sensor';
  // payload.status is the qualitative title ("In range" / "Overcrowded"…);
  // payload.color is the health colour (green in-range, red/amber alert).
  const inRange = /in range/i.test(payload.status || '');
  const tone = payload.color || (inRange ? 'var(--ok)' : 'var(--warn)');
  return (
    <>
      <PlainHeader title={metricLabel} subtitle={payload.floorName || null} />
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        {/* Reading hero */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 14,
            borderRadius: 12,
            background: `color-mix(in oklch, ${tone} 10%, transparent)`,
            border: `1px solid color-mix(in oklch, ${tone} 30%, transparent)`,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{payload.reading || '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>{metricLabel} · live sensor</div>
          </div>
          <Pill
            text={payload.status || (inRange ? 'In range' : 'Attention')}
            bg={`color-mix(in oklch, ${tone} 16%, transparent)`}
            fg={tone}
          />
        </div>

        <Section label="Reading">
          <KeyVal k="Metric" v={metricLabel} />
          <KeyVal k="Value" v={payload.reading || '—'} />
          <KeyVal k="Status" v={payload.status || '—'} />
          <KeyVal k="Floor" v={payload.floorName || '—'} />
        </Section>

        <Section label="Identifiers">
          <KeyVal k="Sensor" v={payload.floorId ? `${payload.floorId}-${payload.metric}` : payload.id || '—'} mono />
          <KeyVal k="Source" v="building sensor mesh" />
        </Section>
      </div>
    </>
  );
}

function AgentRunBody({ payload }) {
  if (!payload) {
    return (
      <>
        <PlainHeader title="Agent run" subtitle="No details loaded" />
        <div style={{ padding: 18, fontSize: 13, color: 'var(--text-dim)' }}>Empty payload.</div>
      </>
    );
  }
  const color = colorForAgent(payload.agent_id);
  const reason = payload.decision_reason || payload.legacySummary || payload.reason || null;
  const raw = payload.raw || payload;
  const created = payload.created_at || raw?.created_at || null;
  const resolved = payload.ask_resolved_at || raw?.ask_resolved_at || null;
  const dec = DECISION_TONE[payload.decision] || null;
  const res = RESOLUTION_TONE[payload.ask_resolution] || null;
  // Breadcrumb chain from the location id, with the displayed floor appended
  // when the caller passed one (My Day / canvas cards place building-level
  // asks on a floor visually; floorName carries that through so the drawer
  // names the same floor the card showed). De-duped so we don't repeat a
  // floor the id already resolved to.
  const baseCrumbs = locationCrumbs(payload.location_id || raw?.location_id);
  const crumbs =
    payload.floorName && !baseCrumbs.includes(payload.floorName) ? [...baseCrumbs, payload.floorName] : baseCrumbs;
  const sources = extractDataSources(raw?.inputs, raw?.action_payload);

  // Does this ask carry a concrete action to EXECUTE on approval, or did
  // the agent merely flag/notify for awareness? "Approve" implies there's
  // a proposal to green-light — wrong when the action is just a flag
  // (action_type 'none' + payload.type 'flag_gap'). In that case the human
  // is acknowledging, not approving, so the verbs change + we say so.
  const INFORMATIONAL_ACTIONS = new Set([
    'none',
    'flag',
    'flag_gap',
    'notify',
    'notify_on_shift',
    'review',
    'awareness',
  ]);
  const effectiveActionKind =
    (raw?.action_type && raw.action_type !== 'none' ? raw.action_type : null) || raw?.action_payload?.type || null;
  const hasExecutableAction = !!effectiveActionKind && !INFORMATIONAL_ACTIONS.has(effectiveActionKind);
  const approveLabel = hasExecutableAction ? 'Approve' : 'Acknowledge';
  const holdLabel = hasExecutableAction ? 'Hold' : 'Dismiss';

  return (
    <>
      {/* Colored banner — agent color → indigo gradient (matches the
          brand wordmark direction). Replaces the plain header. */}
      <div
        style={{
          background: `linear-gradient(135deg, ${color}, var(--accent-indigo))`,
          color: '#fff',
          padding: '16px 18px 18px',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: 0.85,
              }}
            >
              Agent run
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              {payload.agent_id || 'agent'}
            </div>
            {crumbs && crumbs.length > 0 && (
              <div
                style={{
                  fontSize: 12,
                  marginTop: 6,
                  opacity: 0.9,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {crumbs.map((c, i) => (
                  <React.Fragment key={`${c}-${i}`}>
                    {i > 0 && <span style={{ opacity: 0.55 }}>›</span>}
                    <span>{c}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
            {/* Prominent timestamp — when the ask was raised, surfaced in
                the header (relative for at-a-glance recency, exact below)
                rather than buried in the Timestamps section at the bottom.
                JB 2026-05-30. */}
            {created && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {relativeDrawerTime(created)}
                </span>
                <span style={{ fontSize: 11.5, opacity: 0.85 }}>{exactDrawerTime(created)}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {dec && <Pill text={dec.label} bg={dec.bg} fg={dec.fg} />}
              {res && <Pill text={res.label} bg={res.bg} fg={res.fg} />}
              {payload.confidence != null && (
                <Pill text={`${Math.round(payload.confidence)}% confidence`} bg="rgba(255,255,255,0.18)" fg="#fff" />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={closeMessage}
            aria-label="Close"
            title="Close (Esc)"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 16,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {(payload.onApprove || payload.onHold) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!hasExecutableAction && (
              // No proposal to green-light — be explicit so "Acknowledge"
              // doesn't read as approving a (non-existent) automated action.
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Merlin flagged this for your awareness — no automated action is queued. Acknowledging marks it handled.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {payload.onApprove && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      payload.onApprove();
                    } finally {
                      closeMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 4px 12px color-mix(in oklch, var(--accent) 30%, transparent)',
                  }}
                >
                  {approveLabel}
                </button>
              )}
              {payload.onHold && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      payload.onHold();
                    } finally {
                      closeMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {holdLabel}
                </button>
              )}
            </div>
          </div>
        )}

        {reason && (
          <Section label="Reason" accent={color}>
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--text)',
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${color}`,
                borderRadius: 6,
              }}
            >
              {reason}
            </div>
          </Section>
        )}

        {payload.confidence != null && (
          <Section label="Confidence" accent={color}>
            <ConfidenceBar value={payload.confidence} color={color} />
          </Section>
        )}

        {(raw?.action_type || raw?.action_payload || raw?.created_override_id || raw?.created_ask_id) && (
          <Section label="Action" accent={color}>
            {/* Only show action_type when it's a real action — 'none' is
                noise and duplicates the payload's own `type` row below. */}
            {raw.action_type && raw.action_type !== 'none' && <KeyVal k="Type" v={humanizeValue(raw.action_type)} />}
            {raw.created_override_id && <KeyVal k="Override id" v={raw.created_override_id} mono />}
            {raw.created_ask_id && <KeyVal k="Ask id" v={raw.created_ask_id} mono />}
            {/* Payload rendered as readable key/value rows (humanized keys,
                nested objects flattened) instead of a raw JSON block —
                JB 2026-05-30 "no JSON file". */}
            {raw.action_payload && Object.keys(raw.action_payload).length > 0 && (
              <PayloadRows obj={raw.action_payload} />
            )}
          </Section>
        )}

        {sources.length > 0 && (
          <Section label="Data sources" accent={color}>
            {sources.map((s, i) => (
              <KeyVal key={`${s.key}-${i}`} k={s.key} v={s.value} mono />
            ))}
          </Section>
        )}

        {(raw?.model || raw?.latency_ms != null || raw?.cost_usd != null) && (
          <Section label="Runtime" accent={color}>
            {raw.model && <KeyVal k="Model" v={raw.model} />}
            {raw.latency_ms != null && <KeyVal k="Latency" v={`${raw.latency_ms} ms`} />}
            {raw.cost_usd != null && <KeyVal k="Cost" v={`$${Number(raw.cost_usd).toFixed(6)}`} />}
            {raw.tokens_in != null && <KeyVal k="Tokens in" v={Number(raw.tokens_in).toLocaleString()} />}
            {raw.tokens_out != null && <KeyVal k="Tokens out" v={Number(raw.tokens_out).toLocaleString()} />}
          </Section>
        )}

        <Section label="Timestamps" accent={color}>
          {created && <TimeRow k="Created" iso={created} />}
          {resolved && <TimeRow k="Resolved" iso={resolved} />}
        </Section>

        {raw?.inputs && Object.keys(raw.inputs).length > 0 && (
          <Section label="Inputs" accent={color}>
            <PayloadRows obj={raw.inputs} />
          </Section>
        )}

        <Section label="Identifiers" accent={color}>
          <KeyVal k="Run id" v={payload.id} mono />
          {raw?.organization_id && <KeyVal k="Org id" v={raw.organization_id} mono />}
          {(payload.location_id || raw?.location_id) && (
            <KeyVal k="Location id" v={payload.location_id || raw.location_id} mono />
          )}
        </Section>
      </div>
    </>
  );
}

function PlainHeader({ title, subtitle }) {
  return (
    <header
      style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{subtitle}</div>}
      </div>
      <button
        type="button"
        onClick={closeMessage}
        aria-label="Close"
        title="Close (Esc)"
        style={{
          width: 28,
          height: 28,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--text-soft)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </header>
  );
}

function UnknownTypeBody({ msg }) {
  return (
    <>
      <PlainHeader title="Message" subtitle={`type: ${msg.type || 'unknown'}`} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        <JsonBlock value={msg.payload || msg} />
      </div>
    </>
  );
}

function Pill({ text, bg, fg }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: bg,
        color: fg,
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

function Section({ label, accent, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: accent || 'var(--text-faint)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {accent && (
          <span style={{ width: 4, height: 12, background: accent, borderRadius: 2, display: 'inline-block' }} />
        )}
        <span>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  );
}

function KeyVal({ k, v, mono }) {
  if (v == null || v === '') return null;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12.5 }}>
      <span style={{ minWidth: 96, color: 'var(--text-dim)', fontWeight: 600 }}>{k}</span>
      <span
        style={{
          flex: 1,
          color: 'var(--text)',
          fontWeight: 500,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : 'inherit',
          wordBreak: mono ? 'break-all' : 'normal',
        }}
      >
        {String(v)}
      </span>
    </div>
  );
}

// Domain acronyms that must stay fully upper-cased in humanized labels —
// otherwise Title-casing turns "sla" into "Sla", "voc" into "Voc", etc.
const HUMANIZE_ACRONYMS = new Set([
  'sla',
  'slas',
  'voc',
  'tvoc',
  'hvac',
  'nfc',
  'sku',
  'kwh',
  'co2',
  'id',
  'aq',
  'rh',
  'db',
  'eta',
  'mtd',
  'ytd',
  'qtd',
  'kpi',
  'roi',
  'pm',
  'fm',
]);

// snake_case / camelCase → "Title Case" for human-readable payload labels.
// Known acronyms render upper-case (SLA, VOC, HVAC), not Title-cased.
function humanizeKey(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (HUMANIZE_ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// A single payload value as readable text. Enums become Title Case;
// booleans → Yes/No; arrays → comma list; nested objects fall through to
// PayloadRows. Long strings (e.g. a "reason" paragraph) pass through whole.
function humanizeValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  const s = String(v);
  // Title-case short snake/lower enum-ish tokens; leave prose untouched.
  if (/^[a-z][a-z0-9_]*$/.test(s) && s.length <= 24) return humanizeKey(s);
  return s;
}

// Renders an object as readable Key: Value rows. One level of nesting is
// expanded inline (indented); deeper than that falls back to a compact
// string so the drawer never shows a raw JSON blob.
function PayloadRows({ obj, depth = 0 }) {
  if (!obj || typeof obj !== 'object') return null;
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingLeft: depth ? 10 : 0,
        borderLeft: depth ? '2px solid var(--border)' : 'none',
      }}
    >
      {entries.map(([k, v]) => {
        const label = humanizeKey(k);
        if (v && typeof v === 'object' && !Array.isArray(v) && depth < 1) {
          return (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)' }}>{label}</span>
              <PayloadRows obj={v} depth={depth + 1} />
            </div>
          );
        }
        // Long prose (reason text) gets its own block; short values inline.
        const text = humanizeValue(v);
        if (text.length > 70) {
          return (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)' }}>{label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
            </div>
          );
        }
        return <KeyVal key={k} k={label} v={text} />;
      })}
    </div>
  );
}

function ConfidenceBar({ value, color }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          position: 'relative',
          height: 8,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, var(--accent-indigo))`,
            transition: 'width 200ms ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>{pct}%</div>
    </div>
  );
}

function JsonBlock({ label, value }) {
  let formatted;
  try {
    formatted = JSON.stringify(value, null, 2);
  } catch {
    formatted = String(value);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>{label}</div>}
      <pre
        style={{
          margin: 0,
          padding: 10,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 11.5,
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--text)',
          maxHeight: 280,
          overflow: 'auto',
        }}
      >
        {formatted}
      </pre>
    </div>
  );
}

// Relative "how long ago" for the prominent header timestamp. Short,
// human ("3h ago", "just now"); falls back to a date past a week.
function relativeDrawerTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const dSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (dSec < 45) return 'just now';
  if (dSec < 3600) return `${Math.max(1, Math.floor(dSec / 60))}m ago`;
  if (dSec < 86400) return `${Math.floor(dSec / 3600)}h ago`;
  if (dSec < 604800) return `${Math.floor(dSec / 86400)}d ago`;
  try {
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return `${Math.floor(dSec / 86400)}d ago`;
  }
}

// Exact local time for the secondary header line (e.g. "30 May, 14:59").
function exactDrawerTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

// Timestamps in agent_runs are stored as timestamptz (UTC under the
// hood). Show both: UTC for cross-tenant audit comparisons, local for
// the operator's lived intuition.
function TimeRow({ k, iso }) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <KeyVal k={k} v={String(iso)} />;
  }
  const utcStr =
    d
      .toLocaleString('en-GB', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      .replace(',', '') + ' UTC';
  let localTz = '';
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(d);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    localTz = tzPart ? ` ${tzPart.value}` : '';
  } catch {
    /* noop */
  }
  const localStr = d.toLocaleString() + localTz;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12.5 }}>
      <span style={{ minWidth: 96, color: 'var(--text-dim)', fontWeight: 600 }}>{k}</span>
      <span
        style={{ flex: 1, color: 'var(--text)', fontWeight: 500, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <span>{utcStr}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{localStr}</span>
      </span>
    </div>
  );
}

// Resolve a location_id to a breadcrumb chain ("Meridian HQ › Floor 32
// › Zone 47"). Returns names only (best-effort) — falls back to the
// raw id when the cache hasn't hydrated.
function locationCrumbs(locationId) {
  if (!locationId) return [];
  try {
    const chain = breadcrumbForAny(locationId);
    if (Array.isArray(chain) && chain.length > 0) {
      return chain.map((n) => n?.name || n?.id || '').filter(Boolean);
    }
  } catch {
    /* noop */
  }
  return [locationId];
}

// Best-effort scrape of data-source references from inputs/action_payload.
// agent_runs.inputs is per-agent-shaped jsonb; many shapes carry a
// data_source_id / source / device_id / source_kind reference somewhere
// in their top level. Render whatever known keys we find so the drawer
// surfaces the provenance without us hard-coding each agent's schema.
const SOURCE_KEYS = new Set([
  'data_source_id',
  'data_source',
  'source',
  'source_id',
  'source_kind',
  'device_id',
  'sensor_id',
  'probe_id',
  'meter_id',
  'feed',
  'feed_id',
  'integration',
  'integration_id',
]);
function extractDataSources(inputs, actionPayload) {
  const out = [];
  const visit = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (SOURCE_KEYS.has(k) && v != null && typeof v !== 'object') {
        out.push({ key: k, value: String(v) });
      }
    }
  };
  visit(inputs);
  visit(actionPayload);
  return out;
}
