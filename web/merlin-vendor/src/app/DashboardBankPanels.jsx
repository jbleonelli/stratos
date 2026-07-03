// Bank / FEB-scenario dashboard panels — extracted from Dashboard.jsx.
//
// These widgets only render for workspaces whose devices carry
// telemetry.service_policy (the SLB "bank branch" scenario). On every
// other workspace they self-hide (return null), so they are no-ops for
// office tenants like Meridian HQ. Wired into METRICS_WIDGET_CATALOG in
// Dashboard.jsx via the `sla-strip` / `bank-compliance` / `bank-fines-trend`
// / `bank-branches` catalog entries.
//
// Exported: SlaBreachStrip, BankComplianceCard, BankFinesTrendCard,
// BankBranchStatusPanel. Everything else (hooks, NY-tz date helpers, the
// row/legend/kpi sub-components) is private to this module.

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useCurrencySymbol } from './locale-format.js';
import { navigateTo } from './use-route.js';
import { supabase } from './supabase.js';
import { useSlaPerformance } from './slas-data.js';
import { LoadingCard } from './MetricsWidgets.jsx';

// SLA breach surface for the Dashboard — auto-shows a one-line strip at
// the top of the metrics section when any active SLA is in breach or
// at-risk for this workspace. Clicking jumps to Insights → SLAs so the
// manager lands on the per-SLA scorecard with the recommendations open.
// Quietly hides when everything is on target / pending / not yet defined.

const SLA_LOW_SAMPLE_THRESHOLD = 5; // mirrored from Insights.jsx

export function SlaBreachStrip({ orgId, onView }) {
  const t = useT();
  const { slas, perf, loaded } = useSlaPerformance(orgId);
  if (!loaded) return <LoadingCard />;
  if (!slas?.length) return null;

  // Effective status across all SLAs — same logic Insights.jsx uses to
  // downgrade low-sample false positives. Roll up counts so we can
  // compose the right narrative ("1 in breach", "2 at-risk", etc).
  let breachCount = 0;
  let atRiskCount = 0;
  let breachNames = [];
  let atRiskNames = [];
  for (const sla of slas) {
    const p = perf[sla.id];
    if (!p) continue;
    const lowSample = p.computable && p.sample_size != null && p.sample_size < SLA_LOW_SAMPLE_THRESHOLD;
    const eff = lowSample ? 'low_sample' : p.status || 'pending';
    if (eff === 'breach') {
      breachCount += 1;
      breachNames.push(sla.name);
    }
    if (eff === 'at_risk') {
      atRiskCount += 1;
      atRiskNames.push(sla.name);
    }
  }
  if (breachCount === 0 && atRiskCount === 0) return null;

  const tone = breachCount > 0 ? 'risk' : 'warn';
  const headline =
    breachCount > 0
      ? t(breachCount === 1 ? 'sla.strip.in_breach_one' : 'sla.strip.in_breach_many', { n: breachCount })
      : t(atRiskCount === 1 ? 'sla.strip.at_risk_one' : 'sla.strip.at_risk_many', { n: atRiskCount });
  const moreSuffix = (n) => (n > 2 ? ` ${t('sla.strip.more_suffix', { n: n - 2 })}` : '');
  const detail =
    breachCount > 0
      ? breachNames.slice(0, 2).join(' · ') + moreSuffix(breachNames.length)
      : atRiskNames.slice(0, 2).join(' · ') + moreSuffix(atRiskNames.length);

  const goToInsights = () => {
    if (onView) {
      onView('insights');
      // Persist the SLAs sub-track so Insights opens on it after the view switch.
      try {
        localStorage.setItem('merlinInsightsTrack', 'slas');
      } catch {}
    }
  };

  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      <button
        onClick={goToInsights}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 6,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <Dot tone={tone} pulse size={6} />
          <Pill tone={tone}>{headline}</Pill>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
            {t('sla.strip.view_on_insights')}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-soft)',
            width: '100%',
            minWidth: 0,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {detail}
        </span>
      </button>
    </Card>
  );
}

