// Merlin Insights — AI-surfaced optimizations + their $ impact.
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card, AdaptivLoader } from './primitives.jsx';
import { useT, getLanguage } from './i18n.js';
import { useSession } from './auth.js';
import {
  INSIGHT_CATEGORIES,
  INSIGHTS_HQ,
  INSIGHTS_ECOSYSTEM,
  INSIGHTS_ECOSYSTEM_SAVED_YTD,
  INSIGHTS_ECOSYSTEM_IMPLEMENTED,
  filterInsightsForRole,
  computeInsightStats,
  TRACKS,
  trackOf,
  filterInsightsByTrack,
  pastActionsOf,
  realizedDollars,
} from './insights-data.js';
import { useLocalizedInsights, useLocalizedCategoryLabel } from './localized-data.js';
import { useSlaPerformance, windowLabel, useAiSlaRecommendations } from './slas-data.js';

const PRIORITY_TONE = { high: 'risk', medium: 'warn', low: 'info' };
const STATUS_TONE = { new: 'accent', in_review: 'info', approved: 'ok', implemented: 'ok', dismissed: 'neutral' };
const RISK_TONE = { low: 'ok', medium: 'warn', high: 'risk' };

// Currency: locale derived from active language. fr → fr-FR / EUR (€),
// everything else → en-US / USD ($). getLanguage() is read at call
// time so the formatter flips when the user switches language;
// callers inside React render trees subscribe via useLanguage() in
// the parent component (any will do — InsightsPage already does).
const fmtDollars = (n) => {
  const isFr = getLanguage() === 'fr';
  return new Intl.NumberFormat(isFr ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: isFr ? 'EUR' : 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

// Wellbeing hero: prefer the satisfaction (★) aggregate as the headline
// when present, then fall back to the largest other unit. Stars average
// across locations (a per-room rating lift can't meaningfully be summed);
// counts like complaints/mo and requests/mo sum across insights.
function formatWellbeingHero(byUnit, countByUnit, t) {
  const STAR = '\u2605';
  const color = '#10b981';
  const empty = {
    primary: '\u2014',
    secondary: t ? t('insights.wellbeing.no_recs') : 'No active recommendations.',
    color,
  };
  const units = Object.entries(byUnit || {});
  if (units.length === 0) return empty;

  const counts = countByUnit || {};
  const fmtPrimary = (u, sum) => {
    if (u === STAR) {
      const n = counts[u] || 1;
      return `+${(sum / n).toFixed(1)}${STAR}`;
    }
    return `\u2212${Math.round(sum)}`;
  };
  const fmtSecondary = (u, sum) => {
    if (u === STAR) {
      const n = counts[u] || 1;
      return t
        ? t(n === 1 ? 'insights.wellbeing.avg_lift_one' : 'insights.wellbeing.avg_lift_many', { n })
        : `avg lift across ${n} ${n === 1 ? 'location' : 'locations'}`;
    }
    return t
      ? t('insights.wellbeing.unit_per_mo', { n: Math.round(sum), unit: u })
      : `\u2212${Math.round(sum)} ${u}/mo`;
  };

  let primaryEntry = units.find(([u]) => u === STAR);
  if (!primaryEntry) primaryEntry = units.slice().sort((a, b) => b[1] - a[1])[0];
  const [pu, pv] = primaryEntry;
  const primary = fmtPrimary(pu, pv);
  // Lead the secondary with the star-specific label (if star is primary),
  // then append every other unit as a "−N unit/mo" chip.
  const pieces = [];
  if (pu === STAR) pieces.push(fmtSecondary(STAR, pv));
  for (const [u, v] of units) {
    if (u === pu) continue;
    pieces.push(fmtSecondary(u, v));
  }
  const secondary = pieces.length ? pieces.join(' \u00b7 ') : null;
  return { primary, secondary, color };
}

export function InsightsPage({ building, role, onOpenChat, initialTrack }) {
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  // Track now lives at the TopBar level — the PREDICT sub-nav (lifted
  // 2026-05-16) maps each track to a distinct view value, App.jsx
  // passes the resolved track in via initialTrack, and a useEffect
  // syncs the internal state when initialTrack changes mid-mount.
  // localStorage persistence is dropped; view is now the source of
  // truth (and the back/forward buttons + URL share now work).
  const [track, setTrack] = useState(initialTrack || 'financial-v2');
  useEffect(() => {
    if (initialTrack && initialTrack !== track && TRACKS.some((tr) => tr.id === initialTrack)) {
      setTrack(initialTrack);
    }
  }, [initialTrack]); // eslint-disable-line react-hooks/exhaustive-deps
  const [expandedId, setExpandedId] = useState(null);
  // Sub-tab inside Financials v2 — 'recommendations' (mirrors v1) or
  // 'past'. Persisted so the user lands on whichever sub-view they
  // last looked at across reloads.
  const [v2Sub, setV2Sub] = useState(() => {
    try {
      const saved = localStorage.getItem('merlinFinancialsV2Sub');
      if (saved === 'recommendations' || saved === 'past') return saved;
    } catch {}
    return 'recommendations';
  });
  useEffect(() => {
    try {
      localStorage.setItem('merlinFinancialsV2Sub', v2Sub);
    } catch {}
  }, [v2Sub]);
  const t = useT();
  const session = useSession();

  const isEcosystem = building?.kind === 'ecosystem';
  const isImf = building?.variant === 'imf';
  // IMF is a live device pilot — no demo insight fixtures. Empty pool renders
  // the Insights empty state; real insights populate from live signal.
  const sourceSet = isImf ? [] : isEcosystem ? INSIGHTS_ECOSYSTEM : INSIGHTS_HQ;
  const savedYTDBase = isImf ? 0 : isEcosystem ? INSIGHTS_ECOSYSTEM_SAVED_YTD : 47400;
  const implementedBase = isImf ? 0 : isEcosystem ? INSIGHTS_ECOSYSTEM_IMPLEMENTED : 7;

  // Role gates which insights are visible. Facility Manager sees everything;
  // the other personas only see what's in their domain.
  const roleInsights = useMemo(() => filterInsightsForRole(sourceSet, role?.id), [sourceSet, role?.id]);
  const trackInsights = useMemo(() => filterInsightsByTrack(roleInsights, track), [roleInsights, track]);
  // Financials v2 is a clone slot — for now it draws from the same
  // numbers as the v1 financial tab. Future work will diverge.
  const isFinancialTrack = track === 'financial-v2';
  const stats = useMemo(
    () => ({
      ...computeInsightStats(trackInsights),
      // Realized $ and implemented count today all come from financial-track
      // insights (wellbeing insights don't carry dollar metrics yet), so the
      // base numbers apply in full on the financial tabs (v1 + v2 clone) and
      // drop to counts derived from the track-filtered list on the wellbeing tab.
      savedYTD: isFinancialTrack ? savedYTDBase : 0,
      implementedCount: isFinancialTrack
        ? implementedBase
        : trackInsights.filter((i) => i.status === 'implemented').length,
    }),
    [trackInsights, track, savedYTDBase, implementedBase],
  );
  // SLA window selector — segmented control on the SLAs track. Persisted
  // so a user who picks "30d" stays on it across reloads. Defaulting to
  // 14d matches the original fixed window before this was selectable.
  const [slaWindow, setSlaWindow] = useState(() => {
    try {
      const saved = localStorage.getItem('merlinSlaWindow');
      if (['7d', '14d', '30d', 'mtd'].includes(saved)) return saved;
    } catch {}
    return '14d';
  });
  useEffect(() => {
    try {
      localStorage.setItem('merlinSlaWindow', slaWindow);
    } catch {}
  }, [slaWindow]);

  // SLA performance hook — fires for the SLAs track (and quietly for the
  // counts pill so the track toggle's "N" badge reflects active SLAs).
  const slaPerf = useSlaPerformance(session?.organizationId, slaWindow);

  // Counts for the track toggle pills (gated by role). Financials v2
  // mirrors v1 since it's a clone of the same insight pool today.
  useMemo(() => {
    const financialCount = roleInsights.filter((i) => trackOf(i) === 'financial' && i.status !== 'dismissed').length;
    return {
      financial: financialCount,
      'financial-v2': financialCount,
      wellbeing: roleInsights.filter((i) => trackOf(i) === 'wellbeing' && i.status !== 'dismissed').length,
      slas: slaPerf.slas.length,
    };
  }, [roleInsights, slaPerf.slas]);
  const insights = useLocalizedInsights(trackInsights, building);
  useLocalizedCategoryLabel();

  const filtered = useMemo(() => {
    return insights.filter((i) => {
      if (statusFilter === 'active' && (i.status === 'dismissed' || i.status === 'implemented')) return false;
      if (statusFilter === 'implemented' && i.status !== 'implemented') return false;
      if (statusFilter === 'dismissed' && i.status !== 'dismissed') return false;
      if (filter !== 'all' && i.category !== filter) return false;
      return true;
    });
  }, [insights, filter, statusFilter]);

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
    >
      {/* Track strip lifted to the TopBar 2026-05-16 (pillar-subnav.js
          PREDICT entry). InsightsPage receives the resolved track via
          initialTrack and syncs internal state through a useEffect. */}
      {track === 'slas' ? (
        <SlasTrack
          slas={slaPerf.slas}
          perf={slaPerf.perf}
          openAskBySlaId={slaPerf.openAskBySlaId}
          loaded={slaPerf.loaded}
          windowSpec={slaWindow}
          windowDays={slaPerf.windowDays}
          onWindowChange={setSlaWindow}
          // Auto-SEND the question (not just stage it in the input) so "Ask
          // Merlin to dig deeper" actually asks Merlin and gets a live answer,
          // matching every other ask-Merlin action. Without { send: true },
          // openChat only seeds the input and the user has to hit enter.
          onAskMerlin={(q) => onOpenChat?.(q, { send: true })}
        />
      ) : (
        <>
          {track === 'financial-v2' && (
            <FinancialsV2SubTabs
              sub={v2Sub}
              onChange={(next) => {
                setV2Sub(next);
                setExpandedId(null);
              }}
              recommendationsCount={
                trackInsights.filter((i) => i.status !== 'dismissed' && i.status !== 'implemented').length
              }
              pastCount={pastActionsOf(roleInsights).length}
            />
          )}
          {track === 'financial-v2' && v2Sub === 'past' ? (
            <PastActionsTrack
              actions={pastActionsOf(roleInsights)}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              onAskMerlin={onOpenChat}
              role={role}
              building={building}
            />
          ) : (
            <>
              <InsightsHero stats={stats} role={role} building={building} track={track} onOpenChat={onOpenChat} />
              <FilterBar
                insights={insights}
                filter={filter}
                onFilter={setFilter}
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map((ins) => (
                  <InsightCard
                    key={ins.id}
                    insight={ins}
                    expanded={expandedId === ins.id}
                    onToggle={() => setExpandedId(expandedId === ins.id ? null : ins.id)}
                    onAskMerlin={(q) => onOpenChat?.(q)}
                  />
                ))}
                {filtered.length === 0 && (
                  <Card style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
                    {t('insights.no_match')}
                  </Card>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

// ────────────────────── Financials v2 sub-tabs ──────────────────────
//
// Two sub-views inside the Financials v2 tab:
//   - 'recommendations' — same content as Financial v1 (active list)
//   - 'past'            — implemented insights, reverse-chronological,
//                         realized-$ headline.
// Counts on each pill come from the same insight pool the underlying
// views read from, so a user always sees the size of the surface they're
// about to switch into.

function FinancialsV2SubTabs({ sub, onChange, recommendationsCount, pastCount }) {
  const t = useT();
  const opts = [
    { id: 'recommendations', label: t('insights.v2.recommendations'), icon: 'sparkle', count: recommendationsCount },
    { id: 'past', label: t('insights.v2.past'), icon: 'check', count: pastCount },
  ];
  return (
    <Card pad={false} style={{ flexShrink: 0, padding: 6, display: 'inline-flex', alignSelf: 'flex-start', gap: 4 }}>
      {opts.map((o) => {
        const active = sub === o.id;
        const IconC = Icon[o.icon] || Icon.sparkle;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              fontSize: 12.5,
              fontWeight: 700,
              background: active ? 'color-mix(in oklch, var(--accent) 12%, var(--surface))' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-dim)',
              border: '1px solid ' + (active ? 'color-mix(in oklch, var(--accent) 35%, transparent)' : 'transparent'),
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <IconC size={12} />
            {o.label}
            <span
              style={{
                padding: '2px 7px',
                fontSize: 10.5,
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                background: active ? 'color-mix(in oklch, var(--accent) 18%, transparent)' : 'var(--surface-3)',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                borderRadius: 999,
              }}
            >
              {o.count ?? 0}
            </span>
          </button>
        );
      })}
    </Card>
  );
}

// ─────────────────── Past actions track (Financials v2) ───────────────────
//
// Reverse-chronological list of implemented financial insights. Each
// row reuses InsightCard for symmetry with the Recommendations view —
// expanding shows the same reasoning / data sources / implementation
// steps. The hero rolls up realized $ + count and shows the most
// recent action's date so the user gets "we banked $X · last action
// was Y days ago" at a glance.

function PastActionsTrack({ actions, expandedId, onToggle, onAskMerlin, role, building }) {
  const t = useT();
  const totalRealized = realizedDollars(actions);
  const lastAt = actions[0]?.implementedAt || null;
  const localized = useLocalizedInsights(actions, building);
  return (
    <>
      <PastActionsHero
        realized={totalRealized}
        count={actions.length}
        lastAt={lastAt}
        building={building}
        role={role}
      />
      {localized.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>{t('insights.past.empty')}</Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {localized.map((ins) => (
            <InsightCard
              key={ins.id}
              insight={ins}
              expanded={expandedId === ins.id}
              onToggle={() => onToggle(ins.id)}
              onAskMerlin={(q) => onAskMerlin?.(q)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Hero variant for Past actions — same card frame as InsightsHero so
// the surface feels familiar, but the headline and stats are about
// realized $ and recency rather than potential pipeline.
function PastActionsHero({ realized, count, lastAt, building }) {
  const t = useT();
  const isEcosystem = building?.kind === 'ecosystem';
  const locationLabel = isEcosystem ? building.name : t('insights.merlin_hq_label');
  const lastLabel = formatDaysAgo(lastAt, t);
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(160deg, color-mix(in oklch, var(--accent) 14%, var(--surface)), var(--surface) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          padding: 'var(--pad)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            {t('insights.past.eyebrow', { loc: locationLabel })}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 36, fontWeight: 800, letterSpacing: -0.02, color: 'var(--text)' }}>
            {fmtDollars(realized)}{' '}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>
              {t('insights.past.realized_ytd')}
            </span>
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.55 }}>
            {count === 0 ? (
              t('insights.past.no_actions_year')
            ) : (
              <>
                {t(count === 1 ? 'insights.past.across_one' : 'insights.past.across_many', { n: count })}
                {lastLabel ? <> · {t('insights.past.last_action', { when: lastLabel })}</> : null}.
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <PastActionsHeroStat label={t('insights.past.realized')} value={fmtDollars(realized)} tone="accent" />
          <PastActionsHeroStat label={t('insights.past.actions')} value={count} tone="neutral" />
        </div>
      </div>
    </Card>
  );
}

// Compact stat tile reused by the past-actions hero.
function PastActionsHeroStat({ label, value, tone = 'neutral' }) {
  const color = tone === 'accent' ? 'var(--accent)' : 'var(--text)';
  return (
    <div
      style={{
        minWidth: 110,
        padding: '10px 14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        textAlign: 'right',
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
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// "3 days ago" / "last week" / "Jan 14" formatter for the hero
// recency line. Falls back to ISO date for anything older than a
// month so the user gets a stable anchor.
function formatDaysAgo(iso, t) {
  if (!iso) return null;
  const then = new Date(iso + 'T00:00:00Z');
  if (isNaN(then)) return null;
  const now = new Date();
  const days = Math.max(0, Math.round((now - then) / 86_400_000));
  if (!t) {
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'last week';
    if (days < 30) return `${Math.round(days / 7)} weeks ago`;
    return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (days === 0) return t('time.today');
  if (days === 1) return t('time.yesterday');
  if (days < 7) return t('time.days_ago', { n: days });
  if (days < 14) return t('time.last_week');
  if (days < 30) return t('time.weeks_ago', { n: Math.round(days / 7) });
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d)) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─────────────────── Journey strip (Past actions) ───────────────────
//
// Three-step horizontal pipeline shown at the top of an implemented
// insight's expanded body: Proposed → Approved → Implemented. Each
// node carries its date; the Approved node also surfaces who signed
// off so the audit trail reads at a glance. All three nodes are
// "filled" green for past actions (every one is by definition done).

function JourneyStrip({ insight }) {
  const t = useT();
  const proposed = insight.proposedAt;
  const approved = insight.approvedAt;
  const approvedBy = insight.approvedBy;
  const implemented = insight.implementedAt;
  const steps = [
    {
      label: t('insights.journey.proposed'),
      date: proposed,
      icon: 'sparkle',
      sublabel: t('insights.journey.by_merlin'),
    },
    {
      label: t('insights.journey.approved'),
      date: approved,
      icon: 'check',
      sublabel: approvedBy ? t('insights.journey.by_person', { name: approvedBy.name }) : null,
      hint: approvedBy?.role,
    },
    { label: t('insights.journey.implemented'), date: implemented, icon: 'bolt', sublabel: null },
  ];
  return (
    <Section title={t('insights.journey')}>
      <div
        style={{
          marginTop: 8,
          padding: '14px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0,
          position: 'relative',
        }}
      >
        {/* Connecting line behind the dots */}
        <div
          style={{
            position: 'absolute',
            left: '16.66%',
            right: '16.66%',
            top: 26,
            height: 2,
            background: 'color-mix(in oklch, var(--ok) 35%, transparent)',
            zIndex: 0,
          }}
        />
        {steps.map((s, _i) => {
          const IconC = Icon[s.icon] || Icon.check;
          return (
            <div
              key={s.label}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'var(--ok)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 4px var(--surface)',
                }}
              >
                <IconC size={12} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{s.label}</div>
              {s.date && (
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  {formatShortDate(s.date) || s.date}
                </div>
              )}
              {s.sublabel && <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{s.sublabel}</div>}
              {s.hint && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{s.hint}</div>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─────────────────── Outcome block (Past actions) ───────────────────
//
// "How it played out" panel — predicted vs actual side-by-side plus a
// short narrative. The narrative uses prose (not bullets) on purpose:
// past-action storytelling lands better as a sentence than as a list.

function OutcomeBlock({ outcome }) {
  const t = useT();
  return (
    <Section title={t('insights.outcome')}>
      <div
        style={{
          marginTop: 8,
          padding: 14,
          background: 'color-mix(in oklch, var(--ok) 6%, var(--surface))',
          border: '1px solid color-mix(in oklch, var(--ok) 25%, transparent)',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {(outcome.predicted || outcome.actual) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <OutcomeStat label={t('insights.outcome.predicted')} value={outcome.predicted} tone="dim" />
            <OutcomeStat label={t('insights.outcome.actual')} value={outcome.actual} tone="ok" />
          </div>
        )}
        {outcome.narrative && (
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-soft)' }}>{outcome.narrative}</p>
        )}
      </div>
    </Section>
  );
}

function OutcomeStat({ label, value, tone }) {
  const color = tone === 'ok' ? 'var(--ok)' : 'var(--text-dim)';
  return (
    <div>
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
      <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700, color }}>{value || '—'}</div>
    </div>
  );
}

// ────────────────────────────── Hero ──────────────────────────────

function InsightsHero({ stats, role, building, track, onOpenChat }) {
  const t = useT();
  const isFacility = role?.id === 'facility' || !role;
  const isEcosystem = building?.kind === 'ecosystem';
  const locationLabel = isEcosystem ? building.name : t('insights.merlin_hq_label');
  const isWellbeing = track === 'wellbeing';
  const trackMeta = TRACKS.find((x) => x.id === track) || TRACKS[0];

  // Big hero number swaps with the track. Wellbeing picks the unit with
  // the largest aggregate (usually ★ deltas) and renders the rest below.
  const heroBig = isWellbeing
    ? formatWellbeingHero(stats.wellbeingByUnit, stats.wellbeingCountByUnit, t)
    : { primary: fmtDollars(stats.potentialDollars), color: 'var(--accent)' };

  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isWellbeing
            ? `radial-gradient(700px 340px at 90% -10%, color-mix(in oklch, ${trackMeta.accent} 22%, transparent), transparent 65%),
             radial-gradient(500px 280px at 10% 110%, color-mix(in oklch, #20286D 22%, transparent), transparent 60%)`
            : `radial-gradient(700px 340px at 90% -10%, color-mix(in oklch, var(--accent) 24%, transparent), transparent 65%),
             radial-gradient(500px 280px at 10% 110%, color-mix(in oklch, #20286D 28%, transparent), transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', display: 'flex', alignItems: 'center', gap: 32, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Icon.sparkle size={13} style={{ color: isWellbeing ? trackMeta.accent : 'var(--accent)' }} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('insights.merlin_label')} · {t(trackMeta.labelKey)} · {locationLabel}
              {role && !isFacility ? ` · ${role.name}` : ''}
            </span>
            <Dot tone={isWellbeing ? 'ok' : 'accent'} size={5} pulse />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                letterSpacing: -0.025,
                lineHeight: 1,
                color: heroBig.color,
                fontFamily: 'var(--font)',
              }}
            >
              {heroBig.primary}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-soft)', fontWeight: 500 }}>
              {isWellbeing ? t('insights.wellbeing.projected_lift') : t('insights.potential')}{' '}
              <b>{stats.counts.total - stats.counts.dismissed}</b> {t('insights.active_recs_suffix')}
            </div>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--text-dim)', maxWidth: 720, lineHeight: 1.55 }}>
            {isWellbeing ? (
              <>
                {t('insights.wellbeing.body')}
                {heroBig.secondary && (
                  <>
                    {' '}
                    · <b style={{ color: trackMeta.accent }}>{heroBig.secondary}</b>
                  </>
                )}
              </>
            ) : (
              <>
                {isFacility ? (
                  isEcosystem ? (
                    <>{t('insights.sub.facility_eco')}</>
                  ) : (
                    <>{t('insights.sub.facility_hq')}</>
                  )
                ) : (
                  <>
                    {t('insights.sub.non_facility')}
                    <b>{role.name}</b>
                    {t('insights.sub.non_facility_end')}
                  </>
                )}
                {t('insights.sub.realized')}
                <b style={{ color: 'var(--ok)' }}>{fmtDollars(stats.savedYTD)}</b>
                {t('insights.sub.realized_end', { n: stats.implementedCount || 0 })}
              </>
            )}
          </p>

          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => onOpenChat?.(t('insights.prioritize_prompt'))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 10px color-mix(in oklch, var(--accent) 30%, transparent)',
              }}
            >
              <Icon.sparkle size={12} /> {t('insights.prioritize')}
            </button>
            <button
              style={{
                padding: '8px 14px',
                background: 'var(--surface-2)',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon.panel size={12} /> {t('insights.export_cfo')}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 12, flexShrink: 0 }}>
          <HeroStat label={t('insights.status.new')} value={stats.counts.new} tone="accent" />
          <HeroStat label={t('insights.status.in_review')} value={stats.counts.in_review} tone="info" />
          <HeroStat label={t('insights.status.approved')} value={stats.counts.approved} tone="ok" />
          <HeroStat label={t('insights.status.implemented')} value={stats.counts.implemented} tone="ok" />
        </div>
      </div>
    </Card>
  );
}

function HeroStat({ label, value, tone }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[tone] ||
    'var(--text)';
  return (
    <div
      style={{
        minWidth: 112,
        padding: '10px 14px',
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
          textTransform: 'uppercase',
          letterSpacing: 0.12,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ────────────────────────────── Filter bar ──────────────────────────────

function FilterBar({ insights, filter, onFilter, statusFilter, onStatusFilter }) {
  const catLabel = useLocalizedCategoryLabel();
  const t = useT();
  const countBy = (cat) =>
    insights.filter((i) => i.category === cat && i.status !== 'dismissed' && i.status !== 'implemented').length;
  const activeTotal = insights.filter((i) => i.status !== 'dismissed' && i.status !== 'implemented').length;

  return (
    <Card
      pad={false}
      style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}
    >
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-3)', padding: 2, borderRadius: 7 }}>
        {[
          [
            'active',
            t('insights.filter.active', {
              n: insights.filter((i) => i.status !== 'dismissed' && i.status !== 'implemented').length,
            }),
          ],
          [
            'implemented',
            t('insights.filter.implemented', { n: insights.filter((i) => i.status === 'implemented').length }),
          ],
          ['dismissed', t('insights.filter.dismissed', { n: insights.filter((i) => i.status === 'dismissed').length })],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => onStatusFilter(k)}
            style={{
              padding: '5px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              background: statusFilter === k ? 'var(--surface)' : 'transparent',
              color: statusFilter === k ? 'var(--text)' : 'var(--text-dim)',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              boxShadow: statusFilter === k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 22, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <CategoryChip
          active={filter === 'all'}
          onClick={() => onFilter('all')}
          label={t('insights.filter.all', { n: activeTotal })}
          tone="accent"
        />
        {Object.values(INSIGHT_CATEGORIES).map((c) => {
          const n = countBy(c.id);
          if (n === 0) return null;
          return (
            <CategoryChip
              key={c.id}
              icon={c.icon}
              active={filter === c.id}
              onClick={() => onFilter(c.id)}
              label={`${catLabel(c)} · ${n}`}
              tone={c.tone}
            />
          );
        })}
      </div>
    </Card>
  );
}

function CategoryChip({ icon, label, active, onClick, tone = 'neutral' }) {
  const IconC = icon ? Icon[icon] || Icon.sparkle : null;
  const bg = active ? `color-mix(in oklch, var(--${tone}) 14%, transparent)` : 'var(--surface-2)';
  const color = active ? `var(--${tone})` : 'var(--text-soft)';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 11px',
        fontSize: 11.5,
        fontWeight: 600,
        background: bg,
        color,
        border: `1px solid ${active ? `color-mix(in oklch, var(--${tone}) 40%, transparent)` : 'var(--border)'}`,
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      {IconC && <IconC size={11} />}
      {label}
    </button>
  );
}

// ────────────────────────────── Insight card ──────────────────────────────

function InsightCard({ insight, expanded, onToggle, onAskMerlin }) {
  const catLabel = useLocalizedCategoryLabel();
  const t = useT();
  const cat = INSIGHT_CATEGORIES[insight.category] || {
    id: insight.category,
    label: insight.category,
    icon: 'sparkle',
    tone: 'accent',
  };
  const IconC = Icon[cat.icon] || Icon.sparkle;
  const statusTone = STATUS_TONE[insight.status] || 'accent';
  const statusLabel = t(`insights.status.${insight.status}`) || insight.status;
  const priorityTone = PRIORITY_TONE[insight.priority];
  const priorityLabel = t(`insights.priority.${insight.priority}`) || insight.priority;
  const riskTone = RISK_TONE[insight.risk] || 'info';
  // Implemented insights get a "completed" treatment \u2014 green left
  // border, "Realized" dollar label, and a "Completed <date>" line
  // under the title. Same treatment whether the user lands on this
  // card via the v2 Past-actions sub-tab or by filtering v1 to
  // status='implemented'.
  const isPast = insight.status === 'implemented';
  const completedLabel = isPast ? formatDaysAgo(insight.implementedAt, t) : null;

  const period = insight.impact.period ? t(`insights.period.${insight.impact.period}`) : null;
  const wbColor = '#10b981';
  const wellbeingPrimary = (() => {
    if (insight.impact_kind !== 'wellbeing') return null;
    const u = insight.impact.unit || '';
    const v = insight.impact.amount;
    if (u === '\u2605') return `+${v.toFixed(1)}\u2605`;
    return `\u2212${v} ${u}`;
  })();
  const dollarColor = isPast ? 'var(--ok)' : 'var(--accent)';
  const dollarSuffix = isPast ? (
    <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 3 }}>{t('insights.realized_inline')}</span>
  ) : (
    <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 3 }}>/{period || insight.impact.period}</span>
  );
  const impactLabel =
    insight.impact_kind === 'dollars' ? (
      <>
        <b style={{ fontSize: 16, color: dollarColor }}>{fmtDollars(insight.impact.amount)}</b>
        {dollarSuffix}
      </>
    ) : insight.impact_kind === 'hours' ? (
      <>
        <b style={{ fontSize: 16, color: dollarColor }}>
          {insight.impact.amount}
          {t('insights.hours_abbr')}
        </b>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 3 }}>
          {isPast ? t('insights.realized_inline') : `/${period || insight.impact.period}`}
        </span>
      </>
    ) : insight.impact_kind === 'wellbeing' ? (
      <>
        <b style={{ fontSize: 16, color: wbColor }}>{wellbeingPrimary}</b>
        {insight.impact.period && (
          <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 3 }}>/{insight.impact.period}</span>
        )}
      </>
    ) : (
      <b style={{ fontSize: 13, color: 'var(--accent)' }}>{t('insights.operational')}</b>
    );

  return (
    <Card
      pad={false}
      style={{
        overflow: 'hidden',
        borderLeft: isPast
          ? '3px solid color-mix(in oklch, var(--ok) 70%, transparent)'
          : `3px solid color-mix(in oklch, var(--${cat.tone}) 50%, transparent)`,
        transition: 'border-color .2s',
      }}
    >
      {/* Collapsed row */}
      <div
        onClick={onToggle}
        style={{
          padding: '14px 16px',
          display: 'grid',
          gridTemplateColumns: '36px 180px 1fr 180px 44px',
          gap: 14,
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'background .12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: `color-mix(in oklch, var(--${cat.tone}) 14%, transparent)`,
            color: `var(--${cat.tone})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconC size={16} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-dim)',
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
            }}
          >
            {catLabel(cat)}
          </div>
          <div>{impactLabel}</div>
          {insight.secondary_impact && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{insight.secondary_impact}</div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{insight.title}</div>
            {!isPast && <Pill tone={priorityTone}>{priorityLabel}</Pill>}
            {insight.ageDays <= 5 && insight.status === 'new' && (
              <Pill tone="accent">
                <Dot tone="accent" size={4} pulse /> {t('insights.new_pill')}
              </Pill>
            )}
            {isPast && completedLabel && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--ok)',
                }}
              >
                <Icon.check size={11} /> {t('insights.completed', { when: completedLabel })}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-dim)',
              lineHeight: 1.45,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {insight.summary}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <ConfidenceBar value={insight.confidence} />
          <Pill tone={statusTone}>{statusLabel}</Pill>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Icon.chevD
            size={13}
            style={{
              color: 'var(--text-dim)',
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform .18s',
            }}
          />
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          style={{
            padding: '4px 16px 16px 68px',
            background: 'var(--surface-2)',
            borderTop: '1px solid var(--border)',
          }}
        >
          {/* Past actions: journey strip + outcome block first, so the
              "what happened" story leads. Recommendations skip these
              and go straight to the stat tiles. */}
          {isPast && <JourneyStrip insight={insight} />}
          {isPast && insight.outcome && <OutcomeBlock outcome={insight.outcome} />}

          {/* Top stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
            <DetailStat
              label={t('insights.annual_impact')}
              value={
                insight.impact_kind === 'dollars'
                  ? fmtDollars(insight.impact.amount)
                  : insight.impact_kind === 'hours'
                    ? `${insight.impact.amount} ${t('insights.hours_word')}`
                    : t('insights.operational')
              }
              tone="accent"
            />
            <DetailStat
              label={t('insights.confidence')}
              value={`${Math.round(insight.confidence * 100)}%`}
              tone="info"
            />
            <DetailStat
              label={t('insights.risk')}
              value={t(`insights.risk.${insight.risk}`) || insight.risk}
              tone={riskTone}
            />
          </div>

          {/* Reasoning */}
          <Section title={t('insights.how_figured')}>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--text-soft)' }}>
              {insight.reasoning.map((r, i) => (
                <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 4 }}>
                  {r}
                </li>
              ))}
            </ol>
          </Section>

          {/* Data sources */}
          <Section title={t('insights.data_sources')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {insight.dataSources.map((s, i) => (
                <span
                  key={i}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    background: 'var(--surface)',
                    color: 'var(--text-soft)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>

          {/* Implementation */}
          <Section title={t('insights.implementation_plan')}>
            <div style={{ position: 'relative', marginTop: 8, paddingLeft: 22 }}>
              <div
                style={{ position: 'absolute', left: 8, top: 6, bottom: 6, width: 2, background: 'var(--border)' }}
              />
              {insight.implementation.map((p, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: 10 }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: -22,
                      top: 4,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: `color-mix(in oklch, var(--${cat.tone}) 16%, var(--surface))`,
                      color: `var(--${cat.tone})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      boxShadow: `inset 0 0 0 1.5px color-mix(in oklch, var(--${cat.tone}) 50%, transparent)`,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{p.what}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{p.when}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
            }}
          >
            {insight.status !== 'approved' && insight.status !== 'implemented' && (
              <button
                style={{
                  padding: '8px 14px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon.check size={12} /> {t('insights.approve_impl')}
              </button>
            )}
            <button
              onClick={() => onAskMerlin?.(`${t('insights.discuss_prompt')}: ${insight.title}`)}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon.sparkle size={12} /> {t('insights.discuss')}
            </button>
            {insight.status !== 'dismissed' && (
              <button
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('insights.dismiss')}
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 90 ? 'ok' : pct >= 75 ? 'info' : 'warn';
  const t = useT();
  return (
    <div style={{ width: 170 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.12,
          marginBottom: 3,
        }}
      >
        <span>{t('insights.confidence')}</span>
        <span style={{ color: `var(--${tone})`, fontFamily: 'var(--mono)' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `var(--${tone})` }} />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailStat({ label, value, tone }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[tone] ||
    'var(--text)';
  return (
    <div
      style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.12,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 3, textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

// ────────────────────────────── SLAs track ──────────────────────────────
// Live SLA scorecards: one card per SLA with status pill, current vs target,
// at-risk now, breaches MTD, 14-day sparkline, top contributing locations,
// and rule-based recommendations. Reads from public.slas + computes
// performance live from device_requests / device_service_sessions / etc.
// in slas-data.js.

const SLA_DOMAIN_ICON = {
  hygiene: 'people',
  comfort: 'hvac',
  air: 'air',
  supplies: 'supply',
  security: 'shield',
  compliance: 'shield',
};

const SLA_STATUS_TONE = {
  ok: 'ok',
  at_risk: 'warn',
  breach: 'risk',
  pending: 'off',
  low_sample: 'info',
};

const SLA_STATUS_LABEL_KEY = {
  ok: 'sla.status.ok',
  at_risk: 'sla.status.at_risk',
  breach: 'sla.status.breach',
  pending: 'sla.status.pending',
  low_sample: 'sla.status.low_sample',
};

// Render order maps status → priority. Breach first so the
// most-urgent SLAs are above the fold; "ok" last because they're the
// least-actionable for a manager scanning the page.
const SLA_STATUS_RANK = { breach: 0, at_risk: 1, low_sample: 2, pending: 3, ok: 4 };

function effectiveStatus(sla, perf) {
  if (!perf) return 'pending';
  const lowSample = perf.computable && perf.sample_size != null && perf.sample_size < SLA_LOW_SAMPLE_THRESHOLD;
  return lowSample ? 'low_sample' : perf.status || 'pending';
}

function SlasTrack({
  slas,
  perf,
  openAskBySlaId = {},
  loaded,
  windowSpec = '14d',
  windowDays = 14,
  onWindowChange,
  onAskMerlin,
}) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState('all');

  if (!loaded) {
    return (
      <Card style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AdaptivLoader size="sm" />
      </Card>
    );
  }
  if (!slas.length) {
    const ctaTemplate = t('sla.empty.cta', { bold: 'XBOLDX' });
    const [ctaPre, ctaPost = ''] = ctaTemplate.split('XBOLDX');
    return (
      <Card style={{ padding: 40, textAlign: 'center', color: 'var(--text-soft)', fontSize: 13.5, lineHeight: 1.55 }}>
        {t('sla.empty.title')}
        <br />
        <span style={{ color: 'var(--text-dim)' }}>
          {ctaPre}
          <b>{t('sla.empty.bold')}</b>
          {ctaPost}
        </span>
      </Card>
    );
  }

  // Hero rollup: how many on-target / at-risk / breach / pending across all SLAs.
  // Low-sample SLAs roll up under their own bucket rather than fueling a fake
  // "in breach" pill — same logic the per-card status downgrade uses.
  const counts = { ok: 0, at_risk: 0, breach: 0, pending: 0, low_sample: 0 };
  let breachesMtdSum = 0;
  let atRiskSum = 0;
  for (const sla of slas) {
    const p = perf[sla.id];
    if (!p) {
      counts.pending += 1;
      continue;
    }
    const eff = effectiveStatus(sla, p);
    counts[eff] = (counts[eff] || 0) + 1;
    if (p.computable && eff !== 'low_sample' && eff !== 'pending') {
      breachesMtdSum += p.breaches_mtd || 0;
      atRiskSum += p.at_risk || 0;
    }
  }

  // Sort by urgency (status rank) then by display_order as the
  // tiebreaker so SLAs in the same status keep operator-set order.
  const sorted = slas.slice().sort((a, b) => {
    const ra = SLA_STATUS_RANK[effectiveStatus(a, perf[a.id])] ?? 9;
    const rb = SLA_STATUS_RANK[effectiveStatus(b, perf[b.id])] ?? 9;
    if (ra !== rb) return ra - rb;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  // Apply the status filter pill. 'all' shows everything; specific
  // filters narrow to a single status bucket.
  const filtered =
    statusFilter === 'all'
      ? sorted
      : sorted.filter((sla) => {
          const eff = effectiveStatus(sla, perf[sla.id]);
          // Group "low_sample" + "pending" under a single "Pending" filter
          // since to a user they're both "no actionable signal yet".
          if (statusFilter === 'pending') return eff === 'pending' || eff === 'low_sample';
          return eff === statusFilter;
        });

  return (
    <>
      <SlasHero
        slaCount={slas.length}
        counts={counts}
        breachesMtd={breachesMtdSum}
        atRiskNow={atRiskSum}
        windowSpec={windowSpec}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <SlaStatusFilter counts={counts} value={statusFilter} onChange={setStatusFilter} />
        <div style={{ flex: 1 }} />
        <SlaWindowPicker value={windowSpec} onChange={onWindowChange} />
      </div>
      {filtered.length === 0 ? (
        <Card style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          {t('sla.bucket.empty', { bucket: statusFilter })}
        </Card>
      ) : (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 'var(--pad)' }}
        >
          {filtered.map((sla) => (
            <SlaCard
              key={sla.id}
              sla={sla}
              perf={perf[sla.id]}
              openAsk={openAskBySlaId[sla.id] || null}
              windowDays={windowDays}
              onAskMerlin={onAskMerlin}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Segmented control for the SLA performance lookback window. Pinned to
// the right of the status filter so the two pivots sit on one line.
// MTD is a soft option — sample size shrinks early in the month, so the
// low-sample guard kicks in on the 1st-3rd. That's correct behaviour:
// don't put a number on a 1-day month.
function SlaWindowPicker({ value, onChange }) {
  const opts = [
    { id: '7d', label: '7d' },
    { id: '14d', label: '14d' },
    { id: '30d', label: '30d' },
    { id: 'mtd', label: 'MTD' },
  ];
  return (
    <Card pad={false} style={{ flexShrink: 0, padding: 4, display: 'inline-flex', gap: 4 }}>
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange?.(o.id)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-dim)',
              border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`,
              borderRadius: 7,
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </Card>
  );
}

// Filter pill bar — matches the shape the Financial/Wellbeing track
// uses so the page feels consistent. Counts only show buckets that
// have at least one SLA, so a workspace with no breaches doesn't
// see a "Breach 0" pill.
function SlaStatusFilter({ counts, value, onChange }) {
  const t = useT();
  const buckets = [
    {
      id: 'all',
      label: t('sla.filter.all'),
      n:
        (counts.ok || 0) +
        (counts.at_risk || 0) +
        (counts.breach || 0) +
        (counts.low_sample || 0) +
        (counts.pending || 0),
      tone: 'info',
    },
    { id: 'breach', label: t('sla.status.breach'), n: counts.breach || 0, tone: 'risk' },
    { id: 'at_risk', label: t('sla.status.at_risk'), n: counts.at_risk || 0, tone: 'warn' },
    { id: 'ok', label: t('sla.status.ok'), n: counts.ok || 0, tone: 'ok' },
    {
      id: 'pending',
      label: t('sla.status.pending_short'),
      n: (counts.pending || 0) + (counts.low_sample || 0),
      tone: 'off',
    },
  ];
  return (
    <Card pad={false} style={{ flexShrink: 0, padding: 4, display: 'inline-flex', alignSelf: 'flex-start', gap: 4 }}>
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
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : disabled ? 'var(--text-faint)' : 'var(--text-dim)',
              border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`,
              borderRadius: 7,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {b.label}
            <span
              style={{
                padding: '1px 6px',
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
    </Card>
  );
}

function SlasHero({ slaCount, counts, breachesMtd, atRiskNow, windowSpec = '14d' }) {
  const t = useT();
  const tone = counts.breach > 0 ? 'risk' : counts.at_risk > 0 ? 'warn' : 'ok';
  const win = windowLabel(windowSpec).toLowerCase();
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(420px 200px at 92% 0%, color-mix(in oklch, #2185D0 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon.shield size={13} style={{ color: '#2185D0' }} />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            {t('sla.hero.eyebrow', { window: win })}
          </span>
          <Pill tone={tone}>
            {counts.breach > 0
              ? t('sla.hero.in_breach', { n: counts.breach })
              : counts.at_risk > 0
                ? t('sla.hero.at_risk', { n: counts.at_risk })
                : t('sla.hero.all_on_target')}
          </Pill>
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {t(slaCount === 1 ? 'sla.hero.title_one' : 'sla.hero.title_many', {
            n: slaCount,
            at_risk: atRiskNow,
            breaches: breachesMtd,
          })}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 720 }}>
          {t('sla.hero.body', { window: win })}
        </p>
      </div>
    </Card>
  );
}

// Below this many samples, the % isn't trustworthy yet — render a
// "low sample" badge instead of a misleading current-% number. Threshold
// is conservative; managers should not chase a target derived from <5
// data points.
const SLA_LOW_SAMPLE_THRESHOLD = 5;

function SlaCard({ sla, perf, openAsk, windowDays = 14, onAskMerlin }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // Effective status — downgrade to 'pending' when sample size is tiny
  // even though the computer happily produced a number, so the UI doesn't
  // show "Breach" because of one stale closed request from 14 days ago.
  const lowSample = perf?.computable && perf?.sample_size != null && perf.sample_size < SLA_LOW_SAMPLE_THRESHOLD;
  const status = lowSample ? 'low_sample' : perf?.status || 'pending';
  const tone = SLA_STATUS_TONE[status] || 'off';
  const label = t(SLA_STATUS_LABEL_KEY[status] || 'sla.status.pending_short');
  const icon = SLA_DOMAIN_ICON[sla.domain] || 'sparkle';
  const IconC = Icon[icon] || Icon.sparkle;

  // Click-to-open behaviour for the agent ask. Dispatches a global
  // event picked up by App.jsx to open the chat on the Activity tab,
  // where merlin_asks pending stack puts the new ask at the top.
  const openChatToAsk = (e) => {
    e?.stopPropagation();
    try {
      window.dispatchEvent(
        new CustomEvent('merlin:open-chat', {
          detail: { tab: 'activity', focusAskId: openAsk?.id || null },
        }),
      );
    } catch {}
  };

  return (
    <Card pad={false}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {/* Header: name + status pill */}
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              flexShrink: 0,
              background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconC size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{sla.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
              {t('sla.card.target_domain', { pct: Number(sla.target_pct).toFixed(0), domain: sla.domain })}
              {sla.owner_label && (
                <>
                  {' '}
                  · {t('sla.card.owner_word')}{' '}
                  <span style={{ color: 'var(--text-soft)', fontWeight: 600 }}>{sla.owner_label}</span>
                </>
              )}
            </div>
            {(() => {
              // Show the contractor company an SLA is held against (counterparty).
              const cp = Array.isArray(sla.counterparty) ? sla.counterparty[0] : sla.counterparty;
              if (cp?.kind !== 'contractor' || !cp?.name) return null;
              return (
                <div style={{ marginTop: 5 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
                      color: 'var(--accent)',
                      border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                      borderRadius: 999,
                      maxWidth: '100%',
                    }}
                  >
                    <Icon.people size={10} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cp.name}
                    </span>
                  </span>
                </div>
              );
            })()}
          </div>
          {openAsk && (
            <button
              onClick={openChatToAsk}
              title={t('sla.card.ask_pending_tooltip')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.1,
                background: 'color-mix(in oklch, var(--accent) 14%, transparent)',
                color: 'var(--accent)',
                border: '1px solid color-mix(in oklch, var(--accent) 35%, transparent)',
                borderRadius: 999,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              <Icon.sparkle size={9} /> {t('sla.card.ask_pending')}
            </button>
          )}
          <Pill tone={tone}>
            <Dot tone={tone} size={5} pulse={status === 'at_risk' || status === 'breach'} /> {label}
          </Pill>
        </div>

        {/* Body: current %, sparkline, KPIs */}
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}
            >
              {t('sla.card.current')}
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: lowSample ? 'var(--text-dim)' : 'var(--text)',
                  lineHeight: 1,
                  fontFamily: 'var(--mono)',
                }}
              >
                {perf?.computable === false || perf?.current == null || lowSample ? '—' : `${perf.current}%`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/ {Number(sla.target_pct).toFixed(0)}%</span>
            </div>
            {perf?.sample_size != null && (
              <div style={{ marginTop: 4, fontSize: 10.5, color: lowSample ? 'var(--warn)' : 'var(--text-dim)' }}>
                {lowSample
                  ? t(perf.sample_size === 1 ? 'sla.card.low_sample_one' : 'sla.card.low_sample_many', {
                      n: perf.sample_size,
                      days: windowDays,
                      threshold: SLA_LOW_SAMPLE_THRESHOLD,
                    })
                  : t(perf.sample_size === 1 ? 'sla.card.samples_one' : 'sla.card.samples_many', {
                      n: perf.sample_size.toLocaleString(),
                      days: windowDays,
                    })}
              </div>
            )}
          </div>
          <Sparkline trend={perf?.trend || []} target={Number(sla.target_pct)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: '1px solid var(--border)' }}>
          <SlaKpi
            label={t('sla.kpi.at_risk_now')}
            value={perf?.at_risk}
            tone={(perf?.at_risk || 0) > 0 ? 'warn' : 'off'}
          />
          <SlaKpi
            label={t('sla.kpi.breaches_mtd')}
            value={perf?.breaches_mtd}
            tone={(perf?.breaches_mtd || 0) > 0 ? 'risk' : 'off'}
            divider
          />
        </div>
      </button>

      {expanded && <SlaCardExpanded sla={sla} perf={perf} windowDays={windowDays} onAskMerlin={onAskMerlin} />}
    </Card>
  );
}

function SlaKpi({ label, value, tone, divider }) {
  const color =
    { ok: 'var(--ok)', warn: 'var(--warn)', risk: 'var(--risk)', off: 'var(--text-dim)' }[tone] || 'var(--text)';
  return (
    <div style={{ padding: '10px 14px', borderLeft: divider ? '1px solid var(--border)' : 'none' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 3, fontSize: 18, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>
        {value == null ? '—' : value.toLocaleString()}
      </div>
    </div>
  );
}

function Sparkline({ trend, target }) {
  const t = useT();
  if (!trend || trend.length === 0) return <div style={{ minHeight: 48 }} />;
  const W = 200,
    H = 48,
    P = 4;
  const points = trend.map((d) => d.pct);
  // Y: 0..100 mapped to H..0
  const xStep = (W - 2 * P) / Math.max(1, trend.length - 1);
  const xy = points.map((v, i) => {
    if (v == null) return null;
    const y = H - P - (v / 100) * (H - 2 * P);
    const x = P + i * xStep;
    return [x, y];
  });
  const valid = xy.filter(Boolean);
  if (valid.length < 2)
    return (
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', alignSelf: 'flex-end' }}>{t('sla.spark.not_enough')}</div>
    );
  const path = valid.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  // Target line.
  const targetY = H - P - (target / 100) * (H - 2 * P);
  return (
    <svg width={W} height={H} style={{ alignSelf: 'flex-end' }}>
      <line
        x1={P}
        y1={targetY}
        x2={W - P}
        y2={targetY}
        stroke="var(--text-faint)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <path d={path} fill="none" stroke="#2185D0" strokeWidth="1.5" />
      {valid.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.5} fill="#2185D0" />
      ))}
    </svg>
  );
}

function SlaCardExpanded({ sla, perf, windowDays = 14, onAskMerlin }) {
  const t = useT();
  const desc = sla?.config?.description;
  // Fire the AI-recs call only on expand. Rule-based recs render
  // immediately below; the AI section is additive, not a replacement,
  // so the page never has an empty state while Haiku thinks.
  const aiRecs = useAiSlaRecommendations(sla, perf, perf?.computable !== false);
  return (
    <div
      style={{
        padding: '12px 16px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {desc && <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>{desc}</div>}

      {perf?.computable === false ? (
        <div
          style={{
            padding: 10,
            background: 'color-mix(in oklch, var(--text-dim) 8%, transparent)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--text-soft)',
            lineHeight: 1.5,
          }}
        >
          {(perf?.recommendations || []).map((r, i) => (
            <div key={i} style={{ marginTop: i ? 4 : 0 }}>
              · {r}
            </div>
          ))}
        </div>
      ) : (
        <>
          {perf?.contributors?.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.15,
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  marginBottom: 4,
                }}
              >
                {t('sla.expanded.contributors', { days: windowDays })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {perf.contributors.map((c) => (
                  <Pill key={c.location_id} tone="warn">
                    <span>{c.name || c.location_id}</span>
                    <span style={{ marginLeft: 6, fontWeight: 700 }}>{c.count}</span>
                  </Pill>
                ))}
              </div>
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                marginBottom: 4,
              }}
            >
              {t('sla.expanded.recommendations')}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              {(perf?.recommendations || []).map((r, i) => (
                <li key={i} style={{ marginTop: i ? 4 : 0 }}>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Merlin's take — AI-generated recs on top of the rule-based
              ones above. Loading / error / empty states all handle gracefully
              — the rule-based block above always carries the page so the
              demo never has a blank moment. */}
          <div
            style={{
              padding: 10,
              background: 'color-mix(in oklch, var(--accent) 6%, transparent)',
              border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)',
              borderRadius: 7,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 6,
              }}
            >
              <Icon.sparkle size={11} /> {t('sla.expanded.merlin_take')}
              {aiRecs.loading && (
                <span
                  style={{
                    marginLeft: 4,
                    color: 'var(--text-dim)',
                    textTransform: 'none',
                    fontWeight: 500,
                    letterSpacing: 0,
                  }}
                >
                  {t('sla.expanded.thinking')}
                </span>
              )}
            </div>
            {aiRecs.recs?.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55 }}>
                {aiRecs.recs.map((r, i) => (
                  <li key={i} style={{ marginTop: i ? 4 : 0 }}>
                    {r}
                  </li>
                ))}
              </ul>
            ) : aiRecs.loading ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                {t('sla.expanded.drafting')}
              </div>
            ) : aiRecs.error ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{t('sla.expanded.error')}</div>
            ) : null}
          </div>

          {onAskMerlin && (
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAskMerlin(
                    t('sla.expanded.dig_deeper_prompt', {
                      name: sla.name,
                      current: perf.current,
                      target: sla.target_pct,
                    }),
                  );
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  cursor: 'pointer',
                }}
              >
                {t('sla.expanded.dig_deeper')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
