// Schedules — weekly shift grid + team roster management.
// Grid tab (current): read-only weekly view of who's on what shift.
// Team tab (Phase 8a): CRUD for workers + their weekly availability.
import React, { useMemo, useState, createContext, useContext } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { confirmDialog } from './dialogs.jsx';
import {
  SHIFT_TEAMS,
  SHIFT_TYPES,
  WEEK_DAYS,
  TODAY,
  shiftFor,
  getShiftMeta,
  getTeamMeta,
  getTimeOff,
  coverageByDay,
  onShiftNow,
  selectSchedulesData,
} from './schedules-data.js';

// Tenant-scoped crew + schedule data flowing from selectSchedulesData
// (building). Provided once at SchedulesPage top so deeply-nested
// ShiftCell can read shiftFor/getTimeOff with the right slice without
// prop-drilling. Defaults to Meridian HQ if no provider is mounted
// (legacy callers, ShiftCell used elsewhere).
const SchedulesDataCtx = createContext(null);
import {
  useTeam,
  createMember,
  updateMember,
  deleteMember,
  setAvailability,
  availabilityFor,
  describeWeek,
  DAY_LABELS,
  DAY_ORDER,
} from './team-data.js';
import {
  useRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  setRouteZones,
  addAssignment,
  removeAssignment,
  routeZoneIds,
  routeAssignments,
  SERVICE_TYPES,
  CADENCE_OPTIONS,
  ASSIGNMENT_ROLES,
  serviceLabel,
  serviceTone,
  cadenceLabel,
  routeRunsOn,
  routeAppliesToBuilding,
} from './routes-data.js';
import { useZonesForLocation, useAllZones, groupByFloor, sortedFloors, zoneKindLabel } from './zones-data.js';
import { useBuildingsForActiveOrg, flattenTreeForPicker, descendantIds, breadcrumbFor } from './custom-locations.js';
import { useRouteOverrideRenderer } from './ask-render.js';
import { useTranslatedText } from './event-translations.js';
import { useT, useLanguage } from './i18n.js';
import { useSL } from './servicing-i18n.js';
import { weekRangeLabel, weekDaysFor, addDays, todayStr as demoTodayStr } from './demo-dates.js';
import {
  useOverrides,
  createOverride,
  deleteOverride,
  effectiveOverride,
  overridesForRouteOnDate,
  todayStr,
  dowOf,
  OVERRIDE_ACTIONS,
} from './route-overrides-data.js';

const SUB_NAV = [
  { id: 'today', labelKey: 'sched.nav.today', icon: 'check' },
  { id: 'grid', labelKey: 'sched.nav.grid', icon: 'sla' },
  { id: 'team', labelKey: 'sched.nav.team', icon: 'people' },
  { id: 'routes', labelKey: 'sched.nav.routes', icon: 'building' },
];

export function SchedulesPage({ building, onOpenChat }) {
  const t = useT();
  const lang = useLanguage();
  const [section, setSection] = useState(() => {
    try {
      return localStorage.getItem('merlinSchedulesSection') || 'grid';
    } catch {
      return 'grid';
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem('merlinSchedulesSection', section);
    } catch {}
  }, [section]);
  const [team, setTeam] = useState('all');

  // Week navigation. weekAnchor is any date inside the visible week;
  // weekDays computes the Mon..Sun span containing it. Defaults to
  // today on mount; reset via the "This week" button in WeekNav.
  const [weekAnchor, setWeekAnchor] = useState(() => demoTodayStr());
  const weekDays = useMemo(() => weekDaysFor(weekAnchor), [weekAnchor]);
  const weekRange = useMemo(() => weekRangeLabel(weekDays, lang), [weekDays, lang]);
  const isCurrentWeek = useMemo(() => weekDays.some((d) => d.date === TODAY), [weekDays]);

  // Per-tenant crew + schedule data. Recomputed when the workspace
  // changes so switching IMF → Meridian HQ swaps the roster.
  const data = useMemo(() => selectSchedulesData(building), [building?.id, building?.variant]);
  const { CREW } = data;

  const filteredCrew = useMemo(() => (team === 'all' ? CREW : CREW.filter((c) => c.team === team)), [team, CREW]);
  const coverage = useMemo(() => coverageByDay(data, weekDays), [data, weekDays]);
  const liveShift = useMemo(() => onShiftNow(11, data), [data]);

  return (
    <SchedulesDataCtx.Provider value={data}>
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
            style={{ padding: 'var(--pad)', display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon.people size={12} style={{ color: 'var(--accent)' }} />
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: 0.15,
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    fontWeight: 700,
                  }}
                >
                  {t('sched.hero.eyebrow', { workspace: building?.name || t('sched.hero.workspace_fallback') })}
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
                {section === 'today'
                  ? t('sched.hero.title.today')
                  : section === 'grid'
                    ? t('sched.hero.title.grid', { range: weekRange })
                    : section === 'team'
                      ? t('sched.hero.title.team')
                      : t('sched.hero.title.routes')}
              </h1>
              <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
                {section === 'today'
                  ? t('sched.hero.body.today')
                  : section === 'grid'
                    ? t(liveShift.length === 1 ? 'sched.hero.body.grid_one' : 'sched.hero.body.grid_many', {
                        n: liveShift.length,
                        shown: filteredCrew.length,
                        total: CREW.length,
                      })
                    : section === 'team'
                      ? t('sched.hero.body.team')
                      : t('sched.hero.body.routes')}
              </p>
            </div>
            {section === 'grid' && (
              <button
                onClick={() => onOpenChat?.(t('sched.hero.cover_prompt'))}
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
                <Icon.sparkle size={12} /> {t('sched.hero.cover_btn')}
              </button>
            )}
          </div>
        </Card>

        {/* Sub-nav */}
        <Card pad={false} style={{ flexShrink: 0 }}>
          <div style={{ padding: '8px 12px', display: 'flex', gap: 4 }}>
            {SUB_NAV.map((s) => {
              const IconC = Icon[s.icon] || Icon.sparkle;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  <IconC size={12} />
                  {t(s.labelKey)}
                </button>
              );
            })}
          </div>
        </Card>

        {CREW.length === 0 ? (
          <Card>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <Icon.people size={28} style={{ color: 'var(--text-dim)' }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>No crew yet for {building?.name || 'this building'}</div>
                <div
                  style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', maxWidth: 480, lineHeight: 1.55 }}
                >
                  Add team members from Admin → Team to start scheduling shifts. Once you have crew, this page will show
                  their weekly grid, today&apos;s coverage, and routes.
                </div>
              </div>
            </div>
          </Card>
        ) : section === 'today' ? (
          <TodaySection building={building} />
        ) : section === 'team' ? (
          <TeamSection />
        ) : section === 'routes' ? (
          <RoutesSection building={building} />
        ) : (
          <GridSection
            team={team}
            setTeam={setTeam}
            filteredCrew={filteredCrew}
            coverage={coverage}
            liveShift={liveShift}
            weekDays={weekDays}
            weekRange={weekRange}
            weekAnchor={weekAnchor}
            setWeekAnchor={setWeekAnchor}
            isCurrentWeek={isCurrentWeek}
          />
        )}
      </main>
    </SchedulesDataCtx.Provider>
  );
}

