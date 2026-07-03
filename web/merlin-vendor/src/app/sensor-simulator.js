// ─── Drift state ─────────────────────────────────────────────────────
const DRIFT_TICK_MS = 30_000;
const DRIFT_STEP = 0.08; // 0..1 per tick — gentle Brownian
const drift = new Map(); // `${floorId}|${metric}` → 0..1
let lastDriftTick = 0;

function maybeAdvanceDrift() {
  const now = Date.now();
  if (now - lastDriftTick < DRIFT_TICK_MS) return;
  lastDriftTick = now;
  for (const [k, v] of drift) {
    const step = (Math.random() - 0.5) * DRIFT_STEP * 2;
    drift.set(k, Math.max(0, Math.min(1, v + step)));
  }
}

// ─── Health model — meaning, not just a metric-specific hue ──────────
//
// Every metric maps to the SAME green→red semantic so the building reads
// as one health heatmap regardless of which sensor is selected:
//   - In the comfort band  → green, deep at the centre, fading to PALE
//     green as the reading approaches a limit.
//   - Outside the band     → red, light just over the edge, DEEPENING
//     with how far past the hard limit it is.
// One-sided metrics (air quality, occupancy, noise — only "too much" is
// bad) leave the low edge open (-Infinity). Two-sided metrics
// (temperature, humidity) flag both ends.
//
// `comfortLo/Hi` = the green band. `hardLo/Hi` = where red saturates
// fully. `warn` = how far inside the band the green starts paling.
const HEALTH_BANDS = {
  temperature: { comfortLo: 20, comfortHi: 24.5, hardLo: 17, hardHi: 28, warn: 2 },
  airquality: { comfortLo: -Infinity, comfortHi: 600, hardLo: -Infinity, hardHi: 1100, warn: 250 },
  occupancy: { comfortLo: -Infinity, comfortHi: 85, hardLo: -Infinity, hardHi: 100, warn: 25 },
  humidity: { comfortLo: 40, comfortHi: 55, hardLo: 28, hardHi: 68, warn: 7 },
  noise: { comfortLo: -Infinity, comfortHi: 60, hardLo: -Infinity, hardHi: 74, warn: 9 },
};

// Green + red ramp endpoints. Kept here (not in agent-colors) because
// these are health-scale colours, distinct from the per-agent palette.
const HEALTH_GREEN_DEEP = '#059669'; // emerald-600 — comfortably in range
const HEALTH_GREEN_PALE = '#bbf7d0'; // emerald-200 — in range but near a limit
const HEALTH_RED_LIGHT = '#f87171'; // red-400 — just over the limit
const HEALTH_RED_DEEP = '#b91c1c'; // red-700 — far past the hard limit

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function lerpHex(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp01(t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Pure: map (metric, value) → health verdict. The single source of truth
// for floor tint + which floors get an alert card. Unit-tested.
//   { state: 'ok' | 'alert', severity: 0..1, direction: 'high'|'low'|null, color }
export function evaluateHealth(metric, value) {
  const b = HEALTH_BANDS[metric];
  if (!b || value == null || Number.isNaN(value)) {
    return { state: 'ok', severity: 0, direction: null, color: HEALTH_GREEN_DEEP };
  }
  const { comfortLo, comfortHi, hardLo, hardHi, warn } = b;
  if (value >= comfortLo && value <= comfortHi) {
    // In band → green, paling toward the nearest finite comfort edge.
    const distHi = comfortHi === Infinity ? Infinity : comfortHi - value;
    const distLo = comfortLo === -Infinity ? Infinity : value - comfortLo;
    const prox = clamp01(Math.min(distHi, distLo) / warn); // 1 = deep, 0 = pale
    return { state: 'ok', severity: 0, direction: null, color: lerpHex(HEALTH_GREEN_PALE, HEALTH_GREEN_DEEP, prox) };
  }
  // Out of band → red, severity by distance past the comfort edge.
  const direction = value > comfortHi ? 'high' : 'low';
  const severity =
    direction === 'high'
      ? clamp01((value - comfortHi) / (hardHi - comfortHi))
      : clamp01((comfortLo - value) / (comfortLo - hardLo));
  return { state: 'alert', severity, direction, color: lerpHex(HEALTH_RED_LIGHT, HEALTH_RED_DEEP, severity) };
}

// ─── Subscriber registry for re-render on drift tick ─────────────────
//
// Consumers register a callback that fires on every drift advance.
// Used by the viewer to bump a tick state so its useMemos recompute
// the per-floor highlights + outlier set.
const listeners = new Set();
let intervalHandle = null;

function ensureInterval() {
  if (intervalHandle || typeof window === 'undefined') return;
  intervalHandle = setInterval(() => {
    // Advance and notify even if no subscribers yet — keeps the state
    // warm so first paint after a quiet stretch isn't stale.
    maybeAdvanceDrift();
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        /* swallow */
      }
    }
  }, DRIFT_TICK_MS);
}

export function subscribeSensorTick(fn) {
  listeners.add(fn);
  ensureInterval();
  return () => {
    listeners.delete(fn);
  };
}
