// Services roll-up — the cross-domain landing for the whole Servicing group.
// One card per top-level domain (Cleaning / Security / Hospitality /
// Maintenance) with aggregated SLA adherence, overdue, open, and a trend, plus
// a portfolio summary line. Clicking a card drills into that domain's grouped
// overview. Reads org-scoped demo_servicing_perf (all sub-domains) + the
// bathrooms perf for Cleaning — same sources as ServicingOverview, aggregated.

import React, { useMemo, useState } from 'react';
import { Card, Pill, Ring, Sparkline } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import {
  SERVICING_DOMAINS,
  SERVICING_DOMAIN_META,
  SERVICING_GROUP_DOMAINS,
  domainAccent,
  domainSoft,
} from './servicing-areas.js';
import { synthTrend, useServicingHistoryMap, useServicingRollup } from './servicing-data.js';
import { useSL } from './servicing-i18n.js';

// Positional average of a top-domain's sub-domain histories (they share hourly
// buckets, so element-wise averaging over the common tail is meaningful).
function avgTrend(domainKey, histMap) {
  const areas = SERVICING_DOMAINS[domainKey]?.areas || [];
  const series = areas
    .map((a) => histMap[a.domain === null ? 'bathrooms' : a.domain])
    .filter((s) => s && s.length >= 2);
  if (!series.length) return null;
  const len = Math.min(...series.map((s) => s.length));
  const out = [];
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (const s of series) sum += s[s.length - len + i];
    out.push(Math.round(sum / series.length));
  }
  return out.length >= 2 ? out : null;
}

// Fallback label for a sub-domain with no areas-config entry: drop the top
// prefix and title-case the rest ('cleaning_common' → 'Common').
function prettifySub(sub) {
  const parts = String(sub || '').split('_');
  const rest = parts.slice(1).join(' ') || parts[0] || '';
  return rest.replace(/\b\w/g, (c) => c.toUpperCase()) || sub;
}

function DomainCard({ domainKey, label, stat, trend, hotspot, onClick }) {
  const sl = useSL();
  const meta = SERVICING_DOMAIN_META[domainKey];
  const DomIcon = Icon[meta?.icon] || Icon.sparkle;
  const accent = domainAccent(domainKey);
  const adh = stat?.adh;
  const tone = adh == null ? 'accent' : adh >= 90 ? 'ok' : adh >= 75 ? 'warn' : 'risk';
  const [hover, setHover] = useState(false);
  const areaCount = SERVICING_DOMAINS[domainKey]?.areas.length || 0;
  // Adherence-% trend over the (hourly) history window — captioned + with a
  // start→end delta so the sparkline reads as "SLA adherence, last Nh".
  const trendData = stat ? (trend && trend.length >= 2 ? trend : synthTrend(domainKey, adh)) : null;
  const trendDelta = trendData ? Math.round(trendData[trendData.length - 1]) - Math.round(trendData[0]) : 0;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: stat ? 'space-between' : 'flex-start',
        gap: 20,
        padding: 26,
        borderRadius: 16,
        height: '100%',
        minHeight: 0,
        // Clip to the rounded box so the trend sparkline can never bleed past
        // the card edge into the row below (box-shadow renders outside, unaffected).
        overflow: 'hidden',
        background: 'var(--surface)',
        border: `1px solid ${hover ? accent : 'var(--border)'}`,
        boxShadow: hover ? `0 6px 22px ${domainSoft(domainKey)}` : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 12,
            background: domainSoft(domainKey),
          }}
        >
          <DomIcon size={23} style={{ color: accent }} />
        </span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
            {areaCount} {sl('areas', 'zones')}
          </div>
        </div>
        <span style={{ marginLeft: 'auto', color: 'var(--text-soft)' }}>
          <Icon.chevR size={18} />
        </span>
      </div>
      {stat ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Ring pct={adh} size={88} thick={8} tone={tone} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pill tone={stat.overdue > 0 ? 'warn' : 'ok'}>
                  {stat.overdue} {sl('overdue', 'en retard')}
                </Pill>
                {stat.open > 0 && (
                  <Pill tone="risk">
                    {stat.open} {sl('open', 'ouv.')}
                  </Pill>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                {stat.total} {sl('items tracked', 'éléments suivis')}
              </div>
            </div>
          </div>
          {/* Hotspot — the worst area in this line, so the % points somewhere
              actionable ("where's the 10%?"). Clean → an all-on-track reassurance. */}
          {hotspot &&
            (() => {
              const flagged = hotspot.overdue > 0 || hotspot.open > 0;
              const c = flagged ? '#f59e0b' : '#10b981';
              const HotIcon = flagged ? Icon.warn : Icon.check;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 11px',
                    borderRadius: 10,
                    background: `color-mix(in oklch, ${c} 9%, transparent)`,
                    border: `1px solid color-mix(in oklch, ${c} 22%, transparent)`,
                  }}
                >
                  <HotIcon size={13} style={{ color: c, flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-soft)',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {flagged ? (
                      <>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: c }}>
                          {sl('NEEDS ATTENTION', 'À TRAITER')}
                        </span>{' '}
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{hotspot.label}</span>
                        {' · '}
                        {hotspot.overdue > 0 && `${hotspot.overdue} ${sl('overdue', 'en retard')}`}
                        {hotspot.overdue > 0 && hotspot.open > 0 && ' · '}
                        {hotspot.open > 0 && `${hotspot.open} ${sl('open', 'ouv.')}`}
                      </>
                    ) : (
                      `${sl('All', 'Les')} ${areaCount} ${sl('areas on track', 'zones à jour')}`
                    )}
                  </span>
                </div>
              );
            })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  color: 'var(--text-dim)',
                }}
              >
                {sl('Adherence trend', 'Tendance d’adhérence')} · {trendData.length}h
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: trendDelta > 0 ? 'var(--ok)' : trendDelta < 0 ? 'var(--risk)' : 'var(--text-soft)',
                }}
              >
                {trendDelta === 0
                  ? sl('steady', 'stable')
                  : `${trendDelta > 0 ? '▲' : '▼'} ${Math.abs(trendDelta)} ${sl('pts', 'pts')}`}
              </span>
            </div>
            <Sparkline data={trendData} w={240} h={52} responsive stroke={accent} fill={domainSoft(domainKey)} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          {sl('No data for this building yet', 'Aucune donnée pour ce bâtiment')}
        </div>
      )}
    </button>
  );
}

