// Reports — PDF / digest deliverables Merlin drafts automatically or on demand.

export const REPORT_TYPES = {
  sla: { id: 'sla', label: 'SLA', icon: 'sla', tone: 'warn' },
  incident: { id: 'incident', label: 'Incidents', icon: 'bell', tone: 'risk' },
  compliance: { id: 'compliance', label: 'Compliance', icon: 'shield', tone: 'ok' },
  energy: { id: 'energy', label: 'Energy', icon: 'bolt', tone: 'warn' },
  security: { id: 'security', label: 'Security', icon: 'shield', tone: 'info' },
  satisfaction: { id: 'satisfaction', label: 'Satisfaction', icon: 'check', tone: 'accent' },
  financial: { id: 'financial', label: 'Financial', icon: 'bolt', tone: 'accent' },
  device: { id: 'device', label: 'Device health', icon: 'grid', tone: 'info' },
  occupancy: { id: 'occupancy', label: 'Occupancy', icon: 'grid', tone: 'accent' },
  custom: { id: 'custom', label: 'Custom', icon: 'sparkle', tone: 'accent' },
};

// Reports already on the shelf.
export const REPORTS = [
  {
    id: 'rep-001',
    title: 'Weekly cleaning SLA summary',
    type: 'sla',
    period: 'Week of Apr 14–20',
    generatedAt: '2026-04-20T06:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 214,
    pages: 8,
    recipients: ['Jamie Lin', 'Priya Shah', 'Ayesha Rahman'],
    highlights: ['98.2% Hygiene SLA attainment', '2 near-misses · Fl 32 East', '41 NFC-verified cleanings'],
    audience: ['facility', 'cleaning'],
  },
  {
    id: 'rep-002',
    title: 'Monthly incident digest · March',
    type: 'incident',
    period: 'March 2026',
    generatedAt: '2026-04-01T08:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 428,
    pages: 12,
    recipients: ['Jamie Lin'],
    highlights: [
      '127 incidents · 94% auto-resolved',
      '6 SLA breaches (2 avoidable)',
      '$312 recovered via ghost-booking release',
    ],
    audience: ['facility'],
  },
  {
    id: 'rep-003',
    title: 'Quarterly compliance audit trail',
    type: 'compliance',
    period: 'Q1 2026',
    generatedAt: '2026-04-04T10:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 1820,
    pages: 42,
    recipients: ['Priya Shah', 'Legal'],
    highlights: [
      'NFC cleaning evidence · 100% coverage',
      'Firmware provenance · 576/578 on stable',
      'SOC 2 CC-6.2 controls pass',
    ],
    audience: ['facility', 'security', 'cleaning'],
  },
  {
    id: 'rep-004',
    title: 'Monthly energy usage',
    type: 'energy',
    period: 'March 2026',
    generatedAt: '2026-04-02T07:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 612,
    pages: 14,
    recipients: ['Jamie Lin', 'Darnell Price'],
    highlights: [
      '−7.2% YoY · weather-normalized',
      'HVAC auto-balance saved $2,148',
      'Setback schedule drift flagged (Zone B)',
    ],
    audience: ['facility', 'maintenance'],
  },
  {
    id: 'rep-005',
    title: 'Weekly after-hours security review',
    type: 'security',
    period: 'Week of Apr 14–20',
    generatedAt: '2026-04-20T07:30:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 184,
    pages: 6,
    recipients: ['Ivan Kovac', 'Jamie Lin'],
    highlights: ['1,284 badge events · 4 flagged', 'Loading Dock B held open 14m (Thu)', '0 tailgate events · T1-T4'],
    audience: ['facility', 'security'],
  },
  {
    id: 'rep-006',
    title: 'Building satisfaction · weekly digest',
    type: 'satisfaction',
    period: 'Week of Apr 14–20',
    generatedAt: '2026-04-20T06:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 162,
    pages: 4,
    recipients: ['Jamie Lin'],
    highlights: ['4.38★ average (+0.08 WoW)', '3,550 ratings logged', 'Needs attention: Fl 24 Men\u2019s'],
    audience: ['facility', 'cleaning'],
  },
  {
    id: 'rep-007',
    title: 'CFO scorecard · Merlin savings YTD',
    type: 'financial',
    period: 'Jan–Apr 2026',
    generatedAt: '2026-04-15T09:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 342,
    pages: 10,
    recipients: ['CFO', 'Jamie Lin'],
    highlights: ['$47,400 realized savings', '7 insights implemented', '$98,200 still in pipeline'],
    audience: ['facility'],
  },
  {
    id: 'rep-008',
    title: 'Custodian performance · March',
    type: 'satisfaction',
    period: 'March 2026',
    generatedAt: '2026-04-01T06:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 248,
    pages: 9,
    recipients: ['Maria Chen', 'Priya Shah'],
    highlights: ['Avg route time 4m 52s', 'Maria: 4.7★ · Diego: 4.5★', '6 training opportunities identified'],
    audience: ['facility', 'cleaning'],
  },
  {
    id: 'rep-009',
    title: 'Monthly device health',
    type: 'device',
    period: 'March 2026',
    generatedAt: '2026-04-02T05:00:00',
    author: 'Merlin',
    status: 'ready',
    format: 'pdf',
    sizeKb: 198,
    pages: 5,
    recipients: ['Darnell Price'],
    highlights: ['99.87% fleet uptime', '3,776 devices across 50 floors', '12 predicted failures · pre-ordered'],
    audience: ['facility', 'maintenance'],
  },
  {
    id: 'rep-010',
    title: 'Quarterly board report',
    type: 'custom',
    period: 'Q1 2026',
    generatedAt: '2026-04-10T14:00:00',
    author: 'Ayesha Rahman',
    status: 'ready',
    format: 'pdf',
    sizeKb: 2940,
    pages: 48,
    recipients: ['Board'],
    highlights: ['SLA posture · all green', '−7.2% energy YoY', 'Merlin-driven $47k in realized savings'],
    audience: ['facility'],
  },
  {
    id: 'rep-011',
    title: 'Annual fire-safety compliance',
    type: 'compliance',
    period: 'FY 2025 (filed Q1 2026)',
    generatedAt: '2026-02-28T11:00:00',
    author: 'Priya Shah',
    status: 'ready',
    format: 'pdf',
    sizeKb: 3820,
    pages: 86,
    recipients: ['NYC Fire Dept', 'Priya Shah'],
    highlights: ['All 50 floors inspected', 'Sprinkler flow · verified', '0 violations · filed on time'],
    audience: ['facility'],
  },
  {
    id: 'rep-012',
    title: 'Draft · HVAC optimization proposal',
    type: 'energy',
    period: 'Proposal for Q2 rollout',
    generatedAt: '2026-04-18T15:30:00',
    author: 'Darnell Price',
    status: 'draft',
    format: 'pdf',
    sizeKb: 84,
    pages: 3,
    recipients: [],
    highlights: ['Weekend setback · $31.4k/yr', 'Summer +1°C · $4.8k/yr', 'Pending Jamie\u2019s review'],
    audience: ['facility', 'maintenance'],
  },
];

