// Manager-side multi-contractor scorecard (Phase 8.12 of the contractor
// intelligence loop). Lives at Operations → Contractors → Scorecard on
// real_estate orgs.
//
// Where ManagerProposalsInbox is "what is my contractor asking me to
// decide on" and ManagerReportsInbox is "what has my contractor handed
// me", this is "how do all my contractors compare to each other" —
// one row per contractor org with their portfolio metrics side by side.
//
// Symmetric to the contractor-side AnalyticsStrip (Phase 8.8) but with
// a comparison-table shape rather than a single hero card, since the FM
// is comparing across multiple counterparties rather than reflecting on
// their own portfolio.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useManagerScorecard } from './slas-data.js';
import { ContractDrawerById } from './ContractorApp.jsx';
import { Sparkline } from './primitives.jsx';
import { gradeFor } from './contractor-performance.js';

// Column definitions for the comparison table. Each column has a
// `sort` function used when its header is clicked. Order here is
// the default left-to-right column order.
const COLUMNS = [
  {
    id: 'contractor',
    labelKey: 'scorecard.col.contractor',
    fallback: 'Contractor',
    align: 'left',
    sort: (a, b) => a.contractor_name.localeCompare(b.contractor_name),
  },
  // Merlin-computed performance grade (contractor-performance.js). First
  // metric column so it reads as the headline "rating".
  {
    id: 'grade',
    labelKey: 'scorecard.col.grade',
    fallback: 'Merlin grade',
    align: 'center',
    sort: (a, b) => a.grade.score - b.grade.score,
  },
  {
    id: 'response',
    labelKey: 'scorecard.col.response',
    fallback: 'Avg response',
    align: 'right',
    sort: (a, b) => a.grade.perf.responseMins - b.grade.perf.responseMins,
  },
  {
    id: 'ontime',
    labelKey: 'scorecard.col.ontime',
    fallback: 'On-time',
    align: 'right',
    sort: (a, b) => a.grade.perf.onTimePct - b.grade.perf.onTimePct,
  },
  {
    id: 'active',
    labelKey: 'scorecard.col.active',
    fallback: 'Active',
    align: 'right',
    sort: (a, b) => a.activeContracts - b.activeContracts,
  },
  {
    id: 'monthly',
    labelKey: 'scorecard.col.monthly',
    fallback: 'Monthly $',
    align: 'right',
    sort: (a, b) => a.monthlyValue - b.monthlyValue,
  },
  {
    id: 'pilots',
    labelKey: 'scorecard.col.pilots',
    fallback: 'Pilots (acc / total)',
    align: 'right',
    sort: (a, b) => a.proposalsAccepted - b.proposalsAccepted,
  },
  {
    id: 'pending',
    labelKey: 'scorecard.col.pending',
    fallback: 'Pending',
    align: 'right',
    sort: (a, b) => a.proposalsPending - b.proposalsPending,
  },
  {
    id: 'decision',
    labelKey: 'scorecard.col.decision',
    fallback: 'Decision time',
    align: 'right',
    sort: (a, b) => (a.decisionDaysMedian ?? 999) - (b.decisionDaysMedian ?? 999),
  },
  {
    id: 'sla_delta',
    labelKey: 'scorecard.col.sla_delta',
    fallback: 'SLA Δ (90d)',
    align: 'right',
    sort: (a, b) => a.cumulativeSlaDelta - b.cumulativeSlaDelta,
  },
  // Trend column — inline sparkline of cumulative-SLA-delta over 90d
  // (one point per report). Header is non-sortable (no useful key);
  // sort by SLA Δ does the same job semantically.
  {
    id: 'trend',
    labelKey: 'scorecard.col.trend',
    fallback: 'Trend',
    align: 'center',
    sort: (a, b) => (a.slaDeltaTimeseries?.length || 0) - (b.slaDeltaTimeseries?.length || 0),
  },
  {
    id: 'last_report',
    labelKey: 'scorecard.col.last_report',
    fallback: 'Last report',
    align: 'right',
    sort: (a, b) => (a.lastReportAt || '').localeCompare(b.lastReportAt || ''),
  },
];

