// PREDICT → Forecast. Merlin's forward look: where the building's
// environment + people-traffic are heading over the next 12 hours, from
// live sensor + occupancy trends, and what it plans to do ahead of each
// peak. Sibling to MaintenancePage (equipment) under the PREDICT pillar.
//
// v1 surfaces representative, building-specific forecasts (the same signals
// the Now strip teases) in a fuller layout. The fixture VALUES below
// (locations, readings) are demo data — Phase 2 wires real sensor history +
// model output here. The section shapes + all UI copy are the contract.

import React from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { ENV_FORECAST } from './predict-forecast.js';

// Predicted occupancy curve for a typical office weekday (% of capacity),
// 06:00 → 20:00. Drives the traffic bar chart + the peak callout.
const OCC_CURVE = [
  { h: '06', v: 8 },
  { h: '07', v: 18 },
  { h: '08', v: 42 },
  { h: '09', v: 68 },
  { h: '10', v: 81 },
  { h: '11', v: 85 },
  { h: '12', v: 72 },
  { h: '13', v: 64 },
  { h: '14', v: 83 },
  { h: '15', v: 79 },
  { h: '16', v: 66 },
  { h: '17', v: 41 },
  { h: '18', v: 19 },
  { h: '19', v: 9 },
];

// Occupancy chart geometry. Bars get a PIXEL height derived from value so
// they never collapse against an auto-height parent (the v1 bug: a `%`
// height resolves to 0 when the column wrapper has no definite height).
const CHART_H = 160; // total track height
const BAR_TRACK = CHART_H - 16; // room reserved above the tallest bar for its value label
const CAPACITY_PCT = 80; // comfort/capacity threshold drawn as a guide line

// Env-forecast signals — single source of truth in predict-forecast.js,
// shared with the chat backend so Merlin knows every signal shown here (no
// drift). Display prose comes from i18n (noteKey) for EN/FR.

const PLANNED = [
  { agent: 'CLEANING', when: '13:30', textKey: 'predict.forecast.plan.cleaning' },
  { agent: 'HVAC', when: '10:45', textKey: 'predict.forecast.plan.hvac' },
  { agent: 'ENERGY', when: '18:45', textKey: 'predict.forecast.plan.energy' },
  { agent: 'SPACE', when: 'rolling', textKey: 'predict.forecast.plan.space' },
];

