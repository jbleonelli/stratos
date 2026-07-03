// @ts-check
// Demo-date helpers — keeps every "current week" / "this rollout
// started X days ago" surface feeling current without manual updates.
//
// Pattern: each mock dataset (schedules-data.js, deployments-data.js,
// imf-data.js, ecosystem-data.js) was originally hand-authored against
// a fixed REFERENCE_DATE in April 2026. Relative gaps between dates
// inside a dataset (e.g. "rollout started 7 days before today") were
// meaningful for the demo story. Hardcoding the absolute dates makes
// the page feel 4 weeks stale a month later.
//
// rebase() shifts a static date forward by the same delta that "today"
// has moved from REFERENCE_DATE — preserving the relative gaps while
// keeping the absolute dates fresh on every page load.
//
// All consumers run rebase at module-import time so the dates land in
// the exports as concrete ISO strings (no per-render recompute, no
// runtime branching). Pages get day-fresh dates on any browser reload.

export const REFERENCE_DATE = '2026-04-21'; // original "today" in the hand-authored mocks (Tue, Apr 21 2026)

// Today as 'YYYY-MM-DD' in the browser's local timezone. We use local-
// midnight Date math so DST flips don't push a day across the line.
export function todayStr() {
  const now = new Date();
  return ymd(now);
}

// Returns the Monday of the week containing `date` (defaults to today).
// Used to compute the current-week grid in Schedules.
export function mondayOf(date) {
  const d = date ? new Date(date) : new Date();
  const dow = d.getDay(); // 0=Sun..6=Sat
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + daysToMon);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Returns [{ dow, date: 'YYYY-MM-DD', label }] for Mon..Sun of the
// week containing today. dow matches Date.getDay() (Sun=0).
export function currentWeekDays() {
  return weekDaysFor();
}

// Same shape as currentWeekDays() but for the week containing `anchor`
// (a 'YYYY-MM-DD' string, or undefined for today). Used by Schedules
// to render an arbitrary navigated week.
export function weekDaysFor(anchor) {
  const mon = mondayOf(anchor ? anchor + 'T00:00:00' : undefined);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dow = d.getDay();
    out.push({ dow, date: ymd(d), label: labels[i] });
  }
  return out;
}

// Shift a 'YYYY-MM-DD' by N days (negative ok). Returns 'YYYY-MM-DD'.
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}

// Shift a 'YYYY-MM-DD' by N calendar months (negative ok). Returns 'YYYY-MM-DD'.
// Pins to last-of-month when the source day-of-month overflows (e.g. Jan 31
// + 1 month -> Feb 28/29).
export function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  const targetMonth = d.getMonth() + n;
  d.setDate(1);
  d.setMonth(targetMonth);
  // Clamp to last day of target month if original day-of-month overflows.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const srcDay = parseInt(dateStr.slice(8, 10), 10);
  d.setDate(Math.min(srcDay, lastDay));
  return ymd(d);
}

// "Tue, Apr 21" style label for the day view.
export function dayLabel(dateStr, lang) {
  const safeLang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat(safeLang, { weekday: 'short', month: 'short', day: 'numeric' }).format(d);
}

// "April 2026" style label for the month view.
export function monthLabel(dateStr, lang) {
  const safeLang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat(safeLang, { month: 'long', year: 'numeric' }).format(d);
}

// All days of the calendar month containing `anchor`. Returns
// [{ date, dow, day }]. Used by Deployments month view.
export function monthDaysFor(anchor) {
  const base = anchor ? new Date(anchor + 'T00:00:00') : new Date();
  const y = base.getFullYear();
  const m = base.getMonth();
  const out = [];
  const cur = new Date(y, m, 1);
  while (cur.getMonth() === m) {
    out.push({ date: ymd(cur), dow: cur.getDay(), day: cur.getDate() });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Compact "Mon 12 – Sun 18" style label for the schedules hero. Uses
// today's locale's month names so it reads naturally for the user.
export function weekRangeLabel(weekDays, lang) {
  if (!weekDays?.length) return '';
  const safeLang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const first = new Date(weekDays[0].date + 'T00:00:00');
  const last = new Date(weekDays[weekDays.length - 1].date + 'T00:00:00');
  const fmtDay = new Intl.DateTimeFormat(safeLang, { month: 'short', day: 'numeric' });
  return `${fmtDay.format(first)} – ${fmtDay.format(last)}`;
}

// rebase('2026-04-14') → today + (2026-04-14 - REFERENCE_DATE) days
// (i.e. shifts the input forward by the same delta today has moved
// from REFERENCE_DATE). Preserves relative gaps inside a dataset.
//
// Pass null / undefined / non-date strings through unchanged so the
// caller can blanket-rebase a field that's sometimes null (e.g.
// rollout.eta could be missing).
export function rebase(staticDate) {
  if (!staticDate || typeof staticDate !== 'string') return staticDate;
  const d = new Date(staticDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return staticDate;
  d.setDate(d.getDate() + dayDelta());
  return ymd(d);
}

// Days "today" has moved from REFERENCE_DATE. Memoized for module
// lifetime — every consumer at import time sees the same delta.
let _dayDeltaCache = null;
function dayDelta() {
  if (_dayDeltaCache !== null) return _dayDeltaCache;
  const today = new Date(todayStr() + 'T00:00:00');
  const ref = new Date(REFERENCE_DATE + 'T00:00:00');
  _dayDeltaCache = Math.round((today.getTime() - ref.getTime()) / 86400000);
  return _dayDeltaCache;
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
