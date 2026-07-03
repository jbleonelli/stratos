// /platform/internal/status — Adaptiv-side health dashboard for the
// external services Merlin depends on.
//
// Phase 1 (this file): mirrors each provider's public Atlassian
// Statuspage JSON via /api/platform/status. The endpoint fans out to
// 7 providers in parallel (5s timeout each, edge-cached 30s) and
// returns aggregated indicators. Polls every 60s + has a manual
// refresh button.
//
// Phase 2 (later): layer active probes on top — actually hit each
// provider with a real call (Supabase healthcheck, Stripe customers.list,
// Resend test send, Anthropic models.list) so we can distinguish "their
// service is up but our token is wrong" from "they're truly down."
// Same UI grid; just adds a second pill per card.

import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill } from './primitives.jsx';
import { useT } from './i18n.js';
import { usePlatformStatus } from './queries/platform.ts';

// Maps Atlassian Statuspage indicators → our internal tone +
// translation key. 'maintenance' deliberately reads as info-blue
// rather than warn so planned work doesn't look alarming.
const INDICATOR_META = {
  none: { tone: 'ok', labelKey: 'platform.status.ind.none' },
  minor: { tone: 'warn', labelKey: 'platform.status.ind.minor' },
  major: { tone: 'warn', labelKey: 'platform.status.ind.major' },
  critical: { tone: 'risk', labelKey: 'platform.status.ind.critical' },
  maintenance: { tone: 'info', labelKey: 'platform.status.ind.maintenance' },
  unknown: { tone: 'neutral', labelKey: 'platform.status.ind.unknown' },
};

export function PlatformStatusPage() {
  const t = useT();
  // React Query owns the fetch, 60s polling, in-flight state, and last-updated
  // stamp — the manual busy/refreshedAt/setInterval/refresh machinery is gone.
  const { data, error, isError, isFetching, dataUpdatedAt, refetch } = usePlatformStatus();
  const refreshedAt = data ? new Date(dataUpdatedAt) : null;

  const providers = data?.providers || [];
  const operationalCount = providers.filter((p) => p.indicator === 'none').length;
  const total = providers.length;
  const allOk = providers.length > 0 && providers.every((p) => p.indicator === 'none');
  const anyCritical = providers.some((p) => p.indicator === 'critical' || p.indicator === 'major');
  const anyMinor = providers.some((p) => p.indicator === 'minor');

  const overallTone =
    providers.length === 0 ? 'neutral' : anyCritical ? 'risk' : anyMinor ? 'warn' : allOk ? 'ok' : 'neutral';

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero
        overallTone={overallTone}
        operationalCount={operationalCount}
        total={total}
        refreshedAt={refreshedAt}
        busy={isFetching}
        onRefresh={refetch}
      />

      {isError && (
        <div
          style={{
            padding: '10px 14px',
            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
            color: 'var(--risk)',
            border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
            borderRadius: 8,
            fontSize: 12.5,
          }}
        >
          {error?.message}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 'var(--pad)',
        }}
      >
        {providers.length === 0 && !error
          ? // Skeletons before the first fetch completes.
            [1, 2, 3, 4, 5, 6, 7].map((i) => <SkeletonCard key={i} />)
          : providers.map((p) => <ProviderCard key={p.id} provider={p} t={t} />)}
      </div>
    </div>
  );
}

function Hero({ overallTone, operationalCount, total, refreshedAt, busy, onRefresh }) {
  const t = useT();
  const toneColor =
    overallTone === 'ok'
      ? 'var(--ok)'
      : overallTone === 'warn'
        ? 'var(--warn)'
        : overallTone === 'risk'
          ? 'var(--risk)'
          : 'var(--text-faint)';
  const summaryKey =
    overallTone === 'ok'
      ? 'platform.status.summary.all_ok'
      : overallTone === 'warn'
        ? 'platform.status.summary.degraded'
        : overallTone === 'risk'
          ? 'platform.status.summary.critical'
          : 'platform.status.summary.unknown';
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, ${toneColor} 18%, transparent), transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
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
              {t('platform.status.eyebrow')}
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
              {t('platform.status.heading')}
            </h1>
            <p
              style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 720, lineHeight: 1.55 }}
            >
              {t('platform.status.subheading')}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onRefresh}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 700,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: busy ? 0.7 : 1,
              }}
            >
              <Icon.bolt size={11} />
              {busy ? t('platform.status.refreshing') : t('platform.status.refresh')}
            </button>
            {refreshedAt && (
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                {t('platform.status.refreshed_at', { time: refreshedAt.toLocaleTimeString() })}
              </div>
            )}
          </div>
        </div>

        {total > 0 && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: toneColor,
                boxShadow: `0 0 0 4px color-mix(in oklch, ${toneColor} 20%, transparent)`,
              }}
            />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
              {t(summaryKey, { ok: operationalCount, total })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ProviderCard({ provider, t }) {
  const meta = INDICATOR_META[provider.indicator] || INDICATOR_META.unknown;
  const updated = provider.updated_at ? new Date(provider.updated_at) : null;
  return (
    <Card pad style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 140 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.005 }}>{provider.name}</div>
          <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>
            {provider.purpose}
          </div>
        </div>
        <Pill tone={meta.tone}>{t(meta.labelKey)}</Pill>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>{provider.description || '—'}</div>

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-faint)',
        }}
      >
        <span title={updated ? updated.toISOString() : ''}>
          {updated
            ? t('platform.status.updated_at', { when: updated.toLocaleString() })
            : t('platform.status.no_timestamp')}
        </span>
        <a
          href={provider.page_url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--text-soft)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          {t('platform.status.open_page')} <Icon.chevR size={9} />
        </a>
      </div>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card pad style={{ minHeight: 140, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ height: 16, width: '50%', background: 'var(--surface-3)', borderRadius: 4 }} />
      <div style={{ height: 10, width: '70%', background: 'var(--surface-3)', borderRadius: 4 }} />
      <div style={{ flex: 1 }} />
      <div style={{ height: 10, width: '40%', background: 'var(--surface-3)', borderRadius: 4 }} />
    </Card>
  );
}
