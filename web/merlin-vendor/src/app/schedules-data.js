// Schedules — crew rosters and weekly shift assignments for cleaning,
// maintenance, and security teams. Mock data for the demo.
//
// Dates flow through `demo-dates.js` so the calendar always lines up
// with today. WEEK_DAYS = the current week (Mon → Sun). TODAY = the
// actual today. TIME_OFF dates are rebased relative to the original
// hand-authored reference date — relative gaps preserved, absolutes
// fresh every page load.
//
// Two demo variants ship today: the default (Meridian HQ-flavored —
// generic corporate-tower roster covering cleaning, maintenance and
// security) and IMF (DC government campus, restroom-ops emphasis to
// match the IMF demo narrative). selectSchedulesData(building) picks
// the right slice. Helpers (shiftFor / getTimeOff / coverageByDay /
// onShiftNow) accept an optional `data` arg so callers can drive them
// per-tenant; without it they fall back to the module-level defaults
// (the Meridian HQ roster), which keeps every legacy caller working.

import { currentWeekDays, todayStr, rebase } from './demo-dates.js';

export const SHIFT_TEAMS = [
  { id: 'cleaning', label: 'Cleaning', accent: '#10b981', icon: 'droplet' },
  { id: 'maintenance', label: 'Maintenance', accent: '#f59e0b', icon: 'hvac' },
  { id: 'security', label: 'Security', accent: '#3b82f6', icon: 'shield' },
];

export const SHIFT_TYPES = [
  { id: 'morning', label: 'Morning', start: '06:00', end: '14:00', tone: 'ok' },
  { id: 'evening', label: 'Evening', start: '14:00', end: '22:00', tone: 'warn' },
  { id: 'overnight', label: 'Overnight', start: '22:00', end: '06:00', tone: 'info' },
];

export const CREW = [
  // cleaning
  { id: 'c1', name: 'Maria Chen', team: 'cleaning', role: 'Lead Custodian', initials: 'MC' },
  { id: 'c2', name: 'Priya Shah', team: 'cleaning', role: 'Custodian', initials: 'PS' },
  { id: 'c3', name: 'Diego Ramirez', team: 'cleaning', role: 'Custodian', initials: 'DR' },
  { id: 'c4', name: 'Thandi Okafor', team: 'cleaning', role: 'Overnight crew', initials: 'TO' },
  // maintenance
  { id: 'm1', name: 'Darnell Price', team: 'maintenance', role: 'HVAC Tech', initials: 'DP' },
  { id: 'm2', name: 'Sofia Patel', team: 'maintenance', role: 'Electrician', initials: 'SP' },
  { id: 'm3', name: 'Marcus Lee', team: 'maintenance', role: 'Plumber', initials: 'ML' },
  // security
  { id: 's1', name: 'Ivan Kovac', team: 'security', role: 'Security Lead', initials: 'IK' },
  { id: 's2', name: 'Robin Akande', team: 'security', role: 'Lobby', initials: 'RA' },
  { id: 's3', name: 'Yusuf Habib', team: 'security', role: 'Patrol', initials: 'YH' },
];

// Per-crew weekly recurring schedule. dow: 0=Sun .. 6=Sat → shift_id.
export const WEEKLY_SCHEDULE = {
  c1: { 1: 'morning', 2: 'morning', 3: 'morning', 4: 'morning', 5: 'morning' },
  c2: { 1: 'morning', 2: 'morning', 3: 'morning', 4: 'morning', 5: 'morning', 6: 'morning' },
  c3: { 1: 'evening', 2: 'evening', 3: 'evening', 4: 'evening', 5: 'evening' },
  c4: { 0: 'overnight', 1: 'overnight', 2: 'overnight', 3: 'overnight', 4: 'overnight' },
  m1: { 1: 'morning', 2: 'morning', 3: 'morning', 4: 'morning', 5: 'morning' },
  m2: { 1: 'morning', 3: 'morning', 5: 'morning' },
  m3: { 2: 'evening', 4: 'evening' },
  s1: { 1: 'morning', 2: 'morning', 3: 'morning', 4: 'morning', 5: 'morning' },
  s2: { 0: 'morning', 1: 'evening', 2: 'evening', 5: 'evening', 6: 'evening' },
  s3: {
    0: 'overnight',
    1: 'overnight',
    2: 'overnight',
    3: 'overnight',
    4: 'overnight',
    5: 'overnight',
    6: 'overnight',
  },
};

