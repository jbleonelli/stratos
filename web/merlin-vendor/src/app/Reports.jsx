// Report builder — pick a type + scope + columns + format, preview, then
// generate a PDF or Excel. Pulls real rows from Postgres for the four
// types in LIVE_REPORT_TYPES; the rest fall back to SAMPLE_ROWS.
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card, IconBtn } from './primitives.jsx';
import {
  REPORT_TYPES,
  REPORTS,
  REPORT_TEMPLATES,
  SEEDED_PROFILES,
  loadUserProfiles,
  persistUserProfiles,
  filterReportsForRole,
  filterProfilesForRole,
  nextRunFromSchedule,
  scheduleLabel,
  humanizeReportDate,
} from './reports-data.js';
import { useSession } from './auth.js';
import { fetchReportRows, LIVE_REPORT_TYPES } from './reports-fetch.js';
import { useT } from './i18n.js';

// Column options per report type. Each entry: { id, label, default }.
const COLUMNS_BY_TYPE = {
  sla: [
    { id: 'time', labelKey: 'reports.col.timestamp', default: true },
    { id: 'incident', labelKey: 'reports.col.incident', default: true },
    { id: 'sla_name', labelKey: 'reports.col.sla', default: true },
    { id: 'response', labelKey: 'reports.col.response_time', default: true },
    { id: 'priority', labelKey: 'reports.col.priority', default: false },
    { id: 'outcome', labelKey: 'reports.col.outcome', default: true },
    { id: 'responder', labelKey: 'reports.col.responder', default: false },
  ],
  incident: [
    { id: 'time', labelKey: 'reports.col.timestamp', default: true },
    { id: 'priority', labelKey: 'reports.col.priority', default: true },
    { id: 'title', labelKey: 'reports.col.title', default: true },
    { id: 'location', labelKey: 'reports.col.location', default: true },
    { id: 'status', labelKey: 'reports.col.status', default: true },
    { id: 'merlin_auto', labelKey: 'reports.col.merlin_auto', default: true },
    { id: 'approver', labelKey: 'reports.col.approver', default: false },
    { id: 'duration', labelKey: 'reports.col.duration', default: false },
  ],
  compliance: [
    { id: 'time', labelKey: 'reports.col.nfc_time', default: true },
    { id: 'cleaner', labelKey: 'reports.col.cleaner', default: true },
    { id: 'location', labelKey: 'reports.col.location', default: true },
    { id: 'duration', labelKey: 'reports.col.duration', default: true },
    { id: 'in_verified', labelKey: 'reports.col.checkin', default: true },
    { id: 'out_verified', labelKey: 'reports.col.checkout', default: true },
    { id: 'incident_closed', labelKey: 'reports.col.incident_closed', default: false },
  ],
  energy: [
    { id: 'date', labelKey: 'reports.col.date', default: true },
    { id: 'kwh', labelKey: 'reports.col.kwh', default: true },
    { id: 'kwh_wn', labelKey: 'reports.col.kwh_wn', default: true },
    { id: 'setback', labelKey: 'reports.col.setback', default: true },
    { id: 'zone', labelKey: 'reports.col.zone', default: false },
    { id: 'peak', labelKey: 'reports.col.peak', default: false },
  ],
  security: [
    { id: 'time', labelKey: 'reports.col.timestamp', default: true },
    { id: 'event', labelKey: 'reports.col.event', default: true },
    { id: 'location', labelKey: 'reports.col.location', default: true },
    { id: 'person', labelKey: 'reports.col.person', default: true },
    { id: 'outcome', labelKey: 'reports.col.outcome', default: true },
    { id: 'clip', labelKey: 'reports.col.clip', default: false },
  ],
  satisfaction: [
    { id: 'date', labelKey: 'reports.col.date', default: true },
    { id: 'location', labelKey: 'reports.col.location', default: true },
    { id: 'rating', labelKey: 'reports.col.rating', default: true },
    { id: 'comments', labelKey: 'reports.col.comments', default: false },
    { id: 'context', labelKey: 'reports.col.context', default: false },
  ],
  financial: [
    { id: 'insight', labelKey: 'reports.col.insight', default: true },
    { id: 'category', labelKey: 'reports.col.category', default: true },
    { id: 'impact', labelKey: 'reports.col.annual_impact', default: true },
    { id: 'status', labelKey: 'reports.col.status', default: true },
    { id: 'realized', labelKey: 'reports.col.realized_ytd', default: true },
  ],
  device: [
    { id: 'id', labelKey: 'reports.col.device', default: true },
    { id: 'type', labelKey: 'reports.col.type', default: true },
    { id: 'location', labelKey: 'reports.col.location', default: true },
    { id: 'status', labelKey: 'reports.col.status', default: true },
    { id: 'uptime', labelKey: 'reports.col.uptime', default: true },
    { id: 'battery', labelKey: 'reports.col.battery', default: false },
    { id: 'firmware', labelKey: 'reports.col.firmware', default: false },
  ],
  occupancy: [
    { id: 'date', labelKey: 'reports.col.date', default: true },
    { id: 'location', labelKey: 'reports.col.location', default: true },
    { id: 'peak_hour', labelKey: 'reports.col.peak_hour', default: true },
    { id: 'peak_count', labelKey: 'reports.col.peak_count', default: true },
    { id: 'daily_entries', labelKey: 'reports.col.daily_entries', default: true },
    { id: 'context', labelKey: 'reports.col.context', default: false },
  ],
  custom: [{ id: 'prompt', labelKey: 'reports.col.prompt', default: true }],
};

