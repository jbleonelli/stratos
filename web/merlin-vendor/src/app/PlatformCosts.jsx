// Platform → Costs (SaaS v1, phase 7).
// Daily Claude API spend across all tenants. Reads claude_usage_daily
// (rollup view of claude_usage_events). Platform-admin only.
//
// Layout: hero with today's $ + delta + 30d total, then a 30-day
// area chart, then three breakdown tables (by org, by feature, by
// model), then a recent-calls tail. Keeps the same look-and-feel as
// PlatformAudit.jsx.

import React, { useState } from 'react';
import { Card } from './primitives.jsx';
import { useCostsRollup } from './costs-data.js';
import { useT } from './i18n.js';

const WINDOW_OPTIONS = [
  { id: 7, labelKey: 'platform.costs.window.7d' },
  { id: 30, labelKey: 'platform.costs.window.30d' },
  { id: 90, labelKey: 'platform.costs.window.90d' },
];

export function PlatformCostsPage() {
  const t = useT();
  const [days, setDays] = useState(30);
  const data = useCostsRollup({ days });

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero days={days} onChangeDays={setDays} data={data} />

      <Card pad>
        <SectionHeading
          eyebrow={t('platform.costs.chart.eyebrow')}
          title={t('platform.costs.chart.title', { n: days })}
        />
        <DailyChart series={data.days} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--pad)' }}>
        <BreakdownCard
          title={t('platform.costs.byorg.title')}
          rows={data.byOrg.slice(0, 10)}
          labelOf={(r) => r.orgName}
          empty={t('platform.costs.byorg.empty')}
        />
        <BreakdownCard
          title={t('platform.costs.byfeature.title')}
          rows={data.byFeature}
          labelOf={(r) => featureLabel(r.feature)}
          empty={t('platform.costs.byfeature.empty')}
        />
        <BreakdownCard
          title={t('platform.costs.bymodel.title')}
          rows={data.byModel}
          labelOf={(r) => modelLabel(r.model)}
          empty={t('platform.costs.bymodel.empty')}
        />
      </div>

      <RecentCallsTable rows={data.recent} ready={data.ready} />
    </div>
  );
}

function Hero({ days, onChangeDays, data }) {
  const t = useT();
  const delta = data.todayCost - data.yesterdayCost;
  const deltaPct = data.yesterdayCost > 0 ? (delta / data.yesterdayCost) * 100 : null;
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
      <div
        style={{
          padding: 'var(--pad)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('platform.costs.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.costs.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>{t('platform.costs.body')}</p>
        </div>

        <Stat
          label={t('platform.costs.stat.today')}
          value={formatUsd(data.todayCost)}
          detail={deltaPct == null ? null : t('platform.costs.stat.vs_yesterday', { pct: signedPct(deltaPct) })}
          tone={delta > 0 ? 'risk' : delta < 0 ? 'ok' : 'neutral'}
        />
        <Stat
          label={t('platform.costs.stat.window_total', { n: days })}
          value={formatUsd(data.totalCost)}
          detail={t('platform.costs.stat.calls', { n: data.totalCalls.toLocaleString() })}
        />

        <select
          value={days}
          onChange={(e) => onChangeDays(Number(e.target.value))}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {WINDOW_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}

function Stat({ label, value, detail, tone = 'neutral' }) {
  const detailColor = tone === 'risk' ? 'var(--risk)' : tone === 'ok' ? 'var(--ok)' : 'var(--text-dim)';
  return (
    <div style={{ minWidth: 140 }}>
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {detail && <div style={{ fontSize: 11, color: detailColor, marginTop: 2, fontWeight: 600 }}>{detail}</div>}
    </div>
  );
}

// Inline area chart — small enough not to need a chart library.
function DailyChart({ series }) {
  const t = useT();
  const ref = React.useRef(null);
  const [w, setW] = useState(720);
  const h = 200;
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(320, Math.floor(e.contentRect.width)));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0.001, ...series.map((d) => d.cost));
  const padL = 44,
    padR = 12,
    padT = 10,
    padB = 28;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);
  const xAt = (i) => (series.length <= 1 ? padL + innerW / 2 : padL + (i / (series.length - 1)) * innerW);
  const yAt = (v) => padT + innerH - (v / max) * innerH;

  const path = series
    .map((d, i) => {
      const x = xAt(i);
      const y = yAt(d.cost);
      return i === 0 ? `M${x},${y}` : `L${x},${y}`;
    })
    .join(' ');
  const area = series.length ? `${path} L${xAt(series.length - 1)},${padT + innerH} L${xAt(0)},${padT + innerH} Z` : '';

  // Y-axis ticks: 0, half, max
  const ticks = [0, max / 2, max];
  // X-axis ticks: first, middle, last (show date labels)
  const tickIdx =
    series.length >= 3 ? [0, Math.floor((series.length - 1) / 2), series.length - 1] : series.map((_, i) => i);

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={yAt(tk)} y2={yAt(tk)} stroke="var(--border)" strokeDasharray="2,3" />
            <text
              x={padL - 6}
              y={yAt(tk) + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--text-dim)"
              fontFamily="var(--mono)"
            >
              {formatUsdCompact(tk)}
            </text>
          </g>
        ))}
        {series.length > 0 && (
          <>
            <path d={area} fill="color-mix(in oklch, var(--accent) 18%, transparent)" />
            <path
              d={path}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {series.map((d, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(d.cost)} r={2.5} fill="var(--accent)">
                <title>
                  {d.day}: {formatUsd(d.cost)} · {d.calls.toLocaleString()} calls
                </title>
              </circle>
            ))}
          </>
        )}
        {tickIdx.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={h - 8}
            textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="var(--text-dim)"
            fontFamily="var(--mono)"
          >
            {series[i]?.day?.slice(5) /* MM-DD */}
          </text>
        ))}
        {series.length === 0 && (
          <text x={w / 2} y={h / 2} textAnchor="middle" fontSize="12" fill="var(--text-dim)">
            {t('platform.costs.chart.empty')}
          </text>
        )}
      </svg>
    </div>
  );
}

