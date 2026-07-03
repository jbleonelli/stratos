// PREDICT → Innovations. Merlin-authored "worth adopting next" pitches:
// marketplace partner solutions that plug into Merlin and would move the
// needle for THIS building, each with a why-it-fits rationale, sized impact,
// and a phased adoption plan the FM can act on. Sibling to Forecast /
// Maintenance / Compliance under the PREDICT (ANTICIPATE) pillar.
//
// v1 features one recommendation: Verdigris (circuit-level energy
// sub-metering, a real marketplace vendor) for Meridian HQ. The pitch is
// grounded in the demo's existing energy story (92 kW peak, Chiller 1 watch,
// demand charges). Demo copy lives in i18n (predict.innov.*); wire a real
// recommender (match marketplace vendors to a building's open problems) here
// as it lands. Cards click through to chat and SEND, so a click drafts the
// proposal with Merlin.

import React from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT } from './i18n.js';

const IMPACTS = [
  { key: 'impact1', icon: 'bolt' },
  { key: 'impact2', icon: 'beacon' },
  { key: 'impact3', icon: 'check' },
  { key: 'impact4', icon: 'cog' },
];

const STEPS = ['step1', 'step2', 'step3', 'step4'];

export function InnovationsPage({ building, onOpenChat, onView }) {
  const t = useT();
  const bName = building?.name || 'this building';
  // IMF is a live device pilot — no demo fixtures. Render the header + an
  // honest empty state; real recommendations populate from usage data.
  const isImf = building?.variant === 'imf';
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
              {t('predict.innov.eyebrow')}
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
            {t('predict.innov.title')}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 760 }}>
            {t('predict.innov.intro', { building: bName })}
          </p>
        </div>

        {isImf ? (
          <Card
            pad
            style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}
          >
            {t('predict.innov.empty')}
          </Card>
        ) : (
          <>
            {/* The recommendation hero — Verdigris */}
            <Card pad style={{ position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background:
                    'radial-gradient(520px 240px at 88% 0%, color-mix(in oklch, var(--accent) 16%, transparent), transparent 60%)',
                }}
              />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--accent)',
                      color: '#fff',
                    }}
                  >
                    <Icon.bolt size={22} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        marginBottom: 6,
                        padding: '2px 8px',
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        background: 'var(--accent-soft)',
                        border: '1px solid var(--accent-line)',
                        borderRadius: 999,
                      }}
                    >
                      {t('predict.innov.recommended')}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Verdigris</div>
                    <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>
                      {t('predict.innov.vd.tagline')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                      {t('predict.innov.vd.category')}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Why it fits */}
            <SectionLabel icon="sparkle">{t('predict.innov.why_title')}</SectionLabel>
            <Card pad>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {t('predict.innov.vd.why')}
              </div>
            </Card>

            {/* Expected impact */}
            <SectionLabel icon="bolt">{t('predict.innov.impact_title')}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {IMPACTS.map((m) => {
                const IconC = Icon[m.icon] || Icon.sparkle;
                return (
                  <Card key={m.key} pad>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <IconC size={13} style={{ color: 'var(--accent)' }} />
                      <div
                        style={{
                          fontSize: 10.5,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: 'var(--text-faint)',
                          fontWeight: 700,
                        }}
                      >
                        {t(`predict.innov.vd.${m.key}.k`)}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15 }}>
                      {t(`predict.innov.vd.${m.key}.v`)}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Adoption plan */}
            <SectionLabel icon="check">{t('predict.innov.plan_title')}</SectionLabel>
            <Card pad>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {STEPS.map((s, i) => {
                  const stepT = t(`predict.innov.vd.${s}.t`);
                  const stepD = t(`predict.innov.vd.${s}.d`);
                  const askStep = () => ask(t('predict.innov.ask_step', { step: stepT, detail: stepD }));
                  return (
                    <div
                      key={s}
                      role="button"
                      tabIndex={0}
                      onClick={askStep}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          askStep();
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        padding: '14px 4px',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        cursor: 'pointer',
                        borderRadius: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          flexShrink: 0,
                          marginTop: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--accent-soft)',
                          color: 'var(--accent)',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{stepT}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.5 }}>
                          {stepD}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => ask(t('predict.innov.ask_adopt'))}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon.sparkle size={13} /> {t('predict.innov.ask_adopt')}
              </button>
              <button
                onClick={() => ask(t('predict.innov.ask_why'))}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('predict.innov.ask_why')}
              </button>
              <button
                onClick={() => onView?.('innovate')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '10px 4px',
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
                {t('predict.innov.learn_more')}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
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
