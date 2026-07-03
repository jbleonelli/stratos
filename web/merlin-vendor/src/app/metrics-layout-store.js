// Tiny pub/sub store on top of the per-user × per-org metrics layout
// in localStorage. Both useMetricsLayout (hook used by WidgetGrid)
// and the Merlin chat tool handler read/write through this module so
// chat-driven additions propagate live to the grid even when both
// surfaces are mounted simultaneously.
//
// Storage shape (single key per user × org):
//   localStorage['merlin-metrics-layout:USERID:ORGID']
//     = JSON.stringify({ v: 1, widgets: ['kpi-ring', 'gradient-area', ...] })
//
// Subscribers receive a `(userId, orgId)` payload so they can refilter
// when their identity matches. Event fan-out is in-process only —
// cross-tab sync rides on the browser's native `storage` event, which
// the hook also listens for separately.

const LS_PREFIX = 'merlin-metrics-layout';
const layoutKey = (userId, orgId) => `${LS_PREFIX}:${userId || 'anon'}:${orgId || 'none'}`;

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
      /* never let one bad listener break others */
    }
  }
}

// Custom (chat-generated) widget IDs always start with `cust:` — keep
// them through the catalog filter so a fresh deploy without their
// catalog entry still renders them via the spec store.
const CUSTOM_PREFIX = 'cust:';
const isAllowedId = (id, catalogIds) => catalogIds.has(id) || (typeof id === 'string' && id.startsWith(CUSTOM_PREFIX));

export function readLayout(userId, orgId, defaults, catalogIds) {
  try {
    const raw = localStorage.getItem(layoutKey(userId, orgId));
    if (!raw) return defaults.slice();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.widgets)) {
      return parsed.widgets.filter((id) => isAllowedId(id, catalogIds));
    }
    return defaults.slice();
  } catch {
    return defaults.slice();
  }
}

export function writeLayout(userId, orgId, widgets) {
  try {
    localStorage.setItem(layoutKey(userId, orgId), JSON.stringify({ v: 1, widgets }));
  } catch {
    /* quota / private mode → silently drop */
  }
  emit(userId, orgId);
}

// High-level mutators used by chat tool handlers (they don't have
// access to the React hook). All return the resulting layout array
// on a real change so callers can mirror it to profile.preferences;
// they return null when the call was a no-op (already present /
// already absent / unknown id) so the caller can skip the profile
// round-trip.
export function addWidget(userId, orgId, catalogId, defaults, catalogIds) {
  const current = readLayout(userId, orgId, defaults, catalogIds);
  if (current.includes(catalogId)) return null;
  if (!isAllowedId(catalogId, catalogIds)) return null; // unknown id — refuse silently
  const next = [...current, catalogId];
  writeLayout(userId, orgId, next);
  return next;
}

export function removeWidget(userId, orgId, catalogId, defaults, catalogIds) {
  const current = readLayout(userId, orgId, defaults, catalogIds);
  if (!current.includes(catalogId)) return null;
  const next = current.filter((id) => id !== catalogId);
  writeLayout(userId, orgId, next);
  return next;
}

// Drag-to-reorder primitive. Moves `fromId` to land before/after
// `toId`. Returns the new layout array on success so callers can
// mirror it to profile preferences; returns null if the move was a
// no-op (e.g. dropping a widget on itself, unknown ids).
export function reorderWidget(userId, orgId, fromId, toId, position, defaults, catalogIds) {
  if (!fromId || !toId || fromId === toId) return null;
  const current = readLayout(userId, orgId, defaults, catalogIds);
  const fromIdx = current.indexOf(fromId);
  const toIdx = current.indexOf(toId);
  if (fromIdx < 0 || toIdx < 0) return null;
  const without = current.slice();
  without.splice(fromIdx, 1);
  let insertIdx = without.indexOf(toId);
  if (position === 'after') insertIdx += 1;
  if (insertIdx < 0 || insertIdx > without.length) return null;
  const next = without.slice();
  next.splice(insertIdx, 0, fromId);
  if (next.length === current.length && next.every((id, i) => id === current[i])) return null;
  writeLayout(userId, orgId, next);
  return next;
}
