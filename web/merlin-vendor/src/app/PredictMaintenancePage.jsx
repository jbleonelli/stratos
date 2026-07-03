// PREDICT → Maintenance. Predictive maintenance for the building: Merlin
// watches equipment telemetry for pre-failure signatures, estimates
// time-to-failure, and schedules work before things break. Sibling to
// ForecastPage (environment + traffic) under the PREDICT pillar.
//
// NB: named PredictMaintenancePage to avoid colliding with MaintenancePage
// (the maintenance-MODE "site is down" screen).
//
// v1 surfaces representative, building-specific equipment health in the
// section shapes we want; the live device count is real (useDevices). The
// fixture VALUES (asset names, rooms, readings) are demo data — wire the
// predictive-maintenance agent's runs + per-asset telemetry here as they
// land. Section shapes + UI copy are the contract. Health rings + sparklines
// drift on the sensor tick so the page reads as alive (autopilot watching),
// not a static snapshot.

import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Sparkline } from './primitives.jsx';
import { useDevices } from './devices-store.js';
import { subscribeSensorTick } from './sensor-simulator.js';
import { useT } from './i18n.js';
import { useFormatTime } from './locale-format.js';
import { PREDICT_EQUIPMENT } from './predict-equipment.js';

// Equipment fleet — single source of truth in predict-equipment.js, shared
// with the chat backend so Merlin knows every asset shown here (no drift).
// Display prose (signal/ttf/action) is rendered from i18n for EN/FR; the
// numeric/structural fields (health, trend, tone, cat) come from the module.
const EQUIPMENT = PREDICT_EQUIPMENT;

const SCHEDULED = [
  {
    key: 'pump',
    whenKey: 'predict.maint.when.mon',
    asset: 'Pump P-204',
    workKey: 'predict.maint.sch.pump',
    who: 'Darnell Price',
    kind: 'predictive',
  },
  {
    key: 'driver',
    whenKey: 'predict.maint.when.thu',
    asset: 'LED Driver Bank · F22',
    workKey: 'predict.maint.sch.driver',
    who: 'Darnell Price',
    kind: 'predictive',
  },
  {
    key: 'emerg',
    whenKey: 'predict.maint.when.tomorrow',
    asset: 'Emergency Lighting',
    workKey: 'predict.maint.sch.emerg',
    who: 'Contractor · LumenSafe',
    kind: 'predictive',
  },
  {
    key: 'chiller',
    whenKey: 'predict.maint.when.wed',
    asset: 'Chiller 1',
    workKey: 'predict.maint.sch.chiller',
    who: 'Contractor · CoolTech',
    kind: 'predictive',
  },
  {
    key: 'ahu',
    whenKey: 'predict.maint.when.fri',
    asset: 'AHU-3',
    workKey: 'predict.maint.sch.ahu',
    who: 'Darnell Price',
    kind: 'planned',
  },
  {
    key: 'tower',
    whenKey: 'predict.maint.when.nextweek',
    asset: 'Cooling Tower',
    workKey: 'predict.maint.sch.tower',
    who: 'Contractor · AquaServ',
    kind: 'predictive',
  },
];

const PREVENTED = [
  { asset: 'Garage lighting', textKey: 'predict.maint.prev.garage', whenKey: 'predict.maint.when.lastweek' },
  { asset: 'AHU-1', textKey: 'predict.maint.prev.ahu', whenKey: 'predict.maint.when.lastmonth' },
  { asset: 'Sump pump S-2', textKey: 'predict.maint.prev.sump', whenKey: 'predict.maint.when.2weeks' },
];

