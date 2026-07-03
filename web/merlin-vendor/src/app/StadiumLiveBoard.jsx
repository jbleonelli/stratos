// StadiumLiveBoard — Phase 5 MVP of the stadium demo.
//
// Renders a live event banner + KPI grid + recent-agent-action ribbon
// when the active building has variant='stadium' AND a stadium event
// exists in the active window (scheduled within 30 min OR live OR
// just-ended within 30 min). For non-stadium tenants and inactive
// stadium periods, the component returns null and is invisible.
//
// Data flow:
//   - One supabase query on mount + every 10s (polling beats realtime
//     here because we want consistent 10s update cadence regardless of
//     which devices changed; the simulator pushes every minute so
//     polling is cheap relative to the underlying tick rate).
//   - Pulls: stadium_events (latest active), devices in building
//     subtree, last 8 stadium-agent runs.
//
// This is intentionally a "banner" — sits at the top of Briefing.
// A full floor-plan heatmap (Phase 5b) renders the same data on an
// SVG stadium plan later.

import React from 'react';
import { useStadiumLiveBoard } from './queries/stadium.ts';
import { Card, Pill } from './primitives.jsx';

export function StadiumLiveBoard({ building, orgId }) {
  // Live event + its subtree devices + recent agent runs, polled by React Query.
  const { data } = useStadiumLiveBoard(building, orgId);

  if (!building?.id || building.variant !== 'stadium') return null;
  if (!data || !data.event) return null;

  const { event, devices, runs } = data;

  // Aggregate KPIs by subtype.
  const bySubtype = (s) => devices.filter((d) => d.telemetry?.subtype === s);
  const turnstiles = bySubtype('turnstile');
  const cams = bySubtype('crowd-flow-cam');
  const pos = bySubtype('food-pos');
  const restrooms = bySubtype('restroom-occupancy');
  const scoreboard = devices.find((d) => d.telemetry?.subtype === 'scoreboard');

  const totalIngress = turnstiles.reduce((s, d) => s + Number(d.telemetry?.count_today || 0), 0);
  const peakDensity = Math.max(0, ...cams.map((d) => Number(d.telemetry?.density_pct || 0)));
  const longestQueue = Math.max(0, ...pos.map((d) => Number(d.telemetry?.queue_length || 0)));
  const busiestRestroom = Math.max(
    0,
    ...restrooms.map((d) => {
      const tot = Number(d.telemetry?.total_stalls || 24);
      return Math.round((Number(d.telemetry?.occupied_stalls || 0) / Math.max(1, tot)) * 100);
    }),
  );
  const totalSalesCents = pos.reduce((s, d) => s + Number(d.telemetry?.sales_today_cents || 0), 0);

  // Status label.
  const tMin = (Date.now() - new Date(event.starts_at).getTime()) / 60_000;
  let statusLabel;
  let statusTone;
  if (event.status === 'live') {
    statusLabel = 'LIVE';
    statusTone = 'risk';
  } else if (event.status === 'scheduled' && tMin < 0) {
    const absMin = Math.abs(Math.round(tMin));
    statusLabel = `T-${absMin}min`;
    statusTone = absMin < 15 ? 'warn' : 'info';
  } else {
    statusLabel = String(event.status).toUpperCase();
    statusTone = 'neutral';
  }

  const sbT = scoreboard?.telemetry || {};
  const showScore = sbT.quarter && event.status === 'live';

  return (
    <Card
      style={{
        background: 'linear-gradient(135deg, var(--accent-strong, #1B5E20), var(--bg-deep, #0F2018))',
        color: 'white',
        padding: 20,
        marginBottom: 16,
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Pill
          tone={statusTone}
          style={{
            background: 'rgba(255,255,255,0.18)',
            color: 'white',
            border: 'none',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
          }}
        >
          {statusLabel}
        </Pill>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25, letterSpacing: -0.1 }}>{event.name}</div>
          <div style={{ fontSize: 11, opacity: 0.78, marginTop: 3, lineHeight: 1.35 }}>
            {event.sport} · capacity {event.attendance_target.toLocaleString()}
            {event.metadata?.broadcast ? ` · ${event.metadata.broadcast}` : ''}
          </div>
        </div>
        {showScore ? (
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -0.5,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {sbT.home_score} - {sbT.away_score}
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.78,
                marginTop: 5,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.1,
              }}
            >
              Q{sbT.quarter} · {sbT.clock || ''}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, opacity: 0.78, letterSpacing: 0.1 }}>
            Tipoff {new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <Kpi label="Ingress" value={totalIngress.toLocaleString()} suffix="fans" />
        <Kpi label="Peak density" value={`${peakDensity}%`} tone={peakDensity > 90 ? 'warn' : 'normal'} />
        <Kpi
          label="Longest queue"
          value={`${longestQueue}`}
          suffix="ppl"
          tone={longestQueue > 12 ? 'warn' : 'normal'}
        />
        <Kpi label="Busiest restroom" value={`${busiestRestroom}%`} tone={busiestRestroom > 90 ? 'warn' : 'normal'} />
        <Kpi
          label="Concessions"
          value={`$${(totalSalesCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          suffix="today"
        />
      </div>

      {/* Recent agent activity */}
      {runs.length > 0 && (
        <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              opacity: 0.7,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: 10,
            }}
          >
            Recent agent activity
          </div>
          {runs.slice(0, 3).map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 7, lineHeight: 1.45 }}>
              <Pill
                tone="neutral"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  border: 'none',
                  minWidth: 118,
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                {r.agent_id}
              </Pill>
              <div style={{ opacity: 0.92, flex: 1 }}>
                <span style={{ opacity: 0.6, marginRight: 6, fontVariantNumeric: 'tabular-nums' }}>[{r.decision}]</span>
                {(r.decision_reason || '(no reason)').slice(0, 160)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Kpi({ label, value, suffix, tone }) {
  const warn = tone === 'warn';
  return (
    <div
      style={{
        background: warn ? 'rgba(255,180,0,0.22)' : 'rgba(255,255,255,0.1)',
        padding: '11px 12px',
        borderRadius: 8,
        border: warn ? '1px solid rgba(255,180,0,0.45)' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          opacity: 0.75,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: -0.4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {suffix ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              opacity: 0.7,
              marginLeft: 5,
              letterSpacing: 0.1,
              fontVariantNumeric: 'normal',
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}