// CSV-escape one cell. Wraps in double quotes and doubles any inner
// quotes so Excel + Numbers + Sheets all parse it correctly.
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Build CSV text from columns (with id + label) + row objects keyed by
// column id. Excel handles UTF-8 cleanly with a BOM prefix — added
// here so emoji status pills survive.
function buildCsv(columns, rows, t) {
  const lbl = (c) => (c.labelKey ? t(c.labelKey) : c.label || c.id);
  const header = columns.map((c) => csvEscape(lbl(c))).join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c.id])).join(',')).join('\n');
  return '﻿' + header + '\n' + body + '\n';
}

// Trigger a browser download of `text` as `filename`. Pure client —
// no server roundtrip. Used for the xlsx (CSV) format path.
function triggerDownload(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Approximate file size from CSV bytes.
function approxKb(text) {
  return Math.max(1, Math.round(new Blob([text]).size / 1024));
}

// Sample rows per type — what the preview + downloaded file would contain.
const SAMPLE_ROWS = {
  sla: [
    {
      time: '14:02',
      incident: 'VOC spike — Fl 32 E',
      sla_name: 'Hygiene · 20m',
      response: '6m 12s',
      priority: 'critical',
      outcome: 'met',
      responder: 'Maria C.',
    },
    {
      time: '13:45',
      incident: 'Occupancy peak — Fl 18',
      sla_name: 'Hygiene · 20m',
      response: '8m',
      priority: 'high',
      outcome: 'met',
      responder: 'Priya S.',
    },
    {
      time: '11:22',
      incident: 'HVAC drift — Fl 41',
      sla_name: 'Comfort · ±2°C',
      response: '—',
      priority: 'medium',
      outcome: 'ok',
      responder: 'Merlin',
    },
    {
      time: '10:40',
      incident: 'Ghost booking — Syc.',
      sla_name: 'Space',
      response: '30m',
      priority: 'high',
      outcome: 'auto-released',
      responder: 'Merlin',
    },
    {
      time: '09:14',
      incident: 'Water leak — Pantry',
      sla_name: 'Safety',
      response: '47s',
      priority: 'critical',
      outcome: 'contained',
      responder: 'Merlin',
    },
    {
      time: '08:22',
      incident: 'Waste bin 95% — Fl 24',
      sla_name: 'Hygiene · 20m',
      response: '2h 8m',
      priority: 'medium',
      outcome: 'met',
      responder: 'Diego R.',
    },
  ],
  incident: [
    {
      time: '14:02',
      priority: 'critical',
      title: 'VOC spike — Fl 32 East Restroom',
      location: 'Fl 32 · East',
      status: 'Resolved',
      merlin_auto: 'No (approved)',
      approver: 'Jamie',
      duration: '18m',
    },
    {
      time: '13:45',
      priority: 'high',
      title: 'Occupancy threshold — Fl 18 W',
      location: 'Fl 18 · W',
      status: 'Resolved',
      merlin_auto: 'No (approved)',
      approver: 'Jamie',
      duration: '14m',
    },
    {
      time: '11:22',
      priority: 'medium',
      title: 'HVAC drift — Fl 41 South',
      location: 'Fl 41 · S',
      status: 'Ok',
      merlin_auto: 'Yes',
      approver: '—',
      duration: '—',
    },
    {
      time: '10:40',
      priority: 'high',
      title: 'Ghost booking — Conf Sycamore',
      location: 'Fl 32',
      status: 'Released',
      merlin_auto: 'Yes',
      approver: '—',
      duration: '30m',
    },
    {
      time: '09:14',
      priority: 'critical',
      title: 'Water leak — Fl 12 Pantry',
      location: 'Fl 12 · Pantry',
      status: 'Contained',
      merlin_auto: 'Yes (valve closed)',
      approver: '—',
      duration: '47s',
    },
  ],
  compliance: [
    {
      time: '2026-04-20 14:02',
      cleaner: 'Maria Chen',
      location: 'Fl 32 · East RR',
      duration: '6m 04s',
      in_verified: '✓',
      out_verified: '✓',
      incident_closed: 'VOC spike',
    },
    {
      time: '2026-04-20 10:40',
      cleaner: 'Priya Shah',
      location: 'Fl 18 · W RR',
      duration: '5m 22s',
      in_verified: '✓',
      out_verified: '✓',
      incident_closed: '—',
    },
    {
      time: '2026-04-20 09:15',
      cleaner: 'Diego Ramirez',
      location: 'Fl 24 · Men\u2019s',
      duration: '4m 48s',
      in_verified: '✓',
      out_verified: '✓',
      incident_closed: 'Paper towel refill',
    },
    {
      time: '2026-04-20 08:30',
      cleaner: 'Maria Chen',
      location: 'Fl 05 · Main RR',
      duration: '5m 10s',
      in_verified: '✓',
      out_verified: '✓',
      incident_closed: '—',
    },
    {
      time: '2026-04-19 22:14',
      cleaner: 'Thandi Okafor',
      location: 'Lobby',
      duration: '12m 20s',
      in_verified: '✓',
      out_verified: '✓',
      incident_closed: '—',
    },
  ],
  energy: [
    { date: '2026-04-14', kwh: 42_180, kwh_wn: 41_920, setback: 1_180, zone: 'Tower-wide', peak: '18,214 kW' },
    { date: '2026-04-15', kwh: 41_742, kwh_wn: 41_450, setback: 1_220, zone: 'Tower-wide', peak: '17,980 kW' },
    { date: '2026-04-16', kwh: 43_120, kwh_wn: 42_780, setback: 1_090, zone: 'Tower-wide', peak: '18,802 kW' },
    { date: '2026-04-17', kwh: 41_980, kwh_wn: 41_640, setback: 1_280, zone: 'Tower-wide', peak: '18,118 kW' },
    { date: '2026-04-18', kwh: 38_204, kwh_wn: 38_010, setback: 2_184, zone: 'Tower-wide', peak: '16,204 kW' },
  ],
  security: [
    {
      time: '14:02',
      event: 'After-hours badge',
      location: 'Server Rm · Fl 32',
      person: 'K. Okafor',
      outcome: 'Authorized',
      clip: 'link',
    },
    {
      time: '11:22',
      event: 'Door held open',
      location: 'Loading Dock B',
      person: '—',
      outcome: '14m flag',
      clip: 'link',
    },
    {
      time: '09:14',
      event: 'Badge deny retries',
      location: 'Server Rm · Fl 18',
      person: 'B. Alvarez',
      outcome: 'Routed to Ivan',
      clip: 'link',
    },
    {
      time: '03:14',
      event: 'Tailgate · T2',
      location: 'Main lobby',
      person: 'Unknown',
      outcome: 'Under review',
      clip: 'link',
    },
  ],
  satisfaction: [
    { date: '2026-04-20', location: 'Fl 48 · Exec', rating: '5★', comments: 'Clean and fresh', context: 'after clean' },
    { date: '2026-04-20', location: 'Fl 24 · Men\u2019s', rating: '2★', comments: 'Paper out', context: 'supply low' },
    { date: '2026-04-19', location: 'Fl 32 · East', rating: '3★', comments: 'Smells', context: 'pre-VOC spike' },
    { date: '2026-04-19', location: 'Lobby', rating: '5★', comments: '—', context: '—' },
  ],
  financial: [
    { insight: 'Weekend HVAC setback', category: 'Energy', impact: '$31,400', status: 'In review', realized: '$0' },
    { insight: 'Dynamic cleaning dispatch', category: 'Cleaning', impact: '$18,200', status: 'New', realized: '$0' },
    { insight: 'Auto-release ghost bookings', category: 'Space', impact: '$7,800', status: 'New', realized: '$0' },
    {
      insight: 'Per-zone AHU filter cadence',
      category: 'Maintenance',
      impact: '$6,700',
      status: 'New',
      realized: '$0',
    },
    { insight: 'Motion-gated Garage L3', category: 'Lighting', impact: '$1,400', status: 'Approved', realized: '$420' },
  ],
  device: [
    {
      id: 'ADX-TD-0041',
      type: 'Touch eInk',
      location: 'Restroom W-05',
      status: 'Online',
      uptime: '99.8%',
      battery: '92%',
      firmware: '4.12.1',
    },
    {
      id: 'ADX-AQ-0018',
      type: 'Air Quality',
      location: 'Conf Fir · Fl 12',
      status: 'Degraded',
      uptime: '91%',
      battery: '34%',
      firmware: '2.8.4',
    },
    {
      id: 'ADX-WL-0051',
      type: 'Water Leak',
      location: 'Mech Rm · Fl 22',
      status: 'Online',
      uptime: '99.9%',
      battery: '81%',
      firmware: '1.2.0',
    },
    {
      id: 'ADX-CM-2210',
      type: 'Camera',
      location: 'Garage L3',
      status: 'Updating',
      uptime: '98.2%',
      battery: '—',
      firmware: '7.3.0-rc1',
    },
  ],
  custom: [{ prompt: 'Show me every Fl 32 restroom event this week with Merlin\u2019s response time.' }],
};

// ───────────────────────────── page ─────────────────────────────

export function ReportsPage({ building, role, onOpenChat }) {
  const t = useT();
  const [type, setType] = useState('sla');
  const [range, setRange] = useState('7d'); // 24h | 7d | 30d | 90d | qtd | ytd
  const [format, setFormat] = useState('pdf'); // pdf | xlsx
  const [selectedCols, setSelectedCols] = useState(
    () => new Set(COLUMNS_BY_TYPE.sla.filter((c) => c.default).map((c) => c.id)),
  );
  const [customPrompt, setCustomPrompt] = useState('');
  const [generated, setGenerated] = useState(null);

  // Schedule config for the report being built.
  const [schedule, setSchedule] = useState({
    enabled: false,
    cadence: 'weekly',
    dow: 1,
    dom: 1,
    hour: 6,
    minute: 0,
    recipients: '',
  });

  // Profiles (seeded + user-saved).
  const [userProfiles, setUserProfiles] = useState(() => loadUserProfiles());
  const [saveName, setSaveName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);

  const loadProfile = (p) => {
    setType(p.type);
    setRange(p.range || '7d');
    setFormat(p.format || 'pdf');
    setSelectedCols(new Set(p.columns || []));
    setSchedule({
      enabled: !!p.schedule?.enabled,
      cadence: p.schedule?.cadence || 'weekly',
      dow: p.schedule?.dow ?? 1,
      dom: p.schedule?.dom ?? 1,
      hour: p.schedule?.hour ?? 6,
      minute: p.schedule?.minute ?? 0,
      recipients: p.schedule?.recipients || '',
    });
    setCustomPrompt(p.type === 'custom' ? p.prompt || '' : '');
    setGenerated(null);
    setSaveOpen(false);
  };

  const saveProfile = () => {
    if (!saveName.trim()) return;
    const id = `prof-user-${Date.now()}`;
    const newProf = {
      id,
      name: saveName.trim(),
      type,
      range,
      format,
      columns: [...selectedCols],
      schedule: schedule.enabled ? { ...schedule } : { enabled: false },
      audience: role ? [role.id, 'facility'] : ['facility'],
      owner: role?.who || 'You',
      seeded: false,
      prompt: type === 'custom' ? customPrompt : undefined,
    };
    const next = [newProf, ...userProfiles];
    setUserProfiles(next);
    persistUserProfiles(next);
    setSaveName('');
    setSaveOpen(false);
  };

  const deleteProfile = (id) => {
    const next = userProfiles.filter((p) => p.id !== id);
    setUserProfiles(next);
    persistUserProfiles(next);
  };

  const toggleProfileSchedule = (id) => {
    const next = userProfiles.map((p) =>
      p.id === id ? { ...p, schedule: { ...p.schedule, enabled: !p.schedule?.enabled } } : p,
    );
    setUserProfiles(next);
    persistUserProfiles(next);
  };

  // When the report type changes, reset column selection to defaults.
  const changeType = (id) => {
    setType(id);
    setSelectedCols(new Set(COLUMNS_BY_TYPE[id].filter((c) => c.default).map((c) => c.id)));
    setGenerated(null);
  };

  const isImf = building?.variant === 'imf';
  const session = useSession();
  const orgId = session?.organizationId;

  const typeMeta = REPORT_TYPES[type];
  const TypeIcon = Icon[typeMeta.icon] || Icon.sla;
  const columns = COLUMNS_BY_TYPE[type] || [];
  // IMF is a live device pilot — no demo sample rows. Live report types fetch
  // from Postgres (empty until real data); non-live types render empty.
  const sampleRows = isImf ? [] : SAMPLE_ROWS[type] || [];

  // Live rows from Postgres for the report types we've wired
  // (LIVE_REPORT_TYPES = sla, incident, device, financial). Other
  // types stay on SAMPLE_ROWS until their source lands. We re-fetch
  // when the user changes type or range; building scope is folded
  // into the fetcher so per-building rows show up automatically.
  const [liveRows, setLiveRows] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);
  useEffect(() => {
    if (!LIVE_REPORT_TYPES.has(type)) {
      setLiveRows(null);
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    fetchReportRows({ type, range, orgId, building })
      .then((rows) => {
        if (!cancelled) setLiveRows(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, range, orgId, building?.id, building?.kind, building?.variant]);

  // Render preference: live rows when present (even if empty after a
  // successful fetch — empty range = empty report). Fall back to the
  // sample rows for non-live report types.
  const rows = liveRows != null ? liveRows : sampleRows;
  const isLive = liveRows != null;

  const visibleCols = columns.filter((c) => selectedCols.has(c.id));

  const rangeLabel = t(`reports.range.${range}`);

  const estRowCount = {
    '24h': 48,
    '7d': 320,
    '30d': 1280,
    '90d': 3840,
    qtd: 4610,
    ytd: 19240,
  }[range];

  const baseReports = isImf ? [] : REPORTS;
  const baseProfiles = isImf ? [] : SEEDED_PROFILES;

  const recentReports = useMemo(() => filterReportsForRole(baseReports, role?.id), [baseReports, role?.id]);

  const allProfiles = useMemo(
    () => filterProfilesForRole([...baseProfiles, ...userProfiles], role?.id),
    [baseProfiles, userProfiles, role?.id],
  );

  // Next 4 scheduled runs across enabled profiles, sorted by nearest.
  const upNext = useMemo(() => {
    const withNext = allProfiles
      .map((p) => ({ profile: p, next: nextRunFromSchedule(p.schedule) }))
      .filter((x) => x.next)
      .sort((a, b) => a.next - b.next);
    return withNext.slice(0, 4);
  }, [allProfiles]);

  // Build the file the user actually walks away with. Excel format
  // ships as CSV (Excel + Sheets + Numbers all open it natively);
  // PDF format calls window.print() against the preview area, which
  // lets the user "Save as PDF" from the browser's print dialog.
  const generate = () => {
    const colLabel = (c) => (c.labelKey ? t(c.labelKey) : c.label || c.id);

    if (type === 'custom') {
      // Custom prompt has no rows yet — drop a single-line CSV so
      // the user gets *something* and the download isn't silent.
      const text = `Prompt\n${csvEscape(customPrompt)}\n`;
      const filename = `merlin-custom-${range}.csv`;
      triggerDownload(filename, text);
      setGenerated({
        type,
        format: 'xlsx',
        range: rangeLabel,
        columns: ['Prompt'],
        generatedAt: new Date().toISOString(),
        fileName: filename,
        sizeKb: approxKb(text),
        kind: 'csv',
      });
      return;
    }

    if (format === 'xlsx') {
      const text = buildCsv(visibleCols, rows, t);
      const filename = `merlin-${type}-${range}.csv`;
      triggerDownload(filename, text);
      setGenerated({
        type,
        format: 'xlsx',
        range: rangeLabel,
        columns: visibleCols.map(colLabel),
        generatedAt: new Date().toISOString(),
        fileName: filename,
        sizeKb: approxKb(text),
        kind: 'csv',
        csvText: text,
      });
      return;
    }

    // PDF: tag the preview as the print target + invoke window.print.
    // The print stylesheet (rendered below as <style media="print">)
    // hides every other surface so the printable page is clean.
    setGenerated({
      type,
      format: 'pdf',
      range: rangeLabel,
      columns: visibleCols.map(colLabel),
      generatedAt: new Date().toISOString(),
      fileName: `merlin-${type}-${range}.pdf`,
      sizeKb: Math.max(40, Math.round(visibleCols.length * rows.length * 1.4)),
      kind: 'pdf',
    });
    // Defer so React paints the banner before the print dialog steals focus.
    setTimeout(() => window.print(), 50);
  };

  // Re-fire the same download (banner Download button). For PDF we
  // re-print; for CSV we rebuild the same text and download again.
  const redownload = () => {
    if (!generated) return;
    if (generated.kind === 'pdf') {
      window.print();
      return;
    }
    if (generated.csvText) {
      triggerDownload(generated.fileName, generated.csvText);
    } else {
      // Custom-prompt row was tiny — rebuild from prompt.
      const text = `Prompt\n${csvEscape(customPrompt)}\n`;
      triggerDownload(generated.fileName, text);
    }
  };

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
    >
      {/* Hero */}
      <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{ padding: 'var(--pad)', display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon.panel size={12} style={{ color: 'var(--accent)' }} />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 0.15,
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  fontWeight: 700,
                }}
              >
                {t('reports.hero.eyebrow', { workspace: building?.name || t('reports.hero.workspace_fallback') })}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
              {t('reports.hero.title')}
            </h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
              {t('reports.hero.body')}
            </p>
          </div>
          <button
            onClick={() => onOpenChat?.(t('reports.hero.draft_prompt'))}
            style={{
              padding: '9px 14px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
              boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 10px color-mix(in oklch, var(--accent) 30%, transparent)',
            }}
          >
            <Icon.sparkle size={12} /> {t('reports.hero.draft_btn')}
          </button>
        </div>
      </Card>

      {/* Up next scheduled runs */}
      {upNext.length > 0 && (
        <Card pad={false} style={{ flexShrink: 0 }}>
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Icon.sla size={14} style={{ color: 'var(--text-dim)' }} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t('reports.up_next.title')}</div>
            <Pill tone="accent">
              {t('reports.up_next.active', { n: allProfiles.filter((p) => p.schedule?.enabled).length })}
            </Pill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${upNext.length}, minmax(0, 1fr))` }}>
            {upNext.map(({ profile, next }, i) => {
              const rt = REPORT_TYPES[profile.type] || REPORT_TYPES.custom;
              const RtIcon = Icon[rt.icon] || Icon.paper;
              return (
                <div
                  key={profile.id}
                  style={{
                    padding: '12px 16px',
                    borderRight: i < upNext.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RtIcon size={12} style={{ color: `var(--${rt.tone})` }} />
                    <span
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.12,
                      }}
                    >
                      {rt.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {profile.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                    {relativeFrom(next, t)}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{scheduleLabel(profile.schedule)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Builder + preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
          gap: 'var(--pad)',
          flexShrink: 0,
        }}
      >
        {/* Builder config */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section number="1" title={t('reports.section.type')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.values(REPORT_TYPES).map((rt) => {
                const active = type === rt.id;
                const RtIcon = Icon[rt.icon] || Icon.sla;
                return (
                  <button
                    key={rt.id}
                    onClick={() => changeType(rt.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: active
                        ? `color-mix(in oklch, var(--${rt.tone}) 14%, transparent)`
                        : 'var(--surface-2)',
                      color: active ? `var(--${rt.tone})` : 'var(--text-soft)',
                      border: `1px solid ${active ? `color-mix(in oklch, var(--${rt.tone}) 40%, transparent)` : 'var(--border)'}`,
                      borderRadius: 7,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <RtIcon size={12} /> {rt.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {type === 'custom' ? (
            <Section number="2" title={t('reports.section.describe')}>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Every Fl 32 restroom event this week with Merlin's response time, grouped by day."
                style={{
                  width: '100%',
                  minHeight: 100,
                  padding: 10,
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  resize: 'vertical',
                  fontFamily: 'var(--font)',
                  fontSize: 12.5,
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>{t('reports.custom.hint')}</div>
            </Section>
          ) : (
            <Section number="2" title={t('reports.section.scope')}>
              <Label>{t('reports.label.date_range')}</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {[
                  ['24h', '24h'],
                  ['7d', '7d'],
                  ['30d', '30d'],
                  ['90d', '90d'],
                  ['qtd', 'QTD'],
                  ['ytd', 'YTD'],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setRange(k)}
                    style={{
                      padding: '6px 0',
                      fontSize: 11,
                      fontWeight: 600,
                      background: range === k ? 'var(--surface-3)' : 'var(--surface-2)',
                      color: range === k ? 'var(--text)' : 'var(--text-dim)',
                      border: `1px solid ${range === k ? 'var(--border-strong)' : 'var(--border)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6 }}>
                {t('reports.estimated_rows')} ·{' '}
                <b style={{ fontFamily: 'var(--mono)' }}>{estRowCount.toLocaleString()}</b>
              </div>
            </Section>
          )}

          {type !== 'custom' && (
            <Section number="3" title={t('reports.section.columns')}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 260,
                  overflow: 'auto',
                  paddingRight: 4,
                }}
              >
                {columns.map((c) => {
                  const checked = selectedCols.has(c.id);
                  return (
                    <label
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        background: checked ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${checked ? 'var(--accent-line)' : 'var(--border)'}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedCols((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            return next;
                          });
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span style={{ color: checked ? 'var(--accent)' : 'var(--text-soft)', fontWeight: 600 }}>
                        {c.labelKey ? t(c.labelKey) : c.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </Section>
          )}

          <Section number={type === 'custom' ? '3' : '4'} title={t('reports.section.format')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <FormatPick
                active={format === 'pdf'}
                onClick={() => setFormat('pdf')}
                label={t('reports.format.pdf')}
                sub={t('reports.format.pdf_sub')}
              />
              <FormatPick
                active={format === 'xlsx'}
                onClick={() => setFormat('xlsx')}
                label={t('reports.format.excel')}
                sub={t('reports.format.excel_sub')}
              />
            </div>
          </Section>

          <Section number={type === 'custom' ? '4' : '5'} title={t('reports.section.schedule')}>
            <SchedulePicker schedule={schedule} onChange={setSchedule} />
          </Section>

          {saveOpen ? (
            <div
              style={{
                padding: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--accent-line)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  fontWeight: 700,
                  letterSpacing: 0.12,
                  textTransform: 'uppercase',
                }}
              >
                {t('reports.save_as_profile')}
              </div>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={t('reports.save_profile_ph')}
                autoFocus
                style={{
                  padding: '8px 10px',
                  fontSize: 12.5,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontFamily: 'var(--font)',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={saveProfile}
                  disabled={!saveName.trim()}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: saveName.trim() ? 'var(--accent)' : 'var(--surface-3)',
                    color: saveName.trim() ? '#fff' : 'var(--text-dim)',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: saveName.trim() ? 'pointer' : 'default',
                  }}
                >
                  {t('reports.save_profile')}
                </button>
                <button
                  onClick={() => {
                    setSaveOpen(false);
                    setSaveName('');
                  }}
                  style={{
                    padding: '7px 10px',
                    background: 'transparent',
                    color: 'var(--text-soft)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('action.cancel')}
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                {schedule.enabled
                  ? t('reports.profile.scheduled', { label: scheduleLabel(schedule) })
                  : t('reports.profile.on_demand')}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSaveOpen(true)}
              style={{
                padding: '8px 10px',
                background: 'var(--surface-2)',
                color: 'var(--text-soft)',
                border: '1px dashed var(--border-strong)',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Icon.plus size={11} /> {t('reports.save_profile_btn')}
            </button>
          )}

          <button
            onClick={generate}
            disabled={type === 'custom' && !customPrompt.trim()}
            style={{
              marginTop: 4,
              padding: '10px 14px',
              background: type === 'custom' && !customPrompt.trim() ? 'var(--surface-3)' : 'var(--accent)',
              color: type === 'custom' && !customPrompt.trim() ? 'var(--text-dim)' : '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow:
                type === 'custom' && !customPrompt.trim()
                  ? 'none'
                  : '0 1px 0 rgba(0,0,0,0.04), 0 2px 10px color-mix(in oklch, var(--accent) 30%, transparent)',
            }}
          >
            <Icon.sparkle size={13} /> {t('reports.generate', { format: format.toUpperCase() })}
          </button>
        </Card>

        {/* Preview */}
        <Card pad={false} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: `color-mix(in oklch, var(--${typeMeta.tone}) 14%, transparent)`,
                color: `var(--${typeMeta.tone})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TypeIcon size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {t('reports.preview.report_label', { type: typeMeta.label })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {type === 'custom'
                  ? customPrompt.trim()
                    ? t('reports.preview.custom_will_draft')
                    : t('reports.preview.custom_describe')
                  : t('reports.preview.cols_rows', {
                      range: rangeLabel,
                      cols: visibleCols.length,
                      rows: estRowCount.toLocaleString(),
                    })}
              </div>
            </div>
            <Pill tone={format === 'pdf' ? 'risk' : 'ok'}>{format.toUpperCase()}</Pill>
            {LIVE_REPORT_TYPES.has(type) && (
              <Pill tone={loadingRows ? 'neutral' : isLive ? 'ok' : 'warn'}>
                {loadingRows
                  ? t('reports.live.loading')
                  : isLive
                    ? t('reports.live.live_rows', { n: rows.length })
                    : t('reports.live.sample')}
              </Pill>
            )}
          </div>

          <div id="merlin-print-target">
            {type === 'custom' ? (
              <CustomPreview prompt={customPrompt} />
            ) : (
              <PreviewTable cols={visibleCols} rows={rows} format={format} building={building} />
            )}
          </div>

          {generated && <GeneratedBanner r={generated} onDownload={redownload} onDismiss={() => setGenerated(null)} />}
        </Card>
      </div>

      {/* Saved profiles */}
      <Card pad={false} style={{ flexShrink: 0 }}>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('reports.saved_profiles')}</div>
          <Pill tone="accent">{allProfiles.length}</Pill>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {t('reports.saved.scheduled', {
              n: allProfiles.filter((p) => p.schedule?.enabled).length,
              m: allProfiles.filter((p) => !p.schedule?.enabled).length,
            })}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 10,
            padding: 14,
          }}
        >
          {allProfiles.map((p) => {
            const rt = REPORT_TYPES[p.type] || REPORT_TYPES.custom;
            const RtIcon = Icon[rt.icon] || Icon.paper;
            const isScheduled = !!p.schedule?.enabled;
            return (
              <div
                key={p.id}
                style={{
                  padding: 12,
                  background: 'var(--surface-2)',
                  border: `1px solid ${isScheduled ? 'var(--accent-line)' : 'var(--border)'}`,
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      flexShrink: 0,
                      background: `color-mix(in oklch, var(--${rt.tone}) 14%, transparent)`,
                      color: `var(--${rt.tone})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RtIcon size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                      {rt.label} · {p.format?.toUpperCase()} · {t('reports.saved.owner', { name: p.owner })}
                    </div>
                  </div>
                  {p.seeded && <Pill>{t('reports.saved.built_in')}</Pill>}
                </div>

                <div
                  style={{
                    padding: '8px 10px',
                    background: isScheduled
                      ? 'color-mix(in oklch, var(--accent) 8%, var(--surface))'
                      : 'var(--surface-3)',
                    border: `1px solid ${isScheduled ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: isScheduled ? 'var(--accent)' : 'var(--text-dim)',
                      fontWeight: 700,
                    }}
                  >
                    {isScheduled ? <Dot tone="accent" size={5} pulse /> : <Dot tone="off" size={5} />}
                    {scheduleLabel(p.schedule)}
                  </div>
                  {isScheduled && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                      {t('reports.saved.next', { when: relativeFrom(nextRunFromSchedule(p.schedule), t) })}
                    </div>
                  )}
                  {isScheduled && p.schedule?.recipients && (
                    <div
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-dim)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      → {p.schedule.recipients}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => loadProfile(p)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Icon.sparkle size={11} /> {t('reports.saved.run')}
                  </button>
                  {!p.seeded && (
                    <button
                      onClick={() => toggleProfileSchedule(p.id)}
                      title={t('reports.saved.toggle_tip')}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--surface)',
                        color: 'var(--text-soft)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isScheduled ? t('reports.saved.pause') : t('reports.saved.schedule')}
                    </button>
                  )}
                  {!p.seeded && (
                    <button
                      onClick={() => deleteProfile(p.id)}
                      title={t('reports.saved.delete_tip')}
                      style={{
                        width: 30,
                        padding: 0,
                        background: 'transparent',
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon.close size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {allProfiles.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: 40,
                textAlign: 'center',
                fontSize: 12.5,
                color: 'var(--text-dim)',
              }}
            >
              {(() => {
                const tmpl = t('reports.saved.empty', { bold: 'XBOLDX' });
                const [pre, post = ''] = tmpl.split('XBOLDX');
                return (
                  <>
                    {pre}
                    <b>{t('reports.save_profile_btn')}</b>
                    {post}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </Card>

      {/* Templates */}
      <Card pad={false} style={{ flexShrink: 0 }}>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.grid size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('reports.templates')}</div>
          <Pill>{REPORT_TEMPLATES.length}</Pill>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
            padding: 14,
          }}
        >
          {REPORT_TEMPLATES.map((tpl) => {
            const TIcon = Icon[tpl.icon] || Icon.sparkle;
            return (
              <button
                key={tpl.id}
                onClick={() => changeType(tpl.type)}
                style={{
                  textAlign: 'left',
                  padding: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TIcon size={13} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{tpl.name}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.45 }}>{tpl.desc}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 6, fontFamily: 'var(--mono)' }}>
                  {t('reports.templates.time_to_build', { m: tpl.timeMin })}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Recent */}
      <Card pad={false} style={{ flexShrink: 0 }}>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.paper size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('reports.recent')}</div>
          <Pill>{recentReports.length}</Pill>
        </div>
        <div>
          {recentReports.map((r, i) => {
            const rt = REPORT_TYPES[r.type] || REPORT_TYPES.custom;
            const RtIcon = Icon[rt.icon] || Icon.paper;
            return (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1.8fr) 120px 140px 80px 44px',
                  gap: 14,
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: i < recentReports.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: `color-mix(in oklch, var(--${rt.tone}) 14%, transparent)`,
                    color: `var(--${rt.tone})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RtIcon size={13} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>
                    {r.period} · {t('reports.recent.by', { author: r.author })}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  {humanizeReportDate(r.generatedAt)}
                </div>
                <div>
                  <Pill tone={r.status === 'draft' ? 'warn' : 'ok'}>{r.status}</Pill>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  {r.format.toUpperCase()} · {r.sizeKb}KB
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <IconBtn title={t('reports.recent.download_tip')}>
                    <Icon.ship size={12} />
                  </IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}

// ───────────────────────────── atoms ─────────────────────────────

function Section({ number, title, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {number}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: 'var(--text-dim)',
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4 }}>{children}</div>;
}

function FormatPick({ active, onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
        borderRadius: 7,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div
        style={{
          fontSize: 10.5,
          color: active ? 'var(--accent)' : 'var(--text-dim)',
          opacity: active ? 0.85 : 1,
          marginTop: 2,
        }}
      >
        {sub}
      </div>
    </button>
  );
}

function PreviewTable({ cols, rows, format, building }) {
  const t = useT();
  if (cols.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
        {t('reports.preview.pick_column')}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', overflow: 'auto' }}>
      {/* Paper-ish preview background */}
      <div
        style={{
          background: format === 'pdf' ? 'var(--surface)' : 'var(--surface-2)',
          padding: 16,
        }}
      >
        {/* Header */}
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
          {t('reports.preview.header', {
            date: new Date().toLocaleDateString(),
            workspace: building?.name || t('reports.hero.workspace_fallback'),
          })}
        </div>

        {/* Title bar */}
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{t('reports.preview.title')}</div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols.length}, minmax(min-content, 1fr))`,
              background: 'var(--surface-3)',
              padding: '8px 10px',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.12,
              gap: 10,
            }}
          >
            {cols.map((c) => (
              <div key={c.id}>{c.labelKey ? t(c.labelKey) : c.label}</div>
            ))}
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols.length}, minmax(min-content, 1fr))`,
                padding: '8px 10px',
                borderBottom: i < rows.length - 1 ? '1px dashed var(--border)' : 'none',
                fontSize: 11.5,
                gap: 10,
                color: 'var(--text-soft)',
              }}
            >
              {cols.map((c) => (
                <div
                  key={c.id}
                  style={{
                    fontFamily: /time|date|duration|kwh|setback|rating|battery|uptime|peak|id/.test(c.id)
                      ? 'var(--mono)'
                      : 'var(--font)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r[c.id] ?? '\u2014'}
                </div>
              ))}
            </div>
          ))}
          <div style={{ padding: '8px 10px', fontSize: 10.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            {t('reports.preview.sample_footer', { n: rows.length })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomPreview({ prompt }) {
  if (!prompt.trim()) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
        Type a prompt in the builder and Merlin will show a preview here.
      </div>
    );
  }
  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        <Icon.sparkle size={12} style={{ color: 'var(--accent)' }} /> Merlin’s plan
      </div>
      <div
        style={{
          padding: 12,
          background: 'var(--surface-2)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          fontSize: 12.5,
          color: 'var(--text-soft)',
          lineHeight: 1.55,
        }}
      >
        I'll gather {prompt.toLowerCase().includes('fl 32') ? 'Floor 32 restroom' : 'the relevant'} events, pivot by
        day, and include response-time breakdowns. Columns I think you want:{' '}
        <b>time, event, location, Merlin auto, response time</b>. Estimated <b>48 rows</b>.
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
        Click Generate and I'll render the file in about 8 seconds.
      </div>
    </div>
  );
}

function SchedulePicker({ schedule, onChange }) {
  const t = useT();
  const set = (patch) => onChange({ ...schedule, ...patch });
  const DOW = [
    t('reports.sched.dow.sun'),
    t('reports.sched.dow.mon'),
    t('reports.sched.dow.tue'),
    t('reports.sched.dow.wed'),
    t('reports.sched.dow.thu'),
    t('reports.sched.dow.fri'),
    t('reports.sched.dow.sat'),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!schedule.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: schedule.enabled ? 'var(--accent)' : 'var(--text-soft)' }}>
          {t('reports.sched.run_auto')}
        </span>
      </label>

      {schedule.enabled && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {[
              ['daily', t('reports.sched.daily')],
              ['weekly', t('reports.sched.weekly')],
              ['monthly', t('reports.sched.monthly')],
              ['quarterly', t('reports.sched.quarterly')],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => set({ cadence: k })}
                style={{
                  padding: '6px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  background: schedule.cadence === k ? 'var(--surface-3)' : 'var(--surface-2)',
                  color: schedule.cadence === k ? 'var(--text)' : 'var(--text-dim)',
                  border: `1px solid ${schedule.cadence === k ? 'var(--border-strong)' : 'var(--border)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {schedule.cadence === 'weekly' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {DOW.map((d, i) => (
                <button
                  key={i}
                  onClick={() => set({ dow: i })}
                  style={{
                    padding: '6px 0',
                    fontSize: 10.5,
                    fontWeight: 600,
                    background: schedule.dow === i ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: schedule.dow === i ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${schedule.dow === i ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 5,
                    cursor: 'pointer',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {(schedule.cadence === 'monthly' || schedule.cadence === 'quarterly') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)' }}>{t('reports.sched.day_of')}</span>
              <input
                type="number"
                min={1}
                max={28}
                value={schedule.dom}
                onChange={(e) => set({ dom: Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1)) })}
                style={{
                  width: 60,
                  padding: '6px 8px',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontFamily: 'var(--mono)',
                  outline: 'none',
                }}
              />
              <span style={{ color: 'var(--text-dim)' }}>
                {schedule.cadence === 'monthly' ? t('reports.sched.of_month') : t('reports.sched.of_quarter')}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-dim)' }}>{t('reports.sched.at')}</span>
            <input
              type="number"
              min={0}
              max={23}
              value={schedule.hour}
              onChange={(e) => set({ hour: Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)) })}
              style={{
                width: 52,
                padding: '6px 8px',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'var(--mono)',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--text-dim)' }}>:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={15}
              value={schedule.minute}
              onChange={(e) => set({ minute: Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)) })}
              style={{
                width: 52,
                padding: '6px 8px',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'var(--mono)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4 }}>
              {t('reports.sched.deliver_to')}
            </div>
            <input
              value={schedule.recipients}
              onChange={(e) => set({ recipients: e.target.value })}
              placeholder={t('reports.sched.deliver_ph')}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 12,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'var(--font)',
                outline: 'none',
              }}
            />
          </div>

          <div
            style={{
              padding: '8px 10px',
              background: 'color-mix(in oklch, var(--accent) 8%, var(--surface-2))',
              border: '1px solid var(--accent-line)',
              borderRadius: 6,
              fontSize: 11.5,
              color: 'var(--text-soft)',
            }}
          >
            <b style={{ color: 'var(--accent)' }}>{scheduleLabel(schedule)}</b> ·{' '}
            {t('reports.sched.next_run', { when: relativeFrom(nextRunFromSchedule(schedule), t) })}
          </div>
        </>
      )}
    </div>
  );
}

// Relative-time label for a future (or very recent) Date; mirrors the
// app's demo "today" reference.
function relativeFrom(date, t) {
  if (!date) return '\u2014';
  const ref = new Date('2026-04-20T12:00:00');
  const diff = date - ref;
  const mins = Math.round(diff / 60000);
  if (!t) {
    if (Math.abs(mins) < 60) return mins <= 0 ? 'due now' : `in ${mins}m`;
    const hours0 = Math.round(mins / 60);
    if (Math.abs(hours0) < 48) return `in ${hours0}h`;
    const days0 = Math.round(hours0 / 24);
    if (Math.abs(days0) < 60) return `in ${days0}d`;
    return `in ${Math.round(days0 / 30)}mo`;
  }
  if (Math.abs(mins) < 60) return mins <= 0 ? t('reports.rel.due_now') : t('reports.rel.in_min', { n: mins });
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return t('reports.rel.in_hour', { n: hours });
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 60) return t('reports.rel.in_day', { n: days });
  const months = Math.round(days / 30);
  return t('reports.rel.in_month', { n: months });
}

function GeneratedBanner({ r, onDownload, onDismiss }) {
  const t = useT();
  const isPdf = r.kind === 'pdf';
  return (
    <div
      className="merlin-no-print"
      style={{
        margin: '0 16px 16px',
        padding: 12,
        background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Icon.check size={14} style={{ color: 'var(--ok)' }} />
      <div style={{ flex: 1, fontSize: 12 }}>
        {(() => {
          const tmpl = t('reports.gen.ready', { file: 'XFILEX', kb: r.sizeKb, n: r.columns.length });
          const [pre, post = ''] = tmpl.split('XFILEX');
          return (
            <>
              {pre}
              <b style={{ color: 'var(--ok)' }}>{r.fileName}</b>
              {post}
            </>
          );
        })()}
        {isPdf && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{t('reports.gen.pdf_hint')}</span>}
      </div>
      <button
        onClick={onDownload}
        style={{
          padding: '6px 12px',
          background: 'var(--ok)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Icon.ship size={11} /> {isPdf ? t('reports.gen.print_again') : t('reports.gen.download_again')}
      </button>
      <IconBtn onClick={onDismiss} title={t('reports.gen.dismiss')}>
        <Icon.close size={12} />
      </IconBtn>
    </div>
  );
}
