// @ts-check
// Per user × org localStorage store for *custom* widget specs created
// via the chat smart-picker (Merlin's `create_custom_chart` tool).
//
// Layout-store keeps `widgets: ['kpi-ring', 'cust:battery-90d', ...]`
// and this module owns the `'cust:battery-90d' → spec`  mapping.
// Two separate keys keeps reads cheap + the layout schema unchanged.
//
// Spec shape (validated server-side in api/chat.js before it ever
// lands here):
//   {
//     id:         'cust:<slug>',
//     title:      'Avg battery · 90d',
//     source:     'device_events' | 'incident_actions' | 'device_service_sessions' | 'merlin_asks' | 'agent_runs',
//     metric:     'count' | 'count_distinct' | 'avg' | 'sum',
//     field?:     string,                // for avg/sum/count_distinct, may be a JSON path like 'payload.battery_pct'
//     bucket:     'hour' | 'day' | 'week',
//     days:       number,                // 1..365
//     filter?:    [{ field, op: 'eq'|'gte'|'lte'|'in', value }],
//     chart_type: 'area' | 'line' | 'bar',
//     accent?:    'accent' | 'ok' | 'warn' | 'risk' | 'info',
//     created_at: ISO string,
//   }

const LS_PREFIX = 'merlin-metrics-specs';
const specsKey = (userId, orgId) => `${LS_PREFIX}:${userId || 'anon'}:${orgId || 'none'}`;

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(userId, orgId) {
  for (const fn of listeners) {
    try {
      fn({ userId, orgId });
    } catch {
      /* don't let one bad listener break others */
    }
  }
}

function readAll(userId, orgId) {
  try {
    const raw = localStorage.getItem(specsKey(userId, orgId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed.specs === 'object' && parsed.specs) || {};
  } catch {
    return {};
  }
}

function writeAll(userId, orgId, specs) {
  try {
    localStorage.setItem(specsKey(userId, orgId), JSON.stringify({ v: 1, specs }));
  } catch {
    /* quota / private mode → silent drop */
  }
  emit(userId, orgId);
}

export function getSpec(userId, orgId, id) {
  const all = readAll(userId, orgId);
  return all[id] || null;
}

export function setSpec(userId, orgId, spec) {
  if (!spec || !spec.id) return;
  const all = readAll(userId, orgId);
  all[spec.id] = { ...spec, created_at: spec.created_at || new Date().toISOString() };
  writeAll(userId, orgId, all);
}

export function removeSpec(userId, orgId, id) {
  const all = readAll(userId, orgId);
  if (!(id in all)) return;
  delete all[id];
  writeAll(userId, orgId, all);
}
