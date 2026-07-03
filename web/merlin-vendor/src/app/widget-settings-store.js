// @ts-check
// Per user × org × widget-id settings store. Each widget owns its
// own settings shape (timeframe, source filter, accent, etc.), this
// module just persists whatever the widget puts in.
//
// Storage: a single localStorage key per user × org carrying a map
// from widget id → settings JSON. Two keys total (this + the layout
// store) keep the read paths cheap and the schemas independent.

const LS_PREFIX = 'merlin-metrics-widget-settings';
const settingsKey = (userId, orgId) => `${LS_PREFIX}:${userId || 'anon'}:${orgId || 'none'}`;

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(userId, orgId, widgetId) {
  for (const fn of listeners) {
    try {
      fn({ userId, orgId, widgetId });
    } catch {
      /* never let one bad listener break others */
    }
  }
}

function readAll(userId, orgId) {
  try {
    const raw = localStorage.getItem(settingsKey(userId, orgId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed.settings === 'object' && parsed.settings) || {};
  } catch {
    return {};
  }
}

function writeAll(userId, orgId, all, widgetId) {
  try {
    localStorage.setItem(settingsKey(userId, orgId), JSON.stringify({ v: 1, settings: all }));
  } catch {
    /* quota / private mode → silent drop */
  }
  emit(userId, orgId, widgetId);
}

export function getSettings(userId, orgId, widgetId) {
  const all = readAll(userId, orgId);
  return all[widgetId] || null;
}

export function setSettings(userId, orgId, widgetId, settings) {
  if (!widgetId) return;
  const all = readAll(userId, orgId);
  all[widgetId] = { ...settings };
  writeAll(userId, orgId, all, widgetId);
}