// One-click report templates.
export const REPORT_TEMPLATES = [
  {
    id: 't-001',
    name: 'SLA performance',
    desc: 'Coverage and near-misses for a single SLA over any window.',
    type: 'sla',
    icon: 'sla',
    timeMin: 2,
    audience: ['facility', 'cleaning', 'maintenance'],
  },
  {
    id: 't-002',
    name: 'Incident digest',
    desc: 'Every incident, grouped by priority + Merlin autonomy.',
    type: 'incident',
    icon: 'bell',
    timeMin: 2,
    audience: ['facility'],
  },
  {
    id: 't-003',
    name: 'Compliance audit',
    desc: 'NFC trail, firmware provenance, and SOC 2 control evidence.',
    type: 'compliance',
    icon: 'shield',
    timeMin: 4,
    audience: ['facility', 'security', 'cleaning'],
  },
  {
    id: 't-004',
    name: 'Energy usage',
    desc: 'Weather-normalized kWh by zone with setback savings called out.',
    type: 'energy',
    icon: 'bolt',
    timeMin: 3,
    audience: ['facility', 'maintenance'],
  },
  {
    id: 't-005',
    name: 'CFO scorecard',
    desc: 'Merlin insights realized + in-pipeline dollar impact.',
    type: 'financial',
    icon: 'bolt',
    timeMin: 2,
    audience: ['facility'],
  },
  {
    id: 't-006',
    name: 'Custom (prompt Merlin)',
    desc: 'Describe what you need in plain language; Merlin drafts it.',
    type: 'custom',
    icon: 'sparkle',
    timeMin: 5,
    audience: ['facility', 'cleaning', 'maintenance', 'security'],
  },
];

export function filterReportsForRole(list, roleId) {
  if (!roleId || roleId === 'facility') return list;
  return list.filter((r) => Array.isArray(r.audience) && r.audience.includes(roleId));
}

