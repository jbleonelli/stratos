// /platform/performance — Adaptiv-side overview of how Merlin is doing
// across every customer. Single page, four "today" widgets, a future-
// state revenue strip, and a per-tenant table.
//
// Headline metrics (what we can measure right now):
//   · Tenants — customer orgs + breakdown by kind / lifecycle
//   · Users — distinct member count across all tenants
//   · Buildings — building-shaped locations under coverage
//   · Devices — total deployed across all tenants
//
// Revenue strip (placeholders until self-serve subscriptions ship):
//   · MRR · ARR · Paying tenants — all show "—" with a "coming with
//     self-serve" note. NOT wired to the contracts table — those are
//     contractor↔FM business contracts that live inside Merlin, NOT
//     what Merlin charges customers for. Easy mix-up worth the comment.
//
// Per-tenant table: name · kind · users · buildings · devices · created.
// Click-through opens the existing tenant detail page.
//
// Data layer: src/app/platform-performance-data.js. RLS already gives
// platform admins read on every table involved (migration 063).

import React from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { navigateTo } from './use-route.js';
import { useT } from './i18n.js';
import { useFormatNumber } from './locale-format.js';
import { usePlatformPerformance } from './platform-performance-data.js';
import { KIND_LABELS, LIFECYCLE_LABELS, LIFECYCLE_TONES } from './platform-data.js';

export function PlatformPerformancePage() {
  const t = useT();
  const { data, ready, error, refresh } = usePlatformPerformance();

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero ready={ready} onRefresh={refresh} />

      {error && (
        <Card
          pad
          style={{
            background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
            borderColor: 'color-mix(in oklch, var(--risk) 35%, transparent)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--risk)' }}>{t('platform.performance.error')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 4 }}>{error}</div>
        </Card>
      )}

      <TodayGrid data={data} ready={ready} />

      <RevenueStrip />

      <Card pad={false}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon.building size={13} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.performance.table.title')}</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {ready
              ? t('platform.performance.table.count', { n: data.perTenant.length })
              : t('platform.performance.loading')}
          </div>
        </div>
        <PerTenantTable rows={data.perTenant} ready={ready} />
      </Card>
    </div>
  );
}

function Hero({ ready, onRefresh }) {
  const t = useT();
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('platform.performance.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.performance.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13, maxWidth: 720, lineHeight: 1.5 }}>
            {t('platform.performance.subtitle')}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={!ready}
          title={t('platform.performance.refresh')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            background: 'var(--surface-2)',
            color: 'var(--text-soft)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: ready ? 'pointer' : 'wait',
          }}
        >
          <Icon.reload size={11} />
          {t('platform.performance.refresh')}
        </button>
      </div>
    </Card>
  );
}

function TodayGrid({ data, ready }) {
  const t = useT();
  const fmt = useFormatNumber();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--pad)',
      }}
    >
      <Widget
        icon="building"
        eyebrow={t('platform.performance.widget.tenants.eyebrow')}
        value={ready ? fmt(data.tenants.total) : '—'}
        primary={t('platform.performance.widget.tenants.primary', {
          re: fmt(data.tenants.realEstate),
          con: fmt(data.tenants.contractor),
        })}
        secondary={
          ready && data.tenants.suspended > 0
            ? t('platform.performance.widget.tenants.suspended', { n: fmt(data.tenants.suspended) })
            : t('platform.performance.widget.tenants.added30', { n: fmt(data.tenants.addedLast30) })
        }
        tone="accent"
      />
      <Widget
        icon="people"
        eyebrow={t('platform.performance.widget.users.eyebrow')}
        value={ready ? fmt(data.users.distinct) : '—'}
        primary={t('platform.performance.widget.users.primary', { n: fmt(data.users.total) })}
        secondary={t('platform.performance.widget.users.secondary')}
      />
      <Widget
        icon="floor"
        eyebrow={t('platform.performance.widget.buildings.eyebrow')}
        value={ready ? fmt(data.buildings.total) : '—'}
        primary={t('platform.performance.widget.buildings.primary', {
          n: data.tenants.realEstate > 0 ? fmt(Math.round(data.buildings.total / data.tenants.realEstate)) : '0',
        })}
        secondary={t('platform.performance.widget.buildings.secondary')}
      />
      <Widget
        icon="gateway"
        eyebrow={t('platform.performance.widget.devices.eyebrow')}
        value={ready ? fmt(data.devices.total) : '—'}
        primary={t('platform.performance.widget.devices.primary', {
          n: data.tenants.total > 0 ? fmt(Math.round(data.devices.total / data.tenants.total)) : '0',
        })}
        secondary={t('platform.performance.widget.devices.secondary')}
      />
    </div>
  );
}

