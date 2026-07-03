// @ts-check
// Small pure helpers shared across the Merlin Field (mobile) tabs. Extracted
// from MobileApp.jsx (G2 split) so the Today tab and the Tickets tab can both
// use hhmm() without importing each other (avoids a MobileApp ↔ tab cycle).

// Local HH:MM for a timestamp; '' on a bad value. Used by the task-done pill
// (Today) and the ticket comment timestamps (Tickets).
export function hhmm(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Midnight (local) today as ISO — lower bound for "completed today" reads.
export function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
