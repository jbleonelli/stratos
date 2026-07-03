// MONITOR → Now: the signature "Priority bubble map" cluster extracted from
// NowBriefingPage. Self-contained presentational layout + render logic for the
// ServiceBubbleCard — the jittered-grid scatter pack, collision relaxation,
// Apple-Watch springboard hover, pill-style gauge rings, shrink-to-fit text,
// and the per-bubble forecast trend. Behaviour-preserving move; the page imports
// ServiceBubbleCard back and owns all the data wiring.
import React from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { synthTrend } from './servicing-data.js';
import { SERVICING_GROUP_DOMAINS, SERVICING_DOMAINS, SERVICING_DOMAIN_META, topDomainOf } from './servicing-areas.js';
import { useSL } from './servicing-i18n.js';
import { HypervisorPage } from './Hypervisor.jsx';

// Bubble-map attention palette. Adherence still drives colour, but HEALTHY work
// recedes to a muted slate (not green) so the red/amber problems are the only
// thing that shouts — the card is "what needs attention", so calm should be
// quiet. risk = red, watch = amber, calm = slate.
const BUBBLE_RISK = '#ef4444',
  BUBBLE_WATCH = '#f59e0b',
  BUBBLE_CALM = '#94a3b8';
// Banded against the 90% SLA adherence target (not absolute %): at/above target
// is on-track (calm slate); within 5pts below is a watch (amber); more than 5pts
// below target is genuinely at risk (red). Anchored this way so red actually
// fires on the laggards — real adherence sits ~80-95%, so a fixed 75% red never
// triggered and amber ended up labelling everything.
const SLA_TARGET = 90;
// Adherence is the headline metric, so the outer ring is binary against the SLA
// target: at/above target = respected (calm), the moment it drops below = breached
// (red). No amber middle band — a breach is a breach.
function riskTone(adh) {
  if (adh == null) return 'calm';
  return adh < SLA_TARGET ? 'risk' : 'calm';
}
function riskColor(adh) {
  const tn = riskTone(adh);
  return tn === 'risk' ? BUBBLE_RISK : tn === 'watch' ? BUBBLE_WATCH : BUBBLE_CALM;
}

// ─── Priority bubble map (experimental) ──────────────────────────────
// Flat, white-background bubbles that MIX every signal (service areas +
// business + forecast) onto one importance scale: bubble size = how much work
// it carries, colour = health. Distributed across the WHOLE card via a
// jittered grid (biggest toward the centre), then collision-relaxed.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Seed positions on a jittered grid spanning the full W×H so the cloud fills
// the card (no central clump). Biggest items go to the most-central cells.
function scatterPack(items, W, H) {
  const sorted = [...items].sort((a, b) => b.r - a.r);
  const n = sorted.length || 1;
  const cols = Math.max(1, Math.round(Math.sqrt(n * (W / H))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cw = W / cols,
    ch = H / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: (c + 0.5) * cw, y: (r + 0.5) * ch });
  cells.sort((a, b) => Math.hypot(a.x - W / 2, a.y - H / 2) - Math.hypot(b.x - W / 2, b.y - H / 2));
  return sorted.map((it, i) => {
    const cell = cells[i] || { x: W / 2, y: H / 2 };
    const j = hashStr(String(it.id));
    const jx = ((j & 255) / 255 - 0.5) * cw * 0.35;
    const jy = (((j >> 8) & 255) / 255 - 0.5) * ch * 0.35;
    const px = it.r + BUBBLE_EDGE_PAD;
    return {
      ...it,
      x: Math.max(px, Math.min(W - px, cell.x + jx)),
      y: Math.max(px, Math.min(H - px, cell.y + jy)),
    };
  });
}

// Apple-Watch springboard layout: from the fixed (non-overlapping) base, grow +
// pin the hovered bubble and collision-resolve everything else so neighbours
// slide aside. The hovered bubble is held fixed at its grown radius (neighbours
// always yield to it); a final pure-separation pass runs after the loop so the
// returned layout is GUARANTEED overlap-free. Deterministic per hovered id.
function springboard(packed, posById, hovId, hovR, W, H, gap = 6, iters = 140) {
  const pos = packed.map((p) => {
    const base = posById[p.id] || p;
    // Hovered bubble grows to a FIXED radius (hovR) — same for every bubble, so
    // any bubble reads at one uniform large size on hover (never shrinks a bubble
    // already bigger than hovR). Neighbours collision-resolve out of its way.
    return { id: p.id, x: base.x, y: base.y, r: p.id === hovId ? Math.max(p.r, hovR) : p.r, fixed: p.id === hovId };
  });
  const collide = () => {
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i],
          b = pos[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r + gap;
        if (d < min) {
          const o = min - d,
            ux = dx / d,
            uy = dy / d;
          if (a.fixed) {
            b.x += ux * o;
            b.y += uy * o;
          } else if (b.fixed) {
            a.x -= ux * o;
            a.y -= uy * o;
          } else {
            a.x -= (ux * o) / 2;
            a.y -= (uy * o) / 2;
            b.x += (ux * o) / 2;
            b.y += (uy * o) / 2;
          }
        }
      }
    }
  };
  for (let it = 0; it < iters; it++) {
    collide();
    for (const p of pos) {
      if (p.fixed) continue;
      const px = p.r + BUBBLE_EDGE_PAD;
      p.x = Math.max(px, Math.min(W - px, p.x));
      p.y = Math.max(px, Math.min(H - px, p.y));
    }
  }
  collide();
  // Clamp EVERY bubble — including the grown, hovered one — so a hovered bubble
  // near an edge stays inside the card; then resolve neighbours around its
  // contained position and clamp them too.
  for (const p of pos) {
    const px = p.r + BUBBLE_EDGE_PAD;
    p.x = Math.max(px, Math.min(W - px, p.x));
    p.y = Math.max(px, Math.min(H - px, p.y));
  }
  collide();
  for (const p of pos) {
    if (p.fixed) continue;
    const px = p.r + BUBBLE_EDGE_PAD;
    p.x = Math.max(px, Math.min(W - px, p.x));
    p.y = Math.max(px, Math.min(H - px, p.y));
  }
  const map = {};
  for (const p of pos) map[p.id] = { x: p.x, y: p.y, r: p.r };
  return map;
}

