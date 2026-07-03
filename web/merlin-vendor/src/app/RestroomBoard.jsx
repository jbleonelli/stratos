// Restroom Board — the per-bathroom cleaning picture + the cleaning contractor's
// daily worklist (open occupant requests first, then most overdue vs the 4h
// cleaning SLA). See docs/architecture/imf-abm-cleaning-loop.md.
//
// Source-agnostic via useRestroomState/useCleaningPerf (imf-restroom-data.js):
//   • IMF (variant==='imf') → LIVE device data + ABM (the contractor) framing.
//   • Meridian + other real_estate demos → org-scoped replay fixture.
// Gated to real_estate orgs (Operations.jsx / pillar-subnav requiresRealEstate);
// orgs without restroom data get a clean empty state.

import React from 'react';
import { Card, Pill, DataError } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useActiveOrg } from './org-data.js';
import { useRestroomState, useCleaningPerf, sortByUrgency } from './imf-restroom-data.js';

// Cleaning-frequency SLA target (hours since last crew tap).
const OVERDUE_HOURS = 4;

function fmtHours(h) {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function StatPill({ label, value, tone }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 14px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        minWidth: 92,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: tone ? `var(--${tone})` : 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
    </div>
  );
}

function RestroomRow({ r, showFloor }) {
  const overdue = r.hours_since_clean != null && r.hours_since_clean > OVERDUE_HOURS;
  const hasReq = (r.open_requests || 0) > 0;
  const tone = hasReq ? 'risk' : overdue ? 'warn' : 'ok';
  const statusLabel = hasReq
    ? `${r.open_requests} open request${r.open_requests > 1 ? 's' : ''}`
    : overdue
      ? `overdue ${fmtHours(r.hours_since_clean)}`
      : 'within SLA';
  // IMF rows are device serials with a meaningful building·floor (HQ1·f9);
  // fixture rows already carry the floor in the restroom label, so show the
  // building only.
  const place = showFloor
    ? `${(r.building || '').toUpperCase()} · ${(r.floor || '').replace('imf-' + (r.building || '') + '-', '')}`
    : (r.building || '').toUpperCase();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 140px 1fr 150px 120px',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600 }}>{r.restroom}</div>
      <div style={{ color: 'var(--text-soft)' }}>{place}</div>
      <div>
        <Pill tone={tone}>{statusLabel}</Pill>
      </div>
      <div style={{ color: 'var(--text-soft)' }}>
        last clean {fmtHours(r.hours_since_clean)} ago · {r.crew_taps_24h || 0} taps/24h
      </div>
      <div style={{ color: 'var(--text-soft)', textAlign: 'right' }}>
        {r.floor_footfall_24h > 0 ? `${r.floor_footfall_24h} entries/24h` : '—'}
      </div>
    </div>
  );
}

function PerfStrip({ perf, title }) {
  if (!perf) return null;
  const adh = perf.sla_adherence_pct;
  const adhTone = adh >= 90 ? 'ok' : adh >= 70 ? 'warn' : 'risk';
  return (
    <Card>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          color: 'var(--text-soft)',
        }}
      >
        {title} · last 7 days
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 14 }}>
        <StatPill label="SLA adherence" value={`${adh}%`} tone={adhTone} />
        <StatPill label="crew sessions" value={perf.crew_sessions_7d} />
        <StatPill label="restrooms serviced" value={`${perf.restrooms_serviced_7d}/${perf.restrooms_total}`} />
        <StatPill label="requests" value={`${perf.requests_resolved_7d}/${perf.requests_7d}`} />
        <StatPill label="footfall" value={perf.footfall_7d} />
      </div>
    </Card>
  );
}

export function RestroomBoard({ building }) {
  const activeOrg = useActiveOrg();
  const orgId = activeOrg?.id;
  const isImf = building?.variant === 'imf';
  // Contractors read a viewer-scoped, read-only restroom board (their cleaning
  // line at the client building) via the contained RPC; perf self-hides when empty.
  const viewer = activeOrg?.kind === 'contractor';
  const { rows, loaded, error: loadError, refresh } = useRestroomState(building, orgId, { viewer });
  const { perf } = useCleaningPerf(building, orgId);

  const total = rows.length;
  const hq1 = rows.filter((r) => r.building === 'hq1').length;
  const hq2 = rows.filter((r) => r.building === 'hq2').length;
  const overdue = rows.filter((r) => r.hours_since_clean != null && r.hours_since_clean > OVERDUE_HOURS).length;
  const openReq = rows.reduce((n, r) => n + (r.open_requests || 0), 0);

  const pressing = sortByUrgency(
    rows.filter(
      (r) => (r.open_requests || 0) > 0 || (r.hours_since_clean != null && r.hours_since_clean > OVERDUE_HOURS),
    ),
  );

  const eyebrow = isImf ? 'ABM · live cleaning' : 'Live cleaning';
  const perfTitle = isImf ? 'ABM performance' : 'Cleaning performance';

  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {eyebrow}
        </div>
        <h2 style={{ margin: '4px 0 4px', fontSize: 20, fontWeight: 700 }}>Restroom board</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', maxWidth: 640 }}>
          Per-bathroom cleaning state — crew taps, occupant requests, and footfall. Ordered as the cleaning crew&rsquo;s
          worklist: open requests first, then most overdue vs the {OVERDUE_HOURS}h cleaning SLA.
        </p>
      </div>

      {loadError ? (
        <DataError message="Couldn’t load the restroom board." onRetry={refresh} style={{ maxWidth: 460 }} />
      ) : loaded && total === 0 ? (
        <Card>
          <div
            style={{
              padding: 28,
              color: 'var(--text-soft)',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon.droplet size={16} /> No restroom cleaning data for this building yet.
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <StatPill label="restrooms" value={total} />
            {isImf && <StatPill label="HQ1 · HQ2" value={`${hq1} · ${hq2}`} />}
            <StatPill label="overdue" value={overdue} tone={overdue ? 'warn' : undefined} />
            <StatPill label="open requests" value={openReq} tone={openReq ? 'risk' : undefined} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <PerfStrip perf={perf} title={perfTitle} />
          </div>

          <Card>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
                color: 'var(--text-soft)',
              }}
            >
              Needs attention {pressing.length > 0 && <Pill tone="warn">{pressing.length}</Pill>}
            </div>
            {!loaded && (
              <div style={{ padding: 20, color: 'var(--text-soft)', fontSize: 13 }}>Loading restroom state…</div>
            )}
            {loaded && pressing.length === 0 && (
              <div
                style={{
                  padding: 20,
                  color: 'var(--ok)',
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon.check size={16} /> All restrooms within the cleaning SLA — nothing pressing right now.
              </div>
            )}
            {pressing.map((r) => (
              <RestroomRow key={r.restroom} r={r} showFloor={isImf} />
            ))}
          </Card>
        </>
      )}
    </main>
  );
}