// Bank fines trend — daily fines accrual chart for the last N days.
// Sits between the workspace-level compliance card (today's snapshot)
// and the per-branch panel (the actionable list). Fills the gap in
// "is this getting better or worse over time" — a chart that flattens
// to zero is the goal for a healthy operation.
//
// Per day: missed branches × policy.missed_fine_usd + overstayed
// branches × policy.overstay_fine_usd. Computed client-side from
// raw device_service_sessions; the simulator generates the underlying
// signal so the chart fills in over time as more days accumulate.

function useBankFinesTrend(orgId, days = 14) {
  const qc = useQueryClient();
  const queryKey = ['bank-fines-trend', orgId, days];
  const q = useQuery({
    queryKey,
    enabled: Boolean(orgId),
    queryFn: async () => {
      // 1. Bank devices (those with service_policy).
      const { data: devices } = await supabase.from('devices').select('id, telemetry').eq('organization_id', orgId);
      const bankDevices = (devices || []).filter((d) => d?.telemetry?.service_policy);
      if (bankDevices.length === 0) return [];

      const policy = bankDevices[0].telemetry.service_policy;
      const totalBranches = bankDevices.length;
      const missedFine = policy.missed_fine_usd ?? 300;
      const overstayFine = policy.overstay_fine_usd ?? 1500;
      const windowEnd = policy.window_end ?? '20:00';
      const deviceIds = bankDevices.map((d) => d.id);

      // 2. Sessions over the lookback window.
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data: sessions } = await supabase
        .from('device_service_sessions')
        .select('device_id, started_at, ended_at')
        .eq('organization_id', orgId)
        .in('device_id', deviceIds)
        .gte('started_at', since);

      // 3. Bin per day. Use NY-tz date for the started_at since the
      //    service window is defined in ET — a session that starts at
      //    23:30 UTC = 19:30 ET on the same NY-day. Using UTC dates
      //    would split a single ET evening across two buckets.
      const buckets = makeNyDayBuckets(days);
      for (const s of sessions || []) {
        const dayKey = nyDayKey(s.started_at);
        if (!buckets[dayKey]) continue;
        buckets[dayKey].cleanedDeviceIds.add(s.device_id);
        if (s.ended_at && endedAfterWindow(s.ended_at, windowEnd)) {
          buckets[dayKey].overstayedCount += 1;
        }
      }

      return Object.values(buckets).map((b) => {
        const cleaned = b.cleanedDeviceIds.size;
        const missed = Math.max(0, totalBranches - cleaned);
        const overstayed = b.overstayedCount;
        const fineUsd = missed * missedFine + overstayed * overstayFine;
        return {
          date: b.date,
          label: b.label,
          missed,
          overstayed,
          cleaned,
          missedUsd: missed * missedFine,
          overstayUsd: overstayed * overstayFine,
          fineUsd,
        };
      });
    },
  });

  // Live updates: refetch when this org's service sessions change.
  useEffect(() => {
    if (!orgId) return undefined;
    const channel = supabase
      .channel(`bank_fines_trend_${orgId}_${days}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_service_sessions', filter: `organization_id=eq.${orgId}` },
        () => qc.invalidateQueries({ queryKey: ['bank-fines-trend', orgId, days] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, days, qc]);

  return { trend: q.data ?? null, loaded: q.isSuccess };
}

// Date-bin helpers anchored to America/New_York calendar days. A session
// at 23:30 UTC = 19:30 ET belongs to the NY-day, not the UTC-day.
function nyDayKey(iso) {
  if (!iso) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(iso));
}

function makeNyDayBuckets(days) {
  const out = {};
  // Anchor to "today in NY" then walk back.
  const todayNyKey = nyDayKey(new Date().toISOString());
  // Convert NY date back to a Date for arithmetic.
  for (let i = days - 1; i >= 0; i--) {
    const ms = Date.now() - i * 24 * 60 * 60 * 1000;
    const key = nyDayKey(new Date(ms).toISOString());
    if (!out[key]) {
      out[key] = {
        key,
        date: key,
        label: key.slice(5), // MM-DD
        cleanedDeviceIds: new Set(),
        overstayedCount: 0,
      };
    }
  }
  // Always include today even if iteration above happens to skip it.
  if (!out[todayNyKey]) {
    out[todayNyKey] = {
      key: todayNyKey,
      date: todayNyKey,
      label: todayNyKey.slice(5),
      cleanedDeviceIds: new Set(),
      overstayedCount: 0,
    };
  }
  return out;
}

export function BankFinesTrendCard({ orgId, days = 14 }) {
  const t = useT();
  const { trend, loaded } = useBankFinesTrend(orgId, days);
  const cur = useCurrencySymbol(); // before the early returns (rules-of-hooks)
  if (!loaded) return <LoadingCard />;
  if (!trend || trend.length === 0) return null;

  const maxFine = Math.max(1, ...trend.map((d) => d.fineUsd));
  const totalFine = trend.reduce((s, d) => s + d.fineUsd, 0);
  const totalMissed = trend.reduce((s, d) => s + d.missed, 0);
  const totalOverstay = trend.reduce((s, d) => s + d.overstayed, 0);

  const fmtUsd = (n) => `${cur}${Math.round(n).toLocaleString()}`;

  // Chart geometry. SVG canvas; padding leaves room for the day labels.
  const W = 720,
    H = 200,
    PAD_L = 12,
    PAD_R = 12,
    PAD_T = 22,
    PAD_B = 26;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const barW = (chartW / trend.length) * 0.7;
  const barGap = chartW / trend.length;

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <Icon.bolt size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('bank.fines_accrual', { days })}</div>
        <div style={{ flex: 1 }} />
        <Pill tone={totalFine > 0 ? 'risk' : 'ok'}>{t('bank.fines.total', { usd: fmtUsd(totalFine) })}</Pill>
        {totalMissed > 0 && <Pill tone="risk">{t('bank.fines.missed_pill', { n: totalMissed.toLocaleString() })}</Pill>}
        {totalOverstay > 0 && (
          <Pill tone="warn">{t('bank.fines.overstayed_pill', { n: totalOverstay.toLocaleString() })}</Pill>
        )}
      </div>
      <div style={{ padding: 12, overflowX: 'auto' }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {trend.map((d, i) => {
            const cx = PAD_L + barGap * i + barGap / 2;
            const totalH = (d.fineUsd / maxFine) * chartH;
            const missedH = d.fineUsd > 0 ? (d.missedUsd / d.fineUsd) * totalH : 0;
            const overstayH = totalH - missedH;
            const top = PAD_T + chartH - totalH;
            return (
              <g key={d.date}>
                {/* Overstay (warn) on top */}
                {overstayH > 0 && (
                  <rect x={cx - barW / 2} y={top} width={barW} height={overstayH} fill="var(--warn)" rx={2}>
                    <title>
                      {d.date} · {d.overstayed} overstayed · {fmtUsd(d.overstayUsd)}
                    </title>
                  </rect>
                )}
                {/* Missed (risk) below */}
                {missedH > 0 && (
                  <rect x={cx - barW / 2} y={top + overstayH} width={barW} height={missedH} fill="var(--risk)" rx={2}>
                    <title>
                      {d.date} · {d.missed} missed · {fmtUsd(d.missedUsd)}
                    </title>
                  </rect>
                )}
                {/* $ label above the bar */}
                {d.fineUsd > 0 && (
                  <text
                    x={cx}
                    y={top - 4}
                    textAnchor="middle"
                    style={{ fontSize: 9, fontFamily: 'var(--mono)', fill: 'var(--text-dim)' }}
                  >
                    {d.fineUsd >= 1000 ? `${cur}${Math.round(d.fineUsd / 1000)}k` : `${cur}${d.fineUsd}`}
                  </text>
                )}
                {/* Day label */}
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  style={{ fontSize: 9, fontFamily: 'var(--mono)', fill: 'var(--text-faint)' }}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 10.5,
            color: 'var(--text-dim)',
            flexWrap: 'wrap',
          }}
        >
          <LegendDot color="var(--risk)" label={t('bank.branch.missed')} />
          <LegendDot color="var(--warn)" label={t('bank.branch.overstayed')} />
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--mono)' }}>{t('bank.fines.legend.daily')}</span>
        </div>
      </div>
    </Card>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

// Bank branch-status panel — per-branch breakdown of today's service
// window. Drills into the workspace-level "X at risk now" number from
// the SlaBreachStrip + BankComplianceCard above, surfacing the actual
// branches (with addresses + fine $) that managers need to chase.
//
// Live-updates via realtime sub on device_service_sessions, so as crews
// badge in the missed list shrinks in real time during the 19:00–20:00
// service window.
//
// Row click → /device/<external_id> opens the SLB detail page where
// the manager can see the per-device session timeline.

function useBankBranchStatus(orgId) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['bank-branch-status', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      // 1. Bank devices (have service_policy on telemetry).
      const { data: devices } = await supabase
        .from('devices')
        .select('id, external_id, room, telemetry')
        .eq('organization_id', orgId);
      const bankDevices = (devices || []).filter((d) => d?.telemetry?.service_policy);
      if (bankDevices.length === 0) return [];

      const policy = bankDevices[0].telemetry.service_policy;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 2. Sessions in last 24h for those devices.
      const deviceIds = bankDevices.map((d) => d.id);
      const { data: sessions } = await supabase
        .from('device_service_sessions')
        .select('device_id, started_at, ended_at')
        .eq('organization_id', orgId)
        .in('device_id', deviceIds)
        .gte('started_at', since);

      const sessionByDevice = new Map();
      for (const s of sessions || []) {
        const existing = sessionByDevice.get(s.device_id);
        if (!existing || s.started_at > existing.started_at) {
          sessionByDevice.set(s.device_id, s);
        }
      }

      const out = bankDevices.map((d) => {
        const session = sessionByDevice.get(d.id);
        const overstayed = session?.ended_at ? endedAfterWindow(session.ended_at, policy.window_end || '20:00') : false;
        let status = 'cleaned';
        let fine = 0;
        if (!session) {
          status = 'missed';
          fine = policy.missed_fine_usd ?? 300;
        } else if (overstayed) {
          status = 'overstayed';
          fine = policy.overstay_fine_usd ?? 1500;
        }
        return {
          id: d.id,
          external_id: d.external_id,
          room: d.room || '—',
          branch_id: d?.telemetry?.branch_id || d.external_id,
          branch_region_label: d?.telemetry?.branch_region_label || '',
          branch_county: d?.telemetry?.branch_county || '',
          status,
          fine,
          session_started_at: session?.started_at || null,
          session_ended_at: session?.ended_at || null,
        };
      });
      // Sort: missed first, then overstayed, then cleaned; then by room.
      const RANK = { missed: 0, overstayed: 1, cleaned: 2 };
      out.sort((a, b) => {
        if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
        return (a.room || '').localeCompare(b.room || '');
      });
      return out;
    },
  });

  useEffect(() => {
    if (!orgId) return undefined;
    const channel = supabase
      .channel(`bank_branch_status_${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_service_sessions', filter: `organization_id=eq.${orgId}` },
        () => qc.invalidateQueries({ queryKey: ['bank-branch-status', orgId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  return { rows: q.data ?? null, loaded: q.isSuccess };
}

export function BankBranchStatusPanel({ orgId }) {
  const t = useT();
  const { rows, loaded } = useBankBranchStatus(orgId);
  const [filter, setFilter] = useState('missed'); // missed | overstayed | cleaned | all
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Show loading skeleton while we don't yet know if this is a bank
  // workspace; once loaded, hide entirely if there are no rows
  // (non-bank workspace, by design).
  if (!loaded) return <LoadingCard />;
  if (!rows || rows.length === 0) return null;

  const counts = { missed: 0, overstayed: 0, cleaned: 0 };
  for (const r of rows) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const goToFilter = (next) => {
    setFilter(next);
    setPage(0);
  };

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <Icon.building size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('bank.branches_last_24h')}</div>
        <Pill tone="info">{rows.length}</Pill>
        <div style={{ flex: 1 }} />
        <BranchFilter value={filter} counts={counts} onChange={goToFilter} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          {t('bank.branch.empty', { bucket: filter })}
        </div>
      ) : (
        <>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {pageRows.map((r, i) => (
              <BranchStatusRow key={r.id} row={r} divider={i > 0} />
            ))}
          </div>
          {pageCount > 1 && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: 'var(--text-dim)',
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  color: page === 0 ? 'var(--text-faint)' : 'var(--text-soft)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: page === 0 ? 'default' : 'pointer',
                  fontSize: 11,
                }}
              >
                {t('pagination.prev')}
              </button>
              <span style={{ fontFamily: 'var(--mono)' }}>
                {t('pagination.range', {
                  from: page * PAGE_SIZE + 1,
                  to: Math.min((page + 1) * PAGE_SIZE, filtered.length),
                  total: filtered.length,
                })}
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  color: page >= pageCount - 1 ? 'var(--text-faint)' : 'var(--text-soft)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: page >= pageCount - 1 ? 'default' : 'pointer',
                  fontSize: 11,
                }}
              >
                {t('pagination.next')}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function BranchFilter({ value, counts, onChange }) {
  const t = useT();
  const buckets = [
    { id: 'missed', label: t('bank.branch.missed'), n: counts.missed || 0, tone: 'risk' },
    { id: 'overstayed', label: t('bank.branch.overstayed'), n: counts.overstayed || 0, tone: 'warn' },
    { id: 'cleaned', label: t('bank.branch.cleaned'), n: counts.cleaned || 0, tone: 'ok' },
    {
      id: 'all',
      label: t('bank.branch.all'),
      n: (counts.missed || 0) + (counts.overstayed || 0) + (counts.cleaned || 0),
      tone: 'info',
    },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 3,
        background: 'var(--surface-2)',
        borderRadius: 7,
        border: '1px solid var(--border)',
      }}
    >
      {buckets.map((b) => {
        const active = value === b.id;
        const disabled = b.id !== 'all' && b.n === 0;
        return (
          <button
            key={b.id}
            onClick={() => !disabled && onChange(b.id)}
            disabled={disabled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active ? 'var(--accent)' : disabled ? 'var(--text-faint)' : 'var(--text-dim)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
              borderRadius: 5,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {b.label}
            <span
              style={{
                padding: '1px 5px',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                background: active ? 'var(--surface-3)' : 'var(--surface-2)',
                color: 'var(--text-dim)',
                borderRadius: 999,
              }}
            >
              {b.n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BranchStatusRow({ row, divider }) {
  const t = useT();
  const cur = useCurrencySymbol();
  const tone = row.status === 'missed' ? 'risk' : row.status === 'overstayed' ? 'warn' : 'ok';
  const label =
    row.status === 'missed'
      ? t('bank.branch.missed')
      : row.status === 'overstayed'
        ? t('bank.branch.overstayed')
        : t('bank.branch.cleaned');
  const goToDevice = () => navigateTo(`/device/${row.external_id}`);

  return (
    <button
      onClick={goToDevice}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '10px 16px',
        borderTop: divider ? '1px solid var(--border)' : 'none',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '110px 1fr 110px 100px',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Pill tone={tone}>
        <Dot tone={tone} size={5} pulse={row.status === 'missed'} /> {label}
      </Pill>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {row.room}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--mono)' }}>
          {row.branch_id}
          {row.branch_region_label ? ` · ${row.branch_region_label}` : ''}
          {row.branch_county ? ` · ${row.branch_county}` : ''}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          fontFamily: 'var(--mono)',
          color: row.fine > 0 ? 'var(--risk)' : 'var(--text-dim)',
          textAlign: 'right',
          fontWeight: 700,
        }}
      >
        {row.fine > 0 ? `${cur}${row.fine.toLocaleString()}` : '—'}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--accent)', textAlign: 'right', fontWeight: 700 }}>
        {t('bank.branch.open')}
      </div>
    </button>
  );
}

// Bank compliance — workspaces whose devices carry telemetry.service_policy
// (the "bank" scenario for SLBs) get a dedicated tile rolling up today's
// daily-cleaning window. Counts cleaned / missed / overstayed branches and
// sums fines (300 USD per missed, 1500 USD per overstay). Tile auto-hides
// when the active org has no policy-bearing devices, so it's a no-op for
// office workspaces like Meridian HQ.
//
// "Today" = last 24 hours rolling — sidesteps DST + midnight rollover and
// always shows the most recent service-window outcome, even when the demo
// is opened the morning after the 19:00 ET cleaning slot.
function useBankComplianceToday(orgId) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['bank-compliance-today', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      // 1. Get bank devices (those with service_policy).
      const { data: devices } = await supabase.from('devices').select('id, telemetry').eq('organization_id', orgId);
      const bankDevices = (devices || []).filter((d) => d?.telemetry?.service_policy);
      if (bankDevices.length === 0) return { totalBranches: 0 };

      // All branches in a workspace share the same policy in the demo.
      const policy = bankDevices[0].telemetry.service_policy;
      const totalBranches = bankDevices.length;

      // 2. Sessions in last 24h for those devices.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: sessions } = await supabase
        .from('device_service_sessions')
        .select('device_id, started_at, ended_at')
        .eq('organization_id', orgId)
        .gte('started_at', since);

      const cleanedSet = new Set();
      let overstayed = 0;
      for (const s of sessions || []) {
        cleanedSet.add(s.device_id);
        if (s.ended_at && endedAfterWindow(s.ended_at, policy.window_end || '20:00')) {
          overstayed += 1;
        }
      }
      const cleaned = cleanedSet.size;
      const missed = Math.max(0, totalBranches - cleaned);
      const missedFineUsd = missed * (policy.missed_fine_usd ?? 300);
      const overstayFineUsd = overstayed * (policy.overstay_fine_usd ?? 1500);

      return {
        totalBranches,
        cleaned,
        missed,
        overstayed,
        missedFineUsd,
        overstayFineUsd,
        totalFineUsd: missedFineUsd + overstayFineUsd,
        policy,
      };
    },
  });

  useEffect(() => {
    if (!orgId) return undefined;
    const channel = supabase
      .channel(`bank_compliance_${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_service_sessions', filter: `organization_id=eq.${orgId}` },
        () => qc.invalidateQueries({ queryKey: ['bank-compliance-today', orgId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  return q.data ?? null;
}

function endedAfterWindow(endedAtIso, windowEnd) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(endedAtIso));
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const [wh, wm] = (windowEnd || '20:00').split(':').map((n) => parseInt(n, 10));
  return hour * 60 + minute > wh * 60 + wm;
}

function nyClockNow() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return { hour, minute, total: hour * 60 + minute };
}

export function BankComplianceCard({ orgId }) {
  const t = useT();
  const cur = useCurrencySymbol();
  const stats = useBankComplianceToday(orgId);
  // stats === null → still fetching; stats.totalBranches === 0 → no
  // bank devices on this workspace (silent by design).
  if (!stats) return <LoadingCard />;
  if (!stats.totalBranches) return null;

  const policy = stats.policy || {};
  const windowStart = policy.window_start || '19:00';
  const windowEnd = policy.window_end || '20:00';
  const missedFine = policy.missed_fine_usd ?? 300;
  const overstayFine = policy.overstay_fine_usd ?? 1500;

  const now = nyClockNow();
  const [ws_h, ws_m] = windowStart.split(':').map(Number);
  const [we_h, we_m] = windowEnd.split(':').map(Number);
  const startMin = ws_h * 60 + ws_m;
  const endMin = we_h * 60 + we_m;

  let phaseTone, phaseLabel;
  if (now.total < startMin) {
    phaseTone = 'info';
    const mins = startMin - now.total;
    const hh = Math.floor(mins / 60),
      mm = mins % 60;
    phaseLabel = hh > 0 ? t('bank.compliance.window_pre', { hh, mm }) : t('bank.compliance.window_pre_no_h', { mm });
  } else if (now.total < endMin) {
    phaseTone = 'accent';
    const mins = endMin - now.total;
    phaseLabel = t('bank.compliance.window_active', { n: mins });
  } else {
    phaseTone = 'off';
    phaseLabel = t('bank.compliance.window_post');
  }

  // Tone for total-fines tile: ok if zero, warn if non-zero.
  const finesTone = stats.totalFineUsd > 0 ? 'risk' : 'ok';

  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(420px 200px at 92% 0%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon.shield size={13} style={{ color: 'var(--accent)' }} />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            {t('bank.compliance.eyebrow')}
          </span>
          <Pill tone={phaseTone}>{phaseLabel}</Pill>
        </div>
        <h2 style={{ margin: '4px 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          {t('bank.compliance.title', { n: stats.totalBranches.toLocaleString(), start: windowStart, end: windowEnd })}
        </h2>
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          <KpiCard
            label={t('bank.compliance.kpi.cleaned')}
            value={stats.cleaned.toLocaleString()}
            total={stats.totalBranches}
            tone="ok"
            mono
          />
          <KpiCard
            label={t('bank.compliance.kpi.missed')}
            value={stats.missed.toLocaleString()}
            total={stats.totalBranches}
            tone={stats.missed > 0 ? 'warn' : 'off'}
            mono
          />
          <KpiCard
            label={t('bank.compliance.kpi.overstays')}
            value={stats.overstayed.toLocaleString()}
            tone={stats.overstayed > 0 ? 'risk' : 'off'}
            mono
          />
          <KpiCard
            label={t('bank.compliance.kpi.fines')}
            value={`${cur}${stats.totalFineUsd.toLocaleString()}`}
            tone={finesTone}
            mono
          />
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: 'var(--text-dim)',
            lineHeight: 1.55,
          }}
        >
          {stats.missed > 0 || stats.overstayed > 0 ? (
            <>
              ${missedFine}/branch missed cleaning · ${overstayFine.toLocaleString()}/branch overstaying past{' '}
              {windowEnd}.
              {stats.missed > 0 && (
                <>
                  {' '}
                  Missed: <b>${stats.missedFineUsd.toLocaleString()}</b>.
                </>
              )}
              {stats.overstayed > 0 && (
                <>
                  {' '}
                  Overstays: <b>${stats.overstayFineUsd.toLocaleString()}</b>.
                </>
              )}
            </>
          ) : (
            <>
              No fines incurred in the last 24h. Policy: ${missedFine} per missed branch · $
              {overstayFine.toLocaleString()} per overstay past {windowEnd}.
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function KpiCard({ label, value, total, tone, mono }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', accent: 'var(--accent)', off: 'var(--text-dim)' }[
      tone
    ] || 'var(--text)';
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color,
            lineHeight: 1,
            fontFamily: mono ? 'var(--mono)' : 'var(--font)',
          }}
        >
          {value}
        </span>
        {total != null && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>/ {total}</span>
        )}
      </div>
    </div>
  );
}
