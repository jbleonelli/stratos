// 2D overlay panels for HypervisorViewer3D (Stage 3 of the decomposition).
// These are pure DOM components rendered as absolutely-positioned overlays
// ON TOP of the r3f <Canvas> — none touch three.js / @react-three, so they
// live here, away from the ~950KB viewer module. The Canvas-coupled pieces
// (CTACard, CTAAutoLayout, AlertToast) stay in HypervisorViewer3D.jsx.
//
// Exported (rendered by the viewer orchestrator): Centered, CanvasControls,
// SensingMetricBar, AgentFilterBar, ReplaySlider, ActivityPanel.
// Private siblings: ControlBtn, formatBackLabel, AlertRow.
import React, { useState, useEffect, useMemo } from 'react';
import {
  formatCount,
  relativeTime,
  locationOnFloor,
  walkUpToFloor,
  SERVICING_ZONE_META,
  servicingSeverity,
  trLabel,
} from './hypervisor-3d-utils.js';
import { colorForAgent } from './agent-colors.js';
import { SERVICING_DOMAIN_META } from './servicing-areas.js';
import { answerAsk } from './merlin-asks.js';
import { CallRow } from './CallsForAction.jsx';
import { IncidentRow } from './DashboardIncidents.jsx';

export function Centered({ children }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

// Top-left floating control cluster. Buttons drive the OrbitControls
// instance via a ref so DOM clicks can manipulate the in-Canvas
// camera. Zoom is implemented as a manual dolly along the
// target→position vector; fit delegates to the FitController via
// `onFit`; the T button toggles canvas-anchored floor name labels.
//
// Bug history: this whole component got deleted in PR #606 by an
// over-aggressive `sed` truncation that was meant to drop FloorLegend
// + FloorDetailPanel — CanvasControls was the next function in file
// order and got swept up too. Restored here verbatim from PR #602.
export function CanvasControls({ controlsRef, onFit, onDefaultView, showLabels, onToggleLabels, t }) {
  function dolly(factor) {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const cam = ctrl.object;
    // Orthographic cameras don't dolly by moving — they scale via
    // `camera.zoom`. Higher zoom = building bigger on screen.
    if (cam.isOrthographicCamera) {
      const next = cam.zoom / factor; // factor<1 = zoom in (bigger)
      cam.zoom = Math.max(0.1, Math.min(500, next));
      cam.updateProjectionMatrix();
      ctrl.update();
      return;
    }
    // Perspective dolly (legacy path; orthographic is the default
    // since the keystone-tilt fix).
    const tgt = ctrl.target;
    const dir = cam.position.clone().sub(tgt);
    const next = dir.multiplyScalar(factor);
    const dist = next.length();
    const min = ctrl.minDistance || 0;
    const max = ctrl.maxDistance || Infinity;
    if (dist < min) next.setLength(min);
    if (dist > max) next.setLength(max);
    cam.position.copy(tgt).add(next);
    ctrl.update();
  }
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        backdropFilter: 'blur(20px) saturate(180%)',
        padding: 4,
      }}
    >
      <ControlBtn label={t('hyper3d.controls.zoom_in')} onClick={() => dolly(0.82)} glyph="+" />
      <ControlBtn label={t('hyper3d.controls.zoom_out')} onClick={() => dolly(1.22)} glyph="−" />
      <ControlBtn label={t('hyper3d.controls.fit')} onClick={onFit} glyph="⛶" />
      <ControlBtn label={t('hyper3d.controls.default_view')} onClick={onDefaultView} glyph="⌂" />
      <ControlBtn
        label={showLabels ? t('hyper3d.controls.hide_labels') : t('hyper3d.controls.show_labels')}
        onClick={onToggleLabels}
        glyph="T"
        active={showLabels}
      />
    </div>
  );
}

function ControlBtn({ label, onClick, glyph, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active ? true : undefined}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: '1px solid ' + (active ? 'var(--accent-line)' : 'transparent'),
        borderRadius: 5,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--surface-3)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {glyph}
    </button>
  );
}

