// Incident row + context panel — extracted from Dashboard.jsx.
//
// The follow-able incident UI shared across surfaces: IncidentRow (a single
// incident line, optionally expandable into its IncidentContextPanel) and
// the isMerlinHandled predicate (action === 'ok' → Merlin handled it
// autonomously). The Dashboard itself no longer renders an incidents list
// (it's the Metrics surface now); these live on because Activity, Hypervisor,
// Hypervisor3DPanels, and HypervisorViewer3D consume them.
//
// Exported: isMerlinHandled, IncidentRow. timeFor + IncidentContextPanel are
// private to this module. (The old in-Dashboard <Incidents> list container
// was dead — orphaned when the incidents view moved to Activity — and was
// dropped rather than relocated here.)

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot } from './primitives.jsx';
import { usePinned, togglePinIncident } from './pins.js';
import { useT } from './i18n.js';

// An incident was handled by Merlin autonomously when no user approval was
// required (action='ok') — those form the audit trail of what Merlin did
// without waiting for a human.
export const isMerlinHandled = (inc) => inc.action === 'ok';

// Derive a stable HH:MM for an incident: use the sim spawn time when present,
// otherwise hash the incident id into a plausible weekday-hours slot.
function timeFor(inc) {
  if (inc.time) return inc.time;
  if (inc._spawnedAt) {
    const d = new Date(inc._spawnedAt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  let h = 2166136261;
  const id = inc.id || '';
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const mins = Math.abs(h) % (14 * 60);
  const hh = Math.floor(mins / 60) + 7; // 07:00 – 20:59 range
  const mm = mins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function IncidentRow({ inc, last, onAskAbout, onOpenIncident, expandable = false }) {
  const toneByPriority = { critical: 'risk', high: 'warn', medium: 'info', info: 'info' };
  const tone = toneByPriority[inc.priority];
  const IconComp = Icon[inc.icon] || Icon.bell;
  const isFresh = inc._sim && inc._spawnedAt && Date.now() - inc._spawnedAt < 45000;
  const pinned = usePinned();
  const isPinned = pinned.has(inc.id);
  const stop = (e) => e.stopPropagation();
  const t = useT();
  const timeStr = timeFor(inc);
  // Expandable mode (used by Activity feed): clicking the row toggles
  // an inline 'Why this event' panel instead of navigating to the full
  // incident page. Same affordance as CallRow's expanded section so the
  // Activity tab reads as a single consistent surface. Other consumers
  // (Dashboard) keep the click=navigate behavior.
  const [expanded, setExpanded] = useState(false);
  const handleRowClick = expandable
    ? () => setExpanded((v) => !v)
    : onOpenIncident
      ? () => onOpenIncident(inc.id)
      : undefined;

  return (
    <div
      style={{
        borderBottom: last ? 'none' : '1px solid var(--border)',
        transition: 'background .12s',
        background: isPinned ? 'color-mix(in oklch, var(--accent) 5%, transparent)' : 'transparent',
      }}
    >
      <div
        onClick={handleRowClick}
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: handleRowClick ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isPinned
            ? 'color-mix(in oklch, var(--accent) 8%, transparent)'
            : 'var(--surface-2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, width: 44 }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `color-mix(in oklch, var(--${tone}) 14%, transparent)`,
              color: `var(--${tone})`,
            }}
          >
            <IconComp size={15} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
            {timeStr}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {isPinned && (
              <Icon.pin size={11} style={{ color: 'var(--accent)', fill: 'var(--accent)', flexShrink: 0 }} />
            )}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{inc.title}</div>
            <Pill tone={tone}>{t(`priority.${inc.priority}`)}</Pill>
            {isFresh && (
              <Pill tone="accent">
                <Dot tone="accent" size={4} pulse /> {t('dashboard.fresh_pill')}
              </Pill>
            )}
            {isMerlinHandled(inc) && (
              <Pill tone="accent" style={{ background: 'transparent', borderColor: 'var(--accent-line)' }}>
                <Icon.merlin size={9} /> Merlin
              </Pill>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{inc.sub}</div>
        </div>

        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{inc.sla}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 600, marginTop: 1 }}>{inc.status}</div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={stop}>
          <button
            onClick={(e) => {
              stop(e);
              togglePinIncident(inc.id);
            }}
            title={isPinned ? t('dash.pin.unpin') : t('dash.pin.pin')}
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isPinned ? 'var(--accent-soft)' : 'transparent',
              color: isPinned ? 'var(--accent)' : 'var(--text-dim)',
              border: `1px solid ${isPinned ? 'var(--accent-line)' : 'var(--border)'}`,
              borderRadius: 6,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Icon.pin size={12} style={{ fill: isPinned ? 'var(--accent)' : 'none' }} />
          </button>
          {/* Incidents are Merlin's live work, NOT human decisions — the status
            column shows what it's doing ("Crew dispatched · ETA 6m"). We no
            longer render Approve/Hold here: those buttons were inert (no
            handler) and implied a pending decision that isn't real, which
            contradicted the "nothing needs your decision" state in chat / My
            Day. The only true Approve/Hold flow is CallRow, for genuine agent
            asks (counted as CTAs). In-progress incidents get a "Merlin
            handling" chip; everything keeps the "Ask Merlin" affordance. */}
          {!isMerlinHandled(inc) && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
                padding: '5px 9px',
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 999,
              }}
            >
              <Icon.merlin size={10} /> {t('incident.merlin_handling')}
            </span>
          )}
          <button
            onClick={(e) => {
              stop(e);
              onAskAbout?.(t('incident.tell_me_about', { title: inc.title }));
            }}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon.sparkle size={11} /> {t('action.ask')}
          </button>
          {expandable && (
            <Icon.chevD
              size={11}
              style={{
                color: 'var(--text-faint)',
                transform: expanded ? 'none' : 'rotate(-90deg)',
                transition: 'transform .15s',
                marginLeft: 4,
              }}
            />
          )}
        </div>
      </div>
      {/* Expanded 'Why this event' panel — same affordance + visual
        treatment as the CallRow AgentContextPanel, with the data we
        actually have for incidents (detection signal, SLA impact,
        Merlin's auto-action, and a button to open the full incident
        view). Hidden in non-expandable consumers. */}
      {expandable && expanded && (
        <IncidentContextPanel inc={inc} onOpenIncident={onOpenIncident} onAskAbout={onAskAbout} />
      )}
    </div>
  );
}