export function GridSection({
  team,
  setTeam,
  filteredCrew,
  coverage,
  liveShift,
  weekDays = WEEK_DAYS,
  weekRange,
  weekAnchor,
  setWeekAnchor,
  isCurrentWeek = true,
}) {
  const t = useT();
  const localizedTeamLabel = (id, fallback) => {
    const key = `sched.team.${id}`;
    const v = t(key);
    return v === key ? fallback : v;
  };
  const TEAM_FILTERS = [
    { id: 'all', label: t('sched.team_filter.all') },
    ...SHIFT_TEAMS.map((tm) => ({ id: tm.id, label: localizedTeamLabel(tm.id, tm.label) })),
  ];
  return (
    <>
      {/* Week navigation */}
      {setWeekAnchor && (
        <WeekNav
          weekRange={weekRange}
          weekAnchor={weekAnchor}
          setWeekAnchor={setWeekAnchor}
          isCurrentWeek={isCurrentWeek}
        />
      )}
      {/* Filters */}
      <Card pad={false} style={{ flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.12,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('sched.team')}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {TEAM_FILTERS.map((t) => {
              const active = team === t.id;
              const meta = SHIFT_TEAMS.find((x) => x.id === t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTeam(t.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {meta && <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.accent }} />}
                  {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>{t('sched.shift_legend')}</span>
            {SHIFT_TYPES.map((s) => (
              <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 12,
                    height: 8,
                    borderRadius: 3,
                    background: `color-mix(in oklch, var(--${s.tone}) 35%, transparent)`,
                    border: `1px solid color-mix(in oklch, var(--${s.tone}) 50%, transparent)`,
                  }}
                />
                <span style={{ fontFamily: 'var(--mono)' }}>
                  {s.label} · {s.start}–{s.end}
                </span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Schedule grid */}
      <Card pad={false} style={{ overflow: 'hidden' }}>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 200, textAlign: 'left' }}>{t('sched.crew')}</th>
                {weekDays.map((d) => (
                  <th
                    key={d.date}
                    style={{
                      ...thStyle,
                      background:
                        d.date === TODAY
                          ? 'color-mix(in oklch, var(--accent) 12%, var(--surface-2))'
                          : 'var(--surface-2)',
                      color: d.date === TODAY ? 'var(--accent)' : 'var(--text-dim)',
                    }}
                  >
                    {d.label}
                    <div
                      style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', opacity: 0.7, marginTop: 2 }}
                    >
                      {d.date.slice(5)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCrew.map((c) => {
                const teamMeta = getTeamMeta(c.team);
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: `color-mix(in oklch, ${teamMeta.accent} 80%, var(--surface))`,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {c.initials}
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
                          {c.name}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                          {c.role} · <span style={{ color: teamMeta.accent }}>{teamMeta.label}</span>
                        </div>
                      </div>
                    </td>
                    {weekDays.map((d) => (
                      <td
                        key={d.date}
                        style={{
                          padding: 4,
                          verticalAlign: 'middle',
                          background:
                            d.date === TODAY ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'transparent',
                        }}
                      >
                        <ShiftCell crewId={c.id} dow={d.dow} date={d.date} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Coverage strip */}
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
            <div
              style={{
                padding: '10px 14px',
                fontSize: 11,
                color: 'var(--text-dim)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.12,
              }}
            >
              {t('sched.coverage')}
            </div>
            {weekDays.map((d) => {
              const c = coverage[d.date];
              const total = c ? c.cleaning + c.maintenance + c.security : 0;
              const tone = total >= 5 ? 'ok' : total >= 3 ? 'warn' : 'risk';
              return (
                <div
                  key={d.date}
                  style={{
                    padding: '8px 6px',
                    borderLeft: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: `var(--${tone})`, fontFamily: 'var(--mono)' }}>
                    {total}
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {SHIFT_TEAMS.map((t) => (
                      <span
                        key={t.id}
                        title={t.label}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: c?.[t.id] ? t.accent : 'var(--surface-3)',
                          opacity: c?.[t.id] ? 1 : 0.4,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* On shift now */}
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
          <Dot tone="ok" size={6} pulse />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('sched.on_shift_now')}</div>
          <Pill tone="accent">{liveShift.length}</Pill>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>· Tue, 2026-04-21 · 11:00</div>
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, padding: 12 }}
        >
          {liveShift.map(({ crew, shift }) => {
            const teamMeta = getTeamMeta(crew.team);
            return (
              <div
                key={crew.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: teamMeta.accent,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {crew.initials}
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
                    {crew.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                    {shift.label} · {shift.start}–{shift.end}
                  </div>
                </div>
              </div>
            );
          })}
          {liveShift.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: 30,
                textAlign: 'center',
                fontSize: 12.5,
                color: 'var(--text-dim)',
              }}
            >
              {t('sched.no_one_on_shift')}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function WeekNav({ weekRange, weekAnchor, setWeekAnchor, isCurrentWeek }) {
  const t = useT();
  const dateInputRef = React.useRef(null);
  const onPrev = () => setWeekAnchor(addDays(weekAnchor, -7));
  const onNext = () => setWeekAnchor(addDays(weekAnchor, 7));
  const onToday = () => setWeekAnchor(demoTodayStr());
  const onJump = (e) => {
    if (e.target.value) setWeekAnchor(e.target.value);
  };
  return (
    <Card pad={false} style={{ flexShrink: 0 }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onPrev} aria-label={t('sched.nav.prev_week')} style={navArrow}>
          <Icon.chevL size={14} />
        </button>
        <button onClick={onNext} aria-label={t('sched.nav.next_week')} style={navArrow}>
          <Icon.chevR size={14} />
        </button>
        <button
          onClick={onToday}
          disabled={isCurrentWeek}
          style={{
            ...navPill,
            opacity: isCurrentWeek ? 0.45 : 1,
            cursor: isCurrentWeek ? 'default' : 'pointer',
          }}
        >
          {t('sched.nav.this_week')}
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.focus?.()}
            style={{
              ...navPill,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            <Icon.sla size={12} style={{ color: 'var(--text-dim)' }} />
            {weekRange}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={weekAnchor}
            onChange={onJump}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
            }}
            tabIndex={-1}
          />
        </div>
      </div>
    </Card>
  );
}

const navArrow = {
  width: 28,
  height: 28,
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

const navPill = {
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 600,
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
};

function ShiftCell({ crewId, dow, date }) {
  const t = useT();
  // ctx is null only if ShiftCell mounts outside a SchedulesPage —
  // helpers fall back to the Meridian HQ defaults in that case.
  const ctx = useContext(SchedulesDataCtx);
  const shiftId = shiftFor(crewId, dow, date, ctx);
  const off = getTimeOff(crewId, date, ctx);
  // Time-off reasons are user-typed free-form prose ("Dentist appointment",
  // "Family vacation"). Route through the on-read translation cache so a
  // French manager sees a French tooltip on a colleague's PTO row.
  const offReason = useTranslatedText(off?.reason || '');

  if (off) {
    const tone = off.kind === 'callout' ? 'risk' : 'warn';
    const tipKey = off.kind === 'callout' ? 'sched.shift.tooltip_callout' : 'sched.shift.tooltip_pto';
    return (
      <div
        title={t(tipKey, { reason: offReason || off.reason })}
        style={{
          margin: '0 4px',
          padding: '8px 6px',
          textAlign: 'center',
          background: `color-mix(in oklch, var(--${tone}) 12%, transparent)`,
          color: `var(--${tone})`,
          border: `1px dashed color-mix(in oklch, var(--${tone}) 40%, transparent)`,
          borderRadius: 5,
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.1,
        }}
      >
        {off.kind === 'callout' ? t('sched.shift.out') : t('sched.shift.pto')}
      </div>
    );
  }

  if (!shiftId) {
    return <div style={{ height: 28 }} />;
  }

  const shift = getShiftMeta(shiftId);
  return (
    <div
      title={`${shift.label} ${shift.start}–${shift.end}`}
      style={{
        margin: '0 4px',
        padding: '8px 6px',
        textAlign: 'center',
        background: `color-mix(in oklch, var(--${shift.tone}) 25%, transparent)`,
        color: `var(--${shift.tone})`,
        border: `1px solid color-mix(in oklch, var(--${shift.tone}) 45%, transparent)`,
        borderRadius: 5,
        fontSize: 10.5,
        fontWeight: 700,
      }}
    >
      {shift.start}–{shift.end}
    </div>
  );
}

const thStyle = {
  padding: '10px 6px',
  textAlign: 'center',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.12,
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border)',
};

// ────────────────────────── Team Roster ──────────────────────────

const TEAM_OPTIONS = [
  { id: 'cleaning', labelKey: 'sched.team.cleaning', accent: '#10b981' },
  { id: 'maintenance', labelKey: 'sched.team.maintenance', accent: '#f59e0b' },
  { id: 'security', labelKey: 'sched.team.security', accent: '#3b82f6' },
  { id: 'facility', labelKey: 'sched.team.facility', accent: '#a855f7' },
];

function teamAccent(id) {
  return TEAM_OPTIONS.find((t) => t.id === id)?.accent || '#64748b';
}
function teamLabel(id, t) {
  const o = TEAM_OPTIONS.find((x) => x.id === id);
  return o ? (t ? t(o.labelKey) : id) : id;
}

export function TeamSection() {
  const t = useT();
  const { members } = useTeam();
  const [editingId, setEditingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(
    () => (filter === 'all' ? members : members.filter((m) => m.team === filter)),
    [members, filter],
  );

  const byTeam = useMemo(() => {
    const out = {};
    for (const m of filtered) (out[m.team] ||= []).push(m);
    return out;
  }, [filtered]);

  return (
    <>
      <Card pad={false} style={{ flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.12,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('sched.filter')}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'all', label: t('sched.team.filter_all') },
              ...TEAM_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) })),
            ].map((opt) => {
              const active = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setFilter(opt.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            {t('sched.team.members_total', { n: members.length })}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon.plus size={11} /> {t('sched.team.add_member')}
          </button>
        </div>
      </Card>

      {members.length === 0 && (
        <Card>
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            {(() => {
              const tmpl = t('sched.team.empty', { code: 'XCODEX' });
              const [pre, post = ''] = tmpl.split('XCODEX');
              return (
                <>
                  {pre}
                  <code
                    style={{
                      fontFamily: 'var(--mono)',
                      background: 'var(--surface-3)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    node scripts/seed-team.mjs
                  </code>
                  {post}
                </>
              );
            })()}
          </div>
        </Card>
      )}

      {TEAM_OPTIONS.map((opt) => {
        const list = byTeam[opt.id];
        if (!list || list.length === 0) return null;
        return (
          <Card key={opt.id} pad={false}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.accent }} />
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t(opt.labelKey)}</div>
              <Pill>{list.length}</Pill>
            </div>
            <div>
              {list.map((m, i) => (
                <MemberRow key={m.id} member={m} last={i === list.length - 1} onEdit={() => setEditingId(m.id)} />
              ))}
            </div>
          </Card>
        );
      })}

      {editingId && <MemberModal memberId={editingId} onClose={() => setEditingId(null)} />}
      {addOpen && <MemberModal memberId={null} onClose={() => setAddOpen(false)} />}
    </>
  );
}

function MemberRow({ member, last, onEdit }) {
  const t = useT();
  const week = describeWeek(member.id);
  return (
    <div
      onClick={onEdit}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 180px minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'center',
        padding: '12px 14px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background .1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: teamAccent(member.team),
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.3,
        }}
      >
        {member.initials || member.name.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {member.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{member.role || teamLabel(member.team, t)}</div>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--text-soft)',
          fontFamily: 'var(--mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {week}
      </div>
      <Icon.chevR size={12} style={{ color: 'var(--text-dim)' }} />
    </div>
  );
}

function MemberModal({ memberId, onClose }) {
  const t = useT();
  const { members } = useTeam();
  const member = memberId ? members.find((m) => m.id === memberId) : null;
  const [form, setForm] = useState(() => ({
    name: member?.name || '',
    team: member?.team || 'cleaning',
    role: member?.role || '',
    initials: member?.initials || '',
    email: member?.email || '',
    phone: member?.phone || '',
  }));
  const [availDraft, setAvailDraft] = useState(() => {
    const out = {};
    if (memberId) {
      for (const w of availabilityFor(memberId)) {
        (out[w.dow] ||= []).push({ start_time: w.start_time.slice(0, 5), end_time: w.end_time.slice(0, 5) });
      }
    }
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    setErr(null);
    if (!form.name.trim()) return setErr(t('sched.member.name_required'));
    setSaving(true);
    try {
      let id = memberId;
      if (id) await updateMember(id, form);
      else id = (await createMember(form)).id;
      // Replace availability per-day
      for (const dow of [0, 1, 2, 3, 4, 5, 6]) {
        const windows = (availDraft[dow] || []).filter((w) => w.start_time && w.end_time);
        await setAvailability(
          id,
          dow,
          windows.map((w) => ({
            start_time: w.start_time.length === 5 ? w.start_time + ':00' : w.start_time,
            end_time: w.end_time.length === 5 ? w.end_time + ':00' : w.end_time,
          })),
        );
      }
      onClose();
    } catch (e) {
      setErr(e.message || t('sched.member.could_not_save'));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!memberId) return;
    if (!(await confirmDialog({ body: t('sched.member.remove_confirm', { name: form.name }), danger: true }))) return;
    try {
      await deleteMember(memberId);
      onClose();
    } catch (e) {
      setErr(e.message || t('sched.member.could_not_delete'));
    }
  };

  const patchDay = (dow, windows) => setAvailDraft((d) => ({ ...d, [dow]: windows }));

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {memberId ? t('sched.member.edit') : t('sched.member.add')}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
            }}
          >
            <Icon.close size={14} />
          </button>
        </div>

        <div style={{ padding: 18, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={t('sched.member.field.name')}>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={inputStyle}
              />
            </Field>
            <Field label={t('sched.member.field.team')}>
              <select
                value={form.team}
                onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
                style={inputStyle}
              >
                {TEAM_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('sched.member.field.role')}>
              <input
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={inputStyle}
                placeholder={t('sched.member.field.role_ph')}
              />
            </Field>
            <Field label={t('sched.member.field.initials')}>
              <input
                value={form.initials}
                onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))}
                style={inputStyle}
                maxLength={3}
                placeholder={t('sched.member.field.initials_ph')}
              />
            </Field>
            <Field label={t('sched.member.field.email')}>
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={inputStyle}
                placeholder={t('sched.member.field.email_ph')}
              />
            </Field>
            <Field label={t('sched.member.field.phone')}>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                style={inputStyle}
                placeholder={t('sched.member.field.phone_ph')}
              />
            </Field>
          </div>

          <div style={{ marginTop: 6 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: 0.12,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {t('sched.member.weekly_avail')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DAY_ORDER.map((dow) => (
                <DayRow key={dow} dow={dow} windows={availDraft[dow] || []} onChange={(w) => patchDay(dow, w)} />
              ))}
            </div>
          </div>

          {err && <div style={{ fontSize: 12, color: 'var(--risk)', fontWeight: 600 }}>{err}</div>}
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {memberId && (
            <button
              onClick={remove}
              style={{
                ...btnGhost,
                color: 'var(--risk)',
                borderColor: 'color-mix(in oklch, var(--risk) 40%, transparent)',
              }}
            >
              {t('sched.member.remove')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btnGhost}>
            {t('sched.member.cancel')}
          </button>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? t('sched.member.saving') : t('sched.member.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DayRow({ dow, windows, onChange }) {
  const t = useT();
  const add = () => onChange([...windows, { start_time: '09:00', end_time: '17:00' }]);
  const update = (i, patch) => onChange(windows.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const remove = (i) => onChange(windows.filter((_, j) => j !== i));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 10, alignItems: 'flex-start' }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          paddingTop: 8,
          color: windows.length === 0 ? 'var(--text-dim)' : 'var(--text)',
        }}
      >
        {DAY_LABELS[dow]}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {windows.length === 0 && (
          <div style={{ padding: '6px 10px', fontSize: 11.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            {t('sched.day.off')}
          </div>
        )}
        {windows.map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="time"
              value={w.start_time}
              onChange={(e) => update(i, { start_time: e.target.value })}
              style={{ ...inputStyle, width: 100 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>–</span>
            <input
              type="time"
              value={w.end_time}
              onChange={(e) => update(i, { end_time: e.target.value })}
              style={{ ...inputStyle, width: 100 }}
            />
            <button onClick={() => remove(i)} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}>
              {t('sched.day.remove')}
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} style={{ ...btnGhost, padding: '6px 10px', fontSize: 11 }}>
        {t('sched.day.add_window')}
      </button>
    </div>
  );
}

function ZoneChip({ z, on, toggle }) {
  return (
    <button
      onClick={toggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        fontSize: 11.5,
        fontWeight: 600,
        background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: on ? 'var(--accent)' : 'var(--text-soft)',
        border: '1px solid ' + (on ? 'var(--accent-line)' : 'var(--border)'),
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {on && <Icon.check size={10} />}
      {z.name} <span style={{ fontSize: 9.5, opacity: 0.7 }}>{zoneKindLabel(z.kind).toLowerCase()}</span>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  padding: '7px 10px',
  fontSize: 12.5,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  outline: 'none',
};
const btnPrimary = {
  padding: '7px 14px',
  fontSize: 12.5,
  fontWeight: 600,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};
const btnGhost = {
  padding: '7px 14px',
  fontSize: 12.5,
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
};

// ────────────────────────── Routes Section ──────────────────────────

// scope:
//   'building' (default) — only routes that apply to the active building
//   'org'                — every route in the workspace (used by the
//                          Contractor Ops surface, where the manager
//                          sees their crew's routes across customers)
export function RoutesSection({ building, scope = 'building' }) {
  const t = useT();
  const sl = useSL();
  const { routes } = useRoutes();
  const { members } = useTeam();
  const buildings = useBuildingsForActiveOrg();
  const [editing, setEditing] = useState(null); // route object, or 'new' for fresh

  const activeBuilding = building?.id || 'hq';
  const inScope =
    scope === 'org' ? routes : routes.filter((r) => routeAppliesToBuilding(r, activeBuilding, descendantIds));
  // Servicing-program routes (auto-managed; their tasks back the OPERATE →
  // Services boards) are kept out of the hand-managed routes list and summarised
  // in a banner that points to where they're managed.
  const programList = inScope.filter((r) => r.is_servicing_program);
  const list = inScope.filter((r) => !r.is_servicing_program);

  return (
    <>
      <Card pad={false} style={{ flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.12,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {scope === 'org' ? t('sched.routes.scope_label') : t('sched.routes.building_label')}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
            {scope === 'org'
              ? t('sched.routes.across_contracts')
              : building?.name || t('sched.routes.meridian_fallback')}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            {t(list.length === 1 ? 'sched.routes.n_routes_one' : 'sched.routes.n_routes_many', { n: list.length })}
          </div>
          <button
            onClick={() => setEditing('new')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon.plus size={11} /> {t('sched.routes.new_route')}
          </button>
        </div>
      </Card>

      {programList.length > 0 && (
        <Card pad={false} style={{ flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'var(--accent-soft)',
              }}
            >
              <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{sl('Servicing program', 'Programme de services')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                {sl(
                  `${programList.length} auto-managed routes backing the Cleaning · Security · Hospitality · Maintenance boards — managed in OPERATE → Services`,
                  `${programList.length} tournées auto-gérées alimentant les tableaux Nettoyage · Sécurité · Accueil · Maintenance — gérées dans OPERATE → Services`,
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
            {scope === 'org'
              ? t('sched.routes.empty_org')
              : t('sched.routes.empty_building', { name: building?.name || t('sched.routes.this_building') })}
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          <div>
            {list.map((r, i) => (
              <RouteRow
                key={r.id}
                route={r}
                members={members}
                last={i === list.length - 1}
                onEdit={() => setEditing(r)}
              />
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <RouteModal
          route={editing === 'new' ? null : editing}
          defaultLocationId={activeBuilding}
          buildings={buildings}
          members={members}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function RouteRow({ route, members, last, onEdit }) {
  const t = useT();
  const zoneCount = routeZoneIds(route.id).length;
  const assigns = routeAssignments(route.id);
  const primaryAssigns = assigns.filter((a) => a.role === 'primary');
  const subAssigns = assigns.filter((a) => a.role === 'substitute');
  const buildings = useBuildingsForActiveOrg();
  const scopeLoc = buildings[route.location_id];
  const isEcoScope = scopeLoc?.kind === 'ecosystem';
  return (
    <div
      onClick={onEdit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 130px 90px 180px auto',
        gap: 12,
        alignItems: 'center',
        padding: '12px 14px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {route.name}
          </div>
          {isEcoScope && <Pill tone="accent">{t('sched.routes.campus_wide', { name: scopeLoc.name })}</Pill>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
          {cadenceLabel(route)}
          {route.expected_start_time
            ? ` · ${t('sched.routes.from_time', { time: route.expected_start_time.slice(0, 5) })}`
            : ''}
          {route.expected_duration_min
            ? ` · ${t('sched.routes.duration_min', { n: route.expected_duration_min })}`
            : ''}
        </div>
      </div>
      <Pill tone={serviceTone(route.service_type)}>{serviceLabel(route.service_type)}</Pill>
      <div style={{ fontSize: 11.5, color: 'var(--text-soft)', fontFamily: 'var(--mono)' }}>
        {t('sched.routes.zones_count', { n: zoneCount })}
      </div>
      {/* overflow:hidden was clipping a px off each circle's top/bottom
          (subpixel rounding against the 2px border). Negative `gap` is
          invalid CSS anyway — the overlap is done via marginLeft:-4 on
          each child. */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {primaryAssigns.map((a) => {
          const m = members.find((x) => x.id === a.member_id);
          if (!m) return null;
          return (
            <div
              key={a.id}
              title={`${m.name} · primary`}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                marginLeft: -4,
                border: '2px solid var(--surface)',
                flexShrink: 0,
              }}
            >
              {m.initials || m.name.slice(0, 2).toUpperCase()}
            </div>
          );
        })}
        {subAssigns.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>
            {t('sched.routes.subs', { n: subAssigns.length })}
          </span>
        )}
        {assigns.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--risk)', fontWeight: 600 }}>{t('sched.unassigned')}</span>
        )}
      </div>
      <Icon.chevR size={12} style={{ color: 'var(--text-dim)' }} />
    </div>
  );
}

function RouteModal({ route, defaultLocationId, buildings, members, onClose }) {
  const t = useT();
  const [form, setForm] = useState(() => ({
    name: route?.name || '',
    description: route?.description || '',
    location_id: route?.location_id || defaultLocationId,
    service_type: route?.service_type || 'surface_clean',
    cadence: route?.cadence || 'daily',
    cadence_days: route?.cadence_days || [],
    expected_start_time: route?.expected_start_time?.slice(0, 5) || '',
    expected_duration_min: route?.expected_duration_min ?? '',
    sla_threshold_min: route?.sla_threshold_min ?? '',
    active: route?.active !== false,
  }));
  const [zoneSelected, setZoneSelected] = useState(() => (route ? routeZoneIds(route.id) : []));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Scope = selected location. If it's a building we want just its zones;
  // if it's an ecosystem, we pull zones from every descendant building and
  // group by building → floor in the picker so the tree is obvious.
  const currentLoc = buildings[form.location_id];
  const isEcoScope = currentLoc?.kind === 'ecosystem';
  const singleLocZones = useZonesForLocation(isEcoScope ? null : form.location_id);
  const allZones = useAllZones();
  const subtreeIds = isEcoScope ? descendantIds(form.location_id) : null;
  const zones = isEcoScope ? allZones.filter((z) => subtreeIds.has(z.location_id)) : singleLocZones;
  const assigns = route ? routeAssignments(route.id) : [];

  const toggleZone = (zoneId) => {
    setZoneSelected((s) => (s.includes(zoneId) ? s.filter((z) => z !== zoneId) : [...s, zoneId]));
  };
  const toggleCustomDay = (dow) => {
    setForm((f) => ({
      ...f,
      cadence_days: f.cadence_days.includes(dow)
        ? f.cadence_days.filter((d) => d !== dow)
        : [...f.cadence_days, dow].sort(),
    }));
  };

  const save = async () => {
    setErr(null);
    if (!form.name.trim()) return setErr(t('sched.member.name_required'));
    setSaving(true);
    try {
      const payload = {
        ...form,
        expected_start_time: form.expected_start_time
          ? form.expected_start_time.length === 5
            ? form.expected_start_time + ':00'
            : form.expected_start_time
          : null,
        expected_duration_min: form.expected_duration_min === '' ? null : Number(form.expected_duration_min),
        sla_threshold_min: form.sla_threshold_min === '' ? null : Number(form.sla_threshold_min),
      };
      let id = route?.id;
      if (id) await updateRoute(id, payload);
      else id = (await createRoute(payload)).id;
      await setRouteZones(id, zoneSelected);
      onClose();
    } catch (e) {
      setErr(e.message || t('sched.routes.could_not_save'));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!route) return;
    if (!(await confirmDialog({ body: t('sched.routes.delete_confirm', { name: route.name }), danger: true }))) return;
    try {
      await deleteRoute(route.id);
      onClose();
    } catch (e) {
      setErr(e.message || t('sched.routes.delete_failed'));
    }
  };

  const addMember = async (memberId) => {
    if (!route) {
      setErr(t('sched.routes.assignments.save_first_err'));
      return;
    }
    try {
      await addAssignment(route.id, memberId, 'primary');
    } catch (e) {
      setErr(e.message || t('sched.routes.assignments.assign_failed'));
    }
  };
  const removeMember = async (assignId) => {
    if (!route) return;
    try {
      await removeAssignment(assignId, route.id);
    } catch (e) {
      setErr(e.message || t('sched.routes.assignments.unassign_failed'));
    }
  };

  const byFloor = groupByFloor(zones);
  const floorKeys = sortedFloors(zones);
  // Group by building when scope is an ecosystem so the picker
  // shows each campus member clearly.
  const byBuilding = {};
  if (isEcoScope) {
    for (const z of zones) (byBuilding[z.location_id] ||= []).push(z);
  }
  const buildingKeys = isEcoScope
    ? Object.keys(byBuilding).sort((a, z) => (buildings[a]?.name || '').localeCompare(buildings[z]?.name || ''))
    : [];
  const availableMembers = members.filter((m) => !assigns.some((a) => a.member_id === m.id));

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          maxWidth: 760,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {route ? t('sched.routes.modal.edit') : t('sched.routes.modal.new')}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
            }}
          >
            <Icon.close size={14} />
          </button>
        </div>

        <div style={{ padding: 18, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Basic info */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <Field label={t('sched.routes.field.name')}>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={inputStyle}
                placeholder={t('sched.routes.field.name_ph')}
              />
            </Field>
            <Field label={t('sched.routes.field.service')}>
              <select
                value={form.service_type}
                onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))}
                style={inputStyle}
              >
                {SERVICE_TYPES.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('sched.routes.field.scope')}>
              <select
                value={form.location_id}
                onChange={(e) => {
                  setForm((f) => ({ ...f, location_id: e.target.value }));
                  setZoneSelected([]);
                }}
                style={inputStyle}
              >
                {flattenTreeForPicker(buildings).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.kind === 'ecosystem' ? '◧ ' : ''}
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t('sched.routes.field.description')}>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={inputStyle}
              placeholder={t('sched.routes.field.description_ph')}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label={t('sched.routes.field.cadence')}>
              <select
                value={form.cadence}
                onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value }))}
                style={inputStyle}
              >
                {CADENCE_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('sched.routes.field.start_time')}>
              <input
                type="time"
                value={form.expected_start_time}
                onChange={(e) => setForm((f) => ({ ...f, expected_start_time: e.target.value }))}
                style={inputStyle}
              />
            </Field>
            <Field label={t('sched.routes.field.duration')}>
              <input
                type="number"
                value={form.expected_duration_min}
                onChange={(e) => setForm((f) => ({ ...f, expected_duration_min: e.target.value }))}
                style={inputStyle}
                placeholder={t('sched.routes.field.duration_ph')}
              />
            </Field>
            <Field label={t('sched.routes.field.sla')}>
              <input
                type="number"
                value={form.sla_threshold_min}
                onChange={(e) => setForm((f) => ({ ...f, sla_threshold_min: e.target.value }))}
                style={inputStyle}
                placeholder={t('sched.routes.field.sla_ph')}
              />
            </Field>
          </div>

          {form.cadence === 'custom' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {DAY_ORDER.map((dow) => (
                <button
                  key={dow}
                  onClick={() => toggleCustomDay(dow)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: form.cadence_days.includes(dow) ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.cadence_days.includes(dow) ? '#fff' : 'var(--text-soft)',
                    border: '1px solid ' + (form.cadence_days.includes(dow) ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {DAY_LABELS[dow]}
                </button>
              ))}
            </div>
          )}

          {/* Zones picker */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: 0.12,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {t('sched.routes.zones_label', { n: zoneSelected.length })}
              {isEcoScope && (
                <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>
                  {t('sched.routes.campus_scope')}
                </span>
              )}
            </div>
            {zones.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                }}
              >
                {isEcoScope ? t('sched.routes.zones_empty_eco') : t('sched.routes.zones_empty_bldg')}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxHeight: 280,
                  overflow: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                {isEcoScope
                  ? buildingKeys.map((bldgId) => {
                      const bldgZones = byBuilding[bldgId];
                      const bldgFloors = sortedFloors(bldgZones);
                      const bldgByFloor = groupByFloor(bldgZones);
                      return (
                        <div key={bldgId} style={{ paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text)',
                              marginBottom: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Icon.building size={11} style={{ color: 'var(--accent)' }} />
                            {buildings[bldgId]?.name || bldgId}
                          </div>
                          {bldgFloors.map((floor) => (
                            <div key={floor} style={{ marginLeft: 16, marginBottom: 4 }}>
                              <div
                                style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 3 }}
                              >
                                {t('sched.routes.floor_n', { n: floor })}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {bldgByFloor[floor].map((z) => (
                                  <ZoneChip
                                    key={z.id}
                                    z={z}
                                    on={zoneSelected.includes(z.id)}
                                    toggle={() => toggleZone(z.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  : floorKeys.map((floor) => (
                      <div key={floor}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
                          {t('sched.routes.floor_n', { n: floor })}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {byFloor[floor].map((z) => (
                            <ZoneChip
                              key={z.id}
                              z={z}
                              on={zoneSelected.includes(z.id)}
                              toggle={() => toggleZone(z.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
              </div>
            )}
          </div>

          {/* Assignments */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: 0.12,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {t('sched.routes.assignments')}
            </div>
            {!route && (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                }}
              >
                {t('sched.routes.assignments.save_first')}
              </div>
            )}
            {route && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {assigns.map((a) => {
                  const m = members.find((x) => x.id === a.member_id);
                  if (!m) return null;
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {m.initials || m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                      <Pill tone={a.role === 'primary' ? 'ok' : 'info'}>
                        {ASSIGNMENT_ROLES.find((r) => r.id === a.role)?.label || a.role}
                      </Pill>
                      <button
                        onClick={() => removeMember(a.id)}
                        style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}
                      >
                        {t('sched.routes.assignments.remove')}
                      </button>
                    </div>
                  );
                })}
                {assigns.length === 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--risk)', marginBottom: 4 }}>
                    {t('sched.routes.assignments.empty')}
                  </div>
                )}
                {availableMembers.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <select id="add-member-picker" style={{ ...inputStyle, flex: 1 }} defaultValue="">
                      <option value="" disabled>
                        {t('sched.routes.assignments.add_ph')}
                      </option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.role || m.team}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const sel = document.getElementById('add-member-picker');
                        if (sel?.value) {
                          addMember(sel.value);
                          sel.value = '';
                        }
                      }}
                      style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}
                    >
                      {t('sched.routes.assignments.add')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {err && <div style={{ fontSize: 12, color: 'var(--risk)', fontWeight: 600 }}>{err}</div>}
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {route && (
            <button
              onClick={remove}
              style={{
                ...btnGhost,
                color: 'var(--risk)',
                borderColor: 'color-mix(in oklch, var(--risk) 40%, transparent)',
              }}
            >
              {t('sched.routes.delete_route')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btnGhost}>
            {t('sched.routes.cancel')}
          </button>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? t('sched.routes.saving') : t('sched.routes.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────── Today's Plan ──────────────────────────

// scope:
//   'building' (default) — only routes that apply to the active building
//   'org'                — every active route in the workspace (used by
//                          Contractor Ops; the contractor's crew works
//                          across multiple customer buildings).
export function TodaySection({ building, scope = 'building' }) {
  const t = useT();
  const { routes } = useRoutes();
  const { members } = useTeam();
  const overridesAll = useOverrides();
  const [overrideTarget, setOverrideTarget] = useState(null);

  const today = todayStr();
  const dow = dowOf(today);

  const activeBuilding = building?.id || 'hq';
  const todaysRoutes = routes
    .filter(
      (r) =>
        r.active !== false &&
        routeRunsOn(r, dow) &&
        (scope === 'org' || routeAppliesToBuilding(r, activeBuilding, descendantIds)),
    )
    .sort((a, b) => (a.expected_start_time || '').localeCompare(b.expected_start_time || ''));

  const todaysOverrides = overridesAll.filter((o) => o.date === today || (o.permanent && o.date <= today));

  return (
    <>
      <Card pad={false} style={{ flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Dot tone="accent" size={6} pulse />
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
            {new Date(today + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            {t(
              todaysRoutes.length === 1
                ? 'sched.today.date_eyebrow_routes_one'
                : 'sched.today.date_eyebrow_routes_many',
              {
                n: todaysRoutes.length,
                ov: t(todaysOverrides.length === 1 ? 'sched.today.overrides_one' : 'sched.today.overrides_many', {
                  n: todaysOverrides.length,
                }),
              },
            )}
          </div>
        </div>
      </Card>

      {todaysRoutes.length === 0 ? (
        <Card>
          <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
            {scope === 'org'
              ? t('sched.today.empty_org')
              : t('sched.today.empty_building', { name: building?.name || t('sched.routes.this_building') })}
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          <div>
            {todaysRoutes.map((r, i) => (
              <TodayRouteRow
                key={r.id}
                route={r}
                members={members}
                today={today}
                last={i === todaysRoutes.length - 1}
                viewLocationId={activeBuilding}
                onOverride={() => setOverrideTarget(r)}
              />
            ))}
          </div>
        </Card>
      )}

      {overrideTarget && (
        <OverrideModal route={overrideTarget} members={members} onClose={() => setOverrideTarget(null)} />
      )}
    </>
  );
}

function TodayRouteRow({ route, members, today, last, onOverride, viewLocationId }) {
  const t = useT();
  const assigns = routeAssignments(route.id);
  const primary = assigns.filter((a) => a.role === 'primary');
  const override = effectiveOverride(route.id, today);
  const renderOverride = useRouteOverrideRenderer();
  // Phase 2C: localize override.reason via kind+params when present.
  const structuredReason = override ? renderOverride(override).reason : null;
  // Phase 3: legacy override rows (no reason_code) get on-read
  // translation via the /api/translate cache. Structured rows pass
  // through unchanged — the empty-string short-circuits the hook.
  const isLegacyOverride = override && !override.reason_code;
  const txOverrideReason = useTranslatedText(isLegacyOverride ? structuredReason || '' : '');
  const overrideReason = isLegacyOverride ? txOverrideReason || structuredReason : structuredReason;

  // Phase 14d: show the breadcrumb only when the route is somewhere
  // other than the current view — e.g. when viewing "EMEA" and the
  // route targets "EMEA › UK › Canary Wharf". Same-location routes
  // skip the crumb so single-building schedules stay quiet.
  const showCrumb = route.location_id && route.location_id !== viewLocationId;
  const crumbs = showCrumb ? breadcrumbFor(route.location_id) : [];
  const crumbLabel = crumbs.map((c) => c.name).join(' › ');

  const effectiveMemberIds = new Set(primary.map((a) => a.member_id));
  if (override?.action === 'reassign') {
    if (override.from_member_id) effectiveMemberIds.delete(override.from_member_id);
    if (override.to_member_id) effectiveMemberIds.add(override.to_member_id);
  }
  const effectiveNames = Array.from(effectiveMemberIds)
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);

  const skipped = override?.action === 'skip';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '70px minmax(0, 1fr) 130px 190px auto',
        gap: 12,
        alignItems: 'center',
        padding: '12px 14px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        opacity: skipped ? 0.55 : 1,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          fontWeight: 700,
          color: override ? 'var(--accent)' : 'var(--text-soft)',
        }}
      >
        {route.expected_start_time ? route.expected_start_time.slice(0, 5) : '—'}
      </div>
      <div style={{ minWidth: 0 }}>
        {crumbLabel && (
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--accent)',
              fontWeight: 600,
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {crumbLabel}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {route.name}
          </div>
          {override && (
            <Pill tone={override.source === 'merlin' ? 'accent' : 'warn'}>
              {override.source === 'merlin'
                ? t('sched.today.merlin_reroute')
                : override.permanent
                  ? t('sched.today.permanent_change')
                  : t('sched.today.override')}
            </Pill>
          )}
        </div>
        {overrideReason ? (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontStyle: 'italic' }}>
            {overrideReason}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {t('sched.routes.zones_count', { n: routeZoneIds(route.id).length })} ·{' '}
            {route.expected_duration_min
              ? t('sched.routes.duration_min', { n: route.expected_duration_min })
              : t('sched.today.no_duration')}
          </div>
        )}
      </div>
      <Pill tone={serviceTone(route.service_type)}>{serviceLabel(route.service_type)}</Pill>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
        {skipped ? (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-dim)', textDecoration: 'line-through' }}>
            {t('sched.skipped_today')}
          </span>
        ) : effectiveNames.length > 0 ? (
          <>
            <div style={{ display: 'flex' }}>
              {effectiveNames.slice(0, 3).map((m, idx) => (
                <div
                  key={m.id}
                  title={m.name}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    marginLeft: idx === 0 ? 0 : -6,
                    border: '2px solid var(--surface)',
                  }}
                >
                  {m.initials || m.name.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {effectiveNames.map((m) => m.name.split(' ')[0]).join(', ')}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--risk)', fontWeight: 600 }}>{t('sched.no_one_assigned')}</span>
        )}
      </div>
      <button onClick={onOverride} style={{ ...btnGhost, padding: '5px 12px', fontSize: 11 }}>
        {override ? t('sched.today.review') : t('sched.today.override')}
      </button>
    </div>
  );
}

function OverrideModal({ route, members, onClose }) {
  const t = useT();
  const today = todayStr();
  const [form, setForm] = useState({
    action: 'reassign',
    permanent: false,
    from_member_id: routeAssignments(route.id).find((a) => a.role === 'primary')?.member_id || '',
    to_member_id: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const existing = overridesForRouteOnDate(route.id, today);

  const save = async () => {
    setErr(null);
    if (form.action === 'reassign' && !form.to_member_id) return setErr(t('sched.override.pick_replacement'));
    setSaving(true);
    try {
      await createOverride({
        route_id: route.id,
        date: today,
        permanent: form.permanent,
        action: form.action,
        from_member_id: form.action === 'reassign' ? form.from_member_id || null : null,
        to_member_id: form.action === 'reassign' ? form.to_member_id : null,
        reason: form.reason,
        source: 'human',
      });
      onClose();
    } catch (e) {
      setErr(e.message || t('sched.override.could_not_save'));
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    if (!(await confirmDialog({ body: t('sched.override.remove_confirm'), danger: true }))) return;
    try {
      await deleteOverride(id);
      onClose();
    } catch (e) {
      setErr(e.message || t('sched.override.could_not_delete'));
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          maxWidth: 540,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t('sched.override.title', { name: route.name })}</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
            }}
          >
            <Icon.close size={14} />
          </button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {existing.length > 0 && (
            <div
              style={{
                padding: 10,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  letterSpacing: 0.1,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                {t('sched.override.active_today')}
              </div>
              {existing.map((o) => {
                const from = members.find((m) => m.id === o.from_member_id);
                const to = members.find((m) => m.id === o.to_member_id);
                return (
                  <div
                    key={o.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 0' }}
                  >
                    <Pill tone={o.source === 'merlin' ? 'accent' : 'info'}>{o.source}</Pill>
                    <span style={{ fontWeight: 600 }}>
                      {OVERRIDE_ACTIONS.find((a) => a.id === o.action)?.label || o.action}
                    </span>
                    {o.action === 'reassign' && (
                      <span style={{ color: 'var(--text-dim)' }}>
                        {from ? from.name : '—'} → {to ? to.name : '—'}
                      </span>
                    )}
                    {o.permanent && <Pill tone="warn">{t('sched.override.permanent_pill')}</Pill>}
                    <div style={{ flex: 1 }} />
                    <button onClick={() => cancel(o.id)} style={{ ...btnGhost, padding: '3px 10px', fontSize: 11 }}>
                      {t('sched.override.remove')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={t('sched.override.field.action')}>
              <select
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                style={inputStyle}
              >
                {OVERRIDE_ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('sched.override.field.applies')}>
              <select
                value={form.permanent ? '1' : '0'}
                onChange={(e) => setForm((f) => ({ ...f, permanent: e.target.value === '1' }))}
                style={inputStyle}
              >
                <option value="0">{t('sched.override.applies.today')}</option>
                <option value="1">{t('sched.override.applies.permanent')}</option>
              </select>
            </Field>
          </div>

          {form.action === 'reassign' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={t('sched.override.field.original')}>
                <select
                  value={form.from_member_id}
                  onChange={(e) => setForm((f) => ({ ...f, from_member_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('sched.override.field.replacement')}>
                <select
                  value={form.to_member_id}
                  onChange={(e) => setForm((f) => ({ ...f, to_member_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <Field label={t('sched.override.field.reason')}>
            <input
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              style={inputStyle}
              placeholder={t('sched.override.field.reason_ph')}
            />
          </Field>

          {err && <div style={{ fontSize: 12, color: 'var(--risk)', fontWeight: 600 }}>{err}</div>}
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btnGhost}>
            {t('sched.override.cancel')}
          </button>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? t('sched.override.saving') : t('sched.override.log')}
          </button>
        </div>
      </div>
    </div>
  );
}
