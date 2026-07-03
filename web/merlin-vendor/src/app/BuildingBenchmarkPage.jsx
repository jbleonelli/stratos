// BuildingBenchmarkPage — org-admin "Building Benchmark": a sortable, multi-metric
// leaderboard of every building in the org, so the owner can see at a glance which
// sites lead and which lag. Lives under the MONITOR pillar beside the KPI Cockpit;
// gated to org owners/admins (useIsOrgAdmin). Reads the seeded per-building
// benchmark dataset (building_benchmark_metrics, migration 270) — no single blended
// score, just the four dimensions side by side, sortable by any column. Click a row
// for a detail card (each metric vs the portfolio average + Ask-Merlin).

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill } from './primitives.jsx';
import { useSession } from './auth.js';
import { useIsOrgAdmin } from './org-data.js';
import { useFormatCurrency } from './locale-format.js';
import { useT } from './i18n.js';
import { useBuildingBenchmarks } from './benchmark-data.js';

// Status tone vs a target. dir='up' → higher is better; dir='down' → lower is better.
function toneVs(value, target, dir, warnBand) {
  if (value == null) return 'neutral';
  if (dir === 'up') return value >= target ? 'ok' : target - value <= warnBand ? 'warn' : 'risk';
  return value <= target ? 'ok' : value - target <= warnBand ? 'warn' : 'risk';
}
const toneColor = (t) =>
  t === 'ok' ? 'var(--ok)' : t === 'warn' ? 'var(--warn)' : t === 'risk' ? 'var(--risk)' : 'var(--text-soft)';

// Column config. `dir` = which direction is BETTER (drives default sort + tone);
// null = neutral (no tone, no default-best sort). `target`/`warn` feed toneVs.
const COLS = [
  { key: 'slaCompliance', labelKey: 'benchmark.col.sla', dir: 'up', target: 95, warn: 3, fmt: 'pct' },
  { key: 'breaches', labelKey: 'benchmark.col.breaches', dir: 'down', target: 3, warn: 3, fmt: 'int' },
  { key: 'adherence', labelKey: 'benchmark.col.adherence', dir: 'up', target: 92, warn: 4, fmt: 'pct' },
  { key: 'monthlyCost', labelKey: 'benchmark.col.cost', dir: null, fmt: 'money' },
  { key: 'penalties', labelKey: 'benchmark.col.penalties', dir: 'down', target: 500, warn: 1000, fmt: 'money' },
  { key: 'openIncidents', labelKey: 'benchmark.col.incidents', dir: 'down', target: 4, warn: 4, fmt: 'incidents' },
  { key: 'uptime', labelKey: 'benchmark.col.uptime', dir: 'up', target: 98.5, warn: 1, fmt: 'pct' },
  { key: 'mtbf', labelKey: 'benchmark.col.mtbf', dir: 'up', target: 150, warn: 40, fmt: 'days' },
];

function formatMetric(col, row, fmtCurrency, t) {
  const v = row[col.key];
  if (col.fmt === 'pct') return `${v.toFixed(1)}%`;
  if (col.fmt === 'money') return fmtCurrency(v, row.currency, { maximumFractionDigits: 0 });
  if (col.fmt === 'days') return t('benchmark.days', { n: v });
  return String(v);
}

// Signed delta vs the portfolio average, formatted per metric type.
function formatDelta(col, row, avg, fmtCurrency) {
  const d = (row[col.key] ?? 0) - (avg ?? 0);
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  const mag = Math.abs(d);
  if (col.fmt === 'pct') return `${sign}${mag.toFixed(1)} pts`;
  if (col.fmt === 'money') return `${sign}${fmtCurrency(mag, row.currency, { maximumFractionDigits: 0 })}`;
  if (col.fmt === 'days') return `${sign}${Math.round(mag)} d`;
  return `${sign}${Math.round(mag)}`;
}

// Is this building better or worse than the portfolio average on this metric?
function deltaTone(col, row, avg) {
  if (!col.dir) return 'neutral';
  const d = (row[col.key] ?? 0) - (avg ?? 0);
  if (Math.abs(d) < 1e-9) return 'neutral';
  const better = col.dir === 'up' ? d > 0 : d < 0;
  return better ? 'ok' : 'risk';
}