function IncidentContextPanel({ inc, onOpenIncident, onAskAbout }) {
  const t = useT();
  const auto = isMerlinHandled(inc);
  return (
    <div
      style={{
        margin: '0 16px 12px',
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
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
          {t('cta.event_context.label')}
        </span>
        {auto && (
          <Pill tone="accent">
            <Icon.merlin size={9} /> {t('cta.event_context.auto_handled')}
          </Pill>
        )}
      </div>

      {inc.sub && (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              marginBottom: 2,
            }}
          >
            {t('cta.event_context.detection')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{inc.sub}</div>
        </div>
      )}

      {inc.sla && (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              marginBottom: 2,
            }}
          >
            {t('cta.event_context.sla_impact')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{inc.sla}</div>
        </div>
      )}

      {inc.status && (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              marginBottom: 2,
            }}
          >
            {auto ? t('cta.event_context.merlin_action') : t('cta.event_context.current_status')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{inc.status}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {onOpenIncident && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenIncident(inc.id);
            }}
            style={{
              padding: '6px 12px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {t('cta.event_context.open_full')} <Icon.chevR size={10} />
          </button>
        )}
        {onAskAbout && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAskAbout(`Tell me more about: ${inc.title}`);
            }}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon.sparkle size={11} /> {t('action.ask')}
          </button>
        )}
      </div>
    </div>
  );
}