export function PredictMaintenancePage({ building, onOpenChat }) {
  const t = useT();
  const fmtTime = useFormatTime();
  const { devices, ready } = useDevices(building);
  const monitored = ready ? devices.length : null;
  const atRisk = EQUIPMENT.filter((e) => e.tone !== 'ok').length;
  // IMF is a live device pilot — no fabricated equipment fixtures.
  const isImf = building?.variant === 'imf';

  // Live tick — re-render on the sensor drift so health rings + the
  // "Updated" stamp read as a live watch rather than a static snapshot.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => subscribeSensorTick(() => setTick((n) => n + 1)), []);

  // Open chat AND send (the { send: true } pattern) so a card click yields a
  // visible Merlin answer instead of silently prefilling a docked composer.
  const ask = (q) => onOpenChat?.(q, { send: true });

  // Live pilot: real equipment telemetry only — render header + empty state
  // instead of the demo equipment fixtures.
  if (isImf) {
    return (
      <main style={{ flex: 1, overflow: 'auto', padding: 12, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  fontWeight: 700,
                }}
              >
                {t('predict.maint.eyebrow')}
              </div>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: -0.02,
                lineHeight: 1.15,
                color: 'var(--text)',
              }}
            >
              {t('predict.maint.title')}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 760 }}>
              {t('predict.maint.intro')}
            </p>
          </div>
          <Card style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
            {t('predict.maint.empty')}
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: 12, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                fontWeight: 700,
              }}
            >
              {t('predict.maint.eyebrow')}
            </div>
            <LiveStamp t={t} tick={tick} fmtTime={fmtTime} />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: -0.02,
              lineHeight: 1.15,
              color: 'var(--text)',
            }}
          >
            {t('predict.maint.title')}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 760 }}>
            {t('predict.maint.intro')}
          </p>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Kpi
            label={t('predict.maint.kpi.monitored')}
            value={monitored != null ? monitored : '—'}
            sub={t('predict.maint.kpi.monitored_sub')}
          />
          <Kpi
            label={t('predict.maint.kpi.atrisk')}
            value={atRisk}
            sub={t('predict.maint.kpi.atrisk_sub', { n: atRisk })}
            tone={atRisk > 0 ? 'warn' : 'ok'}
          />
          <Kpi
            label={t('predict.maint.kpi.prevented')}
            value="8"
            sub={t('predict.maint.kpi.prevented_sub')}
            tone="ok"
          />
          <Kpi label={t('predict.maint.kpi.downtime')} value="0" sub={t('predict.maint.kpi.downtime_sub')} tone="ok" />
        </div>

        {/* Equipment health */}
        <SectionLabel icon="cog">{t('predict.maint.sec.health')}</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {EQUIPMENT.map((e) => {
            // Drift the displayed health a hair on each tick so the rings
            // breathe — bounded ±1 around the fixture baseline, never crossing
            // into a different tone. Deterministic per-tick (no Math.random,
            // which is unavailable in this codebase's constraints anyway).
            const wobble = ((tick + e.name.length) % 3) - 1; // -1 | 0 | 1
            const shownHealth = Math.max(0, Math.min(100, e.health + wobble));
            const tc = toneColor(e.tone);
            return (
              <Clickable
                key={e.key}
                onClick={() =>
                  ask(
                    t('predict.maint.ask_asset', {
                      asset: e.name,
                      // Seed the card's real facts so Merlin answers grounded
                      // even on a free-typed-feeling click, not a bare name.
                      facts: `${e.system} · ${t(`predict.maint.eq.${e.key}.signal`)} · ${t(`predict.maint.eq.${e.key}.ttf`)} · ${t(`predict.maint.eq.${e.key}.action`)}`,
                    }),
                  )
                }
              >
                <Card
                  pad
                  interactive
                  style={{
                    height: '100%',
                    ...(e.tone === 'risk'
                      ? { borderLeft: '3px solid #ef4444' }
                      : e.tone === 'warn'
                        ? { borderLeft: '3px solid #f59e0b' }
                        : null),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {e.cat === 'lighting' && <Icon.light size={13} style={{ color: tc, flexShrink: 0 }} />}
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {e.name}
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 1 }}>{e.system}</div>
                    </div>
                    <HealthRing pct={shownHealth} tone={e.tone} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 10, lineHeight: 1.5 }}>
                    <Icon.beacon size={11} style={{ color: tc, marginRight: 5, verticalAlign: '-1px' }} />
                    {t(`predict.maint.eq.${e.key}.signal`)}
                  </div>
                  {/* 7-day health trend sparkline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <Sparkline
                      data={e.trend}
                      w={120}
                      h={26}
                      stroke={tc}
                      fill={`color-mix(in oklch, ${tc} 14%, transparent)`}
                    />
                    <span
                      style={{
                        fontSize: 9.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        fontWeight: 700,
                      }}
                    >
                      {t('predict.maint.trend')}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc }}>
                      {t(`predict.maint.eq.${e.key}.ttf`)}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-dim)', textAlign: 'right' }}>
                      {t(`predict.maint.eq.${e.key}.action`)}
                    </span>
                  </div>
                </Card>
              </Clickable>
            );
          })}
        </div>

        {/* Two columns: scheduled + prevented */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)',
            gap: 16,
            alignItems: 'flex-start',
          }}
        >
          <Card pad>
            <SectionLabel icon="ship" inline>
              {t('predict.maint.sec.scheduled')}
            </SectionLabel>
            <div style={{ marginTop: 10 }}>
              {SCHEDULED.map((s, i) => {
                const work = t(s.workKey);
                const askWork = () =>
                  ask(t('predict.maint.ask_work', { work, asset: s.asset, when: t(s.whenKey), who: s.who }));
                return (
                  <div
                    key={s.key}
                    role="button"
                    tabIndex={0}
                    onClick={askWork}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        askWork();
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 4px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                      borderRadius: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--mono)',
                        color: 'var(--text-faint)',
                        fontWeight: 700,
                        width: 74,
                        flexShrink: 0,
                      }}
                    >
                      {t(s.whenKey)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {s.asset} <span style={{ fontWeight: 400, color: 'var(--text-soft)' }}>· {work}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{s.who}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                        padding: '2px 7px',
                        borderRadius: 999,
                        color: s.kind === 'predictive' ? 'var(--accent)' : 'var(--text-dim)',
                        background: s.kind === 'predictive' ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${s.kind === 'predictive' ? 'var(--accent-line)' : 'var(--border)'}`,
                      }}
                    >
                      {t(`predict.maint.kind.${s.kind}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card pad>
            <SectionLabel icon="sparkle" inline>
              {t('predict.maint.sec.prevented')}
            </SectionLabel>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PREVENTED.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#10b981',
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.45 }}>
                      <strong style={{ color: 'var(--text)' }}>{p.asset}</strong> — {t(p.textKey)}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>{t(p.whenKey)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => ask(t('predict.maint.ask_cta').replace(/\s*→\s*$/, ''))}
              style={{
                marginTop: 14,
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon.sparkle size={11} /> {t('predict.maint.ask_cta')}
            </button>
          </Card>
        </div>
      </div>
    </main>
  );
}