// Collision relaxation: nudge bubbles apart until none overlap. The hovered
// bubble is held fixed at its grown radius so neighbours slide out of its way;
// guarantees no overlap in any state (base or hover). Positions only — the
// hovered bubble's visual grow is done via width so its text stays sized.
function relaxBubbles(packed, W, H, gap = 6, iters = 240, gx = 0.01, gy = 0.045) {
  const cx = W / 2,
    cy = H / 2;
  const pos = packed.map((p) => ({ id: p.id, x: p.x, y: p.y, r: p.r }));
  for (let it = 0; it < iters; it++) {
    // Gentle gravity pulls bubbles into an organic cluster, but it TAPERS to 0
    // over the run (g → 0) so the final iterations are pure collision separation.
    // That, plus several collision sub-passes per step, guarantees the result is
    // overlap-free whenever the canvas has room (×1.5 radii leave plenty).
    const g = 1 - it / iters;
    for (const p of pos) {
      p.x += (cx - p.x) * gx * g;
      p.y += (cy - p.y) * gy * g;
    }
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const a = pos[i],
            b = pos[j];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const min = a.r + b.r + gap;
          if (d < min) {
            const o = (min - d) / 2,
              ux = dx / d,
              uy = dy / d;
            a.x -= ux * o;
            a.y -= uy * o;
            b.x += ux * o;
            b.y += uy * o;
          }
        }
      }
    }
    for (const p of pos) {
      const px = p.r + BUBBLE_EDGE_PAD;
      p.x = Math.max(px, Math.min(W - px, p.x));
      p.y = Math.max(px, Math.min(H - px, p.y));
    }
  }
  // Final passes: separate, then RE-CLAMP each pass so the layout converges to
  // both contained AND overlap-free (clamping after separation, not before, is
  // what keeps an edge bubble from drifting out of the card top/bottom).
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i],
          b = pos[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r + gap;
        if (d < min) {
          const o = (min - d) / 2,
            ux = dx / d,
            uy = dy / d;
          a.x -= ux * o;
          a.y -= uy * o;
          b.x += ux * o;
          b.y += uy * o;
        }
      }
    }
    for (const p of pos) {
      const px = p.r + BUBBLE_EDGE_PAD;
      p.x = Math.max(px, Math.min(W - px, p.x));
      p.y = Math.max(px, Math.min(H - px, p.y));
    }
  }
  const map = {};
  for (const p of pos) map[p.id] = p;
  return map;
}

// Project adherence ~2 steps ahead from the slope of the last few points.
function projectAdh(series, current) {
  if (!series || series.length < 3) return current;
  const recent = series.slice(-4);
  const slope = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  return Math.max(40, Math.min(100, Math.round(current + slope * 2)));
}

// Bubble face: two concentric ring gauges (Apple-Watch style). Outer arc =
// adherence %, inner arc = overdue/breach-risk load — each coloured by its own
// band. Business bubbles (no gauge) draw one solid accent ring; forecast bubbles
// draw one dashed ring. Drawn in a 0-100 viewBox so the rings scale with the
// bubble. Sits behind the centred label/% text.
// Opaque light fill (mixed with the surface) so it covers the border stroke
// underneath, leaving the solid colour visible only as a thin edge on each side
// of the band — the app's pill look (thin colour edge + light inner fill).
const softFill = (c, pct) => `color-mix(in oklch, ${c} ${pct}%, var(--surface))`;
// Ring geometry. Radii are in the 0–100 viewBox so they SCALE with the bubble —
// the ring always hugs the edge. Stroke + band WIDTHS are in PIXELS, held
// constant at any bubble size and any hover-magnification via
// vector-effect:non-scaling-stroke (the stroke ignores the viewBox→viewport
// scale), so the tiny bubbles and the giant hero carry the exact same thin ring.
const RING_R_OUT = 46;
const RING_R_IN = 40;
const RING_FILL_R = 37; // centre-fill radius (scales): the soft disc behind the text
const RING_BW_OUT = 4.5; // px — outer band width (inner-edge → outer-edge), constant
const RING_BW_IN = 4.5; // px — inner gauge band width, constant
const RING_EDGE = 1; // px — the visible coloured stroke on each side of a band
const RING_GAP_PX = 3; // px — constant gap between the outer and inner ring bands
const DISK_GAP_PX = 4; // px — constant gap between the innermost ring and the centre disc
// px distance between the two ring CENTRES = half each band + the gap.
const RING_GAP_CENTER_PX = RING_BW_OUT / 2 + RING_GAP_PX + RING_BW_IN / 2;

// Breathing room (viewBox units) kept between every bubble's edge and the canvas
// boundary, so the cloud sits fully INSIDE the card instead of kissing — or
// spilling past — its top/bottom edge. Applied on top of the per-bubble radius
// in every clamp (pack / relax / hover springboard).
const BUBBLE_EDGE_PAD = 10;

