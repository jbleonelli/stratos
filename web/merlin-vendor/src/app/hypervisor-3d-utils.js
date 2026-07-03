// Pure helpers extracted from HypervisorViewer3D.jsx (Stage 1 of the
// viewer decomposition). These have no React/hook/JSX dependencies and
// no closures over component state, so they live here as a standalone,
// unit-testable module. The 3D scene primitives and 2D overlay panels
// that consume them stay in HypervisorViewer3D.jsx.

import { floorIdForItem, isNumericFloorBuilding } from './servicing-floor-catalog.js';

// Compact-format counts so big numbers (Meridian HQ has 300+ pending
// asks on Floor 6 alone, 1.8K across the whole building) stay narrow
// on pill chips and tab badges. <1000 stays as-is, otherwise k/M.
// Used by FloorPillRow pills + ActivityPanel tabs + agent filter
// buttons. Full number always available in `title` for hover.
export function formatCount(n) {
  if (!Number.isFinite(n) || n < 1000) return String(n || 0);
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Tiny deterministic string hash. Used to pick per-agent alerting
// floors so each agent type lights up a different (reproducible)
// subset, mixing nicely when several agents share a floor.
export function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// Pull a leading number out of "Floor 12", "F-3", "L4" etc. so floors
// stack low→high regardless of the org's naming convention. Strings
// without a number sort to the bottom by name.
export function floorOrdinal(name) {
  if (!name) return Number.POSITIVE_INFINITY;
  const m = String(name).match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
}

export function compareFloors(a, b) {
  const oa = floorOrdinal(a.name);
  const ob = floorOrdinal(b.name);
  if (oa !== ob) return oa - ob;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

// Walk parent_id from a deep location id up to the first ancestor of
// `kind === 'floor'`. Bounded loop guards against malformed loops in
// the data. Returns the floor's location_id or null.
export function walkToFloor(locId, parentOf, kindOf) {
  let cur = locId;
  for (let i = 0; i < 32 && cur; i += 1) {
    if (kindOf.get(cur) === 'floor') return cur;
    cur = parentOf.get(cur);
  }
  return null;
}

// Read a CSS custom property off documentElement so the wireframe
// colour stays in sync with the active theme/variant. Falls back to a
// safe slate when the var is unset.
export function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Heuristic title summary — first clause up to em-dash / semicolon /
// comma+space, then cap at ~52 chars at a word boundary. Cheap +
// deterministic; we can swap in an AI-generated summary later if the
// heuristics aren't enough (would need a column on agent_runs so we
// don't re-summarize on every render — see docs/architecture/ai-alert-headlines.md).
//
// When the clause itself is hard-truncated (no early break, long compound
// like "…SLAs are in BREACH at 10% vs 80% target…"), the 52-char cut used
// to land mid-thought on a dangling token ("…BREACH at 10% vs"). We now
// strip trailing connector/comparison/number tokens and append "…" so the
// headline reads as an intentional summary, not a cut-off sentence.
const TITLE_DANGLERS = new Set([
  'vs',
  'v',
  'at',
  'in',
  'on',
  'of',
  'to',
  'by',
  'for',
  'and',
  'or',
  'with',
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'than',
  'from',
  'as',
  'per',
]);
export function summarizeTitle(text) {
  if (!text || typeof text !== 'string') return 'Alert';
  const stop = text.search(/[—;]|, /);
  let head = stop > 0 ? text.slice(0, stop) : text;
  head = head
    .trim()
    .replace(/\s*\([^)]*$/, '')
    .trim();
  const truncated = head.length > 52;
  if (truncated) {
    // Reserve one char for the ellipsis so the result stays ≤52 total.
    let cut = head.slice(0, 51);
    const atBoundary = cut.replace(/\s+\S*$/, '');
    // Use the word-boundary cut unless there's no space at all (one long
    // token) — then keep the hard slice so we still return something.
    cut = atBoundary || cut;
    // Drop trailing dangling tokens (prepositions, conjunctions, "vs",
    // bare numbers / percentages) so we don't end on "… at 10% vs".
    let words = cut.split(/\s+/);
    while (words.length > 1) {
      const last = words[words.length - 1].toLowerCase().replace(/[^a-z%0-9]/g, '');
      if (TITLE_DANGLERS.has(last) || /^[\d.,]+%?$/.test(last)) {
        words = words.slice(0, -1);
      } else break;
    }
    head = words.join(' ').replace(/[\s,;:]+$/, '');
    head = head ? `${head}…` : '';
  }
  return head || 'Alert';
}

// Heuristic body summary — first 1-2 sentences. Caps at ~200 chars at
// a clean word boundary so the body never has to ellipsize visually
// inside the card (JB: "the impression the UI sucks"). The Details
// button still surfaces the full text via the drawer.
export function summarizeBody(text) {
  if (!text || typeof text !== 'string') return '';
  const parts = text.split(/(?<=[.;])\s+/);
  let body = parts[0] || '';
  if (body.length < 120 && parts[1]) body = body + ' ' + parts[1];
  if (body.length > 200) body = body.slice(0, 200).replace(/\s+\S*$/, '') + '…';
  return body.trim();
}

// True when `locId` is the floor itself or a descendant of it. Uses a
// dash-bounded prefix match so sibling ids that merely share a prefix
// (e.g. "feb" vs "feb2") don't false-match.
export function locationOnFloor(locId, floorId) {
  if (!locId || !floorId) return false;
  return locId === floorId || locId.startsWith(floorId + '-');
}

export function walkUpToFloor(locId, floors) {
  if (!locId) return null;
  for (const f of floors) {
    if (locationOnFloor(locId, f.id)) return f.id;
  }
  return null;
}

// Short relative-time label ("3m", "2h", "5d"). Drops day-precision
// after a week so old asks read as a date instead of "184d".
export function relativeTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const dSec = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (dSec < 60) return `${dSec}s`;
  if (dSec < 3600) return `${Math.floor(dSec / 60)}m`;
  if (dSec < 86400) return `${Math.floor(dSec / 3600)}h`;
  if (dSec < 604800) return `${Math.floor(dSec / 86400)}d`;
  try {
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return `${Math.floor(dSec / 86400)}d`;
  }
}

// Minimal-displacement vertical de-overlap solver (isotonic / pool-
// adjacent-violators). Used by the 3D viewer's CTAAutoLayout to spread
// floor-anchored cards so they never overlap on the canvas — no matter
// how clustered the source floors are.
//
// `cards` is an array of { desiredTop, height } already sorted by anchor
// order (top → bottom). Returns an array of resolved top positions
// aligned to the input order such that:
//   - top[i+1] >= top[i] + height[i] + gap   (never overlap)
//   - each card sits as close to its desiredTop as possible (L2-optimal),
//     so a card with no neighbour conflict keeps its desiredTop EXACTLY
//   - the whole stack stays within [margin, canvasHeight - margin]
//
// Math: substitute s_i = top_i - cum_i where cum_i = Σ_{j<i}(h_j + gap).
// The non-overlap constraint top_{i+1} >= top_i + h_i + gap becomes
// s_{i+1} >= s_i (monotone non-decreasing), so PAVA on the desired
// s-values (desiredTop_i - cum_i) is the least-squares monotone fit.
// O(n) after the caller's sort. Pure — depends only on its inputs, so it
// converges in one frame and is fully unit-testable.
//
// `topMargin`/`bottomMargin` override `margin` per-edge — used to reserve
// extra clearance at the top for the metric/agent button bar so the first
// card never rides up under it.
export function resolveVerticalLayout(cards, { gap = 10, margin = 18, topMargin, bottomMargin, canvasHeight }) {
  const n = cards.length;
  if (n === 0) return [];
  const top = topMargin ?? margin;
  const bottom = bottomMargin ?? margin;

  const cum = new Array(n).fill(0);
  for (let i = 1; i < n; i += 1) cum[i] = cum[i - 1] + cards[i - 1].height + gap;

  // PAVA over v_i = desiredTop_i - cum_i.
  const blocks = []; // pooled runs: { sum, count, value }
  for (let i = 0; i < n; i += 1) {
    let b = { sum: cards[i].desiredTop - cum[i], count: 1 };
    b.value = b.sum / b.count;
    while (blocks.length && blocks[blocks.length - 1].value > b.value) {
      const prev = blocks.pop();
      b = { sum: prev.sum + b.sum, count: prev.count + b.count };
      b.value = b.sum / b.count;
    }
    blocks.push(b);
  }
  const tops = new Array(n);
  let k = 0;
  for (const b of blocks) {
    for (let j = 0; j < b.count; j += 1) {
      tops[k] = b.value + cum[k];
      k += 1;
    }
  }

  if (canvasHeight == null) return tops; // no bounds to clamp against

  const minTop = top;
  const maxBottom = canvasHeight - bottom;
  const stackTop = tops[0];
  const stackBottom = tops[n - 1] + cards[n - 1].height;
  if (stackBottom - stackTop <= maxBottom - minTop) {
    // Fits — shift the rigid (already gap-correct) stack into bounds.
    let shift = 0;
    if (stackTop < minTop) shift = minTop - stackTop;
    else if (stackBottom > maxBottom) shift = maxBottom - stackBottom;
    if (shift) for (let i = 0; i < n; i += 1) tops[i] += shift;
  } else if (n > 1) {
    // Pathological: more card than canvas. Even-distribute top→bottom.
    const stride = (maxBottom - minTop - cards[n - 1].height) / (n - 1);
    for (let i = 0; i < n; i += 1) tops[i] = minTop + i * stride;
  } else {
    tops[0] = minTop;
  }
  return tops;
}

// --- Servicing open-item → 3D anchor resolver (richer viewer, Phase 1) ---
//
// The 3D viewer is built purely from floor geometry (location rows where
// kind==='floor'). But servicing open-items carry a free-text catalog
// `location` (servicing-content.js) and many sit OFF the floor stack — a
// loading dock in B1, cameras on the roof, a perimeter gate, "Tower-wide"
// risers. Those have no floor row, so the viewer used to paint nothing.
//
// resolveLocation parses one catalog location string into a spatial anchor
// the viewer CAN place: a real floor / floor band, or one of three synthetic
// off-stack anchors (roof cap above the top floor, basement plinth below
// grade, ground perimeter ring), or 'building' (tower-wide / full-height
// riser → listed in the overlay, no marker). It NEVER returns null: anything
// unrecognised falls to 'building' so the "By location" overlay is never blank.
//
// Meridian HQ has exactly floors 1–50 as kind:'floor' rows — no basement,
// ground, or roof geometry (verified against the live `locations` tree), so
// roof/basement/perimeter are SYNTHETIC anchors, not real rows.
export const ANCHOR = Object.freeze({
  FLOOR: 'floor', //      { kind, floor }      one real floor row
  BAND: 'band', //        { kind, from, to }   contiguous real floors (inclusive)
  ROOF: 'roof', //        { kind }             synthetic cap above the top floor
  BASEMENT: 'basement', //{ kind, level }      synthetic plinth below grade
  PERIMETER: 'perimeter', //{ kind }            synthetic ground ring
  BUILDING: 'building', //{ kind }             tower-wide / riser → overlay only
});

// Pull every floor number out of a "Fl …" / "L …" string and collapse to a
// single floor, an inclusive band, or roof when the whole reference sits
// above the top floor (e.g. "Fl 51 · Roof" on a 50-floor tower).
function floorsFrom(s, topFloor) {
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return { kind: ANCHOR.BUILDING };
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if (lo > topFloor) return { kind: ANCHOR.ROOF }; // entirely above the stack
  const cLo = Math.max(1, Math.min(lo, topFloor));
  const cHi = Math.max(1, Math.min(hi, topFloor));
  return cLo === cHi ? { kind: ANCHOR.FLOOR, floor: cLo } : { kind: ANCHOR.BAND, from: cLo, to: cHi };
}

export function resolveLocation(location, { topFloor = 50 } = {}) {
  const s = String(location || '').trim();
  if (!s) return { kind: ANCHOR.BUILDING };

  // Tower-wide / Tower → overlay-only, no spatial marker.
  if (/^tower\b/i.test(s)) return { kind: ANCHOR.BUILDING };

  // Full-height riser: a basement token joined to a roof / floor / level token
  // ("B2–Roof", "Roof / B2", "B2–L1") spans the whole stack → building-wide.
  const hasBasement = /\bB\d/i.test(s);
  const hasRoof = /\broof\b/i.test(s);
  if (hasBasement && (hasRoof || /[–\-/]\s*(?:L|Fl)\s*\d/i.test(s))) {
    return { kind: ANCHOR.BUILDING };
  }

  // Leading floor refs: "Fl 12", "Fl 35–50", "Fl 3 / Fl 5", "Fl 51 · Roof".
  if (/^Fl\b/i.test(s)) return floorsFrom(s, topFloor);

  // Basement (leading "B1"/"B2 · …"): synthetic plinth below grade.
  const bm = s.match(/^B(\d)/i);
  if (bm) return { kind: ANCHOR.BASEMENT, level: Number(bm[1]) };

  // Roof (leading / standalone — risers already handled above).
  if (hasRoof) return { kind: ANCHOR.ROOF };

  // Exterior skin / grounds / access → ground perimeter ring.
  if (/\b(perimeter|exterior|fa[cç]ade|plaza|gate|grounds)\b/i.test(s)) {
    return { kind: ANCHOR.PERIMETER };
  }

  // Loading dock lives in the basement (B1 unless a level is named).
  if (/loading dock/i.test(s)) {
    const lm = s.match(/B(\d)/i);
    return { kind: ANCHOR.BASEMENT, level: lm ? Number(lm[1]) : 1 };
  }

  // Level refs: "L1", "L1–L3", "L1 · Lobby" → real low floors.
  if (/^L\d/i.test(s)) return floorsFrom(s, topFloor);

  // Ground / lobby / mailroom → ground floor (floor 1, the lowest real row).
  if (/^(ground|lobby|mailroom)\b/i.test(s)) return { kind: ANCHOR.FLOOR, floor: 1 };

  // Unknown → never blank: building-wide group.
  return { kind: ANCHOR.BUILDING };
}

// Spatial zone an anchor belongs to, for the "By location" overlay grouping +
// marker layering. Floors/bands split into high/mid/low rise (a band is keyed
// by its highest affected floor — the most prominent). Off-stack anchors map
// to their own zone. ZONE_ORDER is top-of-tower → grade → off-stack.
export const ZONE_ORDER = Object.freeze(['roof', 'high', 'mid', 'low', 'basement', 'perimeter', 'building']);

function floorZone(n, highFrom, midFrom) {
  if (n >= highFrom) return 'high';
  if (n >= midFrom) return 'mid';
  return 'low';
}

export function zoneOf(anchor, { highFrom = 35, midFrom = 15 } = {}) {
  if (!anchor) return 'building';
  switch (anchor.kind) {
    case ANCHOR.ROOF:
      return 'roof';
    case ANCHOR.BASEMENT:
      return 'basement';
    case ANCHOR.PERIMETER:
      return 'perimeter';
    case ANCHOR.FLOOR:
      return floorZone(anchor.floor, highFrom, midFrom);
    case ANCHOR.BAND:
      return floorZone(anchor.to ?? anchor.from, highFrom, midFrom);
    default:
      return 'building';
  }
}

// Presentation metadata per spatial zone — label + a one-line hint. English
// only for now (the servicing catalog is EN-only; FR i18n is a follow-up).
// Kept here (plain data, no JSX) so the viewer placement, the 3D off-floor
// badges, and the "By location" rail all read the same labels.
// `label` is the English fallback (used by unit tests / when no t is passed);
// `labelKey` localises it via i18n when a t() is threaded in.
export const SERVICING_ZONE_META = Object.freeze({
  roof: { label: 'Roof', labelKey: 'hyper3d.zone.roof', hint: 'Rooftop plant & antennae' },
  high: { label: 'High-rise', labelKey: 'hyper3d.zone.high', hint: 'Floors 35–50' },
  mid: { label: 'Mid-rise', labelKey: 'hyper3d.zone.mid', hint: 'Floors 15–34' },
  low: { label: 'Low-rise', labelKey: 'hyper3d.zone.low', hint: 'Floors 1–14' },
  basement: { label: 'Basement & dock', labelKey: 'hyper3d.zone.basement', hint: 'B1–B2' },
  perimeter: { label: 'Perimeter', labelKey: 'hyper3d.zone.perimeter', hint: 'Grounds & façade' },
  building: { label: 'Building-wide', labelKey: 'hyper3d.zone.building', hint: 'Tower-wide systems' },
});

// Resolve a zone/UI label through an optional t(): use the translation when a t
// is provided and the key resolves, else the English fallback. Keeps the pure
// components renderable without i18n (unit tests) while localising in the app.
export function trLabel(t, key, fallback, vars) {
  if (!t || !key) return fallback;
  const v = t(key, vars);
  return v && v !== key ? v : fallback;
}

// Severity band for an open item's hours-over-SLA. Shared by the floor tint,
// the off-floor badges, and the rail so colour reads consistently. The RPC
// returns the worst-overdue items per line, but most are only fractionally
// past SLA (≈0.1–0.7h) on a healthy building — treating ANY overage as "at
// risk" floods the tower amber, so a small overage reads as on-target. Tiers:
//   on-target (<4h) · at-risk (≥4h) · breached (≥24h).
export function servicingSeverity(hoursOver) {
  const h = Number(hoursOver) || 0;
  if (h >= 24) return { level: 'crit', color: '#ef4444', intensity: 1 };
  if (h >= 4) return { level: 'warn', color: '#f59e0b', intensity: 0.7 };
  return { level: 'ok', color: '#14b8a6', intensity: 0.4 };
}

// Group viewer open-items [{ line, item, hours_over, open_count }] into ordered
// spatial zones for the "By location" overlay + per-zone count badges.
// `locationOf(itemName) -> string|null` injects the catalog lookup so this
// stays catalog-free and unit-testable. Each item keeps its resolved `anchor`
// + `location` for marker placement. Never drops an item — unresolved → the
// 'building' bucket. Returns buckets in ZONE_ORDER, empty zones omitted.
export function bucketServicingItems(items, locationOf, opts = {}) {
  const { topFloor = 50, highFrom, midFrom } = opts;
  const byZone = new Map();
  for (const it of items || []) {
    const location = (locationOf && locationOf(it.item)) || null;
    const anchor = resolveLocation(location, { topFloor });
    const zone = zoneOf(anchor, { topFloor, highFrom, midFrom });
    if (!byZone.has(zone)) {
      byZone.set(zone, { zone, items: [], openCount: 0, maxHoursOver: 0 });
    }
    const b = byZone.get(zone);
    b.items.push({ ...it, anchor, location });
    b.openCount += Number(it.open_count) || 0;
    b.maxHoursOver = Math.max(b.maxHoursOver, Number(it.hours_over) || 0);
  }
  return ZONE_ORDER.filter((z) => byZone.has(z)).map((z) => byZone.get(z));
}

// The full location-aware placement the servicing 3D viewer renders from.
// Pure (no React/three): buckets the open-items, then derives everything the
// viewer needs —
//   - `highlights`: real floor tints [{ location_id:`${buildingId}-fl-N`,
//      color, intensity }] (worst hours-over per floor) so the tower lights the
//      ACTUAL floors/bands instead of the old hash-scatter;
//   - `byFloor`: floorId → Map<'servicing', rows[]> popup rows (the shape
//      ActivityPanel consumes) so a lit floor's click shows its real items;
//   - `offStack`: { roof?, basement?, perimeter? } buckets for the 3D anchors;
//   - `buildingWide`: the tower-wide bucket (overlay only);
//   - `buckets`: every zone, for the never-blank "By location" rail.
// Returns null when there's nothing to place (so the viewer can fall back).
// The shared servicing content catalog is authored against Meridian's 50-floor
// tower ("Fl 48 · Amenities", "Fl 51 · Roof", "B1 · Dock"). Named-floor
// buildings have far fewer floors, so we must resolve those labels in their
// NATIVE 50-floor frame (else "Fl 48" on a 5-floor building wrongly clamps to
// roof) and THEN project the result onto the real named floors via the catalog.
const CONTENT_TOPFLOOR = 50;

export function computeServicingPlacement(openItems, locationOf, { buildingId, topFloor = 50, floors = null } = {}) {
  if (!Array.isArray(openItems) || openItems.length === 0) return null;

  // Floor-id scheme. Meridian names rows `${buildingId}-fl-N`, so a floor NUMBER
  // templates straight to a real row. Named-floor buildings (PSG, Hemisphere)
  // use semantic ids (`psg-pro-aquatics`) with no `-fl-N` rows; there we route
  // each item to one real floor via the per-building catalog. When `floors`
  // isn't supplied (unit tests, legacy callers) we assume numeric → unchanged.
  const numericMode = isNumericFloorBuilding(buildingId, floors);
  // Resolve labels in the content's native frame on named buildings so roof /
  // basement / floor classification stays correct regardless of the physical
  // floor count; numeric buildings keep using their real top floor.
  const resolveTopFloor = numericMode ? topFloor : CONTENT_TOPFLOOR;
  const buckets = bucketServicingItems(openItems, locationOf, { topFloor: resolveTopFloor });

  // Map one floor/band item to the floor row id(s) it should light. Numeric:
  // every floor it spans (`-fl-N`). Named: a single routed semantic floor.
  const floorIdsFor = (it, lo, hi) => {
    if (numericMode) {
      const ids = [];
      for (let n = lo; n <= hi; n += 1) ids.push(`${buildingId}-fl-${n}`);
      return ids;
    }
    const id = floorIdForItem(buildingId, it, floors, { ordinal: lo, contentTopFloor: CONTENT_TOPFLOOR });
    return id ? [id] : [];
  };

  const worstByFloor = new Map(); // floorId → { ho, line } of its worst item
  const byFloor = new Map(); // floorId → Map<'servicing', rows[]>
  const railItemsByFloor = new Map(); // floorId → items[] (named mode "By location" rail)
  const offStack = {}; // 'roof' | 'basement' | 'perimeter' → bucket
  let buildingWide = null;
  for (const b of buckets) {
    if (b.zone === 'roof' || b.zone === 'basement' || b.zone === 'perimeter') offStack[b.zone] = b;
    if (b.zone === 'building') {
      // Named buildings: items whose Meridian-flavoured label didn't resolve
      // (location == null) land here with no real tower-wide meaning. Part A
      // floors those by service line below, so the building-wide bucket keeps
      // only the GENUINELY tower-wide items (an explicit "Tower-wide" label),
      // with its counts recomputed over what remains.
      if (numericMode) {
        buildingWide = b;
      } else {
        const genuine = b.items.filter((it) => it.location != null);
        buildingWide = genuine.length
          ? {
              ...b,
              items: genuine,
              openCount: genuine.reduce((s, it) => s + (Number(it.open_count) || 0), 0),
              maxHoursOver: genuine.reduce((m, it) => Math.max(m, Number(it.hours_over) || 0), 0),
            }
          : null;
      }
    }
    for (const it of b.items) {
      const a = it.anchor;
      const isFloorish = a.kind === ANCHOR.FLOOR || a.kind === ANCHOR.BAND;
      // On named-floor buildings a procedural item with no resolved location has
      // no off-stack/tower meaning — route it onto a real floor by service line
      // rather than stranding it. Numeric (Meridian) buildings keep the strict
      // floor/band gate, so their placement is unchanged.
      const isUnresolvedNamed = !numericMode && a.kind === ANCHOR.BUILDING && it.location == null;
      if (!isFloorish && !isUnresolvedNamed) continue;
      const lo = isFloorish ? (a.kind === ANCHOR.FLOOR ? a.floor : a.from) : 1;
      const hi = isFloorish ? (a.kind === ANCHOR.FLOOR ? a.floor : a.to) : 1;
      const ho = Number(it.hours_over) || 0;
      const oc = Number(it.open_count) || 0;
      for (const fid of floorIdsFor(it, lo, hi)) {
        const prev = worstByFloor.get(fid);
        if (!prev || ho > prev.ho) worstByFloor.set(fid, { ho, line: it.line });
        if (!numericMode) {
          const rail = railItemsByFloor.get(fid) || [];
          rail.push(it);
          railItemsByFloor.set(fid, rail);
        }
        const m = byFloor.get(fid) || new Map();
        const rows = m.get('servicing') || [];
        rows.push({
          id: `svc-${fid}-${rows.length}`,
          location_id: fid, // pin to the floor so ActivityPanel's scope check passes
          agent_id: 'servicing',
          decision_reason: `${it.line} · ${it.item} — ${ho}h over SLA${oc ? `, ${oc} open` : ''}`,
        });
        m.set('servicing', rows);
        byFloor.set(fid, m);
      }
    }
  }
  // Tint only the floors that are genuinely at-risk/breached — on-target floors
  // (the bulk on a healthy building) stay clean wireframe so the few real
  // problem floors actually stand out instead of the whole tower glowing. The
  // popup map + the "By location" rail still carry every item (never-blank).
  const highlights = [];
  for (const [fid, { ho, line }] of worstByFloor) {
    const sev = servicingSeverity(ho);
    if (sev.level === 'ok') continue;
    // `line` = the worst item's service line, so the colour-by-service-line
    // toggle can recolour the floor without recomputing placement.
    highlights.push({ location_id: fid, color: sev.color, intensity: sev.intensity, line });
  }
  // Off-stack zones get a synthetic floor id (`${buildingId}-zone-roof` etc.) in
  // the SAME byFloor popup map, so clicking the roof/basement/perimeter 3D mesh
  // drills into that zone's items through the exact path a floor click uses.
  for (const z of ['roof', 'basement', 'perimeter']) {
    const b = offStack[z];
    if (!b) continue;
    // The zone's worst item's service line (drives colour-by-service-line).
    let wLine = null;
    let wHo = -Infinity;
    for (const it of b.items) {
      const h = Number(it.hours_over) || 0;
      if (h > wHo) {
        wHo = h;
        wLine = it.line;
      }
    }
    b.worstLine = wLine;
    const zid = `${buildingId}-zone-${z}`;
    const rows = b.items.map((it, i) => {
      const ho = Number(it.hours_over) || 0;
      const oc = Number(it.open_count) || 0;
      return {
        id: `svc-${zid}-${i}`,
        location_id: zid,
        agent_id: 'servicing',
        decision_reason: `${it.line} · ${it.item} — ${ho}h over SLA${oc ? `, ${oc} open` : ''}`,
      };
    });
    byFloor.set(zid, new Map([['servicing', rows]]));
  }
  // "By location" rail buckets. Numeric (Meridian) buildings keep the spatial
  // zone grouping (Roof / High-rise / … / Building-wide). Named-floor buildings
  // group by their ACTUAL named floors (Field, Luxury Suites, Aquatics …) — the
  // rooms the items were routed to — plus the off-stack zones and any genuine
  // tower-wide bucket, ordered worst-first so the rail reads as a triage list.
  let railBuckets = buckets;
  if (!numericMode) {
    const floorNameById = new Map((floors || []).map((f) => [f.id, f.name || f.id]));
    const floorBuckets = [];
    for (const [fid, its] of railItemsByFloor) {
      floorBuckets.push({
        zone: 'floor',
        floorId: fid,
        label: floorNameById.get(fid) || fid,
        items: its,
        openCount: its.reduce((s, it) => s + (Number(it.open_count) || 0), 0),
        maxHoursOver: its.reduce((m, it) => Math.max(m, Number(it.hours_over) || 0), 0),
      });
    }
    const tail = [];
    for (const z of ['roof', 'basement', 'perimeter']) if (offStack[z]) tail.push(offStack[z]);
    if (buildingWide) tail.push(buildingWide);
    railBuckets = [...floorBuckets, ...tail].sort(
      (a, b) => (b.maxHoursOver || 0) - (a.maxHoursOver || 0) || b.items.length - a.items.length,
    );
  }
  return { buckets: railBuckets, highlights, byFloor, offStack, buildingWide };
}