function BreakdownCard({ title, rows, labelOf, empty }) {
  const total = rows.reduce((acc, r) => acc + r.cost, 0);
  return (
    <Card pad>
      <SectionHeading title={title} />
      {rows.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '8px 0' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {rows.map((r, i) => {
            const pct = total > 0 ? (r.cost / total) * 100 : 0;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 600 }}
                >
                  <span
                    style={{
                      color: 'var(--text)',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {labelOf(r)}
                  </span>
                  <span style={{ color: 'var(--text-soft)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatUsd(r.cost)}
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background:
                        'linear-gradient(90deg, var(--accent), color-mix(in oklch, var(--accent) 60%, transparent))',
                    }}
                  />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                  {pct.toFixed(1)}% · {r.calls.toLocaleString()} calls
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RecentCallsTable({ rows, ready }) {
  const t = useT();
  return (
    <Card pad={false}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <SectionHeading
          eyebrow={t('platform.costs.recent.eyebrow')}
          title={t('platform.costs.recent.title', { n: rows.length })}
          inline
        />
      </div>
      {!ready && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.costs.loading')}</div>
      )}
      {ready && rows.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.costs.recent.empty')}</div>
      )}
      {ready && rows.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(150px, 180px) minmax(110px, 130px) minmax(140px, 1fr) minmax(180px, 240px) minmax(70px, 90px) minmax(90px, 110px)',
            fontSize: 11.5,
          }}
        >
          <HeaderCell>{t('platform.costs.recent.col.time')}</HeaderCell>
          <HeaderCell>{t('platform.costs.recent.col.feature')}</HeaderCell>
          <HeaderCell>{t('platform.costs.recent.col.org')}</HeaderCell>
          <HeaderCell>{t('platform.costs.recent.col.model')}</HeaderCell>
          <HeaderCell align="right">{t('platform.costs.recent.col.tokens')}</HeaderCell>
          <HeaderCell align="right">{t('platform.costs.recent.col.cost')}</HeaderCell>
          {rows.map((r, i) => {
            const ts = new Date(r.createdAt);
            return (
              <React.Fragment key={r.id}>
                <Cell first={i === 0} mono>
                  {ts.toLocaleString()}
                </Cell>
                <Cell first={i === 0}>{featureLabel(r.feature)}</Cell>
                <Cell first={i === 0}>{r.orgName}</Cell>
                <Cell first={i === 0} mono>
                  {r.model}
                </Cell>
                <Cell first={i === 0} align="right" mono>
                  {(r.inputTokens + r.outputTokens).toLocaleString()}
                </Cell>
                <Cell first={i === 0} align="right" mono>
                  {formatUsd(r.costUsd)}
                </Cell>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function HeaderCell({ children, align = 'left' }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.15,
        textTransform: 'uppercase',
        color: 'var(--text-faint)',
        textAlign: align,
        background: 'var(--surface-2)',
      }}
    >
      {children}
    </div>
  );
}

function Cell({ children, mono, first, align = 'left' }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: first ? 'none' : '1px solid var(--border)',
        color: 'var(--text-soft)',
        textAlign: align,
        fontFamily: mono ? 'var(--mono)' : undefined,
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

function SectionHeading({ eyebrow, title, inline = false }) {
  return (
    <div>
      {eyebrow && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {eyebrow}
        </div>
      )}
      <div style={{ fontSize: inline ? 14 : 16, fontWeight: 700, marginTop: eyebrow ? 4 : 0, color: 'var(--text)' }}>
        {title}
      </div>
    </div>
  );
}

function formatUsd(n) {
  if (!Number.isFinite(n)) return '$0.00';
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function formatUsdCompact(n) {
  if (!Number.isFinite(n) || n === 0) return '$0';
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 10) return `$${n.toFixed(1)}`;
  return `$${Math.round(n)}`;
}

function signedPct(p) {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(0)}%`;
}

function featureLabel(f) {
  if (!f) return '—';
  if (f === 'chat') return 'Chat (Merlin)';
  if (f === 'translate') return 'Translate (i18n)';
  if (f.startsWith('agent:')) return `Agent · ${f.slice(6)}`;
  return f;
}

function modelLabel(m) {
  if (!m) return '—';
  // Strip dated suffix if present so the table doesn't get noisy.
  return m.replace(/-\d{8}$/, '');
}
