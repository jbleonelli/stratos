// StadiumHeatmap — Phase 5b of the stadium demo.
//
// Top-down stadium-plan heatmap. Renders alongside StadiumLiveBoard
// (Phase 5a / PR #511) on the Briefing page when there's a live or
// scheduled stadium event. The board shows headline numbers; this
// shows them in space — which quadrants are dense, which gates are
// hot, which restrooms / concessions are overloaded.
//
// Layout (top-down view of a stadium):
//
//       ┌───── Gate North ─────┐
//       │  UPPER NW │ UPPER NE │
//       ├───────────┼──────────┤
//   GW  │  MID NW   │ MID NE   │ GE
//       ├───────────┼──────────┤
//       │  LOWER NW │ LOWER NE │
//       ├───────────┼──────────┤
//       │           FIELD       │
//       │   (clock + score)     │
//       ├───────────┼──────────┤
//       │  LOWER SW │ LOWER SE │
//       ...
//       └───── Gate South ─────┘
//
// 12 quadrant cells (4 quadrants × 3 decks) colored by camera density.
// 8 concession badges + 7 restroom badges drawn on the concourse
// perimeter, colored by queue length / occupancy. 4 gate badges at
// compass points colored by ingress rate.
//
// Data: same shape + polling cadence as StadiumLiveBoard. We do a
// duplicate fetch here (rather than extracting to a shared hook) so
// each component is self-contained — 10s × 2 = trivial overhead.

import React, { useState } from 'react';
import { useStadiumHeatmap } from './queries/stadium.ts';
import { Card } from './primitives.jsx';

// Color ramp: 0 → 1 maps from cool (green) through amber to hot (red).
// Used for density (0-100%), queue length (0-15 ppl mapped), restroom
// occupancy (0-100%), gate rate (0-30 per-min mapped).
function heatColor(value01) {
  const v = Math.max(0, Math.min(1, value01));
  if (v < 0.3) return '#16A34A'; // calm green
  if (v < 0.6) return '#84CC16'; // active lime
  if (v < 0.8) return '#F59E0B'; // busy amber
  return '#DC2626'; // packed red
}

export function StadiumHeatmap({ building, orgId }) {
  // Live event + subtree devices + recent stadium-agent runs (with locById for
  // the zone-detail drawer), polled by React Query.
  const { data } = useStadiumHeatmap(building, orgId);
  // Phase 5c — selected zone for the detail drawer. Stores a
  // location_id (quadrant, gate, concession, or restroom). Null
  // means "no selection, detail panel hidden."
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  if (!building?.id || building.variant !== 'stadium') return null;
  if (!data || !data.event) return null;

  const { event, devices, runs = [], locById } = data;

  // Index devices by parent location so we can pull metrics per quadrant.
  // Cameras are on quadrants directly. Concessions / restrooms / gates
  // have their own location rows; we look up the location name to find
  // the right node in the SVG.
  const bySubtype = {};
  for (const d of devices) {
    const st = d.telemetry?.subtype;
    if (!st) continue;
    (bySubtype[st] = bySubtype[st] || []).push(d);
  }

  // Per-quadrant density (cameras only cover lower-bowl + mid-deck per
  // Phase 1 seed; upper deck shows "no signal" — gray).
  function quadrantDensity(deckId, q) {
    const expected = `${deckId}-q-${q}`;
    const cam = (bySubtype['crowd-flow-cam'] || []).find((d) => d.location_id === expected);
    return cam ? Number(cam.telemetry?.density_pct || 0) : null;
  }

  // Concession + restroom + gate aggregates.
  function aggregateAt(locationId, kind) {
    const devs = (bySubtype[kind] || []).filter((d) => d.location_id === locationId);
    return devs;
  }

  const sbT = (bySubtype['scoreboard'] || [])[0]?.telemetry || {};
  const isLive = event.status === 'live';

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
          Stadium plan · live heatmap
        </div>
        <Legend />
      </div>

      <SvgPlan
        deckQuadrant={quadrantDensity}
        aggregateAt={aggregateAt}
        sbT={sbT}
        isLive={isLive}
        selectedLocationId={selectedLocationId}
        onSelectZone={setSelectedLocationId}
      />

      {selectedLocationId && (
        <ZoneDetail
          locationId={selectedLocationId}
          locById={locById}
          devices={devices}
          runs={runs}
          onClose={() => setSelectedLocationId(null)}
        />
      )}
    </Card>
  );
}