export function BuildingBenchmarkPage({ onOpenChat }) {
  const t = useT();
  const session = useSession();
  const isOrgAdmin = useIsOrgAdmin();
  const fmtCurrency = useFormatCurrency();
  const orgId = session?.organizationId || null;
  const { rows, loaded } = useBuildingBenchmarks(orgId);

  // Default sort: SLA compliance, best first.
  const [sort, setSort] = useState({ key: 'slaCompliance', dir: 'desc' });
  const [selected, setSelected] = useState(null); // { row, rank } for the detail modal
  const [hoverId, setHoverId] = useState(null);

  const sorted = useMemo(() => {
    const mult = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'string') return mult * av.localeCompare(bv);
      return mult * ((av ?? 0) - (bv ?? 0));
    });
  }, [rows, sort]);

  // Portfolio averages — power the "vs avg" context in the detail card.
  const avgs = useMemo(() => {
    const a = {};
    if (rows.length) for (const c of COLS) a[c.key] = rows.reduce((s, r) => s + (r[c.key] ?? 0), 0) / rows.length;
    return a;
  }, [rows]);

  if (!isOrgAdmin) {
    return (
      <div style={{ padding: 'var(--pad)' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon.shield size={14} style={{ color: 'var(--text-dim)' }} />
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{t('benchmark.restricted')}</div>
          </div>
        </Card>
      </div>
    );
  }

  const clickHeader = (col) => {
    setSort((prev) => {
      if (prev.key === col.key) return { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      // First click on a metric column: put the BEST value on top.
      const dir = col.dir === 'down' ? 'asc' : 'desc';
      return { key: col.key, dir };
    });
  };

  const th = (label, opts = {}) => (
    <th
      onClick={opts.col ? () => clickHeader(opts.col) : undefined}
      style={{
        padding: 12,
        textAlign: opts.left ? 'left' : 'right',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
        cursor: opts.col ? 'pointer' : 'default',
        userSelect: 'none',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        background: 'var(--surface)',
      }}
    >
      {label}
      {opts.col && sort.key === opts.col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div
      style={{
        // flex:1 + minWidth:0 so the page FILLS the flex-row main pane (like
        // KpiCockpit); without it the content shrink-wraps and left-aligns,
        // leaving a big gap on the right (worst full-width / chat closed).
        flex: 1,
        minWidth: 0,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon.scoreboard size={16} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t('benchmark.title')}</h1>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '6px 0 0', maxWidth: 720 }}>
          {t('benchmark.subtitle')}
        </p>
      </div>

      <Card pad={false}>
        {/* 12px inset comes from the cells' uniform 12px padding — NO wrapper
            padding (that would double it to ~24px). Header + card share --surface
            so full-width row dividers cause no corner artifact. */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {th('#', { left: true })}
                {th(t('benchmark.col.building'), { left: true })}
                {COLS.map((c) => (
                  <React.Fragment key={c.key}>{th(t(c.labelKey), { col: c })}</React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.locationId}
                  onClick={() => setSelected({ row, rank: i + 1 })}
                  onMouseEnter={() => setHoverId(row.locationId)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: hoverId === row.locationId ? 'var(--surface-2)' : 'transparent',
                  }}
                >
                  <td style={{ padding: 12, color: 'var(--text-dim)', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: 12, whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                    {row.region ? <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{row.region}</div> : null}
                  </td>
                  {COLS.map((c) => {
                    const tone = c.dir ? toneVs(row[c.key], c.target, c.dir, c.warn) : 'neutral';
                    return (
                      <td
                        key={c.key}
                        style={{
                          padding: 12,
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          color: c.dir ? toneColor(tone) : 'var(--text)',
                          fontWeight: c.dir && tone !== 'neutral' ? 700 : 500,
                        }}
                      >
                        {formatMetric(c, row, fmtCurrency, t)}
                        {c.fmt === 'incidents' && row.criticalIncidents > 0 ? (
                          <Pill tone="risk" style={{ marginLeft: 6 }}>
                            {t('benchmark.crit', { n: row.criticalIncidents })}
                          </Pill>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {loaded && sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 2} style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}>
                    {t('benchmark.empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{t('benchmark.note')}</div>

      {selected ? (
        <BenchmarkDetailModal
          sel={selected}
          avgs={avgs}
          fmtCurrency={fmtCurrency}
          t={t}
          onOpenChat={onOpenChat}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

// Detail card for a single building: every metric with its tone + delta vs the
// portfolio average, and an Ask-Merlin shortcut. Modal overlay; click backdrop or
// Escape to close.
function BenchmarkDetailModal({ sel, avgs, fmtCurrency, t, onOpenChat, onClose }) {
  const { row, rank } = sel;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const askMerlin = () => {
    onClose();
    onOpenChat?.(t('benchmark.detail.ask_prompt', { building: row.name }), { send: true });
  };

  const btn = (primary) => ({
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: primary ? 'var(--accent)' : 'var(--surface-2)',
    color: primary ? '#fff' : 'var(--text-dim)',
    border: '1px solid ' + (primary ? 'var(--accent)' : 'var(--border)'),
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          width: 'min(560px, 100%)',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              minWidth: 30,
              height: 30,
              padding: '0 8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            #{rank}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{row.name}</div>
            {row.region ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{row.region}</div> : null}
          </div>
          <button
            onClick={onClose}
            aria-label={t('benchmark.detail.close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
            }}
          >
            <Icon.close size={16} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {COLS.map((c) => {
            const tone = c.dir ? toneVs(row[c.key], c.target, c.dir, c.warn) : 'neutral';
            const dtone = deltaTone(c, row, avgs[c.key]);
            return (
              <div key={c.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div
                  style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.3 }}
                >
                  {t(c.labelKey)}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    marginTop: 2,
                    color: c.dir ? toneColor(tone) : 'var(--text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatMetric(c, row, fmtCurrency, t)}
                  {c.fmt === 'incidents' && row.criticalIncidents > 0 ? (
                    <Pill tone="risk" style={{ marginLeft: 6 }}>
                      {t('benchmark.crit', { n: row.criticalIncidents })}
                    </Pill>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: toneColor(dtone), marginTop: 3 }}>
                  {formatDelta(c, row, avgs[c.key], fmtCurrency)} {t('benchmark.detail.vs_avg')}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 16,
            borderTop: '1px solid var(--border)',
            justifyContent: 'flex-end',
          }}
        >
          {onOpenChat ? (
            <button onClick={askMerlin} style={btn(true)}>
              {t('benchmark.detail.ask')}
            </button>
          ) : null}
          <button onClick={onClose} style={btn(false)}>
            {t('benchmark.detail.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
