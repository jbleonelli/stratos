// StadiumSchedule — Phase 4 of the stadium demo.
//
// Renders a "calendar / schedule" card below the StadiumLiveBoard +
// StadiumHeatmap on the Briefing page. Shows upcoming events (T-7d
// window) and recently-completed events (last 7d), each as a row with
// the headline metadata + status pill + a click-to-expand drawer for
// per-event stats (attendance, total ingress, etc.).
//
// Same render-gate as the other two stadium surfaces: building.variant
// must be 'stadium'. If the building has no scheduled or recent events,
// the card is hidden entirely (null) — non-stadium tenants see nothing.
//
// Same polling cadence (10s) so a newly-scheduled event appears in the
// schedule within a tick. The query is bounded to a 14-day window
// (-7d to +7d) so a long-lived demo tenant doesn't accumulate UI debt.

import React, { useState } from 'react';
import { useStadiumSchedule } from './queries/stadium.ts';
import { Card, Pill } from './primitives.jsx';

const STATUS_TONE = {
  scheduled: 'info',
  live: 'risk',
  final: 'neutral',
  cancelled: 'warn',
};

export function StadiumSchedule({ building, orgId }) {
  // ±7-day event window, polled by React Query (refetchInterval) instead of a
  // hand-rolled setInterval. `data` is undefined while loading → events = null.
  const { data: events = null } = useStadiumSchedule(building?.id, building?.variant === 'stadium' && Boolean(orgId));
  const [expandedId, setExpandedId] = useState(null);

  if (!building?.id || building.variant !== 'stadium') return null;
  if (!events || events.length === 0) return null;

  const now = Date.now();
  const upcoming = events.filter(
    (e) => new Date(e.starts_at).getTime() >= now - 30 * 60_000 && e.status !== 'final' && e.status !== 'cancelled',
  );
  const past = events.filter(
    (e) => new Date(e.starts_at).getTime() < now - 30 * 60_000 || e.status === 'final' || e.status === 'cancelled',
  );

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
          Stadium schedule · last 7d / next 7d
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            letterSpacing: 0.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {upcoming.length} upcoming · {past.length} past
        </div>
      </div>

      {upcoming.length > 0 && (
        <Section
          title="Upcoming + live"
          events={upcoming}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          now={now}
        />
      )}
      {past.length > 0 && (
        <Section
          title="Recent"
          events={past.slice(-5).reverse()}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          now={now}
        />
      )}
    </Card>
  );
}

function Section({ title, events, expandedId, setExpandedId, now }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          opacity: 0.6,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {events.map((e) => (
        <EventRow
          key={e.id}
          event={e}
          expanded={expandedId === e.id}
          onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
          now={now}
        />
      ))}
    </div>
  );
}

function EventRow({ event, expanded, onToggle, now }) {
  const startsMs = new Date(event.starts_at).getTime();
  const tMin = (now - startsMs) / 60_000;
  let when;
  if (event.status === 'live') {
    when = `LIVE · T+${Math.round(tMin)}min`;
  } else if (event.status === 'final') {
    when = `Ended ${formatRelative(-tMin)} ago`;
  } else if (event.status === 'cancelled') {
    when = 'Cancelled';
  } else if (tMin < 0) {
    when = `Tipoff in ${formatRelative(-tMin)}`;
  } else {
    when = `Tipoff was ${formatRelative(tMin)} ago`;
  }

  const broadcastBadge = event.metadata?.broadcast;

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 10px',
          borderRadius: 6,
          background: expanded ? 'var(--surface-2, #F8FAFC)' : 'transparent',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Pill
          tone={STATUS_TONE[event.status] || 'neutral'}
          style={{
            minWidth: 72,
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
          }}
        >
          {event.status.toUpperCase()}
        </Pill>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.05, lineHeight: 1.3 }}>{event.name}</div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {event.sport} ·{' '}
            {new Date(event.starts_at).toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {broadcastBadge ? ` · ${broadcastBadge}` : ''}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            textAlign: 'right',
            lineHeight: 1.4,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 0.1,
          }}
        >
          <div>{when}</div>
          <div style={{ marginTop: 2 }}>cap {event.attendance_target.toLocaleString()}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', width: 18, textAlign: 'center' }}>
          {expanded ? '▾' : '▸'}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginLeft: 80,
            padding: '10px 12px',
            marginTop: 4,
            marginBottom: 8,
            fontSize: 11,
            color: 'var(--text-dim)',
            background: 'var(--surface-2, #F8FAFC)',
            borderRadius: 6,
            border: '1px solid var(--rule, #E5E7EB)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 8 }}>
            <Stat label="Duration" value={`${event.duration_min}min`} />
            <Stat label="Attendance target" value={event.attendance_target.toLocaleString()} />
            <Stat label="Starts" value={new Date(event.starts_at).toISOString().replace('T', ' ').slice(0, 16)} />
          </div>
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--rule, #E5E7EB)' }}>
              <div
                style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}
              >
                Metadata
              </div>
              <pre style={{ fontFamily: 'monospace', fontSize: 11, margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)' }}>
            event id: <code>{event.id}</code>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          opacity: 0.65,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text)',
          letterSpacing: -0.05,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Small relative-time formatter — handles minutes/hours/days without
// pulling in a date library. Always positive (caller decides ago/from).
function formatRelative(minAbs) {
  const m = Math.round(Math.abs(minAbs));
  if (m < 60) return `${m} min`;
  const h = m / 60;
  if (h < 24) {
    const hi = Math.floor(h);
    const mi = m - hi * 60;
    return mi > 0 ? `${hi}h ${mi}m` : `${hi}h`;
  }
  const d = h / 24;
  if (d < 7) {
    const di = Math.floor(d);
    const hi = Math.floor((d - di) * 24);
    return hi > 0 ? `${di}d ${hi}h` : `${di}d`;
  }
  return `${Math.round(d)}d`;
}