function SummaryStat({ label, value, tone, divider = true }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: '20px 26px',
        borderRight: divider ? '1px solid var(--border)' : 'none',
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, color: tone ? `var(--${tone})` : 'var(--text)' }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-soft)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function ServicesRollup({ building, orgId, viewer = false, onSelectDomain }) {
  const t = useT();
  const sl = useSL();
  const { byTop, overall, loaded, rows } = useServicingRollup(building, orgId, { viewer });
  const histMap = useServicingHistoryMap(orgId);
  const tl = (k, f) => {
    const v = t(k);
    return v && v !== k ? v : f;
  };
  const overallAdh = overall.adh;

  // Friendly label per sub-domain (area) from the areas config.
  const areaLabel = useMemo(() => {
    const m = {};
    for (const top of SERVICING_GROUP_DOMAINS) {
      for (const a of SERVICING_DOMAINS[top]?.areas || []) {
        const key = a.domain || `${top}_restrooms`;
        const v = t(a.labelKey);
        m[key] = v && v !== a.labelKey ? v : a.fallback;
      }
    }
    return m;
  }, [t]);

  // Worst area per service line: the sub-domain with the most overdue (then most
  // open). Drives the card's hotspot row. Null when the line has no sub-rows.
  const hotspotByTop = useMemo(() => {
    const worst = {};
    for (const r of rows || []) {
      const top = String(r.domain || '').split('_')[0];
      if (!SERVICING_GROUP_DOMAINS.includes(top)) continue;
      const score = (r.overdue_now || 0) * 1000 + (r.open_now || 0);
      if (!worst[top] || score > worst[top]._score) worst[top] = { ...r, _score: score };
    }
    const out = {};
    for (const k of SERVICING_GROUP_DOMAINS) {
      const r = worst[k];
      out[k] = r
        ? { label: areaLabel[r.domain] || prettifySub(r.domain), overdue: r.overdue_now || 0, open: r.open_now || 0 }
        : null;
    }
    return out;
  }, [rows, areaLabel]);

  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {sl('Live services', 'Services en direct')}
        </div>
        <h2 style={{ margin: '4px 0 4px', fontSize: 20, fontWeight: 700 }}>
          {sl('Services overview', 'Vue d’ensemble des services')}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', maxWidth: 660 }}>
          {sl(
            'Everything being done in the building, across all four service lines. Open a line to see its areas and live boards.',
            'Tout ce qui est fait dans le bâtiment, sur les quatre lignes de service. Ouvrez une ligne pour voir ses zones et tableaux en direct.',
          )}
        </p>
      </div>

      {loaded && overall.total > 0 && (
        <Card style={{ marginBottom: 18, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <SummaryStat
              label={sl('overall adherence', 'adhérence globale')}
              value={overallAdh != null ? `${overallAdh}%` : '—'}
              tone={overallAdh == null ? undefined : overallAdh >= 90 ? 'ok' : overallAdh >= 75 ? 'warn' : 'risk'}
            />
            <SummaryStat label={sl('items tracked', 'éléments suivis')} value={overall.total} />
            <SummaryStat
              label={sl('overdue now', 'en retard')}
              value={overall.overdue}
              tone={overall.overdue ? 'warn' : undefined}
            />
            <SummaryStat
              label={sl('open requests', 'demandes ouvertes')}
              value={overall.open}
              tone={overall.open ? 'risk' : undefined}
              divider={false}
            />
          </div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          // Rows grow to fit the card content (header + ring + hotspot + trend)
          // and the page scrolls if the viewport is short — instead of `1fr`
          // squeezing the rows below their content, which overflowed the cards.
          gridAutoRows: 'minmax(240px, auto)',
          gap: 16,
        }}
      >
        {SERVICING_GROUP_DOMAINS.map((k) => {
          const meta = SERVICING_DOMAIN_META[k];
          return (
            <DomainCard
              key={k}
              domainKey={k}
              label={tl(meta.labelKey, meta.fallback)}
              stat={loaded ? byTop[k] : null}
              trend={avgTrend(k, histMap)}
              hotspot={loaded ? hotspotByTop[k] : null}
              onClick={() => onSelectDomain(k)}
            />
          );
        })}
      </div>
    </main>
  );
}