export function ManagerScorecard() {
  const t = useT();
  const session = useSession();
  const org = useActiveOrg();
  const { rows, totals, loaded } = useManagerScorecard(session?.organizationId);
  // Default sort: monthly $ desc — same as the hook's initial ordering,
  // but click any column header to override. (sortDir: 'asc' | 'desc')
  const [sortBy, setSortBy] = useState('grade');
  const [sortDir, setSortDir] = useState('desc');
  const [drawerContractId, setDrawerContractId] = useState(null);
  const [perfRow, setPerfRow] = useState(null); // contractor row whose perf panel is open

  // Attach Merlin's computed performance grade to each row (objective score
  // from delivery signals — see contractor-performance.js).
  const gradedRows = useMemo(() => rows.map((r) => ({ ...r, grade: gradeFor(r.contractor_name) })), [rows]);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.id === sortBy);
    if (!col) return gradedRows;
    const sorted = [...gradedRows].sort(col.sort);
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [gradedRows, sortBy, sortDir]);

  function onHeaderClick(colId) {
    if (sortBy === colId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(colId);
      // First click on a new column: numeric columns default desc
      // (biggest first); contractor column defaults asc.
      setSortDir(colId === 'contractor' ? 'asc' : 'desc');
    }
  }

  const labelFor = (col) => {
    const v = t(col.labelKey);
    return v && v !== col.labelKey ? v : col.fallback;
  };

  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
        <Hero org={org} totals={totals} t={t} />

        {!loaded && (
          <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-faint)' }}>
            {t('scorecard.loading') !== 'scorecard.loading' ? t('scorecard.loading') : 'Loading scorecard…'}
          </div>
        )}
        {loaded && rows.length === 0 && <EmptyState t={t} />}
        {loaded && rows.length > 0 && (
          <Card pad={false} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12.5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {COLUMNS.map((col) => {
                      const active = sortBy === col.id;
                      return (
                        <th
                          key={col.id}
                          style={{
                            padding: '10px 14px',
                            textAlign: col.align,
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: active ? 'var(--accent)' : 'var(--text-dim)',
                            letterSpacing: 0.15,
                            textTransform: 'uppercase',
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                          onClick={() => onHeaderClick(col.id)}
                        >
                          {labelFor(col)}
                          {active && (
                            <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <ScorecardRow key={row.contractor_org_id} row={row} onOpenPerf={(r) => setPerfRow(r)} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Biggest-improvements highlight strip — pulled out so it
            doesn't crowd the table cells. Sorted by delta desc. */}
        {loaded && rows.some((r) => r.biggestImprovement) && <BiggestImprovementsStrip rows={rows} t={t} />}
      </div>
      {drawerContractId && (
        <ContractDrawerById contractId={drawerContractId} onClose={() => setDrawerContractId(null)} />
      )}
      {perfRow && (
        <PerformancePanel
          row={perfRow}
          onClose={() => setPerfRow(null)}
          onOpenContract={(id) => {
            setPerfRow(null);
            setDrawerContractId(id);
          }}
          t={t}
        />
      )}
    </main>
  );
}

// Slide-over panel: why a contractor got their grade — the four weighted
// signals behind the score, each with a bar. Opens on row click so the FM
// can follow each contractor's performance, not just the headline letter.
function PerformancePanel({ row, onClose, onOpenContract, t }) {
  const g = row.grade;
  const tone = { ok: 'var(--ok)', warn: 'var(--warn)', risk: 'var(--risk)' }[g.tone] || 'var(--text-soft)';
  // response: lower is better → show as a 0–100 "speed" bar (10m=100, 60m=0).
  const respPct = Math.max(0, Math.min(100, Math.round(((60 - g.perf.responseMins) / 50) * 100)));
  const metrics = [
    {
      key: 'sla',
      label: t('scorecard.perf.sla'),
      weight: 40,
      pct: g.perf.slaAttainment,
      display: `${g.perf.slaAttainment}%`,
    },
    {
      key: 'response',
      label: t('scorecard.perf.response'),
      weight: 25,
      pct: respPct,
      display: `${g.perf.responseMins}m`,
    },
    {
      key: 'ontime',
      label: t('scorecard.perf.ontime'),
      weight: 20,
      pct: g.perf.onTimePct,
      display: `${g.perf.onTimePct}%`,
    },
    {
      key: 'winrate',
      label: t('scorecard.perf.winrate'),
      weight: 15,
      pct: g.perf.winRate,
      display: `${g.perf.winRate}%`,
    },
  ];
  const barTone = (pct) => (pct >= 85 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--risk)');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'color-mix(in oklch, #000 32%, transparent)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 92vw)',
          height: '100%',
          overflow: 'auto',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
          padding: 'var(--pad)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}
            >
              {t('scorecard.perf.title')}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>{row.contractor_name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Grade hero */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 14,
            borderRadius: 12,
            background: `color-mix(in oklch, ${tone} 10%, transparent)`,
            border: `1px solid color-mix(in oklch, ${tone} 30%, transparent)`,
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 800, color: tone, lineHeight: 1 }}>{g.grade}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {g.score}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-faint)' }}>/100</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('scorecard.perf.merlin_grade')}</div>
          </div>
        </div>

        {/* Signal bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {metrics.map((m) => (
            <div key={m.key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{m.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: barTone(m.pct) }}>{m.display}</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${m.pct}%`,
                    height: '100%',
                    background: barTone(m.pct),
                    borderRadius: 999,
                    transition: 'width .3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                {t('scorecard.perf.weight', { n: m.weight })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>{t('scorecard.perf.how')}</div>

        {row.primaryContractId && (
          <button
            type="button"
            onClick={() => onOpenContract(row.primaryContractId)}
            style={{
              marginTop: 'auto',
              padding: '9px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('scorecard.perf.view_contract')}
          </button>
        )}
      </div>
    </div>
  );
}

function Hero({ org, totals, t }) {
  const eyebrowKey = t('scorecard.hero.eyebrow');
  const titleKey = t('scorecard.hero.title');
  const bodyKey = t('scorecard.hero.body');
  const fmtMoney = (n) => {
    if (!n) return '$0';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
        n,
      );
    } catch {
      return `$${Math.round(n).toLocaleString()}`;
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 'var(--pad)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          {eyebrowKey !== 'scorecard.hero.eyebrow' ? eyebrowKey : 'Portfolio overview'}
          {org?.name ? ` · ${org.name}` : ''}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {titleKey !== 'scorecard.hero.title' ? titleKey : 'Contractor scorecard'}
        </h1>
        <p style={{ margin: '6px 0 12px', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 720 }}>
          {bodyKey !== 'scorecard.hero.body'
            ? bodyKey
            : 'Side-by-side comparison of every contractor across your portfolio. Live SLA impact, accepted pilots, decision-time velocity, and monthly spend.'}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat
            label={
              t('scorecard.stat.active_contractors') !== 'scorecard.stat.active_contractors'
                ? t('scorecard.stat.active_contractors')
                : 'Active contractors'
            }
            value={`${totals.activeContractors} / ${totals.contractorCount}`}
            tone="accent"
          />
          <Stat
            label={
              t('scorecard.stat.monthly_spend') !== 'scorecard.stat.monthly_spend'
                ? t('scorecard.stat.monthly_spend')
                : 'Monthly spend'
            }
            value={fmtMoney(totals.totalMonthly)}
            tone="neutral"
          />
          <Stat
            label={
              t('scorecard.stat.pilots_accepted') !== 'scorecard.stat.pilots_accepted'
                ? t('scorecard.stat.pilots_accepted')
                : 'Pilots accepted'
            }
            value={totals.pilotsAccepted}
            tone="ok"
          />
          {totals.pilotsPending > 0 && (
            <Stat
              label={
                t('scorecard.stat.pending_decisions') !== 'scorecard.stat.pending_decisions'
                  ? t('scorecard.stat.pending_decisions')
                  : 'Awaiting decision'
              }
              value={totals.pilotsPending}
              tone="warn"
            />
          )}
          {totals.cumulativeSlaDelta > 0 && (
            <Stat
              label={
                t('scorecard.stat.cumulative_sla') !== 'scorecard.stat.cumulative_sla'
                  ? t('scorecard.stat.cumulative_sla')
                  : 'SLA Δ (90d)'
              }
              value={`+${Math.round(totals.cumulativeSlaDelta)}pp`}
              tone="ok"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const palette = {
    ok: { fg: 'var(--ok)', bg: 'color-mix(in oklch, var(--ok) 10%, transparent)' },
    warn: { fg: 'var(--warn)', bg: 'color-mix(in oklch, var(--warn) 10%, transparent)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
    neutral: { fg: 'var(--text-soft)', bg: 'var(--surface-2)' },
  }[tone] || { fg: 'var(--text-soft)', bg: 'var(--surface-2)' };
  return (
    <div
      style={{
        padding: '8px 12px',
        background: palette.bg,
        borderRadius: 8,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 120,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: palette.fg, marginTop: 2 }}>{value}</span>
    </div>
  );
}

// Merlin grade chip — letter grade + 0–100 score, coloured by tone.
function GradeChip({ grade }) {
  const palette = {
    ok: {
      fg: 'var(--ok)',
      bg: 'color-mix(in oklch, var(--ok) 12%, transparent)',
      bd: 'color-mix(in oklch, var(--ok) 34%, transparent)',
    },
    warn: {
      fg: 'var(--warn)',
      bg: 'color-mix(in oklch, var(--warn) 12%, transparent)',
      bd: 'color-mix(in oklch, var(--warn) 34%, transparent)',
    },
    risk: {
      fg: 'var(--risk)',
      bg: 'color-mix(in oklch, var(--risk) 12%, transparent)',
      bd: 'color-mix(in oklch, var(--risk) 34%, transparent)',
    },
  }[grade.tone] || { fg: 'var(--text-soft)', bg: 'var(--surface-2)', bd: 'var(--border)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: palette.bg,
        border: `1px solid ${palette.bd}`,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 800, color: palette.fg }}>{grade.grade}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-faint)' }}>{grade.score}</span>
    </span>
  );
}

function ScorecardRow({ row, onOpenPerf, t }) {
  const [hover, setHover] = useState(false);
  const fmtMoney = (n) => {
    if (!n) return '—';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
        n,
      );
    } catch {
      return `$${Math.round(n).toLocaleString()}`;
    }
  };
  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
    }
  };
  const dormant = row.activeContracts === 0;
  // Pilot acceptance rate: subtle ratio cell. Show "0 / 0" not "—"
  // so the column doesn't visually drop out for newer contractors.
  const winRate =
    row.proposalsAccepted + row.proposalsDeclined >= 3
      ? Math.round((row.proposalsAccepted / (row.proposalsAccepted + row.proposalsDeclined)) * 100)
      : null;
  const hasTopImprovements = Array.isArray(row.topImprovements) && row.topImprovements.length > 0;

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--border)',
        opacity: dormant ? 0.6 : 1,
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => onOpenPerf(row)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
        setHover(true);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        setHover(false);
      }}
    >
      <td style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 7,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: dormant ? 'var(--surface-2)' : 'var(--accent-soft)',
              color: dormant ? 'var(--text-faint)' : 'var(--accent)',
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            {row.contractor_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.contractor_name}</div>
            {dormant && (
              <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 1 }}>
                {t('scorecard.dormant') !== 'scorecard.dormant' ? t('scorecard.dormant') : 'no active contract'}
              </div>
            )}
          </div>
        </div>
      </td>
      {/* Merlin grade — chip with letter + score */}
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        <GradeChip grade={row.grade} />
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-soft)' }}>
        {row.grade.perf.responseMins}m
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-soft)' }}>
        {row.grade.perf.onTimePct}%
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>
        {row.activeContracts}
        {row.totalContracts > row.activeContracts && (
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)', marginLeft: 4 }}>/ {row.totalContracts}</span>
        )}
      </td>
      <td
        style={{
          padding: '12px 14px',
          textAlign: 'right',
          fontWeight: 700,
          color: dormant ? 'var(--text-soft)' : 'var(--text)',
        }}
      >
        {fmtMoney(row.monthlyValue)}
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
        <span style={{ color: row.proposalsAccepted > 0 ? 'var(--ok)' : 'var(--text-soft)', fontWeight: 700 }}>
          {row.proposalsAccepted}
        </span>
        <span style={{ color: 'var(--text-faint)' }}> / {row.proposalsTotal}</span>
        {winRate != null && (
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)', marginLeft: 4 }}>({winRate}%)</span>
        )}
      </td>
      <td
        style={{
          padding: '12px 14px',
          textAlign: 'right',
          color: row.proposalsPending > 0 ? 'var(--warn)' : 'var(--text-faint)',
          fontWeight: row.proposalsPending > 0 ? 700 : 400,
        }}
      >
        {row.proposalsPending || '—'}
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-soft)' }}>
        {row.decisionDaysMedian == null ? '—' : `${row.decisionDaysMedian}d`}
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'right', position: 'relative' }}>
        {row.cumulativeSlaDelta > 0 ? (
          <span style={{ color: 'var(--ok)', fontWeight: 700 }}>+{Math.round(row.cumulativeSlaDelta)}pp</span>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>—</span>
        )}
        {/* Floating popover with the top SLA improvements driving the
            cumulative number. Anchored to the SLA Δ cell so it overlaps
            the Trend cell to its right without re-flowing the row. */}
        {hover && hasTopImprovements && <TopImprovementsPopover items={row.topImprovements} t={t} />}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        {row.slaDeltaTimeseries?.length >= 2 ? (
          <Sparkline
            data={row.slaDeltaTimeseries}
            w={84}
            h={22}
            stroke="var(--ok)"
            fill="color-mix(in oklch, var(--ok) 18%, transparent)"
          />
        ) : row.slaDeltaTimeseries?.length === 1 ? (
          // One data point — sparkline needs ≥2 to draw a line; show
          // a single dot instead so the cell isn't ambiguously empty.
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--ok)',
            }}
          />
        ) : (
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>
        {fmtDate(row.lastReportAt)}
      </td>
    </tr>
  );
}