// Detail panel that opens below the SVG when a zone is clicked. Shows
// the location label, the devices wired in that zone with their live
// telemetry, and recent stadium-agent decisions touching this location.
function ZoneDetail({ locationId, locById, devices, runs, onClose }) {
  const loc = locById?.get(locationId);
  const label = loc?.name || locationId;
  const kind = loc?.kind || '?';

  const inZone = devices.filter((d) => d.location_id === locationId);
  const relatedRuns = runs
    .filter((r) => {
      const ap = r.action_payload || {};
      const z = ap.zone || ap.stand || ap.from_zone;
      if (!z) return false;
      return (
        z === label ||
        z === locationId ||
        (typeof z === 'string' && z.toLowerCase().includes(String(label).toLowerCase()))
      );
    })
    .slice(0, 5);

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 8,
        border: '1px solid var(--rule, #E5E7EB)',
        background: 'var(--surface-2, #F8FAFC)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.1, lineHeight: 1.25 }}>{label}</div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginTop: 3,
            }}
          >
            {kind}
            {loc?.parent_id ? ` · ${loc.parent_id}` : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: 11,
            padding: '2px 8px',
            letterSpacing: 0.2,
          }}
        >
          ✕ close
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              opacity: 0.7,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Devices in this zone ({inZone.length})
          </div>
          {inZone.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>(no devices wired here)</div>
          ) : (
            inZone.map((d) => (
              <div
                key={d.id}
                style={{
                  fontSize: 12,
                  marginBottom: 8,
                  padding: 9,
                  background: 'white',
                  borderRadius: 4,
                  border: '1px solid var(--rule, #E5E7EB)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, letterSpacing: -0.05 }}>
                  {d.external_id}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-dim)',
                      marginLeft: 6,
                      letterSpacing: 0.2,
                    }}
                  >
                    · {d.telemetry?.subtype || d.kind}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--text-dim)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {formatTelemetry(d.telemetry)}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              opacity: 0.7,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Recent agent decisions ({relatedRuns.length})
          </div>
          {relatedRuns.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              (no agent activity affecting this zone in the last hour)
            </div>
          ) : (
            relatedRuns.map((r) => (
              <div
                key={r.id}
                style={{
                  fontSize: 12,
                  marginBottom: 8,
                  padding: 9,
                  background: 'white',
                  borderRadius: 4,
                  border: '1px solid var(--rule, #E5E7EB)',
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: -0.05 }}>{r.agent_id}</span>
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 0.3,
                      color: r.decision === 'ask' ? 'var(--warn, #B45309)' : 'var(--text-dim)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    [{r.decision}
                    {r.confidence != null ? ` · ${r.confidence}%` : ''}]
                  </span>
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-dim)' }}>
                  {(r.decision_reason || '(no reason)').slice(0, 180)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatTelemetry(t) {
  if (!t) return '(no telemetry)';
  const skip = new Set(['subtype']);
  const lines = Object.entries(t)
    .filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== '')
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  return lines.join('\n') || '(empty)';
}

function Legend() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
      }}
    >
      <span>calm</span>
      {[0.15, 0.45, 0.7, 0.9].map((v, i) => (
        <span
          key={i}
          style={{
            width: 26,
            height: 8,
            background: heatColor(v),
            borderRadius: 2,
            display: 'inline-block',
          }}
        />
      ))}
      <span>packed</span>
    </div>
  );
}

