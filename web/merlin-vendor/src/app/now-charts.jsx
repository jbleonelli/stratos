// MONITOR → Now: small data-driven chart primitives extracted from
// NowBriefingPage. These are pure presentational SVG components (no data
// fetching, no page-owned state) shared by the service-line tiles, the trend
// card, and the KPI/forecast tiles. Behaviour-preserving move — see
// NowBriefingPage.jsx for the orchestration that wires them up.
import React from 'react';

// ─── Data-driven trend visuals ───────────────────────────────────────
// Small area sparkline from a numeric series (auto-scaled, no gradient ids so
// it's collision-free). Used in the service-line tiles + the trend chart legend.
export function TrendSpark({ data, color, width = 64, height = 22, area = true, strokeWidth = 1.5 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data),
    max = Math.max(...data),
    span = max - min || 1,
    pad = 2;
  const stepX = (width - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, pad + (1 - (v - min) / span) * (height - pad * 2)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `M${pts[0][0].toFixed(1)},${(height - pad).toFixed(1)} L${line.split(' ').join(' L')} L${pts[pts.length - 1][0].toFixed(1)},${(height - pad).toFixed(1)} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      {area && <path d={areaPath} fill={color} fillOpacity={0.13} stroke="none" />}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Circular adherence gauge with the % in the centre.
export function RadialGauge({ pct, color, size = 92 }) {
  const sw = 9;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const val = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const dash = (val / 100) * c;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={sw} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(1)} ${(c - dash).toFixed(1)}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'var(--font)' }}>
        <tspan style={{ fontSize: size * 0.3, fontWeight: 800, fill: color }}>{pct == null ? '—' : pct}</tspan>
        {pct != null && (
          <tspan dx="1" style={{ fontSize: size * 0.15, fontWeight: 700, fill: color }}>
            %
          </tspan>
        )}
      </text>
    </svg>
  );
}

// Wide multi-line adherence trend across the contracted service lines.
export function MultiTrendChart({ lines, height = 132 }) {
  const W = 600,
    H = height,
    padT = 10,
    padB = 14,
    padX = 4;
  const all = lines.flatMap((l) => l.data);
  const lo = Math.max(0, Math.min(...all) - 3);
  const hi = Math.min(100, Math.max(...all) + 3);
  const span = hi - lo || 1;
  const yOf = (v) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const xOf = (i, n) => padX + (i * (W - padX * 2)) / Math.max(1, n - 1);
  const grid = [hi, Math.round((hi + lo) / 2), lo];
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {grid.map((g, i) => (
        <line
          key={i}
          x1={0}
          x2={W}
          y1={yOf(g)}
          y2={yOf(g)}
          stroke="var(--border)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeDasharray="3 4"
        />
      ))}
      {lines.map((l) => (
        <polyline
          key={l.key}
          points={l.data.map((v, i) => `${xOf(i, l.data.length).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')}
          fill="none"
          stroke={l.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

// Tiny inline sparkline rendered as an SVG polyline. Each KPI tile
// gets a small one; "flavour" picks a stable shape so different KPIs
// read as different trends without us hooking up live history.
export function MiniSpark({ color, flavour, full = false, height = 22, data = null }) {
  const SHAPES = {
    up: '0,18 12,14 24,12 36,9 48,8 60,5',
    'up-slight': '0,16 12,14 24,12 36,10 48,9 60,7',
    down: '0,4 12,6 24,8 36,10 48,12 60,14',
    risk: '0,12 8,9 16,15 24,8 32,14 40,7 48,16 60,4',
    info: '0,10 8,12 16,8 24,11 32,9 40,12 48,8 60,11',
    // Distinct, physically-plausible shapes so each forecast tile reads as
    // its own signal rather than the same generic squiggle.
    climb: '0,16 10,15 20,13 30,10 40,7 50,5 60,3', // CO₂ rising to a morning peak
    hump: '0,15 10,12 20,8 30,5 40,6 50,10 60,13', // building load: ramp to midday, settle
    peak: '0,17 10,14 20,8 28,4 36,6 46,11 60,15', // floor occupancy: sharp 11:00 peak
  };
  // A real `data` series (e.g. SLA compliance history) plots the ACTUAL values,
  // normalised into the 60×20 viewBox (higher value → higher on the chart). With
  // no series we fall back to the stylised `flavour` shape (a directional cue,
  // not real history).
  const points =
    Array.isArray(data) && data.length >= 2
      ? (() => {
          const min = Math.min(...data);
          const max = Math.max(...data);
          const span = max - min || 1;
          const stepX = 60 / (data.length - 1);
          return data.map((v, i) => `${(i * stepX).toFixed(1)},${(18 - ((v - min) / span) * 16).toFixed(1)}`).join(' ');
        })()
      : SHAPES[flavour] || SHAPES.info;
  // Soft area fill under the line (matches the OPERATE/Servicing sparkline) so
  // the KPI + forecast tiles read as living charts. The area is a FILL-ONLY path
  // (no stroke on the baseline), so the bottom edge is a gentle wash rather than
  // the hard flat line a stroked polygon used to draw.
  const linePath = points
    .split(' ')
    .map((p, i) => (i === 0 ? 'M' : 'L') + p)
    .join(' ');
  const areaPath = `${linePath} L60,20 L0,20 Z`;
  // `full` = a full-width chart that fills the card's lower real estate (the
  // KPI + forecast tiles), vs the compact corner spark. preserveAspectRatio
  // 'none' stretches the 60×20 viewBox to the card width; a non-scaling stroke
  // keeps the line crisp (1.5px) instead of smearing horizontally.
  return (
    <svg
      width={full ? '100%' : 64}
      height={full ? height : 22}
      viewBox="0 0 60 20"
      preserveAspectRatio={full ? 'none' : 'xMidYMid meet'}
      style={{ flexShrink: 0, overflow: 'visible', display: 'block' }}
    >
      <path d={areaPath} fill={color} fillOpacity={full ? 0.16 : 0.14} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={full ? 1.5 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect={full ? 'non-scaling-stroke' : undefined}
      />
    </svg>
  );
}