// Hover popover anchored to the SLA Δ cell — surfaces the top 3 SLA
// improvements (sla_name + pilot title + vendor) that the cumulative
// number rolls up. Positioned absolute with right-edge alignment so
// it doesn't overflow the right side of the table on narrower
// viewports. pointer-events: none so the popover never steals the
// row's click target.
function TopImprovementsPopover({ items, t }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        zIndex: 20,
        marginTop: 4,
        padding: 10,
        minWidth: 240,
        maxWidth: 320,
        background: 'var(--surface)',
        border: '1px solid color-mix(in oklch, var(--ok) 30%, var(--border))',
        borderRadius: 8,
        boxShadow: '0 8px 24px color-mix(in oklch, var(--ok) 12%, rgba(0,0,0,0.18))',
        textAlign: 'left',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--ok)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
          marginBottom: 6,
        }}
      >
        {t('scorecard.tooltip.top_improvements') !== 'scorecard.tooltip.top_improvements'
          ? t('scorecard.tooltip.top_improvements')
          : 'Top SLA improvements (90d)'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{it.sla_name}</span>
              <span style={{ color: 'var(--ok)', fontWeight: 700 }}>+{it.delta}pp</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-soft)', lineHeight: 1.4 }}>
              “{it.pilot_title}”{it.vendor_name && ` · ${it.vendor_name}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BiggestImprovementsStrip({ rows, t }) {
  const wins = rows
    .filter((r) => r.biggestImprovement)
    .map((r) => ({ contractor: r.contractor_name, ...r.biggestImprovement }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  if (wins.length === 0) return null;

  const heading =
    t('scorecard.wins.heading') !== 'scorecard.wins.heading'
      ? t('scorecard.wins.heading')
      : 'Biggest wins this quarter';

  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          {heading}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {wins.map((w, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                background: 'color-mix(in oklch, var(--ok) 8%, transparent)',
                border: '1px solid color-mix(in oklch, var(--ok) 25%, transparent)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon.sparkle size={11} style={{ color: 'var(--ok)' }} />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--ok)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.15,
                  }}
                >
                  {w.contractor}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {w.sla_name} <span style={{ color: 'var(--ok)' }}>+{w.delta}pp</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                from “{w.pilot_title}”{w.vendor_name && ` · ${w.vendor_name}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ t }) {
  const titleKey = t('scorecard.empty.title');
  const bodyKey = t('scorecard.empty.body');
  return (
    <div
      style={{
        padding: 48,
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}
    >
      <Icon.shield size={28} style={{ color: 'var(--text-faint)' }} />
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: 'var(--text)' }}>
        {titleKey !== 'scorecard.empty.title' ? titleKey : 'No contractors yet'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, maxWidth: 460, marginInline: 'auto' }}>
        {bodyKey !== 'scorecard.empty.body'
          ? bodyKey
          : 'When you sign a contract with a contractor and they start delivering, their portfolio metrics will roll up here next to every other contractor on your portfolio.'}
      </div>
    </div>
  );
}