function SvgPlan({ deckQuadrant, aggregateAt, sbT, isLive, selectedLocationId, onSelectZone }) {
  const onClickZone = (id) => onSelectZone && onSelectZone(selectedLocationId === id ? null : id);
  const isSelected = (id) => selectedLocationId === id;
  // Top-down bowl footprint. Rows top-to-bottom:
  //   gate-N strip · upper-N · mid-N · lower-N · FIELD · lower-S · mid-S · upper-S · gate-S strip
  // Two columns per deck row (NW/NE or SW/SE). All decks the same
  // height for a clean symmetric look. Concession badges along the
  // top + bottom strips; restroom badges in a central gutter between
  // the NW and NE cells of each deck (and SW/SE).
  const W = 760;
  const DH = 60; // deck row height
  const FIELD_H = 88; // center field
  const GATE_STRIP = 28; // top + bottom gate badges live here
  const NORTH_TOP = GATE_STRIP;
  const FIELD_TOP = NORTH_TOP + 3 * DH;
  const SOUTH_TOP = FIELD_TOP + FIELD_H;
  const H = SOUTH_TOP + 3 * DH + GATE_STRIP;

  const stroke = 'var(--rule, #E5E7EB)';
  const bg = 'var(--surface-2, #F8FAFC)';
  const gateTone = (rate) => heatColor(Math.min(1, rate / 30));

  // Decks in north-to-field order (far to near). We render the same
  // order again, mirrored, below the field for the south side.
  const decks = [
    { id: 'hem-upper-deck', short: 'up', label: 'UPPER' },
    { id: 'hem-mid-deck', short: 'md', label: 'MID' },
    { id: 'hem-lower-bowl', short: 'lb', label: 'LOWER' },
  ];
  const FIELD = { x: 220, y: FIELD_TOP, w: W - 440, h: FIELD_H };
  const colW = 180;
  const gutter = 20; // gap between NW and NE
  const xNW = (W - 2 * colW - gutter) / 2; // left cell
  const xNE = xNW + colW + gutter; // right cell
  const rrX = (xNW + colW + xNE) / 2; // mid-gutter for restroom badge

  function quadrantFill(deckId, q) {
    const v = deckQuadrant(deckId, q);
    if (v == null) return '#E5E7EB';
    return heatColor(v / 100);
  }
  function quadrantText(deckId, q) {
    const v = deckQuadrant(deckId, q);
    return v == null ? '—' : `${v}%`;
  }

  function deckRow({ deck, idx, side }) {
    const y = side === 'north' ? NORTH_TOP + idx * DH : SOUTH_TOP + (decks.length - 1 - idx) * DH; // mirror so far-from-field is outermost
    const qLeft = side === 'north' ? 'nw' : 'sw';
    const qRight = side === 'north' ? 'ne' : 'se';
    const restroomId = `hem-restroom-${deck.short}-${side === 'north' ? 'n' : 's'}`;
    const rrDevs = aggregateAt(restroomId, 'restroom-occupancy');
    const rrTel = rrDevs[0]?.telemetry || null;
    return (
      <g key={`${side}-${deck.id}`}>
        {[
          [xNW, qLeft],
          [xNE, qRight],
        ].map(([x, q]) => {
          const quadrantId = `${deck.id}-q-${q}`;
          const sel = isSelected(quadrantId);
          return (
            <g key={q} onClick={() => onClickZone(quadrantId)} style={{ cursor: 'pointer' }}>
              <rect
                x={x}
                y={y + 4}
                width={colW}
                height={DH - 8}
                rx={6}
                fill={quadrantFill(deck.id, q)}
                stroke={sel ? '#0EA5E9' : stroke}
                strokeWidth={sel ? 3 : 1}
              >
                <title>{`${deck.label} ${String(q).toUpperCase()} · ${quadrantText(deck.id, q)} density · click for detail`}</title>
              </rect>
              <text
                x={x + 10}
                y={y + 20}
                fontSize={10}
                fill="#fff"
                fontWeight="700"
                letterSpacing="0.5"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)', pointerEvents: 'none' }}
              >
                {deck.label} {String(q).toUpperCase()}
              </text>
              <text
                x={x + colW - 10}
                y={y + DH - 10}
                fontSize={18}
                fill="#fff"
                fontWeight="700"
                textAnchor="end"
                letterSpacing="-0.4"
                style={{
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {quadrantText(deck.id, q)}
              </text>
            </g>
          );
        })}
        {/* Restroom badge in the gutter */}
        {rrTel && (
          <g onClick={() => onClickZone(restroomId)} style={{ cursor: 'pointer' }}>
            <RestroomBadge
              cx={rrX}
              cy={y + DH / 2}
              tel={rrTel}
              label={deck.label[0] + (side === 'north' ? 'N' : 'S')}
              selected={isSelected(restroomId)}
            />
          </g>
        )}
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 760, display: 'block', margin: '0 auto' }}>
      {/* Outer stadium shell — purely decorative */}
      <rect
        x={10}
        y={GATE_STRIP - 6}
        width={W - 20}
        height={H - 2 * (GATE_STRIP - 6)}
        rx={50}
        fill={bg}
        stroke={stroke}
        strokeWidth={1.5}
      />

      {/* Gates at the 4 compass points */}
      <g onClick={() => onClickZone('hem-gate-north')} style={{ cursor: 'pointer' }}>
        <GateBadge
          x={W / 2}
          y={14}
          label="Gate N"
          devs={aggregateAt('hem-gate-north', 'turnstile')}
          gateTone={gateTone}
          selected={isSelected('hem-gate-north')}
        />
      </g>
      <g onClick={() => onClickZone('hem-gate-south')} style={{ cursor: 'pointer' }}>
        <GateBadge
          x={W / 2}
          y={H - 14}
          label="Gate S"
          devs={aggregateAt('hem-gate-south', 'turnstile')}
          gateTone={gateTone}
          selected={isSelected('hem-gate-south')}
        />
      </g>
      <g onClick={() => onClickZone('hem-gate-west')} style={{ cursor: 'pointer' }}>
        <GateBadge
          x={40}
          y={H / 2}
          label="Gate W"
          devs={aggregateAt('hem-gate-west', 'turnstile')}
          gateTone={gateTone}
          rotate={-90}
          selected={isSelected('hem-gate-west')}
        />
      </g>
      <g onClick={() => onClickZone('hem-gate-east')} style={{ cursor: 'pointer' }}>
        <GateBadge
          x={W - 40}
          y={H / 2}
          label="Gate E"
          devs={aggregateAt('hem-gate-east', 'turnstile')}
          gateTone={gateTone}
          rotate={90}
          selected={isSelected('hem-gate-east')}
        />
      </g>

      {/* North decks — far to near */}
      {decks.map((deck, idx) => deckRow({ deck, idx, side: 'north' }))}

      {/* Field — center */}
      <rect
        x={FIELD.x}
        y={FIELD.y}
        width={FIELD.w}
        height={FIELD.h}
        rx={10}
        fill="#1B5E20"
        stroke="#0F3A14"
        strokeWidth={2}
      />
      <line
        x1={FIELD.x + FIELD.w / 2}
        y1={FIELD.y}
        x2={FIELD.x + FIELD.w / 2}
        y2={FIELD.y + FIELD.h}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1}
      />
      <circle
        cx={FIELD.x + FIELD.w / 2}
        cy={FIELD.y + FIELD.h / 2}
        r={24}
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1}
      />
      {isLive ? (
        <>
          <text
            x={FIELD.x + FIELD.w / 2}
            y={FIELD.y + FIELD.h / 2 - 2}
            fontSize={24}
            fill="white"
            textAnchor="middle"
            fontWeight="700"
            letterSpacing="-0.6"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {sbT.home_score ?? 0} - {sbT.away_score ?? 0}
          </text>
          <text
            x={FIELD.x + FIELD.w / 2}
            y={FIELD.y + FIELD.h / 2 + 18}
            fontSize={11}
            fill="rgba(255,255,255,0.85)"
            textAnchor="middle"
            letterSpacing="0.4"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            Q{sbT.quarter ?? '-'} · {sbT.clock ?? ''}
          </text>
        </>
      ) : (
        <text
          x={FIELD.x + FIELD.w / 2}
          y={FIELD.y + FIELD.h / 2 + 4}
          fontSize={11}
          fill="rgba(255,255,255,0.7)"
          textAnchor="middle"
          letterSpacing="2"
          fontWeight="700"
        >
          FIELD
        </text>
      )}

      {/* South decks — mirror */}
      {decks.map((deck, idx) => deckRow({ deck, idx, side: 'south' }))}

      {/* Concession badges — north strip above, south strip below */}
      {['n1', 'n2', 'n3', 'n4'].map((id, i) => {
        const x = 90 + i * 195;
        const locId = `hem-conc-${id}`;
        const devs = aggregateAt(locId, 'food-pos');
        const maxQ = Math.max(0, ...devs.map((d) => Number(d.telemetry?.queue_length || 0)));
        const fill = heatColor(Math.min(1, maxQ / 15));
        return (
          <g key={id} onClick={() => onClickZone(locId)} style={{ cursor: 'pointer' }}>
            <ConcessionBadge
              x={x}
              y={GATE_STRIP / 2 - 2}
              label={id.toUpperCase()}
              queue={maxQ}
              fill={fill}
              selected={isSelected(locId)}
            />
          </g>
        );
      })}
      {['s1', 's2', 's3', 's4'].map((id, i) => {
        const x = 90 + i * 195;
        const locId = `hem-conc-${id}`;
        const devs = aggregateAt(locId, 'food-pos');
        const maxQ = Math.max(0, ...devs.map((d) => Number(d.telemetry?.queue_length || 0)));
        const fill = heatColor(Math.min(1, maxQ / 15));
        return (
          <g key={id} onClick={() => onClickZone(locId)} style={{ cursor: 'pointer' }}>
            <ConcessionBadge
              x={x}
              y={H - GATE_STRIP / 2 + 2}
              label={id.toUpperCase()}
              queue={maxQ}
              fill={fill}
              selected={isSelected(locId)}
            />
          </g>
        );
      })}
    </svg>
  );
}

