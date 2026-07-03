// Deployments — plan rollouts, provision devices, schedule installers.
// Phase H-5: rollout data derives from the DB device fleet for any
// building seeded through the scenario pipeline. Meridian HQ (the
// static 'hq' demo) keeps its hand-authored ROLLOUTS narrative, and
// the two ecosystem buildings (IMF, NYBank) keep their bespoke arrays.
// Install calendar, installers, templates, and procurement queue are
// still static demo decoration — DB-backing those needs a separate
// phase with its own schema.
import React, { useState, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card, IconBtn } from './primitives.jsx';
import { DEVICE_TYPES } from './devices-data.js';
import { useT, useLanguage } from './i18n.js';
import {
  weekDaysFor,
  monthDaysFor,
  addDays,
  addMonths,
  dayLabel,
  monthLabel,
  weekRangeLabel,
  todayStr as demoTodayStr,
} from './demo-dates.js';
import {
  INSTALLERS,
  STAGES,
  ROLLOUTS,
  TEMPLATES,
  PROVISIONING_QUEUE,
  INSTALL_CALENDAR,
  installerById,
} from './deployments-data.js';
import { ECOSYSTEM_ROLLOUTS, ECOSYSTEM_PROVISIONING_QUEUE, ECOSYSTEM_INSTALL_CALENDAR } from './ecosystem-data.js';
import { useFleetViewModel, computeActiveRollouts } from './devices-store.js';

export function DeploymentsPage({ onOpenChat, building }) {
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const isEcosystem = building?.kind === 'ecosystem';
  const isImf = building?.variant === 'imf';
  const isMeridian = building?.id === 'hq';

  // DB-backed buildings (everything except Meridian HQ, NYBank) derive
  // rollouts from live device firmware state. IMF is a live device pilot, so
  // it joins the derived path too — empty until real devices report a pending
  // firmware update — instead of showing demo rollouts/calendar/queue.
  const { fleet } = useFleetViewModel(building);
  const derivedRollouts = useMemo(() => computeActiveRollouts(fleet), [fleet]);
  const useDerived = isImf || (!isEcosystem && !isMeridian);

  const rollouts = useDerived ? derivedRollouts : isEcosystem ? ECOSYSTEM_ROLLOUTS : ROLLOUTS;
  const queue = isEcosystem ? ECOSYSTEM_PROVISIONING_QUEUE : PROVISIONING_QUEUE;
  const calendar = isEcosystem ? ECOSYSTEM_INSTALL_CALENDAR : INSTALL_CALENDAR;

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
      <DeploymentsHero
        onPlan={() => setPlannerOpen(true)}
        rollouts={rollouts}
        queue={queue}
        calendar={calendar}
        building={building}
        useDerived={useDerived}
      />
      {useDerived ? (
        // DB-backed scenario — show derived rollouts only. The install
        // calendar, provisioning queue, and installer chips all need their
        // own DB schemas to be meaningful per-building; leaving them off
        // rather than showing Meridian's bespoke data out of context.
        <DerivedActiveRollouts onOpenChat={onOpenChat} rollouts={rollouts} />
      ) : (
        <>
          <InstallCalendar calendar={calendar} />
          <ActiveRollouts onOpenChat={onOpenChat} rollouts={rollouts} />
          <ProvisioningQueue queue={queue} />
        </>
      )}
      {/* Hide rollout templates when the building has no devices yet.
          Each TEMPLATES entry carries a hardcoded `usedBy` count ("Used
          4×") that reads as fake history for a fresh tenant — same leak
          family as #430-433. Templates are a "scaling up" tool; for a
          fresh tenant the right move is to add a first device, not pick
          a bundle of 10. PRO TEST smoke-test 2026-05-18. */}
      {!isImf && (fleet?.length ?? 0) > 0 && (
        <Templates
          onUse={(t) => {
            setSelectedTemplate(t);
            setPlannerOpen(true);
          }}
        />
      )}
      {plannerOpen && (
        <NewRolloutPlanner
          template={selectedTemplate}
          onClose={() => {
            setPlannerOpen(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </main>
  );
}

// ─────────────────────────── DERIVED ROLLOUTS (DB) ───────────────────────────
// Simpler than ActiveRollouts — derived rollouts don't carry installer,
// budget, or per-floor breakdowns, so the expanded detail view has
// nothing useful to show. Render each rollout as a row with name +
// stage bar + target firmware + device count.
function DerivedActiveRollouts({ onOpenChat, rollouts }) {
  const t = useT();
  if (!rollouts || rollouts.length === 0) {
    return (
      <Card>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <Icon.ship size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t('deployments.no_rollouts')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{t('deployments.no_rollouts_body')}</div>
        </div>
      </Card>
    );
  }
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.ship size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('deployments.active_rollouts')}</div>
        <Pill>{rollouts.length}</Pill>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onOpenChat?.('Summarize rollout risk')}
          style={{
            padding: '4px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--accent-line)',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icon.sparkle size={11} /> {t('deployments.ask_merlin')}
        </button>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rollouts.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(240px, 1.2fr) minmax(320px, 2fr) 90px',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                {t('deployments.derived.meta', {
                  type: DEVICE_TYPES[r.type]?.short || r.type,
                  n: r.total,
                  v: r.target,
                })}
              </div>
            </div>
            <StageBar stages={r.stages} />
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                color: 'var(--accent)',
                textAlign: 'right',
              }}
            >
              {Math.round(r.pct * 100)}%
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────── HERO ───────────────────────────