export const TIME_OFF = [
  { id: 'to1', crewId: 'c2', date: rebase('2026-04-22'), kind: 'pto', reason: 'Family' },
  { id: 'to2', crewId: 'm2', date: rebase('2026-04-23'), kind: 'callout', reason: 'Sick' },
  { id: 'to3', crewId: 's2', date: rebase('2026-04-25'), kind: 'pto', reason: 'PTO' },
];

// Building → which data slice to use. Default (Meridian HQ) is the
// module-level CREW/WEEKLY_SCHEDULE/TIME_OFF; IMF overrides everything.
// Add future tenants here (warehouse roster for MDE, clinical for MHC,
// etc.) the same way — purely additive, no migration needed.
//
// Custom (user-created) buildings get an empty slice — the static
// Meridian roster is demo data that doesn't belong in a real tenant's
// schedule view. Surfaced by PRO TEST smoke-test 2026-05-18; same leak
// family as #430-434. SchedulesPage renders an empty-state card when
// CREW is empty.
export function selectSchedulesData(building) {
  if (building?.custom === true) {
    return { CREW: [], WEEKLY_SCHEDULE: {}, TIME_OFF: [] };
  }
  // IMF is a live device pilot — no demo crew/schedule fixtures. Empty CREW
  // renders the SchedulesPage empty-state card; real rosters populate once
  // configured. (IMF_CREW is retained for getCrewMeta deep-link resolution.)
  if (building?.variant === 'imf') {
    return { CREW: [], WEEKLY_SCHEDULE: {}, TIME_OFF: [] };
  }
  return { CREW, WEEKLY_SCHEDULE, TIME_OFF };
}

// Current week (Mon → Sun) computed at module load. dow matches
// Date.getDay() so Sunday=0 — keeps every downstream `shiftFor(dow)`
// caller working unchanged. Label strings stay short-form English
// here; consumers that need localized day labels use the date and
// Intl.DateTimeFormat directly.
export const WEEK_DAYS = currentWeekDays();

export const TODAY = todayStr();

export function getShiftMeta(id) {
  return SHIFT_TYPES.find((s) => s.id === id);
}
export function getTeamMeta(id) {
  return SHIFT_TEAMS.find((t) => t.id === id);
}

// All helpers below accept an optional `data` arg shaped like
// `{ CREW, WEEKLY_SCHEDULE, TIME_OFF }` — pass the result of
// selectSchedulesData(building) to drive the per-tenant slice. Without
// the arg, helpers fall back to the module-level defaults (Meridian HQ
// roster) so every legacy caller keeps working.

export function getTimeOff(crewId, dateStr, data) {
  const list = data?.TIME_OFF || TIME_OFF;
  return list.find((t) => t.crewId === crewId && t.date === dateStr) || null;
}

// Returns the shift assignment for a crew on a specific dow, or null if off
// or out (PTO/callout). Caller should also check getTimeOff for context.
export function shiftFor(crewId, dow, dateStr, data) {
  const off = getTimeOff(crewId, dateStr, data);
  if (off) return null;
  const ws = data?.WEEKLY_SCHEDULE || WEEKLY_SCHEDULE;
  return ws[crewId]?.[dow] || null;
}

// Coverage: how many people from each team are assigned to each day.
// `weekDays` defaults to the module-level current-week constant; callers
// rendering an arbitrary navigated week should pass weekDaysFor(anchor).
export function coverageByDay(data, weekDays = WEEK_DAYS) {
  const crew = data?.CREW || CREW;
  const out = {};
  for (const day of weekDays) {
    const counts = { cleaning: 0, maintenance: 0, security: 0 };
    for (const c of crew) {
      if (shiftFor(c.id, day.dow, day.date, data)) counts[c.team]++;
    }
    out[day.date] = counts;
  }
  return out;
}

// People currently on shift right now (uses TODAY + a fixed "now" hour).
// Returns array of { crew, shift }.
export function onShiftNow(nowHour = 11, data) {
  const today = WEEK_DAYS.find((d) => d.date === TODAY);
  if (!today) return [];
  const crew = data?.CREW || CREW;
  const out = [];
  for (const c of crew) {
    const shiftId = shiftFor(c.id, today.dow, today.date, data);
    if (!shiftId) continue;
    const shift = getShiftMeta(shiftId);
    const startH = parseInt(shift.start.split(':')[0], 10);
    const endH = parseInt(shift.end.split(':')[0], 10);
    const onShift = endH > startH ? nowHour >= startH && nowHour < endH : nowHour >= startH || nowHour < endH;
    if (onShift) out.push({ crew: c, shift });
  }
  return out;
}
