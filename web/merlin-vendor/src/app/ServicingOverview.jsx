// Servicing overview — the at-a-glance landing for any Servicing sub-group
// (Cleaning / Security / Hospitality / Maintenance). The domain's areas grouped
// into buckets, each a card with live SLA adherence + overdue/open. Click a card
// to drill into its board. Reads org-scoped demo_servicing_perf (domain_* sub-
// areas) + the bathrooms perf for Cleaning (demo_cleaning_perf / imf_cleaning_perf).

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkline } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { supabase } from './supabase.js';
import { SERVICING_DOMAINS, domainAccent, domainSoft } from './servicing-areas.js';
import { synthTrend, useServicingHistoryMap } from './servicing-data.js';
import { useSL } from './servicing-i18n.js';

function useServicingOverview(domain, building, orgId, viewer) {
  const isImf = building?.variant === 'imf';
  const hasBathrooms = domain === 'cleaning';
  const buildingId = building?.id || null;

  const q = useQuery({
    queryKey: ['servicing-overview', domain, orgId, isImf, hasBathrooms, viewer, buildingId],
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!orgId) return { byDomain: {}, bath: null };
      const map = {};
      let b = null;
      if (viewer && buildingId) {
        // Viewer-scoped (contractor): one SECURITY DEFINER RPC returns every area
        // for the contractor's contracted lines at the client building; filter to
        // this domain. Restrooms come back folded in as a `cleaning_restrooms` row.
        const { data } = await supabase.rpc('servicing_rollup_for_viewer', { p_building_id: buildingId });
        for (const r of data || []) {
          if (hasBathrooms && r.domain === 'cleaning_restrooms') {
            b = {
              restrooms_total: r.items_total,
              overdue_now: r.overdue_now,
              open_requests_now: r.open_now,
              sla_adherence_pct: r.adherence_pct,
            };
            continue;
          }
          if (String(r.domain).startsWith(`${domain}_`)) map[r.domain] = r;
        }
      } else {
        const { data } = await supabase
          .from('demo_servicing_perf')
          .select('domain, items_total, overdue_now, open_now, adherence_pct')
          .eq('organization_id', orgId)
          .like('domain', `${domain}_%`);
        (data || []).forEach((r) => {
          map[r.domain] = r;
        });
        if (hasBathrooms) {
          const bathQ = isImf
            ? supabase
                .from('imf_cleaning_perf')
                .select('restrooms_total, overdue_now, open_requests_now, sla_adherence_pct')
                .maybeSingle()
            : supabase
                .from('demo_cleaning_perf')
                .select('restrooms_total, overdue_now, open_requests_now, sla_adherence_pct')
                .eq('organization_id', orgId)
                .maybeSingle();
          const { data: bd } = await bathQ;
          b = bd || null;
        }
      }
      return { byDomain: map, bath: b };
    },
  });

  return { byDomain: q.data?.byDomain ?? {}, bath: q.data?.bath ?? null, loaded: q.isSuccess };
}