// Future-state revenue widgets. All three render "—" today and carry a
// "coming with self-serve" note so a platform admin doesn't read them
// as zero. Wire to a real subscriptions table once self-serve ships
// (see deferred items list).
function RevenueStrip() {
  const t = useT();
  return (
    <Card pad>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.bolt size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {t('platform.performance.revenue.title')}
        </div>
        <Pill tone="neutral">{t('platform.performance.revenue.coming')}</Pill>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5, maxWidth: 680 }}>
        {t('platform.performance.revenue.body')}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <RevenueTile
          eyebrow={t('platform.performance.revenue.mrr')}
          hint={t('platform.performance.revenue.mrr_hint')}
        />
        <RevenueTile
          eyebrow={t('platform.performance.revenue.arr')}
          hint={t('platform.performance.revenue.arr_hint')}
        />
        <RevenueTile
          eyebrow={t('platform.performance.revenue.paying')}
          hint={t('platform.performance.revenue.paying_hint')}
        />
      </div>
    </Card>
  );
}

function RevenueTile({ eyebrow, hint }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        border: '1px dashed var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 26,
          fontWeight: 700,
          color: 'var(--text-faint)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
        }}
      >
        —
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-dim)' }}>{hint}</div>
    </div>
  );
}

function Widget({ icon, eyebrow, value, primary, secondary, tone = 'neutral' }) {
  const IconC = Icon[icon] || Icon.sparkle;
  const accent = tone === 'accent' ? 'var(--accent)' : tone === 'ok' ? 'var(--ok)' : 'var(--text-dim)';
  return (
    <Card pad style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        <IconC size={12} style={{ color: accent }} />
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: -0.01,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      {primary && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 }}>{primary}</div>
      )}
      {secondary && <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-dim)' }}>{secondary}</div>}
    </Card>
  );
}

function PerTenantTable({ rows, ready }) {
  const t = useT();
  const fmt = useFormatNumber();

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <AdaptivLoader size="sm" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.performance.table.empty')}</div>
    );
  }

  const cols = [
    { key: 'name', label: t('platform.performance.col.tenant'), flex: '2 1 200px' },
    { key: 'kind', label: t('platform.performance.col.kind'), flex: '1 1 120px' },
    { key: 'state', label: t('platform.performance.col.state'), flex: '0 1 110px' },
    { key: 'users', label: t('platform.performance.col.users'), flex: '0 1 80px', align: 'right' },
    { key: 'buildings', label: t('platform.performance.col.buildings'), flex: '0 1 100px', align: 'right' },
    { key: 'devices', label: t('platform.performance.col.devices'), flex: '0 1 90px', align: 'right' },
    { key: 'created', label: t('platform.performance.col.created'), flex: '0 1 110px' },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '10px 16px',
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      >
        {cols.map((c) => (
          <div key={c.key} style={{ flex: c.flex, textAlign: c.align || 'left' }}>
            {c.label}
          </div>
        ))}
      </div>
      {rows.map((r) => (
        <button
          key={r.orgId}
          onClick={() => navigateTo(`/platform/tenants/${r.orgId}`)}
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 16px',
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--text)',
            transition: 'background .12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{ flex: cols[0].flex, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{r.slug}</div>
          </div>
          <div style={{ flex: cols[1].flex, fontSize: 12, color: 'var(--text-soft)' }}>
            {KIND_LABELS[r.kind] || r.kind}
          </div>
          <div style={{ flex: cols[2].flex }}>
            <Pill tone={LIFECYCLE_TONES[r.lifecycleState] || 'neutral'}>
              {LIFECYCLE_LABELS[r.lifecycleState] || r.lifecycleState}
            </Pill>
          </div>
          <div
            style={{
              flex: cols[3].flex,
              textAlign: 'right',
              fontSize: 12.5,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {fmt(r.members)}
          </div>
          <div
            style={{
              flex: cols[4].flex,
              textAlign: 'right',
              fontSize: 12.5,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {fmt(r.buildings)}
          </div>
          <div
            style={{
              flex: cols[5].flex,
              textAlign: 'right',
              fontSize: 12.5,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {fmt(r.devices)}
          </div>
          <div style={{ flex: cols[6].flex, fontSize: 11.5, color: 'var(--text-dim)' }}>
            {r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '—'}
          </div>
        </button>
      ))}
    </div>
  );
}
