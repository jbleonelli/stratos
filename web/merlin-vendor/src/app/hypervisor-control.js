// @ts-check
// Cross-component control bus for the Hypervisor 3D viewer.
//
// Lets Merlin chat (or any surface) drive the viewer: switch viewer mode
// (merlin / agents / slas / sensing), pick a Sensing metric, or focus a
// floor — without prop-drilling through App → Operations → Hypervisor.
// Same module-scoped pub/sub pattern as MessageDrawer / agent-runs.
//
// Flow: chat executes a `control_hypervisor` tool action →
// requestHypervisorControl({...}) stores the request + emits. The viewer
// host (Hypervisor.jsx) subscribes via useHypervisorControl and applies it.
//
// A request fired BEFORE the host is mounted (e.g. chat triggers it from
// My Day, then App navigates to the Hypervisor) is latched in `pending`
// and replayed when the host mounts — so navigation + control compose.

let pending = null; // latest unconsumed request
const LISTENERS = new Set();

// Request a viewer change. Partial — only the provided keys are applied.
//   { mode?: 'merlin'|'agents'|'slas'|'sensing',
//     metric?: 'airquality'|'temperature'|'occupancy'|'humidity'|'noise'|null,
//     floorId?: string }
// A monotonic `at` stamp lets the host dedupe / detect a fresh request even
// when the same payload repeats.
export function requestHypervisorControl(req) {
  if (!req || typeof req !== 'object') return;
  pending = { ...req, at: (pending?.at || 0) + 1 };
  LISTENERS.forEach((fn) => {
    try {
      fn(pending);
    } catch {
      /* swallow */
    }
  });
}

export function peekHypervisorControl() {
  return pending;
}

export function subscribeHypervisorControl(fn) {
  LISTENERS.add(fn);
  return () => {
    LISTENERS.delete(fn);
  };
}

// Normalize free-form metric names Claude might emit to the canonical ids
// the Sensing bar uses. Returns null for "clear/none", undefined if no
// metric key was meant to change.
const METRIC_ALIASES = {
  airquality: 'airquality',
  air: 'airquality',
  'air quality': 'airquality',
  aq: 'airquality',
  voc: 'airquality',
  tvoc: 'airquality',
  temperature: 'temperature',
  temp: 'temperature',
  thermal: 'temperature',
  heat: 'temperature',
  occupancy: 'occupancy',
  occupation: 'occupancy',
  people: 'occupancy',
  crowding: 'occupancy',
  density: 'occupancy',
  humidity: 'humidity',
  humid: 'humidity',
  moisture: 'humidity',
  rh: 'humidity',
  noise: 'noise',
  sound: 'noise',
  acoustic: 'noise',
  db: 'noise',
  decibel: 'noise',
};
export function normalizeMetric(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (s === '' || s === 'none' || s === 'off' || s === 'clear') return null;
  return METRIC_ALIASES[s] || null;
}

const VALID_MODES = new Set(['merlin', 'agents', 'slas', 'sensing']);
export function normalizeMode(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase();
  return VALID_MODES.has(s) ? s : undefined;
}