// Live "Updated HH:MM · live" stamp with a pulsing dot. Recomputes the time
// on each sensor tick.
function LiveStamp({ t, tick, fmtTime }) {
  const time = React.useMemo(() => fmtTime(new Date()), [tick, fmtTime]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#10b981',
          color: '#10b981',
          animation: 'merlinPulse 2.4s ease-out infinite',
        }}
      />
      <span
        style={{
          fontSize: 10.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontWeight: 700,
        }}
      >
        {t('predict.maint.updated', { time })} · {t('predict.maint.live')}
      </span>
    </span>
  );
}

// Clickable wrapper — adds onClick + keyboard support + a subtle hover-lift.
// Mirrors the pattern on Forecast/Now (the Card primitive doesn't forward
// onClick, so wrapping is the clean way to add it).
function Clickable({ onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  if (!onClick) return children;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        // Fill the stretched grid cell so sibling cards are equal height
        // (the grid stretches this wrapper; the Card inside also gets 100%).
        height: '100%',
        borderRadius: 'var(--radius)',
        transition: 'transform .12s ease, box-shadow .12s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 22px color-mix(in oklch, var(--accent) 16%, transparent)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function toneColor(tone) {
  return tone === 'risk' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : '#10b981';
}

function HealthRing({ pct, tone }) {
  const color = toneColor(tone);
  const r = 18,
    c = 2 * Math.PI * r,
    dash = c * (pct / 100);
  return (
    <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="23"
          cy="23"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 23 23)"
          style={{ transition: 'stroke-dasharray .4s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          color: 'var(--text)',
        }}
      >
        {pct}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'ok' }) {
  const elevated = tone === 'warn' || tone === 'risk';
  const accent = toneColor(tone);
  return (
    <Card pad style={elevated ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: -0.02 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{sub}</div>
    </Card>
  );
}

function SectionLabel({ icon, children, inline }) {
  const I = Icon[icon] || Icon.bolt;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: inline ? 0 : 4 }}>
      <I size={13} style={{ color: 'var(--accent)' }} />
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontWeight: 700,
        }}
      >
        {children}
      </div>
    </div>
  );
}