// Humanize a timestamp relative to the app's "today" (2026-04-20).
export function humanizeReportDate(iso) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const today = new Date('2026-04-20T12:00:00');
  const days = Math.round((today - d) / 86400000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (days === 0) return `today \u00b7 ${hh}:${mm}`;
  if (days === 1) return `yesterday \u00b7 ${hh}:${mm}`;
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  const months = Math.round(days / 30);
  if (days < 730) return `${months}mo ago`;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ───────────────────────── report profiles ─────────────────────────
// A "profile" is a saved builder configuration. It can run on-demand or on
// a recurring schedule. Seeded profiles ship with the app; user-created ones
// live in localStorage and can be edited freely.

// Schedule shape:
//   { enabled: bool, cadence: 'daily'|'weekly'|'monthly'|'quarterly',
//     dow?: 0-6 (Sun..Sat, used for weekly),
//     dom?: 1-31 (used for monthly),
//     hour: 0-23, minute: 0-59,
//     recipients?: 'Jamie, Priya' }
//
// Profile shape:
//   { id, name, type, range, format, columns: [], schedule: Schedule,
//     audience: [], owner: 'Merlin' | user, seeded: bool }

export const SEEDED_PROFILES = [
  {
    id: 'prof-001',
    name: 'Weekly cleaning SLA summary',
    type: 'sla',
    range: '7d',
    format: 'pdf',
    columns: ['time', 'incident', 'sla_name', 'response', 'outcome', 'responder'],
    schedule: {
      enabled: true,
      cadence: 'weekly',
      dow: 1,
      hour: 6,
      minute: 0,
      recipients: 'Jamie Lin, Priya Shah, Ayesha Rahman',
    },
    audience: ['facility', 'cleaning'],
    owner: 'Merlin',
    seeded: true,
  },
  {
    id: 'prof-002',
    name: 'Monthly incident digest',
    type: 'incident',
    range: '30d',
    format: 'pdf',
    columns: ['time', 'priority', 'title', 'location', 'status', 'merlin_auto'],
    schedule: { enabled: true, cadence: 'monthly', dom: 1, hour: 8, minute: 0, recipients: 'Jamie Lin' },
    audience: ['facility'],
    owner: 'Merlin',
    seeded: true,
  },
  {
    id: 'prof-003',
    name: 'Quarterly compliance audit',
    type: 'compliance',
    range: 'qtd',
    format: 'pdf',
    columns: ['time', 'cleaner', 'location', 'duration', 'in_verified', 'out_verified'],
    schedule: { enabled: true, cadence: 'quarterly', dom: 1, hour: 10, minute: 0, recipients: 'Priya Shah, Legal' },
    audience: ['facility', 'security', 'cleaning'],
    owner: 'Merlin',
    seeded: true,
  },
  {
    id: 'prof-004',
    name: 'CFO scorecard',
    type: 'financial',
    range: 'ytd',
    format: 'pdf',
    columns: ['insight', 'category', 'impact', 'status', 'realized'],
    schedule: { enabled: true, cadence: 'monthly', dom: 15, hour: 9, minute: 0, recipients: 'CFO, Jamie Lin' },
    audience: ['facility'],
    owner: 'Merlin',
    seeded: true,
  },
  {
    id: 'prof-005',
    name: 'Daily fleet health snapshot',
    type: 'device',
    range: '24h',
    format: 'xlsx',
    columns: ['id', 'type', 'location', 'status', 'uptime', 'battery'],
    schedule: { enabled: true, cadence: 'daily', hour: 5, minute: 0, recipients: 'Darnell Price' },
    audience: ['facility', 'maintenance'],
    owner: 'Merlin',
    seeded: true,
  },
  {
    id: 'prof-006',
    name: 'Board report',
    type: 'custom',
    range: 'qtd',
    format: 'pdf',
    columns: ['prompt'],
    schedule: { enabled: false },
    audience: ['facility'],
    owner: 'Ayesha Rahman',
    seeded: true,
  },
];

const USER_PROFILES_KEY = 'merlin-user-report-profiles';

export function loadUserProfiles() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(USER_PROFILES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function persistUserProfiles(list) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(list));
  } catch {}
}

export function filterProfilesForRole(list, roleId) {
  if (!roleId || roleId === 'facility') return list;
  return list.filter((p) => Array.isArray(p.audience) && p.audience.includes(roleId));
}

// Given a schedule object, compute the next run timestamp relative to a
// reference date (defaults to app "today").
export function nextRunFromSchedule(schedule, reference = new Date('2026-04-20T12:00:00')) {
  if (!schedule || !schedule.enabled) return null;
  const { cadence, dow = 1, dom = 1, hour = 6, minute = 0 } = schedule;
  const next = new Date(reference);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);

  if (cadence === 'daily') {
    if (next <= reference) next.setDate(next.getDate() + 1);
    return next;
  }
  if (cadence === 'weekly') {
    const diff = (dow - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + diff);
    if (next <= reference) next.setDate(next.getDate() + 7);
    return next;
  }
  if (cadence === 'monthly') {
    next.setDate(dom);
    if (next <= reference) next.setMonth(next.getMonth() + 1);
    return next;
  }
  if (cadence === 'quarterly') {
    const currentQuarterStart = new Date(
      reference.getFullYear(),
      Math.floor(reference.getMonth() / 3) * 3,
      dom,
      hour,
      minute,
    );
    if (currentQuarterStart > reference) return currentQuarterStart;
    return new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth() + 3, dom, hour, minute);
  }
  return null;
}

const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function scheduleLabel(schedule) {
  if (!schedule || !schedule.enabled) return 'On demand';
  const hhmm = `${String(schedule.hour ?? 6).padStart(2, '0')}:${String(schedule.minute ?? 0).padStart(2, '0')}`;
  if (schedule.cadence === 'daily') return `Every day at ${hhmm}`;
  if (schedule.cadence === 'weekly') return `Every ${DOW_LABEL[schedule.dow ?? 1]} at ${hhmm}`;
  if (schedule.cadence === 'monthly') return `${ordinal(schedule.dom ?? 1)} of each month at ${hhmm}`;
  if (schedule.cadence === 'quarterly') return `${ordinal(schedule.dom ?? 1)} of each quarter at ${hhmm}`;
  return 'Scheduled';
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
