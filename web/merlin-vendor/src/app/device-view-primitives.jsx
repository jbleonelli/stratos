// Device detail view — shared presentational primitives.
// Extracted from DeviceView.jsx (Phase 3 god-file decomposition). Pure leaves:
// no DeviceView state/effects, only Icon/Pill/Card/useT.
import React from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useT } from './i18n.js';

export function HistSummary({ label, value, sub, tone }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[tone] ||
    'var(--text)';
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

export function SectionTitle({ icon, title, sub }) {
  const IconC = Icon[icon] || Icon.bell;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconC size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function KV({ k, v, tone, last }) {
  const color = tone ? `var(--${tone})` : 'var(--text)';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '8px 0',
        borderBottom: last ? 'none' : '1px dashed var(--border)',
      }}
    >
      <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{k}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color, fontFamily: 'var(--mono)' }}>{v}</span>
    </div>
  );
}

export function UptimeStrip({ data }) {
  const t = useT();
  return (
    <>
      <div style={{ display: 'flex', gap: 2, height: 36, marginTop: 10, alignItems: 'stretch' }}>
        {data.map((s, i) => (
          <div
            key={i}
            title={`${Math.floor(i / 2)}:${i % 2 ? '30' : '00'} · ${s}`}
            style={{
              flex: 1,
              borderRadius: 2,
              background:
                s === 'online'
                  ? 'color-mix(in oklch, var(--ok) 70%, transparent)'
                  : s === 'degraded'
                    ? 'color-mix(in oklch, var(--warn) 70%, transparent)'
                    : 'color-mix(in oklch, var(--risk) 70%, transparent)',
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 10,
          color: 'var(--text-faint)',
          fontFamily: 'var(--mono)',
        }}
      >
        <span>{t('dv.upt.24h_ago')}</span>
        <span>{t('dv.upt.12h')}</span>
        <span>{t('dv.upt.now')}</span>
      </div>
    </>
  );
}

export function BarChart({ data, scaleMax }) {
  const max = scaleMax || Math.max(...data) * 1.1;
  return (
    <div style={{ display: 'flex', gap: 2, height: 48, marginTop: 10, alignItems: 'flex-end' }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            minHeight: 4,
            background: 'color-mix(in oklch, var(--accent) 55%, transparent)',
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

export function BatteryChart({ data }) {
  return (
    <div style={{ display: 'flex', gap: 2, height: 60, marginTop: 10, alignItems: 'flex-end' }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / 100) * 100}%`,
            minHeight: 2,
            background: v < 20 ? 'var(--risk)' : v < 40 ? 'var(--warn)' : 'var(--ok)',
            opacity: 0.85,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

export function RatingBars({ ratings, total }) {
  return (
    <div style={{ marginTop: 10 }}>
      {[5, 4, 3, 2, 1].map((n) => {
        const pct = (ratings[n] / total) * 100;
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 14, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>{n}★</span>
            <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: n >= 4 ? 'var(--ok)' : n === 3 ? 'var(--warn)' : 'var(--risk)',
                  borderRadius: 3,
                }}
              />
            </div>
            <span
              style={{
                width: 32,
                textAlign: 'right',
                fontSize: 10.5,
                color: 'var(--text-dim)',
                fontFamily: 'var(--mono)',
              }}
            >
              {ratings[n]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ActivityRow({ e, last, wide }) {
  const t = useT();
  const IconC = Icon[e.icon] || Icon.bell;
  return (
    <div
      style={{
        display: wide ? 'grid' : 'flex',
        gridTemplateColumns: wide ? '32px 1fr 120px 110px' : undefined,
        gap: 10,
        alignItems: 'center',
        padding: '10px 4px',
        borderBottom: last ? 'none' : '1px dashed var(--border)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          flexShrink: 0,
          background: `color-mix(in oklch, var(--${e.tone}) 14%, transparent)`,
          color: `var(--${e.tone})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconC size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{e.kind}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{e.sub || '\u2014'}</div>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{e.t}</div>
      {wide && (
        <div style={{ fontSize: 11 }}>
          <Pill tone={e.tone}>
            {e.tone === 'ok'
              ? t('dv.actrow.logged')
              : e.tone === 'warn'
                ? t('dv.actrow.queued')
                : t('dv.actrow.escalated')}
          </Pill>
        </div>
      )}
    </div>
  );
}

export function MerlinStrip({ onAskMerlin, questions, style }) {
  const t = useT();
  return (
    <Card
      style={{
        gridColumn: '1 / -1',
        background: 'color-mix(in oklch, var(--accent) 5%, var(--surface))',
        ...(style || {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('dv.ms.title')}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onAskMerlin?.(q)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            <Icon.sparkle size={11} style={{ marginRight: 4, verticalAlign: '-2px' }} /> {q}
          </button>
        ))}
      </div>
    </Card>
  );
}