function statFor(area, byDomain, bath) {
  if (area.domain === null) {
    if (!bath) return null;
    return {
      total: bath.restrooms_total,
      overdue: bath.overdue_now,
      open: bath.open_requests_now,
      adh: bath.sla_adherence_pct,
    };
  }
  const r = byDomain[area.domain];
  if (!r) return null;
  return { total: r.items_total, overdue: r.overdue_now, open: r.open_now, adh: r.adherence_pct };
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: tone ? `var(--${tone})` : 'var(--text)' }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          color: 'var(--text-soft)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function AreaCard({ area, stat, label, accent, history, onClick }) {
  const sl = useSL();
  const AreaIcon = Icon[area.icon] || Icon.droplet;
  const adh = stat?.adh;
  const tone = adh == null ? null : adh >= 90 ? 'ok' : adh >= 75 ? 'warn' : 'risk';
  const trend = stat ? (history && history.length >= 2 ? history : synthTrend(area.id, adh)) : null;
  const tv = (p) => (p && typeof p === 'object' ? p.v : p);
  const delta = trend && trend.length >= 2 ? Math.round(tv(trend[trend.length - 1]) - tv(trend[0])) : null;
  const soft = domainSoft(area.id.split('_')[0]);
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--surface)',
        border: `1px solid ${hover ? accent : 'var(--border)'}`,
        boxShadow: hover ? `0 2px 12px ${domainSoft(area.id.split('_')[0])}` : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 7,
            background: domainSoft(area.id.split('_')[0]),
          }}
        >
          <AreaIcon size={14} style={{ color: accent }} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', flex: 1 }}>{label}</span>
        {stat && delta != null && delta !== 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: delta > 0 ? 'var(--ok)' : 'var(--risk)' }}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {stat ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div
              style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: tone ? `var(--${tone})` : 'var(--text)' }}
            >
              {adh}%
            </div>
            {trend && <Sparkline data={trend} w={150} h={44} stroke={accent} fill={soft} />}
          </div>
          {/* SLA adherence with a tick at the 90% target */}
          <div
            style={{
              position: 'relative',
              height: 5,
              borderRadius: 3,
              background: 'var(--border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, adh))}%`,
                height: '100%',
                background: tone ? `var(--${tone})` : accent,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '90%',
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--text-faint)',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 2 }}>
            <Stat label={sl('Overdue', 'En retard')} value={stat.overdue} tone={stat.overdue > 0 ? 'warn' : null} />
            <Stat label={sl('Open', 'Ouvert')} value={stat.open} tone={stat.open > 0 ? 'risk' : null} />
            <Stat label={sl('Items', 'Éléments')} value={stat.total} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{sl('No data yet', 'Aucune donnée')}</div>
      )}
    </button>
  );
}

export function ServicingOverview({ domain, building, orgId, viewer = false, drillable = true, onSelect }) {
  const t = useT();
  const cfg = SERVICING_DOMAINS[domain];
  const { byDomain, bath, loaded } = useServicingOverview(domain, building, orgId, viewer);
  const histMap = useServicingHistoryMap(orgId);
  const sl = useSL();
  const tl = (k, f) => {
    const v = t(k);
    return v && v !== k ? v : f;
  };
  const domLabel = cfg ? tl(cfg.labelKey, cfg.fallback) : '';
  const accent = domainAccent(domain);

  if (!cfg) return null;

  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {sl('Live', 'En direct')} {domLabel.toLowerCase()}
        </div>
        <h2 style={{ margin: '4px 0 4px', fontSize: 20, fontWeight: 700 }}>
          {sl(`${domLabel} overview`, `Vue d’ensemble — ${domLabel}`)}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', maxWidth: 640 }}>
          {drillable
            ? sl(
                'Every area at a glance — grouped by type, with live SLA adherence. Open any card to drill into its board.',
                'Chaque zone en un coup d’œil — groupée par type, avec l’adhérence SLA en direct. Ouvrez une carte pour son tableau.',
              )
            : sl(
                'Every area at a glance — grouped by type, with live SLA adherence for your contracted lines.',
                'Chaque zone en un coup d’œil — groupée par type, avec l’adhérence SLA en direct pour vos lignes sous contrat.',
              )}
        </p>
      </div>

      {/* Groups as side-by-side columns that fill the width (3 across on
          desktop, collapsing to 1–2 as the content area narrows / chat opens),
          cards stacked within each — a "board of boards" that uses the space
          instead of stranding 2 capped cards top-left. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {cfg.groups.map((g) => {
          const areas = cfg.areas.filter((a) => a.group === g.id);
          if (areas.length === 0) return null;
          return (
            <section key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  color: 'var(--text-soft)',
                }}
              >
                {tl(g.labelKey, g.fallback)}
              </div>
              {areas.map((a) => (
                <AreaCard
                  key={a.id}
                  area={a}
                  stat={loaded ? statFor(a, byDomain, bath) : null}
                  label={tl(a.labelKey, a.fallback)}
                  accent={accent}
                  history={histMap[a.domain === null ? 'bathrooms' : a.domain]}
                  onClick={drillable ? () => onSelect(a.id) : undefined}
                />
              ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}