function RestroomBadge({ cx, cy, tel, label, selected }) {
  const total = Number(tel.total_stalls || 24);
  const occ = Number(tel.occupied_stalls || 0);
  const pct = Math.round((occ / Math.max(1, total)) * 100);
  const fill = heatColor(Math.min(1, pct / 100));
  return (
    <g>
      <title>{`Restroom ${label} · ${occ}/${total} stalls (${pct}%) · wait ${tel.wait_estimate_s || 0}s · click for detail`}</title>
      <rect
        x={cx - (selected ? 14 : 12)}
        y={cy - (selected ? 11 : 9)}
        width={selected ? 28 : 24}
        height={selected ? 22 : 18}
        rx={4}
        fill="white"
        stroke={selected ? '#0EA5E9' : fill}
        strokeWidth={selected ? 3 : 2}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight="700"
        letterSpacing="-0.2"
        fill={fill}
        style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
      >
        {pct}%
      </text>
    </g>
  );
}

function ConcessionBadge({ x, y, label, queue, fill, selected }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={selected ? 12 : 10}
        fill={fill}
        stroke={selected ? '#0EA5E9' : 'white'}
        strokeWidth={selected ? 3 : 2}
      />
      <text
        x={x + 14}
        y={y + 4}
        fontSize={10}
        fontWeight="600"
        letterSpacing="0.3"
        fill="var(--text-dim)"
        style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
      >
        {label} · q{queue}
      </text>
    </g>
  );
}

function GateBadge({ x, y, label, devs, gateTone, rotate, selected }) {
  const totalRate = devs.reduce((s, d) => s + Number(d.telemetry?.count_per_min || 0), 0);
  const totalToday = devs.reduce((s, d) => s + Number(d.telemetry?.count_today || 0), 0);
  const fill = gateTone(totalRate);
  return (
    <g transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}>
      <title>{`${label} · ${totalRate}/min · ${totalToday.toLocaleString()} today · click for detail`}</title>
      <rect
        x={x - 40}
        y={y - 9}
        width={80}
        height={18}
        rx={9}
        fill={fill}
        stroke={selected ? '#0EA5E9' : 'white'}
        strokeWidth={selected ? 3 : 1.5}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize={10}
        fill="white"
        fontWeight="700"
        letterSpacing="0.2"
        style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
      >
        {label} · {totalRate}/min
      </text>
    </g>
  );
}