// Vertical "replay" slider docked to the right edge of the canvas
// (PR #746). Top = NOW (live), bottom = `rangeMs` ago. Dragging the
// thumb scrubs the canvas backward in time; the cards on the floors
// are filtered upstream by `replayAt = now - backMs`.
//
// Native `<input type=range>` doesn't support a clean vertical
// orientation cross-browser, so this is a custom thumb-on-track
// affair with pointer drag handlers.
export function ReplaySlider({ backMs, onChange, rangeMs, count = 0 }) {
  const trackRef = React.useRef(null);
  const draggingRef = React.useRef(false);
  const [, force] = React.useReducer((n) => n + 1, 0);

  const clampedBack = Math.max(0, Math.min(rangeMs, backMs || 0));
  const pct = clampedBack / rangeMs; // 0 (Now, top) → 1 (oldest, bottom)

  const labelAtNow = clampedBack < 30_000;
  // Button label says "Live" when at live (the top of the track
  // already says "Now"; using "Now" here too read as redundant per
  // JB 2026-05-26).
  const label = labelAtNow ? 'Live' : formatBackLabel(clampedBack);

  const setFromClientY = (clientY) => {
    const track = trackRef.current;
    if (!track || !onChange) return;
    const rect = track.getBoundingClientRect();
    const yRel = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const p = yRel / rect.height;
    onChange(Math.round(p * rangeMs));
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = true;
    setFromClientY(e.clientY);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    force();
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    setFromClientY(e.clientY);
  };
  const onPointerUp = () => {
    draggingRef.current = false;
    window.removeEventListener('pointermove', onPointerMove);
    force();
  };

  React.useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
    },
    [],
  );

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        top: 60,
        bottom: 60,
        width: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        Now
      </div>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        style={{
          position: 'relative',
          flex: 1,
          width: 8,
          background: 'color-mix(in oklch, var(--surface-2) 70%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          cursor: 'pointer',
        }}
      >
        {/* Filled portion = elapsed-back area (top to thumb) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${pct * 100}%`,
            background: 'linear-gradient(180deg, var(--accent-pink), var(--accent-indigo))',
            borderRadius: 999,
            opacity: labelAtNow ? 0 : 0.85,
            transition: draggingRef.current ? 'none' : 'opacity 120ms ease',
          }}
        />
        {/* Thumb */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: `${pct * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: `2px solid ${labelAtNow ? 'var(--accent-pink)' : 'var(--accent-indigo)'}`,
            boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
            cursor: 'grab',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        6h
      </div>
      {/* Live count of events at the active replayAt so dragging the
          slider has visible feedback even when the cards on canvas
          don't change much (sparse data). PR #747. */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: labelAtNow ? 'var(--accent)' : 'var(--accent-indigo)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}
      >
        {count} {count === 1 ? 'event' : 'events'}
      </div>
      <button
        type="button"
        onClick={() => onChange && onChange(0)}
        disabled={labelAtNow}
        title={labelAtNow ? 'Already live' : 'Snap back to live'}
        style={{
          padding: '4px 10px',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: labelAtNow ? 'transparent' : 'var(--accent)',
          color: labelAtNow ? 'var(--text-dim)' : '#fff',
          border: `1px solid ${labelAtNow ? 'var(--border)' : 'var(--accent)'}`,
          borderRadius: 6,
          cursor: labelAtNow ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {label}
      </button>
    </div>
  );
}

function formatBackLabel(ms) {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m ago`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h ago` : `${h}h ${m}m`;
}

// Button strip pinned to the top-left of the canvas in Sensing mode.
// One button per available metric — toggles which sensor reading paints
// per-floor tints. JB asked 2026-05-29 for an Air quality button as the
// first metric; pattern scales to temperature/occupancy/etc later.
export function SensingMetricBar({ active, onSelect }) {
  const METRICS = [
    { id: 'airquality', label: 'Air quality', color: '#10b981' },
    { id: 'temperature', label: 'Temperature', color: '#f59e0b' },
    { id: 'occupancy', label: 'Occupancy', color: '#ec4899' },
    { id: 'humidity', label: 'Humidity', color: '#0ea5e9' },
    { id: 'noise', label: 'Noise', color: '#8b5cf6' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 86,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        paddingBottom: 2,
      }}
    >
      {METRICS.map((m) => {
        const isActive = active === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(isActive ? null : m.id)}
            title={`Toggle ${m.label} per-floor tint`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: 0.1,
              background: isActive ? m.color : 'color-mix(in oklch, var(--surface) 92%, transparent)',
              color: isActive ? '#fff' : 'var(--text)',
              border: `1px solid ${isActive ? m.color : 'var(--border)'}`,
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
              backdropFilter: 'blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'blur(10px) saturate(180%)',
              boxShadow: isActive
                ? `0 2px 8px color-mix(in oklch, ${m.color} 40%, transparent)`
                : '0 1px 2px rgba(15, 23, 42, 0.06)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isActive ? '#fff' : m.color,
              }}
            />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export function AgentFilterBar({ agents, active, onSelect, rightOffset }) {
  const allActive = active === 'all';
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 86, // canvas controls (~36px) + 8px gap + 30px extra breathing room per JB
        right: rightOffset,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        overflowX: 'auto',
        paddingBottom: 2, // room for the per-button shadow
      }}
    >
      {/* ALL button — highlights every alerting floor in its TOP
          agent's colour (the "rainbow" view JB wanted). Neutral
          outline when inactive, brand-pink fill when active. */}
      <button
        type="button"
        onClick={() => onSelect('all')}
        title="Highlight all alerting floors in their primary agent colour"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: allActive ? 'var(--accent)' : 'color-mix(in oklch, var(--surface) 94%, transparent)',
          color: allActive ? '#fff' : 'var(--text)',
          border: `1.5px solid ${allActive ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1.2,
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          backdropFilter: 'blur(8px)',
          boxShadow: allActive
            ? '0 2px 10px color-mix(in oklch, var(--accent) 35%, transparent)'
            : '0 1px 4px rgba(15,23,42,0.08)',
          transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
        }}
      >
        ALL
      </button>
      {agents.map((a) => {
        const isActive = active === a.agentId;
        return (
          <button
            key={a.agentId}
            type="button"
            onClick={() => onSelect(a.agentId)}
            title={`${a.agentId} · ${a.count.toLocaleString()} pending`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: isActive ? a.color : 'color-mix(in oklch, var(--surface) 94%, transparent)',
              color: isActive ? '#fff' : a.color,
              border: `1.5px solid ${a.color}`,
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 700,
              lineHeight: 1.2,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              backdropFilter: 'blur(8px)',
              boxShadow: isActive
                ? `0 2px 10px color-mix(in oklch, ${a.color} 35%, transparent)`
                : '0 1px 4px rgba(15,23,42,0.08)',
              transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
            }}
          >
            <span>{a.agentId}</span>
            <span
              style={{
                opacity: isActive ? 0.85 : 0.6,
                fontWeight: 800,
                fontSize: 10.5,
              }}
            >
              {formatCount(a.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Right-side activity panel — two modes:
//
//   1. activityEnabled (ACTIVITY toggle ON): full feed for the
//      building. Tabs filter by status (All / CTAs / Open /
//      Resolved). Rows sourced from useAllAsksByLocation (pending +
//      resolved). Respects the top-bar agent filter + TODAY toggle.
//      If panelTarget is also set, scoped to that floor/agent.
//
//   2. panelTarget only (no ACTIVITY toggle): drilldown for one
//      floor (or floor+agent). Rows sourced from the cheaper
//      alertsByFloor (pending only). Same tab strip but the
//      Resolved tab is empty since we didn't fetch that data.
//
// Click outside the panel and ESC both call onClose, which clears
// panelTarget AND the activity toggle (handled by the parent).
const TAB_DEFS = [
  { id: 'all', label: 'All' },
  { id: 'ctas', label: 'CTAs' },
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];
// formatCount hoisted to top of file (line ~22) so FloorPillRow uses it too.

export function ActivityPanel({
  rootRef,
  unifiedFeed,
  rows,
  fallbackByFloor,
  activityEnabled,
  panelTarget,
  floors,
  agentFilter,
  nowFilter,
  onOpenChat,
  onOpenIncident,
  onOpenAgent,
  onClose,
  t,
}) {
  const [tab, setTab] = useState('all');
  const [busyCallId, setBusyCallId] = useState(null);
  // Reset to 'all' when the panel re-opens or panel target changes.
  useEffect(() => {
    setTab('all');
  }, [panelTarget?.floorId, activityEnabled]);

  // PR #647: ACTIVITY toggle on → unified feed (merlin_asks calls +
  // incidents, matching OPERATE/Activity exactly). Per-floor drilldown
  // (panelTarget without activityOpen) keeps the legacy agent_runs
  // fallback because the unified feed lacks per-floor metadata for
  // incidents (simulator quirk — see HypervisorViewer3D comment).
  const useUnified = activityEnabled && Array.isArray(unifiedFeed);

  // Resolve the row pool. Two universes:
  //   - Unified path: scope by agent filter only (no per-floor metadata)
  //   - Legacy path: per-floor or org-wide agent_runs
  const sourceRows = useMemo(() => {
    if (useUnified) return unifiedFeed || [];
    if (activityEnabled) return rows || [];
    if (!panelTarget || !fallbackByFloor) return [];
    const byAgent = fallbackByFloor.get(panelTarget.floorId) || new Map();
    if (panelTarget.agentId) return byAgent.get(panelTarget.agentId) || [];
    return Array.from(byAgent.values()).flat();
  }, [useUnified, unifiedFeed, activityEnabled, rows, panelTarget, fallbackByFloor]);

  // Today cutoff for the TODAY filter (recomputed lazily).
  const todayCutoff = useMemo(() => {
    if (nowFilter !== 'today') return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [nowFilter]);
  // Numeric Date.now-equivalent for unified-feed TODAY filter
  // (incidents carry `_spawnedAt` as ms; calls carry `createdAt`).
  const todayCutoffMs = useMemo(() => {
    if (nowFilter !== 'today') return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [nowFilter]);

  // Filter by every active scope EXCEPT the tab, so tab counts can
  // be computed honestly from this base list.
  const scoped = useMemo(() => {
    const out = [];
    for (const r of sourceRows) {
      if (useUnified) {
        // Unified row shape: { kind, id, priority, ts, agentId, status, data }
        // NOTE: TODAY filter is INTENTIONALLY not applied here — the
        // unified activity feed is the operator's inbox and must
        // match OPERATE/Activity 1:1. TODAY's purpose is taming the
        // 3D building's per-floor pill density (PR #645), not
        // hiding actionable items from the panel. Apply agent
        // filter only.
        if (agentFilter && agentFilter !== 'all' && r.agentId !== agentFilter) continue;
        out.push(r);
        continue;
      }
      // Legacy agent_runs row scoping path
      if (panelTarget) {
        const inFloor = locationOnFloor(r.location_id, panelTarget.floorId);
        if (!inFloor) continue;
        if (panelTarget.agentId && r.agent_id !== panelTarget.agentId) continue;
      } else if (agentFilter && agentFilter !== 'all') {
        if (r.agent_id !== agentFilter) continue;
      }
      if (todayCutoff && (r.created_at || '') < todayCutoff) continue;
      out.push(r);
    }
    out.sort((a, b) => {
      if (useUnified) return (b.ts || 0) - (a.ts || 0);
      return a.created_at < b.created_at ? 1 : -1;
    });
    return out;
  }, [sourceRows, useUnified, panelTarget, agentFilter, todayCutoff, todayCutoffMs]);

  // Tab predicates + counts — branch per data shape.
  const counts = useMemo(() => {
    const c = { all: 0, ctas: 0, open: 0, resolved: 0 };
    for (const r of scoped) {
      c.all += 1;
      if (useUnified) {
        if (r.status === 'cta') c.ctas += 1;
        if (r.status === 'cta' || r.status === 'open') c.open += 1;
        if (r.status === 'resolved') c.resolved += 1;
      } else {
        const open = !r.ask_resolution;
        const isCta = r.decision === 'ask' && open;
        if (isCta) c.ctas += 1;
        if (open) c.open += 1;
        else c.resolved += 1;
      }
    }
    return c;
  }, [scoped, useUnified]);
  const visible = useMemo(() => {
    if (useUnified) {
      if (tab === 'all') return scoped;
      if (tab === 'ctas') return scoped.filter((r) => r.status === 'cta');
      if (tab === 'open') return scoped.filter((r) => r.status === 'cta' || r.status === 'open');
      if (tab === 'resolved') return scoped.filter((r) => r.status === 'resolved');
      return scoped;
    }
    if (tab === 'all') return scoped;
    if (tab === 'ctas') return scoped.filter((r) => r.decision === 'ask' && !r.ask_resolution);
    if (tab === 'open') return scoped.filter((r) => !r.ask_resolution);
    if (tab === 'resolved') return scoped.filter((r) => !!r.ask_resolution);
    return scoped;
  }, [scoped, tab, useUnified]);

  const handleAnswer = async (callId, actionId) => {
    if (busyCallId) return;
    setBusyCallId(callId);
    try {
      await answerAsk(callId, actionId);
    } finally {
      setBusyCallId(null);
    }
  };

  const scopeLabel = panelTarget
    ? `${panelTarget.label || floors.find((f) => f.id === panelTarget.floorId)?.name || 'Floor'}${panelTarget.agentId ? ` · ${panelTarget.agentId}` : ''}`
    : agentFilter && agentFilter !== 'all'
      ? agentFilter
      : t('hyper3d.activity.scope_all');

  return (
    <div
      ref={rootRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        // 480px (was 360px): IncidentRow + CallRow are designed for
        // OPERATE/Activity's wider surface (200px SLA column + icon
        // column + action buttons). 360px squeezed the title column
        // to ~50px and text wrapped word-by-word. 480px gives the
        // title column ~160px of breathing room.
        width: 480,
        maxHeight: 'calc(100% - 24px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        backdropFilter: 'blur(20px) saturate(180%)',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
      }}
    >
      {/* Header — title stacked above scope for a cleaner two-row read */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '12px 14px 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.005em',
              lineHeight: 1.25,
            }}
          >
            {t('hyper3d.activity.title')}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={scopeLabel}
          >
            {scopeLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('hyper3d.panel.close')}
          style={{
            width: 26,
            height: 26,
            marginTop: -2,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: 18,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            flexShrink: 0,
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-3)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-dim)';
          }}
        >
          ×
        </button>
      </div>
      {/* Tabs — pill row, no wrap. 4 tabs need to fit at 360px even
          when counts hit 5 digits (10K+ runs on busy buildings). We
          compact-format counts via Intl so "10244" reads "10.2K" and
          the chip stays narrow. */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'nowrap',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in oklch, var(--surface-2) 50%, transparent)',
          overflow: 'hidden',
        }}
      >
        {TAB_DEFS.map((tdef) => {
          const isActive = tab === tdef.id;
          const n = counts[tdef.id] || 0;
          return (
            <button
              key={tdef.id}
              type="button"
              onClick={() => setTab(tdef.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                fontSize: 10.5,
                fontWeight: 700,
                background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${isActive ? 'var(--accent-line)' : 'var(--border)'}`,
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                flexShrink: 0,
              }}
              title={`${tdef.label} · ${n.toLocaleString()}`}
            >
              {tdef.label}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 16,
                  padding: '0 4px',
                  fontWeight: 800,
                  fontSize: 9.5,
                  background: isActive ? 'var(--accent)' : 'var(--surface-3)',
                  color: isActive ? '#fff' : 'var(--text-dim)',
                  borderRadius: 999,
                  lineHeight: 1.5,
                }}
              >
                {formatCount(n)}
              </span>
            </button>
          );
        })}
      </div>
      {/* List — branch on unified vs legacy data shape */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 0',
        }}
      >
        {visible.length === 0 ? (
          <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--text-dim)' }}>{t('hyper3d.panel.empty')}</div>
        ) : useUnified ? (
          // PR #647: unified path — render via CallRow / IncidentRow
          // for visual parity with OPERATE/Activity. Same components,
          // same data, same affordances.
          visible
            .slice(0, 200)
            .map((r, i) =>
              r.kind === 'call' ? (
                <CallRow
                  key={r.id}
                  call={r.data}
                  busy={busyCallId === r.data.id}
                  onAnswer={handleAnswer}
                  onOpenAgent={onOpenAgent}
                />
              ) : (
                <IncidentRow
                  key={r.id}
                  inc={r.data}
                  last={i === Math.min(visible.length, 200) - 1}
                  onAskAbout={(title) => onOpenChat?.(t('briefing.tell_me_about', { title }))}
                  onOpenIncident={onOpenIncident}
                  expandable
                />
              ),
            )
        ) : (
          // Legacy path — agent_runs rows (per-floor drilldown).
          visible.slice(0, 200).map((r) => {
            const floorId = walkUpToFloor(r.location_id, floors);
            const floor = floors.find((f) => f.id === floorId);
            return <AlertRow key={r.id} row={r} floorName={floor?.name || ''} t={t} />;
          })
        )}
        {visible.length > 200 && (
          <div
            style={{
              padding: '8px 14px',
              fontSize: 10.5,
              color: 'var(--text-dim)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            {`+${visible.length - 200} ${t('hyper3d.panel.more')}`}
          </div>
        )}
      </div>
    </div>
  );
}

// Dash-bounded prefix match: a deep location_id (room/zone) belongs to a
// floor if it starts with the floor's id + '-'. Used by ActivityPanel to
// label rows when we don't have a precomputed lookup.
function AlertRow({ row, floorName, t }) {
  const color = colorForAgent(row.agent_id);
  const isBuildingLevel = !row.location_id || !row.location_id.includes('-');
  const locationLabel = isBuildingLevel ? t('hyper3d.panel.building_level') : row.location_id;
  return (
    <div
      style={{
        padding: '8px 14px',
        borderBottom: '1px solid color-mix(in oklch, var(--border) 50%, transparent)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span
        style={{
          marginTop: 5,
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {row.decision_reason || t('hyper3d.panel.no_reason')}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 10.5,
            color: 'var(--text-dim)',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color, fontWeight: 700 }}>{row.agent_id}</span>
          <span>·</span>
          <span>{floorName}</span>
          {locationLabel !== floorName && (
            <>
              <span>·</span>
              <span style={{ fontStyle: 'italic' }}>{locationLabel}</span>
            </>
          )}
          <span>·</span>
          <span>{relativeTime(row.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// "By location" rail — the never-blank safety net for the servicing 3D viewer.
// Lists the open items grouped into spatial zones (top of tower → grade →
// off-stack) with per-zone open counts + worst hours-over-SLA, so the view
// always answers WHAT even when the tower (the WHERE) can't localise an item
// to a floor (dock / perimeter / tower-wide). Complements — does not replace —
// the service-line text list in the right rail. English-only for now (the
// servicing catalog is EN-only; FR i18n is a follow-up).
export function ServicingByLocationRail({ buckets, t }) {
  if (!buckets || buckets.length === 0) return null;
  // The RPC hardcodes open_count to 0 for the overdue branch, so count the
  // items themselves — "N flagged items in this zone" is the real signal.
  const totalItems = buckets.reduce((s, b) => s + b.items.length, 0);
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 5,
        width: 248,
        maxHeight: 'calc(100% - 24px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'color-mix(in oklch, var(--surface) 94%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        backdropFilter: 'blur(12px) saturate(180%)',
        boxShadow: '0 10px 30px rgba(15,23,42,0.10)',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text)',
          }}
        >
          {trLabel(t, 'hyper3d.byloc.title', 'By location')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {trLabel(t, 'hyper3d.byloc.flagged', `${formatCount(totalItems)} flagged`, {
            n: formatCount(totalItems),
          })}
        </span>
      </div>
      <div style={{ overflowY: 'auto', padding: '4px 4px 6px' }}>
        {buckets.map((b) => {
          const meta = SERVICING_ZONE_META[b.zone] || { label: b.zone, hint: '' };
          // Named-floor buildings carry their floor name on the bucket itself
          // (`b.label`); spatial zone buckets resolve via SERVICING_ZONE_META.
          const label = b.label || trLabel(t, meta.labelKey, meta.label);
          const sev = servicingSeverity(b.maxHoursOver);
          const names = b.items.slice(0, 3).map((it) => it.item);
          const more = b.items.length - names.length;
          // Per-zone heat: a faint severity wash behind at-risk/breached zones so
          // the rail scans as a heatmap; on-target zones stay clean.
          const washPct = sev.level === 'crit' ? 14 : sev.level === 'warn' ? 9 : 0;
          return (
            <div
              key={b.floorId || b.zone}
              style={{
                padding: '7px 8px',
                borderRadius: 8,
                background: washPct ? `color-mix(in oklch, ${sev.color} ${washPct}%, transparent)` : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: sev.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{label}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 999,
                    background: 'color-mix(in oklch, var(--text) 8%, transparent)',
                    color: 'var(--text)',
                    fontSize: 10.5,
                    fontWeight: 800,
                  }}
                >
                  {formatCount(b.items.length)}
                </span>
              </div>
              <div
                style={{
                  marginLeft: 16,
                  marginTop: 2,
                  color: 'var(--text-dim)',
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                {names.join(' · ')}
                {more > 0 ? ` +${more}` : ''}
              </div>
              {sev.level !== 'ok' && (
                <div
                  style={{
                    marginLeft: 16,
                    marginTop: 1,
                    color: sev.color,
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                >
                  {trLabel(t, 'hyper3d.byloc.hours_over', `${b.maxHoursOver}h over SLA`, {
                    n: b.maxHoursOver,
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Servicing canvas colour-mode toggle (bottom-left): "Severity" (default —
// teal/amber/red by hours-over) vs "Service line" (recolour the lit floors +
// off-floor markers by the discipline behind them). In line mode a small legend
// maps each service line to its colour. English-only for now.
const SERVICING_LINES = ['cleaning', 'security', 'hospitality', 'maintenance'];
export function ServicingColorControls({ mode, onChange, t }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      {mode === 'line' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 12px',
            maxWidth: 268,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(10px) saturate(170%)',
          }}
        >
          {SERVICING_LINES.map((l) => {
            const meta = SERVICING_DOMAIN_META[l] || {};
            return (
              <span
                key={l}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--text-soft)',
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 3, background: meta.color, flexShrink: 0 }} />
                {trLabel(t, meta.labelKey, meta.fallback || l)}
              </span>
            );
          })}
        </div>
      )}
      <div
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          padding: 3,
          gap: 2,
          borderRadius: 999,
          background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(12px) saturate(180%)',
        }}
      >
        {[
          ['severity', trLabel(t, 'hyper3d.color.severity', 'Severity')],
          ['line', trLabel(t, 'hyper3d.color.line', 'Service line')],
        ].map(([val, label]) => {
          const active = mode === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              aria-pressed={active}
              style={{
                padding: '5px 11px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11.5,
                fontWeight: 700,
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-soft)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