// Arc path for `frac` of a circle, from 12 o'clock clockwise. A REAL path (not a
// strokeDasharray trick) so non-scaling-stroke fixes the px width without
// mangling the arc length the way it would a dash pattern.
function arcPath(r, frac) {
  const f = Math.max(0, Math.min(0.9999, frac));
  const a0 = -Math.PI / 2;
  const a1 = a0 + f * 2 * Math.PI;
  const x0 = 50 + r * Math.cos(a0),
    y0 = 50 + r * Math.sin(a0);
  const x1 = 50 + r * Math.cos(a1),
    y1 = 50 + r * Math.sin(a1);
  return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

// One pill-style band: a `bw`-px colour stroke under a (bw − 2·edge)-px soft-fill
// stroke, leaving an `edge`-px coloured line each side. ALL widths are px
// (non-scaling-stroke) → never change with bubble size or magnification. frac<1 →
// a partial arc (gauge); dashed → a full dashed ring (forecast); frac≈1 → a full ring.
function band(r, bw, edge, frac, borderCol, fillCol, dashed, k) {
  if (!dashed && frac <= 0.001) return [];
  const sw2 = Math.max(0.1, bw - 2 * edge);
  const full = dashed || frac >= 0.9999;
  const mk = (suffix, stroke, width) =>
    full ? (
      <circle
        key={`${k}${suffix}`}
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap={dashed ? 'butt' : 'round'}
        strokeDasharray={dashed ? '4 4' : undefined}
        vectorEffect="non-scaling-stroke"
      />
    ) : (
      <path
        key={`${k}${suffix}`}
        d={arcPath(r, frac)}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    );
  return [mk('b', borderCol, bw), mk('f', fillCol, sw2)];
}
function BubbleRings({ b, fill, innerR = RING_R_IN, fillR = RING_FILL_R }) {
  const ringStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    overflow: 'visible',
  };
  const center = fill && fill !== 'transparent' ? <circle cx="50" cy="50" r={fillR} fill={fill} /> : null;
  if (b.gauge) {
    const adhFrac = Math.max(0, Math.min(100, b.adhPct ?? 0)) / 100;
    const riskFrac = Math.max(0, Math.min(1, b.riskFrac ?? 0));
    return (
      <svg viewBox="0 0 100 100" style={ringStyle} aria-hidden="true">
        {center}
        {band(RING_R_OUT, RING_BW_OUT, RING_EDGE, adhFrac, b.color, softFill(b.color, 16), false, 'ov')}
        {band(innerR, RING_BW_IN, RING_EDGE, riskFrac, b.riskCol, softFill(b.riskCol, 16), false, 'iv')}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" style={ringStyle} aria-hidden="true">
      {center}
      {band(RING_R_OUT, RING_BW_OUT, RING_EDGE, 1, b.color, softFill(b.color, 16), b.dashed, 'sv')}
    </svg>
  );
}

// Shrink-to-fit text inside a bubble. The label/value fonts are sized from the
// bubble's SIZE, which ignores how LONG a given label is — so a wrapping label
// ("Workspaces & Desks", or any longer French label) used to bleed past the
// inner ring. This measures the rendered text against a box INSCRIBED in the
// centre fill disc (RING_FILL_R=37 of the 100-unit bubble → a 52% square) and
// applies a uniform transform:scale(≤1), so the text can NEVER cross the ring —
// in any state, at any bubble size, in any locale. Scale-down only (never up),
// so short labels keep their size-proportional look; only the offenders shrink.
// Re-fits on content/state change (fitKey) and when the bubble resizes (RO).
function BubbleText({ fitKey, children, boxPct = 52 }) {
  const boxRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const fit = React.useCallback(() => {
    const box = boxRef.current,
      inner = innerRef.current;
    if (!box || !inner) return;
    const cw = box.clientWidth,
      ch = box.clientHeight;
    if (!cw || !ch) return;
    // Transforms don't affect layout metrics, so a stale scale() can't corrupt
    // this. needW = the block's MIN-CONTENT width (its widest unbreakable token —
    // e.g. "Maintenance"); measuring this way sidesteps flex/centred-overflow
    // quirks where a long word's overflow never reaches inner.scrollWidth.
    // needH = the wrapped height at the real box width. Scaling by the min of
    // both ratios guarantees the FULL text fits in BOTH axes — never clipped,
    // never cut mid-word, never ellipsised.
    inner.style.width = 'min-content';
    const needW = inner.scrollWidth;
    inner.style.width = '100%';
    const needH = inner.scrollHeight;
    if (!needW || !needH) return;
    // SAFETY = a little breathing room so text never kisses the box edge.
    const SAFETY = 0.94;
    inner.style.transform = `scale(${Math.min(1, (cw / needW) * SAFETY, (ch / needH) * SAFETY)})`;
  }, []);
  React.useLayoutEffect(() => {
    fit();
  }, [fit, fitKey]);
  React.useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(box);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [fit]);
  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative',
        zIndex: 1,
        width: `${boxPct}%`,
        height: `${boxPct}%`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        ref={innerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Trend direction from a short adherence series (last point vs 3 back).
function trendDirOf(s) {
  if (!Array.isArray(s) || s.length < 3) return 'flat';
  const d = s[s.length - 1] - s[s.length - 3];
  return d > 1.5 ? 'up' : d < -1.5 ? 'down' : 'flat';
}

// Merlin's one-line read of a bubble — a short FACTUAL state cue, surfaced only
// where it adds signal (pressing / slipping lines). Calm-and-steady returns null
// so healthy bubbles stay minimal. Business + forecast bubbles reuse their hint.
// Note: deliberately NO canned action ("dispatch a crew") — every risk bubble
// read identically and it added no signal (JB, 2026-06-17). The bubble states
// the situation; the action lives in chat where it's grounded + one-tap.
function bubbleInsight(b, sl) {
  if (b.tone === 'biz' || b.dashed) return b.extra || null;
  const od = b.overdue || 0;
  const slip = b.trendDir === 'down';
  if (b.tone === 'risk') {
    return od > 0
      ? sl(`${od} overdue${slip ? ', slipping' : ''}`, `${od} en retard${slip ? ', en baisse' : ''}`)
      : sl(`below target${slip ? ', slipping' : ''}`, `sous l’objectif${slip ? ', en baisse' : ''}`);
  }
  if (b.tone === 'watch') {
    return od > 0
      ? sl(`${od} overdue · keep an eye`, `${od} en retard · à surveiller`)
      : slip
        ? sl('easing — keep an eye', 'en recul — à surveiller')
        : null;
  }
  return slip ? sl('holding — watch the trend', 'stable — surveiller la tendance') : null;
}

// Forecast trend indicator: where the line is HEADED, not a graph of the past.
// An arrow + the projected next-shift value, coloured by whether the forecast is
// improving (ok), slipping (risk) or holding (dim) — independent of the bubble's
// current health, so a below-target line that's recovering reads as a green ↗.
function ForecastTrend({ trend, current, fs, horizon }) {
  if (!Array.isArray(trend) || trend.length < 3 || current == null || Number.isNaN(current)) return null;
  const proj = projectAdh(trend, current);
  const delta = proj - current;
  const dir = delta >= 1 ? 'up' : delta <= -1 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '↗' : dir === 'down' ? '↘' : '→';
  const col = dir === 'up' ? 'var(--ok)' : dir === 'down' ? 'var(--risk)' : 'var(--text-dim)';
  return (
    <span style={{ fontSize: fs, fontWeight: 600, color: col, marginTop: '0.3em', whiteSpace: 'nowrap' }}>
      {arrow} {proj}%{horizon ? <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}> {horizon}</span> : null}
    </span>
  );
}

export function ServiceBubbleCard({
  rows = [],
  byTop,
  pendingCount,
  proposals = 0,
  contracts = 0,
  history = {},
  big = false,
  onToggleFocus,
  onOpen,
  onOpenServiceLine,
  onOpenChat,
  building,
  incidents,
}) {
  const sl = useSL();
  const t = useT();
  // In-card view switch: the bubble cloud, or the live 3D Hypervisor of the same
  // building (full interactive viewer). hyperMode mirrors the standalone
  // Hypervisor's viewer-mode (shared via localStorage) so the two stay in sync.
  const [view, setView] = React.useState('bubbles');
  // Full parity with the standalone Hypervisor's mode bar (Operations.jsx) — the
  // card embeds the SAME HypervisorPage, so every viewer mode it offers is
  // reachable here too: Servicing (service-line health), Agents (agent activity),
  // Merlin (CTAs to action), SLAs (breach picker), Sensing (sensor heatmap +
  // metric picker), Assets (tracked-asset coverage). Default Servicing. The
  // stored mode is shared with the standalone viewer via localStorage.
  const CARD_HYPER_MODES = [
    { id: 'servicing', label: 'SERVICING' },
    { id: 'agents', label: 'AGENTS' },
    { id: 'merlin', label: 'MERLIN' },
    { id: 'slas', label: 'SLAs' },
    { id: 'sensing', label: 'SENSING' },
    { id: 'assets', label: 'ASSETS' },
  ];
  const [hyperMode, setHyperModeRaw] = React.useState(() => {
    try {
      const m = localStorage.getItem('hyperViewerMode');
      return CARD_HYPER_MODES.some((x) => x.id === m) ? m : 'servicing';
    } catch {
      return 'servicing';
    }
  });
  const setHyperMode = (m) => {
    setHyperModeRaw(m);
    try {
      localStorage.setItem('hyperViewerMode', m);
    } catch {
      /* ignore */
    }
  };
  const lbl = (k) => {
    const m = SERVICING_DOMAIN_META[k];
    const v = t(m?.labelKey);
    return v && v !== m?.labelKey ? v : m?.fallback;
  };
  // Focus mode: the virtual canvas aspect TRACKS the measured card aspect so the
  // cloud fills the whole surface (no letterboxing) instead of fitting one axis
  // and leaving margins. H is derived from the container's w/h, clamped to a band
  // that stays overlap-free (verified to ~aspect 2.3 / 54% fill). Bigger radii +
  // weak gravity spread the cloud across it.
  const plotWrapRef = React.useRef(null);
  const [containerSize, setContainerSize] = React.useState(null);
  // The plot's rendered px width — lets us convert a fixed-px ring gap into the
  // viewBox radius per bubble, so the gap between the two rings is a constant
  // ~3px at any bubble size (the radii alone are viewBox units, which scale).
  const plotRef = React.useRef(null);
  const [plotW, setPlotW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setPlotW((p) => (p === w ? p : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [big]);
  const W = 1720;
  const H = big
    ? containerSize
      ? Math.max(820, Math.min(1300, Math.round((W * containerSize.ch) / containerSize.cw)))
      : 1200
    : 400;
  const rScale = big ? 2.1 : 1;

  // Sub-domain (area) labels from the servicing config.
  const areaLabel = {};
  for (const top of SERVICING_GROUP_DOMAINS) {
    for (const a of SERVICING_DOMAINS[top]?.areas || []) {
      if (a.domain) {
        const v = t(a.labelKey);
        areaLabel[a.domain] = v && v !== a.labelKey ? v : a.fallback;
      }
    }
  }
  const prettyArea = (d) => {
    if (areaLabel[d]) return areaLabel[d];
    const m = SERVICING_DOMAIN_META[d];
    if (m) {
      const v = t(m.labelKey);
      return v && v !== m.labelKey ? v : m.fallback;
    }
    const parts = String(d || '').split('_');
    return (parts.slice(1).join(' ') || parts[0] || String(d || '')).replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const items = [];
  // (1) Per-area bubbles — one per service sub-domain (real rollup rows), sized
  //     by work volume, coloured by health. The dense layer; keep the busiest 12.
  const areaItems = [];
  // One forecast per live gauge, reused by the dashed forecast bubble below so a
  // line's two forecast representations (gauge arrow + forecast bubble) can never
  // disagree — they were drifting because each projected from a different input.
  const gaugeProj = {};
  for (const r of rows || []) {
    const top = topDomainOf(r.domain);
    if (!SERVICING_GROUP_DOMAINS.includes(top)) continue;
    const adh = Math.round(r.adherence_pct ?? 0);
    // Inner-ring risk = overdue/open backlog pressure, saturating (10+ weighted
    // items = a full ring). Coloured red/amber/slate by how heavy the load is —
    // independent of adherence, so a backlog shows even when adherence looks OK.
    const riskLoad = (r.overdue_now || 0) + 0.5 * (r.open_now || 0);
    const riskFrac = Math.min(1, riskLoad / 10);
    const riskCol = riskFrac >= 0.5 ? BUBBLE_RISK : riskFrac >= 0.2 ? BUBBLE_WATCH : BUBBLE_CALM;
    // Per-area trend: prefer the parent line's real history, else a synthesized
    // series anchored on this area's adherence. Feeds the in-bubble sparkline +
    // the "slipping" cue in the insight line.
    const aTrend = history[top] && history[top].length >= 2 ? history[top] : synthTrend(r.domain, adh, 8);
    // If this row is a top-level line (not a sub-area), stash its forecast so the
    // dashed forecast bubble can reuse the exact value the gauge's arrow shows.
    if (SERVICING_GROUP_DOMAINS.includes(r.domain))
      gaugeProj[r.domain] = { proj: projectAdh(aTrend, adh), series: aTrend };
    areaItems.push({
      id: `area-${r.domain}`,
      label: prettyArea(r.domain),
      value: `${adh}%`,
      sub: (r.overdue_now || 0) > 0 ? `${r.overdue_now} ${sl('overdue', 'en retard')}` : sl('on track', 'à jour'),
      weight: (r.items_total || 0) * 0.25 + ((r.overdue_now || 0) + (r.open_now || 0)) * 9 || 1,
      color: riskColor(adh),
      tone: riskTone(adh),
      gauge: true,
      adhPct: adh,
      riskFrac,
      riskCol,
      overdue: r.overdue_now || 0,
      trend: aTrend,
      trendDir: trendDirOf(aTrend),
      extra: `${r.open_now || 0} ${sl('open', 'ouv.')} · ${r.items_total || 0} ${sl('items', 'éléments')}`,
    });
  }
  areaItems.sort((a, b) => b.weight - a.weight);
  // Keep fewer, bigger bubbles in focus mode so labels are readable; the dropped
  // tail is the smallest (idle, on-track) areas, which carry the least signal.
  items.push(...areaItems.slice(0, big ? 20 : 30));

  // (2) Business bubbles — not service health, so they keep their own accent
  //     colours; tone 'biz' gives them a faint always-on fill to read as action.
  if (pendingCount > 0)
    items.push({
      id: 'decisions',
      label: sl('Decisions', 'Décisions'),
      value: String(pendingCount),
      sub: sl('to approve', 'à valider'),
      weight: pendingCount * 4,
      color: '#6d5efc',
      tone: 'biz',
      extra: sl('Tap to review the queue', 'Voir la file'),
    });
  if (proposals > 0)
    items.push({
      id: 'proposals',
      label: sl('Proposals', 'Propositions'),
      value: String(proposals),
      sub: sl('awaiting client', 'attente client'),
      weight: proposals * 4,
      color: '#0ea5e9',
      tone: 'biz',
      extra: sl('client decision pending', 'décision client en attente'),
    });
  if (contracts > 0)
    items.push({
      id: 'contracts',
      label: sl('Contracts', 'Contrats'),
      value: String(contracts),
      sub: sl('active', 'actifs'),
      weight: Math.max(3, contracts * 2),
      color: '#14b8a6',
      tone: 'biz',
      extra: sl('across your clients', 'chez vos clients'),
    });

  // (3) Forecast per line (dashed) — projected adherence from each line's trend.
  for (const k of SERVICING_GROUP_DOMAINS) {
    const s = byTop[k];
    if (!s || s.adh == null) continue;
    // Reuse the live gauge's own forecast for this line when it has one, so this
    // dashed bubble and the gauge's ↗/↘ arrow always show the same number.
    const g = gaugeProj[k];
    const series = g ? g.series : history[k] && history[k].length >= 2 ? history[k] : synthTrend(k, s.adh, 8);
    const proj = g ? g.proj : projectAdh(series, s.adh);
    items.push({
      id: `fc-${k}`,
      label: lbl(k),
      value: `${proj}%`,
      sub: sl('forecast · next hour', 'prévision · prochaine heure'),
      weight: Math.max(3, ((s.overdue || 0) + (s.open || 0)) * 0.5),
      color: riskColor(proj),
      tone: riskTone(proj),
      dashed: true,
      trend: series,
      trendDir: trendDirOf(series),
      extra: sl('projected next hour', 'projection prochaine heure'),
    });
  }

  const [hovered, setHovered] = React.useState(null);

  // Subtle "this just changed" pulse: between data refreshes (the per-minute
  // replay drift), a bubble's displayed info (value / overdue) can change — and
  // the cloud re-packs. Glow-blink the bubbles whose info actually changed so the
  // eye catches what moved (not just the rearrange). First load doesn't flash.
  const sigAll = items.map((i) => `${i.id}=${i.value}/${i.sub || ''}`).join('|');
  const prevSigRef = React.useRef(null);
  const [flash, setFlash] = React.useState({});
  React.useEffect(() => {
    const cur = {};
    for (const i of items) cur[i.id] = `${i.value}/${i.sub || ''}`;
    const prev = prevSigRef.current;
    prevSigRef.current = cur;
    if (!prev) return undefined;
    const changed = Object.keys(cur).filter((id) => prev[id] !== undefined && prev[id] !== cur[id]);
    if (!changed.length) return undefined;
    setFlash((f) => {
      const n = { ...f };
      for (const id of changed) n[id] = (n[id] || 0) + 1;
      return n;
    });
    const t = setTimeout(
      () =>
        setFlash((f) => {
          const n = { ...f };
          for (const id of changed) delete n[id];
          return n;
        }),
      3800,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigAll]);

  // Fixed radius every hovered bubble grows to (≥ the largest base radius, so
  // nothing shrinks) → all bubbles read at one uniform large size on hover, with
  // room for the full label + % + overdue + detail.
  const HOVER_R = big ? 175 : 80;
  const hoverPct = ((2 * HOVER_R) / W) * 100;

  // Layout is computed ONCE per data change (memoised on a cheap signature), NOT
  // on hover — so hovering only grows a bubble visually and never reshuffles the
  // cloud (that reshuffle was the "shaking"). Gravity tapers to zero across the
  // run so the final passes are pure collision separation → no overlap.
  const geomSig = items.map((i) => `${i.id}:${i.weight.toFixed(2)}:${i.value}:${i.dashed ? 1 : 0}`).join('|');
  const { packed, posById } = React.useMemo(() => {
    const maxW = Math.max(1, ...items.map((i) => i.weight));
    const withR = items.map((i) => ({ ...i, r: (22 + 54 * Math.sqrt(i.weight / maxW)) * rScale }));
    const packed = scatterPack(withR, W, H);
    const posById = big
      ? relaxBubbles(packed, W, H, 10, 460, 0.003, 0.008)
      : relaxBubbles(packed, W, H, 6, 240, 0.01, 0.045);
    return { packed, posById };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomSig, rScale, big, W, H]);

  // Apple-Watch springboard: the base layout stays fixed; when a bubble is
  // hovered we grow + pin it and run COLLISION-resolution off the base so every
  // other bubble slides clear — and it ends on a pure separation pass, so the
  // result is guaranteed overlap-free (not just clear of the hovered bubble).
  // Stays local (base never reshuffles → no jitter) and is deterministic per
  // hovered id → smooth, reversible transitions.
  const displaced = React.useMemo(
    () => (hovered ? springboard(packed, posById, hovered, HOVER_R, W, H, big ? 10 : 6) : posById),
    [hovered, packed, posById, big, W, H, HOVER_R],
  );

  // Measure the available area (the flex wrapper) so H can track its aspect and
  // the plot can be sized in px to fill it. Independent of the plot content, so no
  // feedback loop. (Pure-CSS aspect sizing collapses to 0 inside a container-type
  // flex parent, hence the measurement.)
  React.useLayoutEffect(() => {
    if (!big) {
      setContainerSize(null);
      return undefined;
    }
    const el = plotWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const cw = el.clientWidth,
        ch = el.clientHeight;
      if (cw > 0 && ch > 0) setContainerSize((s) => (s && s.cw === cw && s.ch === ch ? s : { cw, ch }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [big]);
  // The plot fills the wrapper: with H tracking the wrapper aspect, the largest
  // aspect-W/H box that fits ≈ the whole wrapper (letterboxes only when H clamps).
  const plotPx =
    big && containerSize
      ? (() => {
          const AR = W / H,
            { cw, ch } = containerSize;
          const [w, h] = cw / ch > AR ? [ch * AR, ch] : [cw, cw / AR];
          return { w: Math.round(w), h: Math.round(h) };
        })()
      : null;

  // Clicking a bubble asks Merlin about that exact item (auto-sent) instead of
  // jumping to Services — turns the cloud into a launchpad for the chat. The
  // question carries building peer-context (so Merlin ranks this item against the
  // real picture instead of over-claiming) and asks for a recommendation first.
  const askMerlin = (bb) => {
    if (!onOpenChat) {
      onOpen?.();
      return;
    }
    const areas = (rows || []).filter((r) => SERVICING_GROUP_DOMAINS.includes(topDomainOf(r.domain)));
    const breached = areas.filter((r) => Math.round(r.adherence_pct ?? 0) < SLA_TARGET).length;
    const totOverdue = areas.reduce((s, r) => s + (r.overdue_now || 0), 0);
    const ctx = sl(
      `For context, across the building ${breached} of ${areas.length} service areas are below the ${SLA_TARGET}% SLA target and ${totOverdue} items are overdue in all.`,
      `Pour contexte, dans le bâtiment ${breached} des ${areas.length} zones de service sont sous l'objectif SLA de ${SLA_TARGET}% et ${totOverdue} éléments sont en retard au total.`,
    );
    // Decisions bubble → drop the live, actionable decisions list inline in chat
    // (Approve / Hold each) instead of asking a text question.
    if (bb.id === 'decisions') {
      onOpenChat(null, { decisions: true });
      return;
    }
    const lead = sl(
      "Diagnose the likely cause from the data and lead with your recommendation — don't ask me what the bottleneck is, tell me. Only ask if you need a decision from me.",
      "Diagnostique la cause probable à partir des données et commence par ta recommandation — ne me demande pas quel est le problème, dis-le-moi. Ne me pose une question que si tu as besoin d'une décision de ma part.",
    );
    // Forecast phrase — mirrors the bubble's trend indicator (same projectAdh) and
    // asks Merlin to JUSTIFY the projected direction, so the chat explains WHY it's
    // forecasting an increase/decrease rather than just restating the number.
    let fc = '';
    if (!bb.dashed && Array.isArray(bb.trend) && bb.trend.length >= 3 && bb.adhPct != null) {
      const proj = projectAdh(bb.trend, bb.adhPct);
      const d = proj - bb.adhPct;
      if (d >= 1)
        fc = sl(
          ` I'm forecasting it to rise to ~${proj}% next hour — explain what's driving that improvement.`,
          ` Je prévois une hausse à ~${proj}% à la prochaine heure — explique ce qui porte cette amélioration.`,
        );
      else if (d <= -1)
        fc = sl(
          ` I'm forecasting it to slip to ~${proj}% next hour — explain what's driving that decline.`,
          ` Je prévois un recul à ~${proj}% à la prochaine heure — explique ce qui le provoque.`,
        );
      else
        fc = sl(
          ` I'm forecasting it to hold near ${proj}% next hour — say what would tip it up or down.`,
          ` Je prévois une stabilité autour de ${proj}% à la prochaine heure — dis ce qui pourrait le faire basculer.`,
        );
    }
    let q;
    if (bb.id === 'proposals')
      q = sl(
        `What's the status of my ${bb.value} pending proposals, and what should I do? ${lead}`,
        `Où en sont mes ${bb.value} propositions en attente, et que dois-je faire ? ${lead}`,
      );
    else if (bb.id === 'contracts')
      q = sl(
        `Give me a quick health check across my ${bb.value} active contracts. ${lead}`,
        `Fais-moi un point rapide sur mes ${bb.value} contrats actifs. ${lead}`,
      );
    else if (bb.dashed)
      q = sl(
        `${bb.label} is forecast at ${bb.value} next hour. ${ctx} What's driving that? ${lead}`,
        `${bb.label} est prévu à ${bb.value} à la prochaine heure. ${ctx} Qu'est-ce qui l'explique ? ${lead}`,
      );
    else
      q = sl(
        `How is ${bb.label} doing? It's at ${bb.value} SLA adherence${bb.sub ? `, ${bb.sub}` : ''}.${fc} ${ctx} ${lead}`,
        `Comment se porte ${bb.label} ? Conformité SLA à ${bb.value}${bb.sub ? `, ${bb.sub}` : ''}.${fc} ${ctx} ${lead}`,
      );
    onOpenChat(q, { send: true });
  };

  return (
    <Card
      pad
      style={{
        padding: 12,
        ...(big ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } : {}),
      }}
    >
      {/* Soft "this changed" glow-blink — two slow swells of a colour halo. */}
      <style>{`@keyframes bubbleChanged { 0%,100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); } 45% { box-shadow: 0 0 13px 2px var(--bubble-glow); } }`}</style>
      {/* Gradient band — mirrors the Hypervisor's sub-nav band so the bubble and
          Hypervisor views read as one coherent surface. Hosts the PRIORITIES label,
          the Bubbles/Hypervisor view switch, and (in Hypervisor view) the
          viewer-mode toggle. Replaces the old title + legend (just PRIORITIES now). */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          minHeight: 40,
          padding: '4px 12px',
          marginBottom: 10,
          borderRadius: 10,
          background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-indigo))',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {sl('PRIORITIES', 'PRIORITÉS')}
        </span>
        {/* Bubbles | Hypervisor view switch */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            background: 'rgba(255,255,255,0.95)',
            padding: 2,
            borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.6)',
            flexShrink: 0,
          }}
        >
          {[
            { id: 'bubbles', label: sl('Bubbles', 'Bulles') },
            { id: 'hypervisor', label: sl('Hypervisor', 'Hyperviseur') },
          ].map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.03em',
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        {/* Hypervisor viewer-mode toggle — only in Hypervisor view */}
        {view === 'hypervisor' && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              background: 'rgba(255,255,255,0.95)',
              padding: 2,
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.6)',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {CARD_HYPER_MODES.map((s) => {
              const active = hyperMode === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setHyperMode(s.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '0.04em',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {onToggleFocus && (
          <button
            onClick={onToggleFocus}
            title={
              big
                ? sl('Show the other cards', 'Afficher les autres cartes')
                : sl('Focus on priorities', 'Se concentrer sur les priorités')
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.16)',
              padding: '5px 12px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.4)',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            {big ? (
              <>
                <Icon.grid size={13} /> {sl('Show all cards', 'Tout afficher')}
              </>
            ) : (
              <>
                <Icon.panel size={13} /> {sl('Focus', 'Focus')}
              </>
            )}
          </button>
        )}
        <button
          onClick={onOpen}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {sl('Open Services →', 'Ouvrir Services →')}
        </button>
      </div>
      {view === 'hypervisor' ? (
        <div
          style={{
            ...(big ? { flex: 1, minHeight: 0 } : { height: 480 }),
            minWidth: 0,
            display: 'flex',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          <HypervisorPage
            building={building}
            incidents={incidents}
            onOpenChat={onOpenChat}
            onOpenServiceLine={onOpenServiceLine}
            view3d
            viewerMode={hyperMode}
            onViewerModeChange={setHyperMode}
          />
        </div>
      ) : (
        <div
          ref={plotWrapRef}
          style={big ? { flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' } : {}}
        >
          <div
            ref={plotRef}
            style={{
              containerType: 'inline-size',
              // Focus mode: the plot is taken OUT OF FLOW (absolute, centred) so its
              // explicit px size can NEVER feed back into the wrapper's intrinsic width/
              // height. In flow, the wide plot props the whole column open: the layout
              // then only ever grows on resize and never shrinks back (the measurement
              // ratchet), and the overflow shoves the docked Merlin chat off-screen.
              // Out of flow, the wrapper is sized purely by flex (available space),
              // measured cleanly, and plotPx is recomputed to fit on every resize (any
              // brief overshoot is just clipped by the wrapper, never distorted).
              // Non-focus: plain in-flow width-driven aspect box.
              ...(big
                ? {
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    ...(plotPx ? { width: plotPx.w, height: plotPx.h } : { width: '100%', aspectRatio: `${W} / ${H}` }),
                  }
                : { position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, overflow: 'hidden' }),
            }}
          >
            {packed.map((b) => {
              const isHov = hovered === b.id;
              const p = displaced[b.id] || posById[b.id] || b;
              const baseSize = ((2 * b.r) / W) * 100; // % of wrapper width
              const size = isHov ? hoverPct : baseSize; // hover → one uniform big size
              // Inner-ring radius (viewBox units) for a CONSTANT ~3px gap to the outer
              // ring: convert the fixed px centre-distance through this bubble's actual
              // rendered diameter. Uses `size` (incl. hover) so the gap holds when
              // magnified too. Falls back to the static radius before the plot measures.
              const diaPx = plotW > 0 ? (size / 100) * plotW : 0;
              const innerRvb =
                diaPx > 0
                  ? Math.max(24, Math.min(RING_R_OUT - 1, RING_R_OUT - (RING_GAP_CENTER_PX * 100) / diaPx))
                  : RING_R_IN;
              // Centre disc: a CONSTANT 4px inside whichever ring is innermost (the
              // gauge ring on pressing bubbles, else the outer ring). Same px→viewBox
              // conversion as the rings, so the disc-to-ring gap holds at any size /
              // magnification. The text box is the square inscribed in that disc.
              const hasInnerRing = !!b.gauge && (b.riskFrac ?? 0) > 0.001;
              const innerMostR = hasInnerRing ? innerRvb : RING_R_OUT;
              const innerMostBW = hasInnerRing ? RING_BW_IN : RING_BW_OUT;
              const diskR =
                diaPx > 0 ? Math.max(10, innerMostR - ((innerMostBW / 2 + DISK_GAP_PX) * 100) / diaPx) : RING_FILL_R;
              const boxPct = Math.max(20, Math.min(70, diskR * Math.SQRT2));
              // Fonts scale with the EFFECTIVE size, so they grow with the bubble on
              // hover (it's now big enough to hold them) and the text stays the same
              // proportion of the circle in either state.
              // Hover uses SMALLER font coefficients than rest: the hovered bubble is
              // much bigger and holds 4-5 lines, which must stay inside the inner ring
              // rather than bleed onto the outer ring.
              const eff = isHov ? hoverPct : baseSize;
              const fV = (eff * (isHov ? 0.12 : 0.165)).toFixed(2);
              const fL = (eff * (isHov ? 0.064 : 0.094)).toFixed(2);
              const fS = (eff * (isHov ? 0.048 : 0.066)).toFixed(2);
              // NO overflow:hidden / line-clamp / ellipsis / nowrap on ANY text — all
              // of those either clip text (the "Tap to review the qu…" / "Maintenan…"
              // truncation we must never show) or, for nowrap, force a one-line
              // min-content so wide that BubbleText shrinks the whole bubble to a
              // pinhead. Every line WRAPS naturally; BubbleText measures the wrapped
              // size and scales the block so the FULL text shows inside the ring —
              // never split mid-word (wordBreak/overflowWrap normal), never cut.
              const textWrap = {
                whiteSpace: 'normal',
                wordBreak: 'normal',
                overflowWrap: 'normal',
                lineHeight: 1.1,
                maxWidth: '100%',
              };
              const clip = textWrap;
              const labelWrap = { ...textWrap, width: '100%' };
              // All text lives in a box INSCRIBED in the centre fill disc and is
              // shrink-to-fit (BubbleText), so it can never cross the inner ring no
              // matter the label length, bubble size, or locale.
              // Tone drives the centre fill: risk/biz carry a faint always-on tint so
              // they read warm; calm (healthy) recedes with a muted label.
              const tone = b.tone || 'calm';
              // Pill-style soft fill on every bubble; calm stays a whisper so it still
              // recedes, risk/biz a touch stronger. A little more on hover. Painted as a
              // disc INSIDE the outer gauge (in BubbleRings) so it never bleeds past the
              // bubble edge.
              const restFill = tone === 'risk' ? 11 : tone === 'watch' ? 8 : tone === 'biz' ? 8 : 5;
              const fillPct = isHov ? restFill + 4 : restFill;
              const fillColor = `color-mix(in oklch, ${b.color} ${fillPct}%, var(--surface))`;
              const labelColor = tone === 'calm' ? 'var(--text-faint)' : 'var(--text-soft)';
              // Progressive disclosure by size: bigger (= more pressing) bubbles reveal
              // more. small = name+%; medium adds the overdue/status line; large adds a
              // forecast trend indicator (where it's headed); the biggest (and any
              // hovered) add Merlin's one-line read — which subsumes the plain status
              // line so they don't duplicate.
              const insight = bubbleInsight(b, sl);
              const showInsight = (isHov || baseSize >= 11) && !!insight;
              const showSub = !showInsight && (isHov || baseSize >= 6) && !!b.sub;
              const showForecast =
                (isHov || baseSize >= 9) &&
                !b.dashed &&
                tone !== 'biz' &&
                Array.isArray(b.trend) &&
                b.trend.length >= 3;
              const insightColor = tone === 'calm' ? 'var(--text-soft)' : b.color;
              return (
                <button
                  key={b.id}
                  onClick={() => askMerlin(b)}
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered((h) => (h === b.id ? null : h))}
                  title={`${b.label} · ${b.value}${b.sub ? ` · ${b.sub}` : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${(p.x / W) * 100}%`,
                    top: `${(p.y / H) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isHov ? 5 : 1,
                    width: `${size}%`,
                    aspectRatio: '1',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: 4,
                    overflow: 'visible',
                    lineHeight: 1.15,
                    transition:
                      'left .34s cubic-bezier(.34,1.56,.5,1), top .34s cubic-bezier(.34,1.56,.5,1), width .26s cubic-bezier(.34,1.56,.5,1), background .2s',
                    ...(flash[b.id]
                      ? {
                          animation: 'bubbleChanged 1.8s ease-in-out 2 both',
                          '--bubble-glow': `color-mix(in oklch, ${b.color} 55%, transparent)`,
                        }
                      : null),
                  }}
                >
                  <BubbleRings b={b} fill={fillColor} innerR={innerRvb} fillR={diskR} />
                  <BubbleText
                    boxPct={boxPct}
                    fitKey={`${b.id}|${isHov ? 1 : 0}|${b.label}|${b.value}|${showSub ? b.sub : ''}|${showInsight ? insight : ''}|${showForecast ? 1 : 0}|${size.toFixed(1)}|${boxPct.toFixed(1)}`}
                  >
                    <span
                      style={{
                        fontSize: `${fL}cqw`,
                        fontWeight: 400,
                        color: labelColor,
                        letterSpacing: '0.01em',
                        maxWidth: '100%',
                        transition: 'font-size .26s cubic-bezier(.34,1.56,.5,1)',
                        ...labelWrap,
                      }}
                    >
                      {b.label}
                    </span>
                    <span
                      style={{
                        fontSize: `${fV}cqw`,
                        fontWeight: 500,
                        color: b.color,
                        marginTop: '0.12em',
                        transition: 'font-size .26s cubic-bezier(.34,1.56,.5,1)',
                      }}
                    >
                      {b.value}
                    </span>
                    {showInsight ? (
                      <span
                        style={{
                          fontSize: `${fS}cqw`,
                          fontWeight: 600,
                          color: insightColor,
                          marginTop: '0.3em',
                          ...labelWrap,
                        }}
                      >
                        {insight}
                      </span>
                    ) : (
                      showSub && (
                        <span
                          style={{
                            fontSize: `${fS}cqw`,
                            fontWeight: 400,
                            color: 'var(--text-faint)',
                            marginTop: '0.3em',
                            ...clip,
                          }}
                        >
                          {b.sub}
                        </span>
                      )
                    )}
                    {showForecast && (
                      <ForecastTrend
                        trend={b.trend}
                        current={b.adhPct ?? Number.parseInt(b.value, 10)}
                        fs={`${fS}cqw`}
                        horizon={sl('next hour', 'proch. heure')}
                      />
                    )}
                  </BubbleText>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
