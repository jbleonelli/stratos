// Contractor-scoped Insights surface. The contractor manager only
// cares about the slice of the workspace's insight pool that
// touches their domain — cleaning, supply, amenity. We reuse the
// existing InsightCard renderer from Insights.jsx so the cards
// look + behave the same as on the facility manager's surface.

import React, { useMemo, useState } from 'react';
import { Pill, Card } from './primitives.jsx';
import { INSIGHTS_HQ, INSIGHTS_ECOSYSTEM } from './insights-data.js';
import { useT } from './i18n.js';
import { useFormatCurrency } from './locale-format.js';

// Categories that fall under "cleaning operations" — what a cleaning-
// services contractor actually executes against. Tracks the same
// taxonomy facility role uses for filtering, just narrowed.
const CONTRACTOR_CATEGORIES = new Set(['cleaning', 'supply']);

export function ContractorInsights({ org }) {
  // For Phase 1 we read from the same in-bundle insight pools the
  // facility surface uses. When contracts get a real per-customer
  // pool, swap this for a per-contract fetch.
  const isImf = org?.variant === 'imf';
  const isEco = org?.kind === 'ecosystem';
  const pool = isImf ? [] : isEco ? INSIGHTS_ECOSYSTEM : INSIGHTS_HQ;
  const [statusFilter, setStatusFilter] = useState('active');

  const insights = useMemo(() => pool.filter((i) => CONTRACTOR_CATEGORIES.has(i.category)), [pool]);
  const filtered = useMemo(() => {
    return insights.filter((i) => {
      if (statusFilter === 'active' && (i.status === 'dismissed' || i.status === 'implemented')) return false;
      if (statusFilter === 'implemented' && i.status !== 'implemented') return false;
      if (statusFilter === 'dismissed' && i.status !== 'dismissed') return false;
      return true;
    });
  }, [insights, statusFilter]);

  const realized = useMemo(
    () =>
      insights
        .filter((i) => i.status === 'implemented' && i.impact_kind === 'dollars')
        .reduce((s, i) => s + (i.impact?.amount || 0), 0),
    [insights],
  );
  const potential = useMemo(
    () =>
      insights
        .filter((i) => i.status !== 'dismissed' && i.status !== 'implemented' && i.impact_kind === 'dollars')
        .reduce((s, i) => s + (i.impact?.amount || 0), 0),
    [insights],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero org={org} count={insights.length} realized={realized} potential={potential} />
      <FilterBar statusFilter={statusFilter} onStatusFilter={setStatusFilter} />
      {filtered.length === 0 ? (
        <Card>
          <EmptyState />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((ins) => (
            <InsightRow key={ins.id} insight={ins} />
          ))}
        </div>
      )}
    </div>
  );
}

function Hero({ org, count, realized, potential }) {
  const t = useT();
  const fmtDollars = useFormatCurrency();
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
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
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
            {t('contractor_insights.eyebrow', { org: org?.name || t('contractor_insights.org_fallback') })}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {fmtDollars(potential)}{' '}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>
              {t('contractor_insights.potential')}
            </span>
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
            {t('contractor_insights.body', { realized: fmtDollars(realized) })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Stat label={t('contractor_insights.stat.active')} value={count} tone="accent" />
          <Stat label={t('contractor_insights.stat.realized')} value={fmtDollars(realized)} tone="ok" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
      {t('contractor_insights.empty')}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const palette = {
    ok: { fg: 'var(--ok)', bg: 'color-mix(in oklch, var(--ok) 10%, transparent)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
  }[tone] || { fg: 'var(--text-soft)', bg: 'var(--surface-2)' };
  return (
    <div
      style={{
        minWidth: 110,
        padding: '10px 14px',
        background: palette.bg,
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: palette.fg }}>{value}</div>
    </div>
  );
}

function FilterBar({ statusFilter, onStatusFilter }) {
  const t = useT();
  const opts = [
    { id: 'active', label: t('contractor_insights.filter.active') },
    { id: 'implemented', label: t('contractor_insights.filter.implemented') },
    { id: 'dismissed', label: t('contractor_insights.filter.dismissed') },
    { id: 'all', label: t('contractor_insights.filter.all') },
  ];
  return (
    <Card pad={false} style={{ flexShrink: 0 }}>
      <div style={{ padding: 8, display: 'flex', gap: 4 }}>
        {opts.map((o) => {
          const active = statusFilter === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onStatusFilter(o.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-soft)',
                border: '1px solid ' + (active ? 'var(--accent-line)' : 'transparent'),
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Compact one-row card — narrower than the facility-shell InsightCard
// because the contractor surface fits in the same page chrome as
// Contracts and we want them to feel like a list, not a hero stack.
function InsightRow({ insight }) {
  const t = useT();
  const fmtDollars = useFormatCurrency();
  const dollars = insight.impact_kind === 'dollars' ? insight.impact?.amount : null;
  const isPast = insight.status === 'implemented';
  const period = insight.impact?.period ? t(`insights.period.${insight.impact.period}`) : t('insights.period.year');
  const categoryLabel = t(`insights.category.${insight.category}`);
  const priorityLabel = insight.priority ? t(`insights.priority.${insight.priority}`) : null;
  // Free-form prose written at insight-author time; falls back to the
  // source-language string when no translation is registered. Long-term
  // these should flow through `useTranslatedText` (Phase 3), but the
  // contractor pool is currently in-bundle static data so EN is fine.
  return (
    <Card
      pad={false}
      style={{
        borderLeft: `3px solid ${isPast ? 'var(--ok)' : 'var(--accent)'}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{insight.title}</div>
            <Pill tone={isPast ? 'ok' : 'accent'}>{categoryLabel}</Pill>
            {priorityLabel && <Pill tone={insight.priority === 'high' ? 'risk' : 'info'}>{priorityLabel}</Pill>}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-dim)',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {insight.summary}
          </div>
        </div>
        {dollars != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: isPast ? 'var(--ok)' : 'var(--accent)' }}>
              {fmtDollars(dollars)}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
              {isPast ? t('contractor_insights.row.realized') : `/${period}`}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