// Parse the leading number out of a reading string ('1,120 ppm' → 1120,
// '60 %' → 60). Returns null when there's no parseable number so the delta
// chip simply doesn't render.
function leadingNumber(s) {
  const m = String(s)
    .replace(/,/g, '')
    .match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// now→peak percentage change, rounded. null when either end isn't numeric.
function trendDelta(now, peak) {
  const a = leadingNumber(now);
  const b = leadingNumber(peak);
  if (a == null || b == null || a === 0) return null;
  return Math.round(((b - a) / a) * 100);
}

export function ForecastPage({ building, onOpenChat }) {
  const t = useT();
  const bName = building?.name || t('predict.forecast.this_building');
  // IMF is a live device pilot — no demo fixtures. Render the header + an
  // honest empty state; real forecasts populate from live sensor history.
  const isImf = building?.variant === 'imf';
  const peak = OCC_CURVE.reduce((m, p) => (p.v > m.v ? p : m), OCC_CURVE[0]);

  // Open chat AND send — so a card click produces a visible answer rather
  // than silently prefilling the composer of an already-docked chat panel.
  const ask = (q) => onOpenChat?.(q, { send: true });

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
              {t('predict.forecast.eyebrow')}
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
            {t('predict.forecast.title')}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 760 }}>
            {t('predict.forecast.intro', { building: bName })}
          </p>
        </div>

        {isImf ? (
          <Card style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
            {t('predict.forecast.empty')}
          </Card>
        ) : (
          <>
            {/* Environmental forecast */}
            <SectionLabel icon="beacon">{t('predict.forecast.sec.env')}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {ENV_FORECAST.map((f) => {
                const delta = trendDelta(f.now, f.peak);
                return (
                  <Clickable
                    key={f.key}
                    onClick={() =>
                      ask(
                        t('predict.forecast.ask_signal', {
                          label: f.label,
                          where: f.where,
                          // Seed the card's real trajectory + driver so Merlin answers
                          // grounded instead of refusing for lack of a canonical room.
                          facts: `now ${f.now}, predicted peak ${f.peak} at ${f.when}${f.risk ? ', breach risk' : ''} — ${t(f.noteKey)}`,
                        }),
                      )
                    }
                  >
                    <Card
                      pad
                      interactive
                      style={{ height: '100%', ...(f.risk ? { borderLeft: '3px solid #ef4444' } : null) }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--text-faint)',
                            fontWeight: 700,
                          }}
                        >
                          {f.label}
                        </div>
                        {f.risk && (
                          <span
                            style={{
                              padding: '2px 7px',
                              fontSize: 9.5,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              background: 'color-mix(in oklch, #ef4444 14%, transparent)',
                              color: '#ef4444',
                              border: '1px solid color-mix(in oklch, #ef4444 36%, transparent)',
                              borderRadius: 999,
                            }}
                          >
                            {t('predict.forecast.breach_risk')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 8 }}>{f.where}</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 9.5,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: 'var(--text-faint)',
                              fontWeight: 700,
                            }}
                          >
                            {t('predict.forecast.now')}
                          </div>
                          <div
                            style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-soft)', whiteSpace: 'nowrap' }}
                          >
                            {f.now}
                          </div>
                        </div>
                        <Icon.chevR size={14} style={{ color: 'var(--text-faint)', marginBottom: 4, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 9.5,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: 'var(--text-faint)',
                              fontWeight: 700,
                            }}
                          >
                            {t('predict.forecast.peak_at', { when: f.when })}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                            <div
                              style={{
                                fontSize: 24,
                                fontWeight: 800,
                                color: f.risk ? '#ef4444' : 'var(--text)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {f.peak}
                            </div>
                            {delta != null && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: 'var(--mono)',
                                  whiteSpace: 'nowrap',
                                  color: f.risk ? '#ef4444' : 'var(--text-dim)',
                                }}
                              >
                                {delta >= 0 ? '+' : ''}
                                {delta}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.5 }}>
                        {t(f.noteKey)}
                      </div>
                    </Card>
                  </Clickable>
                );
              })}
            </div>

            {/* People & traffic */}
            <SectionLabel icon="people">{t('predict.forecast.sec.traffic')}</SectionLabel>
            <Card pad>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                  {t('predict.forecast.occ_title')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {t('predict.forecast.peak')} <strong style={{ color: 'var(--accent)' }}>{peak.v}%</strong>{' '}
                  {t('predict.forecast.peak_join')} <strong>{peak.h}:00</strong>
                </div>
              </div>
              {/* Bar chart. Track is a fixed-height, position:relative box so the
              capacity guide line can be absolutely placed and bars get pixel
              heights (no %-against-auto-height collapse). */}
              <div style={{ position: 'relative', height: CHART_H }}>
                {/* 80% capacity guide line */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: (CAPACITY_PCT / 100) * BAR_TRACK,
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ borderTop: '1px dashed color-mix(in oklch, var(--text-faint) 60%, transparent)' }} />
                  <span
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: -8,
                      fontSize: 9,
                      fontFamily: 'var(--mono)',
                      color: 'var(--text-faint)',
                      background: 'var(--surface)',
                      padding: '0 4px',
                    }}
                  >
                    {t('predict.forecast.capacity_line', { pct: CAPACITY_PCT })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: '100%' }}>
                  {OCC_CURVE.map((p) => {
                    const hot = p.v >= CAPACITY_PCT;
                    return (
                      <div
                        key={p.h}
                        style={{
                          flex: 1,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <div style={{ fontSize: 9.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                          {p.v}
                        </div>
                        <div
                          title={`${p.h}:00 · ${p.v}%`}
                          style={{
                            width: '100%',
                            height: (p.v / 100) * BAR_TRACK,
                            borderRadius: 5,
                            background: hot
                              ? 'linear-gradient(180deg, #ef4444, color-mix(in oklch, #ef4444 55%, transparent))'
                              : 'linear-gradient(180deg, var(--accent), color-mix(in oklch, var(--accent) 45%, transparent))',
                            transition: 'height .2s',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Hour axis */}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {OCC_CURVE.map((p) => (
                  <div
                    key={p.h}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 10,
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    {p.h}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 14, lineHeight: 1.5 }}>
                {t('predict.forecast.occ_note')}
              </div>
            </Card>

            {/* What Merlin will do */}
            <SectionLabel icon="sparkle">{t('predict.forecast.sec.plan')}</SectionLabel>
            <Card pad>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {PLANNED.map((p, i) => {
                  const text = t(p.textKey);
                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => ask(t('predict.forecast.ask_plan', { agent: p.agent, text }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          ask(t('predict.forecast.ask_plan', { agent: p.agent, text }));
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '12px 4px',
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
                          width: 52,
                          flexShrink: 0,
                          paddingTop: 1,
                        }}
                      >
                        {p.when === 'rolling' ? t('predict.forecast.rolling') : p.when}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: 'var(--accent)',
                          fontWeight: 700,
                          width: 84,
                          flexShrink: 0,
                          paddingTop: 1,
                        }}
                      >
                        {p.agent}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.45 }}>{text}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => ask(t('predict.forecast.ask_default'))}
                style={{
                  marginTop: 12,
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
                <Icon.sparkle size={11} /> {t('predict.forecast.ask_cta')}
              </button>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

// Clickable wrapper — adds onClick + keyboard support + a subtle hover-lift
// to any card. Mirrors the Track A pattern on NowBriefingPage (the Card
// primitive doesn't forward onClick, so wrapping is the clean way to add it).
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

function SectionLabel({ icon, children }) {
  const I = Icon[icon] || Icon.bolt;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
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