function DeploymentsHero({
  onPlan,
  rollouts = ROLLOUTS,
  queue = PROVISIONING_QUEUE,
  calendar = INSTALL_CALENDAR,
  building,
  useDerived = false,
}) {
  const t = useT();
  const isEcosystem = building?.kind === 'ecosystem';
  const activeCount = rollouts.length;
  const devicesInPipeline = useDerived
    ? rollouts.reduce((s, r) => s + (r.total || 0), 0)
    : rollouts.reduce((s, r) => s + Object.values(r.stages).reduce((a, b) => a + b, 0) / 6, 0);
  // Install-calendar + installers are Meridian-demo only; skip the
  // "next install" + "installer utilization" lines when rendering a
  // DB-backed scenario.
  const nextInstall = useDerived ? null : calendar[0];
  const nextInstaller = nextInstall ? installerById(nextInstall.installer) : null;
  const avgUtil = useDerived
    ? null
    : Math.round((INSTALLERS.reduce((s, i) => s + i.utilization, 0) / INSTALLERS.length) * 100);

  return (
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
      <div style={{ padding: 'var(--pad)', display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Dot tone="accent" pulse />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('deployments.hero.eyebrow', { ws: building?.name || t('deployments.hero.workspace_fallback') })}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.01, color: 'var(--text)' }}>
            {t('deployments.hero.title', { active: activeCount, n: Math.round(devicesInPipeline) })}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
            {useDerived ? (
              activeCount === 0 ? (
                t('deployments.hero.body_derived_zero')
              ) : (
                <>
                  {activeCount > 1
                    ? t('deployments.hero.body_derived_pres', { n: activeCount })
                    : t('deployments.hero.body_derived_pre', { n: activeCount })}
                  {t('deployments.hero.body_derived_post')}
                  <b>{t('deployments.hero.body_derived_devices', { n: Math.round(devicesInPipeline) })}</b>
                  {t('deployments.hero.body_derived_in')}
                  <b>{building?.name || t('deployments.hero.workspace_fallback')}</b>
                  {t('deployments.hero.body_derived_tail')}
                </>
              )
            ) : isEcosystem && building?.variant === 'imf' ? (
              <>
                {t('deployments.hero.body_imf_pre')}
                <b>{t('deployments.hero.body_imf_campus')}</b>
                {t('deployments.hero.body_imf_post')}
                <b>{nextInstall.title}</b>
                {t('deployments.hero.body_with_pre')}
                <b>{nextInstaller.name}</b>
                {t('deployments.hero.body_when', { date: nextInstall.date, time: nextInstall.start })}
                {t('deployments.hero.body_three_pre')}
                <b>{t('deployments.hero.body_three_util', { n: avgUtil })}</b>
                {t('deployments.hero.body_three_post')}
              </>
            ) : isEcosystem ? (
              <>
                {t('deployments.hero.body_eco_pre')}
                <b>{t('deployments.hero.body_eco_branches')}</b>
                {t('deployments.hero.body_eco_post')}
                <b>{nextInstall.title}</b>
                {t('deployments.hero.body_with_pre')}
                <b>{nextInstaller.name}</b>
                {t('deployments.hero.body_when', { date: nextInstall.date, time: nextInstall.start })}
                {t('deployments.hero.body_three_pre')}
                <b>{t('deployments.hero.body_three_util', { n: avgUtil })}</b>
                {t('deployments.hero.body_three_post')}
              </>
            ) : (
              <>
                {t('deployments.hero.body_next_install_pre')}
                <b>{nextInstall.title}</b>
                {t('deployments.hero.body_with_pre')}
                <b>{nextInstaller.name}</b>
                {t('deployments.hero.body_when', { date: nextInstall.date, time: nextInstall.start })}
                {t('deployments.hero.body_three_pre')}
                <b>{t('deployments.hero.body_three_util', { n: avgUtil })}</b>
                {t('deployments.hero.body_three_post')}
                {t('deployments.hero.body_alicia')}
              </>
            )}
          </p>

          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            <button
              onClick={onPlan}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 10px color-mix(in oklch, var(--accent) 30%, transparent)',
              }}
            >
              <Icon.plus size={12} /> {t('deployments.hero.btn.plan')}
            </button>
            <button
              style={{
                padding: '8px 14px',
                background: 'var(--surface-2)',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon.cart size={12} /> {t('deployments.hero.btn.procurement')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <PlanStat
            label={t('deployments.stat.active')}
            value={activeCount}
            sub={
              useDerived
                ? building?.name || t('deployments.stat.active_sub_building')
                : isEcosystem
                  ? t('deployments.stat.active_sub_ny')
                  : t('deployments.stat.active_sub_tower')
            }
            tone="accent"
          />
          {useDerived ? (
            <PlanStat
              label={t('deployments.stat.in_motion')}
              value={Math.round(devicesInPipeline)}
              sub={t('deployments.stat.in_motion_sub')}
              tone="warn"
            />
          ) : (
            <>
              <PlanStat
                label={t('deployments.stat.provisioning')}
                value={queue.length}
                sub={t('deployments.stat.provisioning_sub')}
                tone="warn"
              />
              <PlanStat
                label={t('deployments.stat.next_install')}
                value={nextInstall.date.slice(5)}
                sub={`${nextInstall.start} · ${nextInstaller.initials}`}
                tone="info"
              />
              <PlanStat
                label={t('deployments.stat.installer_util')}
                value={`${avgUtil}%`}
                sub={t('deployments.stat.installer_team')}
                tone={avgUtil > 80 ? 'risk' : avgUtil > 65 ? 'warn' : 'ok'}
              />
            </>
          )}
        </div>
      </div>

      {/* Installer chips — Meridian-only demo content; hide for DB-backed
          scenarios until we have per-scenario installer seeds. */}
      {!useDerived && (
        <div style={{ padding: '0 var(--pad) var(--pad)', display: 'flex', gap: 8, position: 'relative' }}>
          {INSTALLERS.map((i) => (
            <div
              key={i.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px 8px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                minWidth: 220,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${i.tone}, color-mix(in oklch, ${i.tone} 60%, #20286D))`,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 0 1.5px var(--surface)',
                }}
              >
                {i.initials}
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
                  {i.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {i.specialty}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: i.utilization > 0.8 ? 'var(--risk)' : i.utilization > 0.65 ? 'var(--warn)' : 'var(--ok)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {Math.round(i.utilization * 100)}%
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                    fontWeight: 700,
                  }}
                >
                  {t('deployments.installer_util_label')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PlanStat({ label, value, sub, tone }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[tone] ||
    'var(--text)';
  return (
    <div
      style={{
        minWidth: 140,
        padding: '10px 14px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          marginTop: 4,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ─────────────────────────── CALENDAR ───────────────────────────

function InstallCalendar({ calendar = INSTALL_CALENDAR }) {
  const t = useT();
  const lang = useLanguage();
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('merlinDeployCalView') || 'week';
    } catch {
      return 'week';
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem('merlinDeployCalView', viewMode);
    } catch {}
  }, [viewMode]);
  const [anchor, setAnchor] = useState(() => demoTodayStr());

  const eventsByDay = useMemo(() => {
    const m = {};
    calendar.forEach((e) => {
      if (!m[e.date]) m[e.date] = [];
      m[e.date].push(e);
    });
    return m;
  }, [calendar]);

  // Range label + nav step depend on view mode.
  const { rangeLabel, step } = useMemo(() => {
    if (viewMode === 'day') return { rangeLabel: dayLabel(anchor, lang), step: 'day' };
    if (viewMode === 'month') return { rangeLabel: monthLabel(anchor, lang), step: 'month' };
    return { rangeLabel: weekRangeLabel(weekDaysFor(anchor), lang), step: 'week' };
  }, [viewMode, anchor, lang]);

  const onPrev = () => {
    if (step === 'day') setAnchor(addDays(anchor, -1));
    else if (step === 'week') setAnchor(addDays(anchor, -7));
    else setAnchor(addMonths(anchor, -1));
  };
  const onNext = () => {
    if (step === 'day') setAnchor(addDays(anchor, 1));
    else if (step === 'week') setAnchor(addDays(anchor, 7));
    else setAnchor(addMonths(anchor, 1));
  };
  const onToday = () => setAnchor(demoTodayStr());
  const today = demoTodayStr();
  const showingToday =
    viewMode === 'day'
      ? anchor === today
      : viewMode === 'week'
        ? weekDaysFor(anchor).some((d) => d.date === today)
        : monthDaysFor(anchor).some((d) => d.date === today);

  return (
    <Card pad={false} style={{ flexShrink: 0 }}>
      <SectionHeader
        icon="sla"
        title={t('deployments.install_calendar')}
        sub={rangeLabel}
        right={
          <CalendarNav
            viewMode={viewMode}
            setViewMode={setViewMode}
            onPrev={onPrev}
            onNext={onNext}
            onToday={onToday}
            showingToday={showingToday}
          />
        }
      />
      {viewMode === 'day' && <DayView anchor={anchor} events={eventsByDay[anchor] || []} today={today} />}
      {viewMode === 'week' && <WeekView weekDays={weekDaysFor(anchor)} eventsByDay={eventsByDay} today={today} />}
      {viewMode === 'month' && (
        <MonthView
          monthDays={monthDaysFor(anchor)}
          eventsByDay={eventsByDay}
          today={today}
          onPickDay={(d) => {
            setAnchor(d);
            setViewMode('day');
          }}
        />
      )}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px dashed var(--border)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          fontSize: 10.5,
          color: 'var(--text-dim)',
        }}
      >
        {INSTALLERS.map((i) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: i.tone }} /> {i.name.split(' ')[0]}
          </div>
        ))}
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Dot tone="warn" size={5} /> {t('deployments.calendar.tentative')}
        </div>
      </div>
    </Card>
  );
}

function CalendarNav({ viewMode, setViewMode, onPrev, onNext, onToday, showingToday }) {
  const t = useT();
  const VIEWS = [
    { id: 'day', labelKey: 'deployments.view.day' },
    { id: 'week', labelKey: 'deployments.view.week' },
    { id: 'month', labelKey: 'deployments.view.month' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={onPrev} aria-label={t('deployments.nav.prev')} style={calBtnArrow}>
        <Icon.chevL size={12} />
      </button>
      <button onClick={onNext} aria-label={t('deployments.nav.next')} style={calBtnArrow}>
        <Icon.chevR size={12} />
      </button>
      <button
        onClick={onToday}
        disabled={showingToday}
        style={{
          ...calBtn,
          opacity: showingToday ? 0.45 : 1,
          cursor: showingToday ? 'default' : 'pointer',
        }}
      >
        {t('deployments.nav.today')}
      </button>
      <div
        style={{
          display: 'inline-flex',
          marginLeft: 4,
          padding: 2,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          gap: 2,
        }}
      >
        {VIEWS.map((v) => {
          const active = viewMode === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-dim)',
                border: 'none',
                borderRadius: 5,
                cursor: 'pointer',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t(v.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ anchor, events, today }) {
  const t = useT();
  const isToday = anchor === today;
  const sorted = [...events].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: 16, minHeight: 220 }}>
      {sorted.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
          <Dot tone={isToday ? 'accent' : 'info'} size={6} pulse={isToday} />
          <div style={{ marginTop: 8 }}>{t('deployments.calendar.no_installs_day')}</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((e) => {
          const inst = installerById(e.installer);
          return (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr 100px',
                gap: 12,
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 8,
                background: `color-mix(in oklch, ${inst.tone} 8%, var(--surface))`,
                border: `1px solid color-mix(in oklch, ${inst.tone} 28%, transparent)`,
                opacity: e.status === 'tentative' ? 0.75 : 1,
              }}
            >
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: inst.tone }}>
                {e.start}
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
                  {e.title}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                  {t('deployments.calendar.devices_floor', { n: e.devices, floor: e.floor })} · {e.durMin}m
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: inst.tone,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {inst.initials}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{inst.name.split(' ')[0]}</div>
                {e.status === 'tentative' && <Dot tone="warn" size={5} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ weekDays, eventsByDay, today }) {
  const t = useT();
  const fmtDay = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return {
      dow: d.toLocaleDateString([], { weekday: 'short' }),
      day: d.getDate(),
      mon: d.toLocaleDateString([], { month: 'short' }),
    };
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${weekDays.length}, minmax(0, 1fr))`,
        borderTop: '1px solid var(--border)',
      }}
    >
      {weekDays.map((wd, i) => {
        const events = eventsByDay[wd.date] || [];
        const { dow, day, mon } = fmtDay(wd.date);
        const isToday = wd.date === today;
        return (
          <div
            key={wd.date}
            style={{
              borderRight: i < weekDays.length - 1 ? '1px solid var(--border)' : 'none',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '10px 10px 6px',
                borderBottom: '1px solid var(--border)',
                background: isToday ? 'color-mix(in oklch, var(--accent) 12%, var(--surface-2))' : 'var(--surface-2)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: isToday ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                }}
              >
                {dow}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 1, fontFamily: 'var(--font)' }}>
                {day} <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>{mon}</span>
              </div>
            </div>
            <div style={{ padding: 6, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {events.map((e) => {
                const inst = installerById(e.installer);
                return (
                  <div
                    key={e.id}
                    title={`${e.start} · ${e.durMin}m · ${e.title}`}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: `color-mix(in oklch, ${inst.tone} 12%, var(--surface))`,
                      border: `1px solid color-mix(in oklch, ${inst.tone} 32%, transparent)`,
                      fontSize: 10.5,
                      lineHeight: 1.35,
                      cursor: 'pointer',
                      opacity: e.status === 'tentative' ? 0.7 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: inst.tone,
                        fontWeight: 700,
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                      }}
                    >
                      <span>{e.start}</span>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span>{inst.initials}</span>
                      {e.status === 'tentative' && <Dot tone="warn" size={4} />}
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginTop: 2,
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {e.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                      {t('deployments.calendar.devices_floor', { n: e.devices, floor: e.floor })}
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: 'var(--text-faint)',
                  }}
                >
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ monthDays, eventsByDay, today, onPickDay }) {
  const t = useT();
  // Pad leading + trailing slots so the first day lands on its column.
  // dow: Sun=0, Mon=1, ..., Sat=6. We render Mon-first, so col index = (dow + 6) % 7.
  const first = monthDays[0];
  const last = monthDays[monthDays.length - 1];
  const leading = first ? (first.dow + 6) % 7 : 0;
  const trailing = last ? 7 - ((last.dow + 6) % 7) - 1 : 0;
  const slots = [...Array(leading).fill(null), ...monthDays, ...Array(trailing).fill(null)];
  const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {DOWS.map((d) => (
          <div
            key={d}
            style={{
              padding: '6px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.15,
              textAlign: 'center',
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {slots.map((slot, i) => {
          if (!slot)
            return (
              <div
                key={`pad-${i}`}
                style={{
                  minHeight: 80,
                  borderRight: i % 7 < 6 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  opacity: 0.4,
                }}
              />
            );
          const events = eventsByDay[slot.date] || [];
          const isToday = slot.date === today;
          return (
            <button
              key={slot.date}
              onClick={() => onPickDay?.(slot.date)}
              style={{
                textAlign: 'left',
                minHeight: 80,
                padding: '6px 8px',
                background: isToday ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : 'transparent',
                borderRight: i % 7 < 6 ? '1px solid var(--border)' : 'none',
                borderBottom: '1px solid var(--border)',
                borderTop: 'none',
                borderLeft: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isToday ? 'var(--accent)' : 'var(--text)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {slot.day}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {events.slice(0, 6).map((e) => {
                  const inst = installerById(e.installer);
                  return (
                    <span
                      key={e.id}
                      title={`${e.start} · ${e.title}`}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: inst.tone,
                        opacity: e.status === 'tentative' ? 0.55 : 1,
                      }}
                    />
                  );
                })}
                {events.length > 6 && (
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, marginLeft: 2 }}>
                    +{events.length - 6}
                  </span>
                )}
              </div>
              {events.length > 0 && (
                <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 'auto', fontWeight: 600 }}>
                  {events.length === 1
                    ? t('deployments.calendar.n_installs_one')
                    : t('deployments.calendar.n_installs_many', { n: events.length })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const calBtn = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  background: 'var(--surface-2)',
  color: 'var(--text-dim)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
};

const calBtnArrow = {
  width: 24,
  height: 24,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
};

// ─────────────────────────── ACTIVE ROLLOUTS ───────────────────────────

function ActiveRollouts({ onOpenChat, rollouts }) {
  const t = useT();
  const [expanded, setExpanded] = useState(null);
  // When `rollouts` prop is provided (ecosystem), use it directly. Otherwise
  // use the default HQ rollouts (already static, no simulator tick).
  const list = rollouts || ROLLOUTS;

  return (
    <Card pad={false} style={{ flexShrink: 0 }}>
      <SectionHeader
        icon="ship"
        title={t('deployments.active_rollouts')}
        sub={t('deployments.in_flight', { n: list.length })}
        right={
          <button
            onClick={() => onOpenChat?.('Summarize rollout risk for the next 2 weeks')}
            style={{
              padding: '4px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon.sparkle size={11} /> {t('deployments.ask_risk_summary')}
          </button>
        }
      />
      <div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 1.4fr) 150px minmax(380px, 2fr) 110px 100px 44px',
            gap: 0,
            padding: '10px 16px',
            fontSize: 10.5,
            color: 'var(--text-dim)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>{t('deployments.col.rollout')}</span>
          <span>{t('deployments.col.installer')}</span>
          <span>{t('deployments.col.pipeline')}</span>
          <span>{t('deployments.col.budget')}</span>
          <span>{t('deployments.col.eta')}</span>
          <span></span>
        </div>

        {list.map((r, i) => {
          const isOpen = expanded === r.id;
          const total = Object.values(r.stages).reduce((a, b) => a + b, 0) / 6;
          const inst = installerById(r.installer);
          const type = DEVICE_TYPES[r.deviceType];

          return (
            <div
              key={r.id}
              style={{ borderBottom: i < list.length - 1 || isOpen ? '1px solid var(--border)' : 'none' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(260px, 1.4fr) 150px minmax(380px, 2fr) 110px 100px 44px',
                  gap: 0,
                  padding: '12px 16px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background .12s',
                  background: isOpen ? 'var(--surface-2)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isOpen) e.currentTarget.style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => setExpanded(isOpen ? null : r.id)}
              >
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {React.createElement(Icon[type.icon] || Icon.grid, { size: 13 })}
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
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>
                      {t('deployments.row.scope_meta', { scope: r.scope, short: type.short, n: total })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${inst.tone}, color-mix(in oklch, ${inst.tone} 60%, #20286D))`,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {inst.initials}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inst.name.split(' ')[0]}
                  </div>
                </div>

                <StageBar stages={r.stages} />

                <div style={{ fontSize: 11.5, fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  ${r.budget.toLocaleString()}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  {r.eta.slice(5)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Icon.chevD
                    size={12}
                    style={{
                      color: 'var(--text-dim)',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform .15s',
                    }}
                  />
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: '0 16px 16px', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
                    <div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-dim)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.12,
                          marginBottom: 8,
                        }}
                      >
                        {t('deployments.detail.per_floor')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {r.floors.map((f) => (
                          <FloorStageBar key={f.floor} f={f} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-dim)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.12,
                          marginBottom: 8,
                        }}
                      >
                        {t('deployments.detail.details')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.started')}</span>{' '}
                        <span style={{ fontFamily: 'var(--mono)' }}>{r.started}</span>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.eta')}</span>{' '}
                        <span style={{ fontFamily: 'var(--mono)' }}>{r.eta}</span>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.installer')}</span>{' '}
                        <span>{inst.name}</span>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.device')}</span>{' '}
                        <span>
                          {type.label} ({type.sku})
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.planned')}</span>{' '}
                        <span style={{ fontFamily: 'var(--mono)' }}>{r.stages.planned}</span>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.live')}</span>{' '}
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--ok)', fontWeight: 700 }}>
                          {r.stages.live}
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.budget')}</span>{' '}
                        <span style={{ fontFamily: 'var(--mono)' }}>${r.budget.toLocaleString()}</span>
                        <span style={{ color: 'var(--text-dim)' }}>{t('deployments.detail.pct')}</span>{' '}
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{Math.round(r.pct * 100)}%</span>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                        <button style={btnPrimary}>
                          <Icon.sparkle size={11} /> {t('deployments.detail.btn.merlin')}
                        </button>
                        <button style={btnGhost}>{t('deployments.detail.btn.devices')}</button>
                        <button style={btnGhost}>{t('deployments.detail.btn.reschedule')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StageBar({ stages }) {
  const total = Object.values(stages).reduce((a, b) => a + b, 0);
  return (
    <div>
      <div
        style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}
      >
        {STAGES.map((s) => {
          const n = stages[s.id] || 0;
          const pct = (n / total) * 100;
          return (
            <div
              key={s.id}
              title={`${s.label}: ${n}`}
              style={{ width: `${pct}%`, background: s.color, opacity: s.id === 'planned' ? 0.35 : 0.9 }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 4,
          fontSize: 9.5,
          color: 'var(--text-dim)',
          fontFamily: 'var(--mono)',
        }}
      >
        {STAGES.map((s) => (
          <span
            key={s.id}
            style={{
              color: stages[s.id] > 0 ? s.color : 'var(--text-faint)',
              fontWeight: stages[s.id] > 0 ? 700 : 500,
            }}
          >
            {stages[s.id]} {s.label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function FloorStageBar({ f }) {
  const t = useT();
  const total = f.planned;
  const chunks = [
    { key: 'live', count: f.live, tone: 'var(--ok)' },
    { key: 'installed', count: f.installed, tone: '#8b5cf6' },
    { key: 'provisioned', count: f.provisioned, tone: 'var(--warn)' },
    { key: 'arrived', count: f.arrived, tone: 'var(--accent)' },
    { key: 'ordered', count: f.ordered, tone: 'var(--info)' },
  ];
  const accounted = chunks.reduce((a, c) => a + c.count, 0);
  const remainingPlanned = Math.max(0, total - accounted);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr 40px', gap: 8, alignItems: 'center' }}>
      <div
        style={{
          fontSize: 11,
          fontFamily: 'var(--mono)',
          color: 'var(--text-dim)',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {f.name ||
          (f.floor === 0
            ? t('deployments.floor.g_mech')
            : f.floor === 50
              ? t('deployments.floor.roof')
              : t('deployments.floor.n', { n: f.floor }))}
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 2, overflow: 'hidden', background: 'var(--surface-3)' }}>
        {chunks.map(
          (c) =>
            c.count > 0 && (
              <div
                key={c.key}
                title={`${c.count} ${c.key}`}
                style={{ flex: c.count, background: c.tone, opacity: 0.9 }}
              />
            ),
        )}
        {remainingPlanned > 0 && <div style={{ flex: remainingPlanned, background: 'var(--border)' }} />}
      </div>
      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ok)', fontWeight: 700, textAlign: 'right' }}>
        {f.live}/{total}
      </div>
    </div>
  );
}

// ─────────────────────────── PROVISIONING QUEUE ───────────────────────────

function ProvisioningQueue({ queue = PROVISIONING_QUEUE }) {
  const t = useT();
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => {
    if (filter === 'unpaired') return queue.filter((q) => !q.paired);
    if (filter === 'unassigned') return queue.filter((q) => !q.assigned);
    return queue;
  }, [filter, queue]);

  const stats = {
    total: queue.length,
    unpaired: queue.filter((q) => !q.paired).length,
    unassigned: queue.filter((q) => !q.assigned).length,
    ready: queue.filter((q) => q.paired && q.assigned).length,
  };

  return (
    <Card pad={false} style={{ flexShrink: 0 }}>
      <SectionHeader
        icon="cart"
        title={t('deployments.queue.title')}
        sub={t('deployments.queue.sub')}
        right={
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-3)', padding: 2, borderRadius: 7 }}>
            {[
              ['all', t('deployments.queue.filter.all', { n: stats.total })],
              ['unpaired', t('deployments.queue.filter.unpaired', { n: stats.unpaired })],
              ['unassigned', t('deployments.queue.filter.no_loc', { n: stats.unassigned })],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: filter === k ? 'var(--surface)' : 'transparent',
                  color: filter === k ? 'var(--text)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />
      <div
        style={{
          padding: '0 16px 10px',
          display: 'flex',
          gap: 16,
          fontSize: 11,
          color: 'var(--text-dim)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>
          <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{stats.ready}</b>
          {t('deployments.queue.stats_ready_pre')}
        </span>
        <span>
          <b style={{ color: 'var(--warn)', fontFamily: 'var(--mono)' }}>{stats.unpaired}</b>
          {t('deployments.queue.stats_unpaired_pre')}
        </span>
        <span>
          <b style={{ color: 'var(--risk)', fontFamily: 'var(--mono)' }}>{stats.unassigned}</b>
          {t('deployments.queue.stats_unassigned_pre')}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 110px 110px 70px 1fr 110px 110px 110px',
          gap: 0,
          padding: '8px 16px',
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.12,
          background: 'var(--surface-2)',
        }}
      >
        <span></span>
        <span>{t('deployments.queue.col.serial')}</span>
        <span>{t('deployments.queue.col.sku')}</span>
        <span>{t('deployments.queue.col.floor')}</span>
        <span>{t('deployments.queue.col.location')}</span>
        <span>{t('deployments.queue.col.arrived')}</span>
        <span>{t('deployments.queue.col.ble_pair')}</span>
        <span>{t('deployments.queue.col.action')}</span>
      </div>
      <div style={{ maxHeight: 360, overflow: 'auto' }}>
        {filtered.map((q) => {
          const type = DEVICE_TYPES[q.deviceType];
          const IconC = Icon[type.icon] || Icon.grid;
          const locationDisplay = q.location || (
            <span style={{ color: 'var(--risk)', fontStyle: 'italic' }}>{t('deployments.queue.assign_now')}</span>
          );
          return (
            <div
              key={q.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 110px 110px 70px 1fr 110px 110px 110px',
                gap: 0,
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <IconC size={14} style={{ color: 'var(--text-dim)' }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>{q.serial}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{q.sku}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                {q.floor === 0 ? t('deployments.queue.floor_g') : q.floor}
              </span>
              <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {locationDisplay}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{q.arrived}</span>
              <span>
                {q.paired ? (
                  <Pill tone="ok">
                    <Dot tone="ok" size={4} /> {t('deployments.queue.paired')}
                  </Pill>
                ) : (
                  <Pill tone="warn">
                    <Dot tone="warn" size={4} /> {t('deployments.queue.pending')}
                  </Pill>
                )}
              </span>
              <span>
                <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>
                  {!q.paired
                    ? t('deployments.queue.btn.pair')
                    : !q.assigned
                      ? t('deployments.queue.btn.assign')
                      : t('deployments.queue.btn.schedule')}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────── TEMPLATES ───────────────────────────

function Templates({ onUse }) {
  const tT = useT();
  return (
    <Card pad={false} style={{ flexShrink: 0 }}>
      <SectionHeader
        icon="grid"
        title={tT('deployments.templates.title')}
        sub={tT('deployments.templates.sub')}
        right={
          <button
            style={{
              padding: '4px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon.plus size={11} /> {tT('deployments.tpl.new_template')}
          </button>
        }
      />
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, padding: 14 }}
      >
        {TEMPLATES.map((t) => {
          const IconC = Icon[t.icon] || Icon.grid;
          return (
            <div
              key={t.id}
              style={{
                padding: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconC size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                    {tT('deployments.tpl.usage', { n: t.usedBy, m: t.installTime })}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.45 }}>{t.desc}</div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  paddingTop: 8,
                  borderTop: '1px dashed var(--border)',
                }}
              >
                {t.bundle.map((b, i) => {
                  const bt = DEVICE_TYPES[b.type];
                  const BIcon = Icon[bt.icon] || Icon.grid;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                      <BIcon size={11} style={{ color: 'var(--text-dim)' }} />
                      <span style={{ flex: 1 }}>{bt.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
                        ×{b.qty}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: 6,
                  borderTop: '1px dashed var(--border)',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                  ${t.cost.toLocaleString()}
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => onUse?.(t)} style={btnPrimary}>
                  {tT('deployments.use_template')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────── NEW ROLLOUT PLANNER ───────────────────────────

function NewRolloutPlanner({ template, onClose }) {
  const t = useT();
  const [step, setStep] = useState('scope');
  const [name, setName] = useState(template ? `${template.name} rollout` : '');
  const [scope, setScope] = useState('mid');
  const [floors, setFloors] = useState('32,33,34');
  const [installer, setInstaller] = useState('p-kumar');
  const [startDate, setStartDate] = useState('2026-04-28');

  const bundle = template?.bundle || [{ type: 'display_touch', qty: 1 }];
  const bundleCost = template?.cost || 389;
  const floorsCount = floors.split(',').filter(Boolean).length;
  const totalCost = bundleCost * floorsCount;
  const inst = installerById(installer);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 60,
          animation: 'merlinFadeIn .12s ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 520,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          animation: 'merlinSlideIn .18s ease-out',
          fontFamily: 'var(--font)',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Icon.ship size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {template
              ? t('deployments.planner.title_template', { name: template.name })
              : t('deployments.planner.title_blank')}
          </div>
          <div style={{ flex: 1 }} />
          <IconBtn onClick={onClose}>
            <Icon.close size={13} />
          </IconBtn>
        </div>

        <div
          style={{
            display: 'flex',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            gap: 4,
            fontSize: 10.5,
          }}
        >
          {['scope', 'devices', 'schedule', 'review'].map((s, i, arr) => (
            <React.Fragment key={s}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background:
                    step === s ? 'var(--accent)' : arr.indexOf(step) > i ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: step === s ? '#fff' : arr.indexOf(step) > i ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.1,
                }}
              >
                {i + 1}. {t(`deployments.planner.step.${s}`)}
              </span>
              {i < arr.length - 1 && <span style={{ alignSelf: 'center', color: 'var(--text-faint)' }}>›</span>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 'scope' && (
            <>
              <Field label={t('deployments.planner.field.name')}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('deployments.planner.field.name_ph')}
                  style={input}
                />
              </Field>
              <Field label={t('deployments.planner.field.zone')}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    ['all', t('deployments.planner.zone.all')],
                    ['low', t('deployments.planner.zone.low')],
                    ['mid', t('deployments.planner.zone.mid')],
                    ['high', t('deployments.planner.zone.high')],
                    ['bmech', t('deployments.planner.zone.bmech')],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setScope(v)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: scope === v ? 'var(--accent-soft)' : 'var(--surface-2)',
                        color: scope === v ? 'var(--accent)' : 'var(--text-soft)',
                        border: `1px solid ${scope === v ? 'var(--accent-line)' : 'var(--border)'}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('deployments.planner.field.specific')} sub={t('deployments.planner.field.specific_sub')}>
                <input
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  placeholder="32, 33, 34"
                  style={input}
                />
              </Field>
            </>
          )}

          {step === 'devices' && (
            <>
              <Field
                label={t('deployments.planner.field.bundle')}
                sub={
                  template
                    ? t('deployments.planner.field.bundle_sub_template', { name: template.name })
                    : t('deployments.planner.field.bundle_sub_default')
                }
              >
                <div
                  style={{
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {bundle.map((b, i) => {
                    const bt = DEVICE_TYPES[b.type];
                    const BIcon = Icon[bt.icon] || Icon.grid;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BIcon size={13} />
                        </div>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{bt.label}</div>
                        <div
                          style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}
                        >
                          ×{b.qty}/floor
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Field>
              <Field label={t('deployments.planner.field.cost')}>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{t('deployments.planner.cost.per_floor', { n: bundleCost })}</span>
                    <span style={{ color: 'var(--text-dim)' }}>
                      {t('deployments.planner.cost.n_floors', { n: floorsCount })}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      paddingTop: 6,
                      borderTop: '1px dashed var(--border)',
                    }}
                  >
                    <b style={{ fontSize: 13 }}>{t('deployments.planner.cost.estimated')}</b>
                    <b style={{ fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                      ${totalCost.toLocaleString()}
                    </b>
                  </div>
                </div>
              </Field>
            </>
          )}

          {step === 'schedule' && (
            <>
              <Field label={t('deployments.planner.field.installer')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {INSTALLERS.map((i) => (
                    <label
                      key={i.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: 10,
                        background: installer === i.id ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${installer === i.id ? 'var(--accent-line)' : 'var(--border)'}`,
                        borderRadius: 7,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        checked={installer === i.id}
                        onChange={() => setInstaller(i.id)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${i.tone}, color-mix(in oklch, ${i.tone} 60%, #20286D))`,
                          color: '#fff',
                          fontSize: 10.5,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {i.initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{i.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {t('deployments.planner.installer.util', {
                            spec: i.specialty,
                            pct: Math.round(i.utilization * 100),
                          })}
                        </div>
                      </div>
                      {i.utilization > 0.75 && <Pill tone="warn">{t('deployments.planner.installer.busy')}</Pill>}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={t('deployments.planner.field.start')} sub={t('deployments.planner.field.start_sub')}>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} />
              </Field>
            </>
          )}

          {step === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label={t('deployments.planner.field.summary')}>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '8px 16px',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--text-dim)' }}>{t('deployments.planner.summary.name')}</span>{' '}
                  <b>{name || t('deployments.planner.summary.unnamed')}</b>
                  <span style={{ color: 'var(--text-dim)' }}>{t('deployments.planner.summary.scope')}</span>{' '}
                  <span>
                    {t('deployments.planner.summary.scope_floors', {
                      scope: scope === 'all' ? t('deployments.planner.summary.scope_all') : scope,
                      floors,
                    })}
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>{t('deployments.planner.summary.installer')}</span>{' '}
                  <span>{inst.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{t('deployments.planner.summary.devices')}</span>{' '}
                  <span>
                    {t('deployments.planner.summary.devices_value', {
                      per: bundle.reduce((s, b) => s + b.qty, 0),
                      n: floorsCount,
                    })}
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>{t('deployments.planner.summary.start')}</span>{' '}
                  <span>{startDate}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{t('deployments.planner.summary.cost')}</span>{' '}
                  <b style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>${totalCost.toLocaleString()}</b>
                </div>
              </Field>
              <div
                style={{
                  padding: 10,
                  background: 'color-mix(in oklch, var(--accent) 6%, var(--surface))',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-soft)',
                }}
              >
                <b style={{ color: 'var(--accent)' }}>{t('deployments.planner.merlin_will_label')}</b>
                {t('deployments.planner.merlin_will_body')}
              </div>
            </div>
          )}
        </div>

        <div
          style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}
        >
          <div style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)' }}>
            {t('deployments.planner.est_total')}{' '}
            <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14, fontFamily: 'var(--mono)' }}>
              ${totalCost.toLocaleString()}
            </span>
          </div>
          {step !== 'scope' && (
            <button
              onClick={() => setStep(step === 'review' ? 'schedule' : step === 'schedule' ? 'devices' : 'scope')}
              style={btnGhost}
            >
              {t('deployments.planner.btn.back')}
            </button>
          )}
          <button
            onClick={() => {
              if (step === 'review') {
                onClose();
                return;
              }
              setStep(step === 'scope' ? 'devices' : step === 'devices' ? 'schedule' : 'review');
            }}
            style={btnPrimary}
          >
            {step === 'review' ? t('deployments.planner.btn.create') : t('deployments.planner.btn.continue')} →
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, sub, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.15,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{sub}</div>}
      {children}
    </div>
  );
}

const input = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  fontFamily: 'var(--font)',
  outline: 'none',
};

const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  padding: '7px 12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};
const btnGhost = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  padding: '6px 10px',
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};

// ─────────────────────────── Section header ───────────────────────────

function SectionHeader({ icon, title, sub, right }) {
  const IconC = Icon[icon] || Icon.bell;
  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <IconC size={14} style={{ color: 'var(--text-dim)' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}
