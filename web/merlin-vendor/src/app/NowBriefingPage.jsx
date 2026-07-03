// MONITOR → Now. Alternative landing page that surfaces decisions
// (not dashboards) — KPI strip + 12-hour forecast + "Merlin asks"
// decision cards + today-at-a-glance side rail. Built off JB's
// 2026-05-28 design brief.
//
// Data sources: real where they exist already (Merlin asks via
// useEventsForBuilding, SLA compliance via useSlaPerformance, device
// fleet via useDevices, active incidents via the incidents prop).
// Forecast + routes status + shift handover are plausible
// placeholders for now — swap in real sources as they land.

import React, { useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Card, AdaptivLoader, MerlinAvatar } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useNowGlance } from './queries/briefing.ts';
import { useActiveOrg } from './org-data.js';
import { useEventsForBuilding, resolveEvent } from './events.js';
import { useLatestAgentActions, useRecentResolvedAgentRuns } from './agent-runs.js';
import { useSlaPerformance, useContractorAnalytics } from './slas-data.js';
import { useDevices } from './devices-store.js';
import { useServicingRollup, useServicingHistoryMap, synthTrend } from './servicing-data.js';
import { SERVICING_GROUP_DOMAINS, SERVICING_DOMAIN_META, domainAccent, domainSoft } from './servicing-areas.js';
import { useSL } from './servicing-i18n.js';
import { useTranslatedText } from './event-translations.js';
import { useFormatRelative, useFormatCurrency } from './locale-format.js';
import { ENV_FORECAST } from './predict-forecast.js';
import { TrendSpark, RadialGauge, MultiTrendChart, MiniSpark } from './now-charts.jsx';
import { ServiceBubbleCard } from './now-bubbles.jsx';

// Forecast preview tiles for demo buildings that don't carry live airq/
// occupancy/cold-chain telemetry — mirrors the full ANTICIPATE Forecast page
// (ENV_FORECAST) so the NOW strip isn't blank. Live pilots (IMF) get the real
// telemetry-derived tiles only, and stay empty until their sensors report.
const FORECAST_PREVIEW = ENV_FORECAST.map((f) => {
  const [value, ...unit] = String(f.peak).split(' ');
  return {
    label: f.label,
    sub: f.where,
    value,
    unit: unit.join(' '),
    pill: f.risk ? 'BREACH RISK' : null,
    trend: f.risk ? 'risk' : 'info',
    // Distinct shape per metric so no two forecast tiles read alike: CO₂ climbs
    // to a peak, building load humps to midday then settles, occupancy peaks.
    spark: f.risk ? 'risk' : { co2: 'climb', load: 'hump', occ: 'peak' }[f.key] || 'info',
  };
});

const AGENT_PRETTY = {
  cleaning: 'CLEANING',
  hvac: 'HVAC',
  space: 'SPACE',
  supply: 'SUPPLY',
  compliance: 'COMPLIANCE',
  energy: 'ENERGY',
  security: 'SECURITY',
  servicing: 'SERVICING',
  'cold-chain': 'COLD-CHAIN',
  'pharmacy-temp': 'PHARMACY',
  'predictive-maintenance': 'PREDICTIVE',
  'asset-tracking': 'ASSETS',
  parking: 'PARKING',
  'crowd-flow': 'CROWD',
  'concession-demand': 'CONCESSIONS',
  'incident-choreography': 'CHOREOGRAPHY',
};

function prettyAgent(agentId) {
  return AGENT_PRETTY[agentId] || (agentId ? agentId.replace(/-/g, ' ').toUpperCase() : 'MERLIN');
}

function formatNowTime() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// "Today at a glance" rail data — routes status + shift handover, building-scoped
// and real (now_today_glance RPC). Refreshes each minute so the night→day
// summary and route progress stay live.
function useTodayGlance(buildingId) {
  // RPC + 60s polling now live in the query hook.
  const { data: glance = null } = useNowGlance(buildingId);
  return glance;
}

// Compact number+label stat for the "Today at a glance" routes rollup.
function GlanceStat({ value, label, tone }) {
  const color = tone === 'ok' ? '#10b981' : tone === 'warn' ? '#f59e0b' : 'var(--text)';
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          marginTop: 3,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function NowBriefingPage({ building, incidents, onView, onOpenChat }) {
  const t = useT();
  const session = useSession();
  const orgId = session?.organizationId || null;

  // ─── Real data hooks ──────────────────────────────────────────────
  // Pull the SAME awaiting-human asks the chat's decisions list uses
  // (processingState + limit match useMerlinAsks) so the "Decisions" bubble
  // count matches the chat ("N decisions waiting"). A bare limit:50 window
  // filtered down to asks under-counted (showed 20 when 37 were pending).
  const buildingEvents = useEventsForBuilding(orgId, building?.id, {
    includeResolved: false,
    processingState: 'awaiting_human',
    limit: 200,
  });
  const pendingAsks = useMemo(
    () => buildingEvents.filter((e) => e.decision === 'ask' && !e.ask_resolution),
    [buildingEvents],
  );
  const slaPerf = useSlaPerformance(orgId);
  const { devices, ready: devicesReady } = useDevices(building);
  const servicing = useServicingRollup(building, orgId);
  const fmtRel = useFormatRelative();
  const fmtCurrency = useFormatCurrency();
  const sl = useSL();

  // Contractor My Day: the owner KPI strip (energy/device/incidents) + building
  // forecast aren't a contractor's briefing — swap in their portfolio KPIs and
  // drop the owner-only strips. The Merlin asks below are already theirs.
  const activeOrg = useActiveOrg();
  const isContractor = activeOrg?.kind === 'contractor';
  const contractor = useContractorAnalytics(isContractor ? orgId : null);
  // Contractor right rail: a CONTAINED servicing roll-up for the client building
  // (only the contractor's contracted lines; viewer-aware RPC, mig 214) — drives
  // the "Service status" glance card that replaces the owner-oriented Routes /
  // Shift-handover placeholders for contractors.
  const contractorServicing = useServicingRollup(building, isContractor ? orgId : null, { viewer: true });
  // Per-line adherence history (mig 198) → real sparklines + the trend chart.
  // Org-scoped, so it serves both the contractor bubbles AND the owner's bubble
  // cloud (PM parity) — the hook keys history by domain for whichever org is active.
  const servicingHistory = useServicingHistoryMap(orgId);

  // Priorities-focus mode: blow the bubble "Priorities" card up to fill the page
  // and hide the surrounding cards. Default OFF — clicking Now lands on the full
  // all-cards briefing (KPIs + priorities + forecast + services + asks); the
  // toggle in the card header blows the bubble map up to fill the page.
  const [bubbleFocus, setBubbleFocus] = React.useState(false);

  // Owner (property-manager) parity: lead with the bubble cloud only when the
  // building actually has a servicing program (Meridian / PSG / FEB / Hemisphere).
  // Owners with no servicing data (the IMF live pilot, not-yet-onboarded sites)
  // keep their KPI + forecast dashboard so they never land on an empty cloud.
  // `bubbleLed` = the page is headed by the bubble cloud (contractor always, owner
  // when it has data); it gates focus-mode capping + which sections hide.
  const ownerBubbles = !isContractor && servicing.loaded && servicing.overall.total > 0;
  const bubbleLed = isContractor || ownerBubbles;

  // Recently handled by Merlin — same real sources My Day uses: per-agent
  // action tables (useLatestAgentActions) + recently-resolved agent_runs
  // (useRecentResolvedAgentRuns), scoped to the building, bounded to a 48h
  // recency window, newest-first. Fills the "Merlin asks" column on a good
  // day so the page reads as alive (autopilot) instead of empty.
  const latestActions = useLatestAgentActions(orgId, building?.id);
  const resolvedAsks = useRecentResolvedAgentRuns(orgId, building?.id, 12);
  const handledItems = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const merged = [...Object.values(latestActions || {}), ...(resolvedAsks || [])];
    return merged
      .filter((a) => a.applied_at && new Date(a.applied_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
      .slice(0, 6);
  }, [latestActions, resolvedAsks]);

  // ─── KPI derivations ──────────────────────────────────────────────
  // SLA compliance — blended live % across the org's SLAs. NOTE:
  // useSlaPerformance returns { slas, perf } (perf keyed by sla.id), NOT
  // `rows` — the old code read slaPerf.rows (undefined), so this always fell
  // through to "—". Read the real shape.
  const slaCompliance = useMemo(() => {
    const slas = slaPerf.slas || [];
    const perf = slaPerf.perf || {};
    if (slas.length === 0) return { value: null, target: 95, loaded: slaPerf.loaded };
    const target = Math.round(slas.reduce((s, x) => s + (Number(x.target_pct) || 95), 0) / slas.length);
    const computable = slas.map((x) => perf[x.id]).filter((pp) => pp && pp.current != null);
    if (computable.length === 0) return { value: null, target, loaded: slaPerf.loaded };
    const value = Math.round(computable.reduce((s, pp) => s + pp.current, 0) / computable.length);
    return { value, target, loaded: slaPerf.loaded };
  }, [slaPerf]);

  // Real SLA-compliance trend for the KPI sparkline: the per-service-line
  // adherence history (the same demo_servicing_history series behind the
  // Services trends) blended into one org-wide line, point-by-point. This is
  // ACTUAL history — not a stylised shape. Null until ≥2 points exist.
  const slaSeries = useMemo(() => {
    const lines = SERVICING_GROUP_DOMAINS.map((k) => servicingHistory[k]).filter(
      (a) => Array.isArray(a) && a.length >= 2,
    );
    if (!lines.length) return null;
    const len = Math.min(...lines.map((a) => a.length));
    if (len < 2) return null;
    const out = [];
    for (let i = 0; i < len; i++) {
      const slice = lines.map((a) => a[a.length - len + i]).filter((v) => Number.isFinite(v));
      if (!slice.length) continue;
      out.push(Math.round(slice.reduce((s, v) => s + v, 0) / slice.length));
    }
    return out.length >= 2 ? out : null;
  }, [servicingHistory]);

  const activeIncidents = useMemo(() => {
    const list = (incidents || []).filter((i) => !i._humanHandled && !i._autoHandled);
    const critical = list.filter((i) => i.priority === 'critical').length;
    // Real sparkline: incident arrivals per bucket over the last hour, from each
    // incident's spawn time — so the card plots ACTUAL data instead of the generic
    // placeholder squiggle. Non-cumulative (varies up/down) so it never wrongly
    // implies incidents are monotonically climbing. Falls back to null (→ the
    // directional flavour shape) when no spawn times are available (e.g. live
    // simulator orgs whose incidents don't carry `_spawnedAt`).
    const now = Date.now();
    const WINDOW = 60 * 60_000;
    const BUCKETS = 10;
    const spawns = list.map((i) => i._spawnedAt).filter((t) => Number.isFinite(t) && t > now - WINDOW);
    const series =
      spawns.length >= 2
        ? Array.from({ length: BUCKETS }, (_, b) => {
            const lo = now - WINDOW + (b * WINDOW) / BUCKETS;
            const hi = now - WINDOW + ((b + 1) * WINDOW) / BUCKETS;
            return spawns.filter((t) => t > lo && t <= hi).length;
          })
        : null;
    return { total: list.length, critical, series };
  }, [incidents]);

  const deviceFleet = useMemo(() => {
    if (!devicesReady) return { pct: null, healthy: 0, total: 0 };
    const total = devices.length;
    if (total === 0) return { pct: null, healthy: 0, total: 0 };
    const healthy = devices.filter(
      (d) => d.status === 'ok' || d.status === 'online' || d.status === 'healthy' || !d.status,
    ).length;
    return { pct: Math.round((healthy / total) * 100), healthy, total };
  }, [devices, devicesReady]);

  // Forecast tiles — derived from THIS building's real sensor telemetry
  // (air quality, occupancy, cold-chain) so the strip is always org-specific
  // instead of the old hardcoded Meridian rooms. Empty → neutral state.
  const forecastTiles = useMemo(() => {
    if (!devicesReady) return [];
    const pretty = (id) => {
      const segs = String(id || '')
        .split('-')
        .slice(-2)
        .filter(Boolean);
      const s = segs.join(' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return s || 'Building-wide';
    };
    const tiles = [];
    const airq = devices.filter((d) => d.kind === 'airq' && d.telemetry?.co2_ppm != null);
    if (airq.length) {
      const worst = airq.slice().sort((a, b) => b.telemetry.co2_ppm - a.telemetry.co2_ppm)[0];
      const co2 = Math.round(worst.telemetry.co2_ppm);
      tiles.push({
        label: 'CO₂',
        sub: pretty(worst.location_id),
        value: String(co2),
        unit: 'ppm',
        trend: co2 >= 1200 ? 'risk' : 'info',
        spark: co2 >= 1200 ? 'risk' : 'climb',
        pill: co2 >= 1200 ? 'BREACH RISK' : null,
      });
      const pm = airq.filter((d) => d.telemetry?.pm25 != null).sort((a, b) => b.telemetry.pm25 - a.telemetry.pm25)[0];
      if (pm)
        tiles.push({
          label: 'PM2.5',
          sub: pretty(pm.location_id),
          value: String(Math.round(pm.telemetry.pm25)),
          unit: 'µg/m³',
          trend: 'info',
          spark: 'info',
        });
    }
    const occ = devices
      .filter((d) => d.kind === 'occupancy' && d.telemetry?.occupancy_pct != null)
      .sort((a, b) => b.telemetry.occupancy_pct - a.telemetry.occupancy_pct)[0];
    if (occ)
      tiles.push({
        label: 'OCCUPANCY',
        sub: pretty(occ.location_id),
        value: String(Math.round(occ.telemetry.occupancy_pct)),
        unit: '%',
        trend: 'info',
        spark: 'peak',
      });
    const cold = devices
      .filter((d) => d.kind === 'smart_logger_basic' && d.telemetry?.temp_c != null)
      .sort((a, b) => b.telemetry.temp_c - a.telemetry.temp_c)[0];
    if (cold) {
      const tc = cold.telemetry.temp_c;
      tiles.push({
        label: 'COLD-CHAIN',
        sub: pretty(cold.location_id),
        value: String(tc),
        unit: '°C',
        trend: tc > 8 ? 'risk' : 'info',
        spark: tc > 8 ? 'risk' : 'info',
        pill: tc > 8 ? 'EXCURSION' : null,
      });
    }
    // Demo buildings without live env telemetry fall back to the forecast
    // preview so the strip reads populated; the IMF live pilot stays empty.
    if (!tiles.length && building?.variant !== 'imf') return FORECAST_PREVIEW;
    return tiles.slice(0, 4);
  }, [devices, devicesReady, building?.variant]);

  // Energy vs budget — no live energy meter yet. Demo buildings show a
  // representative figure (% under budget + $ saved YTD) so the card reads
  // populated, matching the forecast preview's treatment. The IMF live pilot
  // stays honest ("gathering data…") until a real energy feed exists.
  const energyVsBudget = building?.variant === 'imf' ? { pct: null, savedYtd: null } : { pct: 9, savedYtd: '$34k' };

  // Contractor briefing copy — building/client-scoped headline + a subtitle
  // that reflects what's actually on the page (decisions + live service health),
  // not the owner's "decision in 30 minutes" framing.
  const headline = isContractor
    ? `${building?.name || sl('Operations', 'Opérations')} — ${sl('operations briefing', 'briefing opérationnel')}`
    : t('now.headline');
  const subtitle = isContractor
    ? sl(
        'Decisions awaiting you, plus live service health across your contracted lines.',
        'Décisions en attente et état du service en direct sur vos prestations.',
      )
    : t('now.subtitle');

  // Greet the operator by first name in the headline. Skip the email fallback
  // (session.name degrades to the email when no display name is set) — a bare
  // address only reads well with a real given name.
  const firstName = (() => {
    const n = (session?.name || '').trim();
    if (!n || n.includes('@')) return '';
    return n.split(/\s+/)[0];
  })();

  // "Today at a glance" rail (owner only): live routes status + shift handover.
  const glance = useTodayGlance(building?.id);
  const glanceRoutes = glance?.routes || null;
  const glanceShift = glance?.shift || null;

  // Twin-hero data: the service-health summary line under the big adherence %.
  const ov = contractorServicing.overall;
  const byTop = contractorServicing.byTop || {};
  const serviceHeroSub = !contractorServicing.loaded
    ? sl('loading…', 'chargement…')
    : ov.total === 0
      ? sl('no servicing yet', 'aucun service pour le moment')
      : `${sl('overall', 'global')}${ov.overdue > 0 ? ` · ${ov.overdue} ${sl('overdue', 'en retard')}` : ` · ${sl('on track', 'à jour')}`}${ov.open > 0 ? ` · ${ov.open} ${sl('open', 'ouv.')}` : ''}`;

  // One adherence series per contracted line (real history → synthTrend fallback,
  // which ends at the real current value). Drives the trend chart + tile sparks.
  const chartLines = SERVICING_GROUP_DOMAINS.filter((k) => byTop[k]).map((k) => {
    const real = servicingHistory[k];
    return {
      key: k,
      color: domainAccent(k),
      adh: byTop[k].adh,
      data: real && real.length >= 2 ? real : synthTrend(k, byTop[k].adh ?? 90, 14),
    };
  });

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--surface)',
        // A solid 12px margin on every side. The inner padding owns the full
        // 12px (don't rely on the scrollbar gutter for it — overlay scrollbars,
        // e.g. macOS, reserve 0 width so `stable both-edges` contributes nothing
        // and the margin would otherwise collapse to 6px). `stable both-edges`
        // stays only to keep a classic scrollbar from shifting content.
        scrollbarGutter: 'stable both-edges',
      }}
    >
      {/* In bubble focus mode the column is CAPPED to the viewport (height:100%
          + overflow:hidden) so the bubble card can't grow past the screen — the
          cloud then shrinks to fit inside it. Everywhere else it scrolls. Applies
          to both the contractor and owner (PM) bubble-led views. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 12,
          boxSizing: 'border-box',
          ...(bubbleLed && bubbleFocus ? { height: '100%', overflow: 'hidden' } : { minHeight: '100%' }),
        }}
      >
        {/* Eyebrow + headline */}
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            01 · {t('now.eyebrow')}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: -0.02,
                lineHeight: 1.15,
                color: 'var(--text)',
              }}
            >
              {firstName && !isContractor && <span style={{ color: 'var(--accent)' }}>{firstName} — </span>}
              {headline}
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: 'var(--text-faint)',
                flexShrink: 0,
                marginTop: 6,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 0 3px color-mix(in oklch, #10b981 20%, transparent)',
                }}
              />
              {t('now.updated')} {formatNowTime()}
            </div>
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13.5,
              color: 'var(--text-soft)',
              lineHeight: 1.5,
              maxWidth: 760,
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Contractor: twin hero (decisions + service health) above a slim
            secondary portfolio strip. Owner: the building-owner KPI grid. */}
        {isContractor ? (
          <>
            {!bubbleFocus && (
              <>
                {/* Decisions · Service health · Contracts · Run-rate · Proposals —
                    all five on one row. */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                    gap: 12,
                    alignItems: 'stretch',
                  }}
                >
                  <HeroStat
                    eyebrow={sl('DECISIONS', 'DÉCISIONS')}
                    value={pendingAsks.length}
                    color={pendingAsks.length ? '#f59e0b' : '#10b981'}
                    sub={
                      pendingAsks.length
                        ? sl('need your approval', 'en attente de validation')
                        : sl('all clear — Merlin has it', 'tout est clair — Merlin gère')
                    }
                    onClick={() => onView?.('activity')}
                  />
                  <ServiceHealthHero
                    eyebrow={sl('SERVICE HEALTH', 'ÉTAT DU SERVICE')}
                    pct={contractorServicing.loaded ? ov.adh : null}
                    color={adhColor(ov.adh)}
                    sub={serviceHeroSub}
                    onClick={() => onView?.('services')}
                  />
                  <KpiCard
                    label={sl('ACTIVE CONTRACTS', 'CONTRATS ACTIFS')}
                    value={contractor.metrics.activeContracts}
                    unit=""
                    sub={sl('across your clients', 'chez vos clients')}
                    tone="ok"
                    trend="up"
                    onClick={() => onView?.('contracts')}
                  />
                  <KpiCard
                    label={sl('MONTHLY RUN-RATE', 'REVENU MENSUEL')}
                    value={fmtCurrency(contractor.metrics.monthlyRunRate || 0, contractor.metrics.currency)}
                    unit=""
                    sub={sl('recurring revenue', 'revenu récurrent')}
                    tone="ok"
                    trend="up"
                    onClick={() => onView?.('contracts')}
                  />
                  <KpiCard
                    label={sl('PROPOSALS PENDING', 'PROPOSITIONS EN ATTENTE')}
                    value={contractor.metrics.proposalsPending}
                    unit=""
                    sub={
                      contractor.metrics.proposalsPending
                        ? sl('awaiting client decision', 'en attente du client')
                        : sl('none open', 'aucune en cours')
                    }
                    tone={contractor.metrics.proposalsPending ? 'warn' : 'ok'}
                    trend="up"
                    onClick={() => onView?.('proposals')}
                  />
                </div>
                {chartLines.length > 0 && <ServiceTrendCard lines={chartLines} onOpen={() => onView?.('services')} />}
              </>
            )}
            <ServiceBubbleCard
              rows={contractorServicing.rows}
              byTop={byTop}
              pendingCount={pendingAsks.length}
              proposals={contractor.metrics.proposalsPending || 0}
              contracts={contractor.metrics.activeContracts || 0}
              history={servicingHistory}
              big={bubbleFocus}
              onToggleFocus={() => setBubbleFocus((f) => !f)}
              onOpen={() => onView?.('services')}
              onOpenServiceLine={onView}
              onOpenChat={onOpenChat}
              building={building}
              incidents={incidents}
            />
          </>
        ) : (
          // Owner (property-manager) view — full parity with the contractor: the
          // bubble cloud is the headline (focus mode by default), and the owner KPI
          // grid tucks behind the same focus toggle. The bubbles are built from the
          // owner's org-wide servicing roll-up (all service lines), not the
          // contractor's viewer-contained one. Proposals/contracts are contractor
          // business bubbles → 0 for the owner so they don't render.
          <>
            {(!ownerBubbles || !bubbleFocus) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                <>
                  <KpiCard
                    label="SLA COMPLIANCE"
                    value={slaCompliance.value != null ? slaCompliance.value : '—'}
                    unit={slaCompliance.value != null ? '%' : ''}
                    sub={
                      slaCompliance.value != null
                        ? `vs. ${slaCompliance.target}% target`
                        : slaCompliance.loaded
                          ? 'gathering data…'
                          : 'loading…'
                    }
                    tone={
                      slaCompliance.value == null ? 'ok' : slaCompliance.value >= slaCompliance.target ? 'ok' : 'warn'
                    }
                    trend="up-slight"
                    data={slaSeries}
                    onClick={() => onView?.('insights-slas')}
                  />
                  <KpiCard
                    label="ACTIVE INCIDENTS"
                    value={activeIncidents.total}
                    unit=""
                    sub={
                      activeIncidents.critical > 0
                        ? pendingAsks.length === 0
                          ? `${activeIncidents.critical} critical · Merlin handling`
                          : `${activeIncidents.critical} critical`
                        : 'none critical'
                    }
                    // Don't alarm (red) when nothing's in the human's queue — if no
                    // asks are pending, Merlin is handling the criticals itself, so
                    // keep the card calm and let the sub carry the "Merlin handling"
                    // note. Red is reserved for when a decision is actually waiting.
                    tone={pendingAsks.length === 0 ? 'ok' : activeIncidents.critical > 0 ? 'risk' : 'ok'}
                    // Real arrival-rate series (last hour) when we have spawn times;
                    // otherwise the 'info' flavour shape — neutral/variable, NOT a
                    // rising line that would wrongly imply incidents are climbing.
                    trend="info"
                    data={activeIncidents.series}
                    onClick={() => onView?.('activity')}
                  />
                  <KpiCard
                    label="DEVICE FLEET HEALTHY"
                    value={deviceFleet.pct != null ? deviceFleet.pct : '—'}
                    unit={deviceFleet.pct != null ? '%' : ''}
                    sub={deviceFleet.total ? `${deviceFleet.healthy} of ${deviceFleet.total} online` : 'no devices'}
                    tone="ok"
                    trend="up"
                    onClick={() => onView?.('devices')}
                  />
                  <KpiCard
                    label="ENERGY VS. BUDGET"
                    value={energyVsBudget.pct != null ? energyVsBudget.pct : '—'}
                    unit={energyVsBudget.pct != null ? '%' : ''}
                    sub={energyVsBudget.savedYtd ? `${energyVsBudget.savedYtd} saved YTD` : 'gathering data…'}
                    tone="ok"
                    trend="down"
                    onClick={() => onView?.('insights')}
                  />
                </>
              </div>
            )}
            {ownerBubbles && (
              <ServiceBubbleCard
                rows={servicing.rows}
                byTop={servicing.byTop || {}}
                pendingCount={pendingAsks.length}
                proposals={0}
                contracts={0}
                history={servicingHistory}
                big={bubbleFocus}
                onToggleFocus={() => setBubbleFocus((f) => !f)}
                onOpen={() => onView?.('services')}
                onOpenServiceLine={onView}
                onOpenChat={onOpenChat}
                building={building}
                incidents={incidents}
              />
            )}
          </>
        )}

        {/* Forecast strip — owner only (building telemetry, not a contractor
            briefing). Hidden in the owner's bubble focus mode (the cloud is the
            whole page), mirroring the contractor sections below. Owners with no
            servicing data aren't bubble-led, so the strip stays visible for them. */}
        {!isContractor && !(bubbleLed && bubbleFocus) && (
          <Card pad style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <MerlinAvatar size={18} />
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  fontWeight: 700,
                }}
              >
                FORECAST · NEXT 12H
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Merlin sees what's coming</div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => onView?.('predict-forecast')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Open Forecast →
              </button>
            </div>
            {forecastTiles.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {forecastTiles.map((tile, i) => (
                  <ForecastTile
                    key={`${tile.label}-${i}`}
                    label={tile.label}
                    sub={tile.sub}
                    value={tile.value}
                    unit={tile.unit}
                    pill={tile.pill}
                    trend={tile.trend}
                    spark={tile.spark}
                    onClick={() => onView?.('predict-forecast')}
                  />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-dim)', padding: '4px 0' }}>
                Forecast tiles populate as this building's sensors report. Open Forecast for the full 12-hour view.
              </div>
            )}
          </Card>
        )}

        {/* Services strip — live servicing across the building. Hidden in
            priorities-focus mode (the bubble map carries it) — for both the
            contractor and the owner (PM) bubble-led views. */}
        {!(bubbleLed && bubbleFocus) && servicing.loaded && servicing.overall.total > 0 && (
          <ServicesStrip rollup={servicing} onOpen={() => onView?.('services')} />
        )}

        {/* Two-column decisions + side rail. Hidden in bubble focus mode (contractor + owner). */}
        {!(bubbleLed && bubbleFocus) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            {/* Merlin asks column */}
            <Card pad style={{ padding: 12 }}>
              <div
                style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10.5,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--text-faint)',
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    MERLIN ASKS
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                    {pendingAsks.length === 0
                      ? sl('Nothing needs you right now', 'Rien ne requiert votre attention')
                      : pendingAsks.length === 1
                        ? sl('1 decision needs you', '1 décision vous attend')
                        : sl(
                            `${pendingAsks.length} decisions need you`,
                            `${pendingAsks.length} décisions vous attendent`,
                          )}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  {sl('Empty on a good day', 'Vide les bons jours')}
                </div>
              </div>
              {!buildingEvents.loaded ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <AdaptivLoader size="sm" />
                </div>
              ) : pendingAsks.length === 0 ? (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, padding: '2px 0 8px' }}>
                    {handledItems.length > 0
                      ? sl(
                          `Merlin is handling things on its own — ${handledItems.length === 1 ? 'here’s what it just took care of.' : 'here’s what it took care of recently.'}`,
                          `Merlin gère les choses en autonomie — ${handledItems.length === 1 ? 'voici ce dont il vient de s’occuper.' : 'voici ce dont il s’est occupé récemment.'}`,
                        )
                      : sl(
                          'Merlin is handling things on its own. Check back when something needs your call.',
                          'Merlin gère les choses en autonomie. Revenez quand une décision vous attend.',
                        )}
                  </div>
                  {handledItems.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: 10.5,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          color: 'var(--text-faint)',
                          fontWeight: 700,
                          margin: '6px 0 2px',
                        }}
                      >
                        ✦ {sl('Recently handled', 'Traité récemment')}
                      </div>
                      {handledItems.map((it, i) => (
                        <HandledRow
                          key={`${it.agentId || 'a'}-${it.kind || 'k'}-${it.applied_at || i}`}
                          item={it}
                          rel={fmtRel(it.applied_at)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Every pending decision — this IS the decision queue; don't
                      cap it. (pendingAsks is the building's unresolved ask set.) */}
                  {pendingAsks.map((e) => (
                    <DecisionCard key={e.id} event={e} />
                  ))}
                  <button
                    onClick={() => onView?.('activity')}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 4,
                      background: 'transparent',
                      border: 'none',
                      padding: '6px 0',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {sl('Open in Activity →', 'Ouvrir dans Activité →')}
                  </button>
                </div>
              )}
            </Card>

            {/* Today-at-a-glance side rail. Contractors get a live, CONTAINED
              service-status card (their contracted lines only) instead of the
              owner-oriented Routes / Shift-handover placeholders, which have no
              real source and are owner concepts (crews, dispatch routes). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isContractor ? (
                <ContractorServicesCard
                  rollup={contractorServicing}
                  onOpen={() => onView?.('services')}
                  showOverall={false}
                  history={servicingHistory}
                />
              ) : (
                <>
                  <Clickable onClick={() => onView?.('schedules')}>
                    <Card pad style={{ padding: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 10.5,
                              letterSpacing: '0.16em',
                              textTransform: 'uppercase',
                              color: 'var(--text-faint)',
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            TODAY AT A GLANCE
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Routes status</div>
                        </div>
                        <button
                          onClick={() => onView?.('schedules')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Dispatch →
                        </button>
                      </div>
                      {glanceRoutes && glanceRoutes.total_active > 0 ? (
                        <div>
                          <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
                            <GlanceStat value={glanceRoutes.ran_today} label={sl('ran today', 'faits')} tone="ok" />
                            <GlanceStat
                              value={glanceRoutes.overdue}
                              label={sl('overdue', 'en retard')}
                              tone={glanceRoutes.overdue > 0 ? 'warn' : 'ok'}
                            />
                            <GlanceStat
                              value={glanceRoutes.total_active}
                              label={sl('active routes', 'routes actives')}
                            />
                          </div>
                          {/* Progress: share of routes already run today. */}
                          <div
                            style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.round((glanceRoutes.ran_today / glanceRoutes.total_active) * 100))}%`,
                                background: '#10b981',
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6 }}>
                            {sl(
                              `${Math.round((glanceRoutes.ran_today / glanceRoutes.total_active) * 100)}% of today's routes run · open Schedules to dispatch`,
                              `${Math.round((glanceRoutes.ran_today / glanceRoutes.total_active) * 100)}% des routes faites · ouvrir Plannings`,
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5, padding: '2px 0' }}>
                          {sl(
                            'No dispatch routes are configured for this site yet. Set up routes in Schedules to see live status here.',
                            'Aucune route configurée pour ce site. Configurez des routes dans Plannings.',
                          )}
                        </div>
                      )}
                    </Card>
                  </Clickable>

                  {/* No card-level navigation here — the action is the "Hand over
                      shift" button (Merlin narrates the handover). A navigating
                      wrapper would otherwise swallow the click → Schedules. */}
                  <Card pad style={{ padding: 12 }}>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 10.5,
                              letterSpacing: '0.16em',
                              textTransform: 'uppercase',
                              color: 'var(--text-faint)',
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            SHIFT HANDOVER
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            Night · 22:00–06:00 → Day · 06:00–14:00
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!glanceShift) return;
                            onOpenChat?.(
                              sl(
                                `Write the night→day shift handover for ${building?.name || 'this building'}. Overnight (${glanceShift.night_start}–${glanceShift.night_end}) the crew completed ${glanceShift.completed} service tasks and resolved ${glanceShift.resolved_incidents} incidents; ${glanceShift.open_now} decisions and ${glanceShift.overdue_now} overdue items are still open. Summarise what happened and what the day shift should prioritise first.`,
                                `Rédige la passation nuit→jour pour ${building?.name || 'ce bâtiment'}. Cette nuit (${glanceShift.night_start}–${glanceShift.night_end}) : ${glanceShift.completed} tâches faites, ${glanceShift.resolved_incidents} incidents résolus ; ${glanceShift.open_now} décisions et ${glanceShift.overdue_now} éléments en retard restent ouverts. Résume et indique les priorités de l'équipe de jour.`,
                              ),
                              { send: true },
                            );
                          }}
                          style={{
                            flexShrink: 0,
                            padding: '6px 12px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 999,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {sl('Hand over shift', 'Passer le relais')}
                        </button>
                      </div>
                      {glanceShift && glanceShift.completed != null ? (
                        <div style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
                          {sl(`Overnight the crew completed `, `Cette nuit, l'équipe a fait `)}
                          <strong style={{ color: 'var(--text)' }}>{glanceShift.completed}</strong>
                          {sl(' service tasks and resolved ', ' tâches et résolu ')}
                          <strong style={{ color: 'var(--text)' }}>{glanceShift.resolved_incidents}</strong>
                          {sl(' incidents. Handed to the day shift: ', ' incidents. Transmis à l’équipe de jour : ')}
                          <strong style={{ color: glanceShift.open_now > 0 ? '#f59e0b' : 'var(--text)' }}>
                            {glanceShift.open_now} {sl('decisions', 'décisions')}
                          </strong>
                          {' · '}
                          <strong style={{ color: glanceShift.overdue_now > 0 ? '#f59e0b' : 'var(--text)' }}>
                            {glanceShift.overdue_now} {sl('overdue', 'en retard')}
                          </strong>
                          {sl(
                            '. Tap “Hand over shift” for Merlin’s full briefing.',
                            '. « Passer le relais » pour le briefing de Merlin.',
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                          {sl(
                            'The night→day summary appears here once the building has overnight activity.',
                            'Le résumé nuit→jour apparaît dès qu’il y a de l’activité nocturne.',
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Clickable wrapper ───────────────────────────────────────────────
// Makes any card navigate on click, with a subtle hover-lift + keyboard
// support. Passes children through untouched when no onClick is given, so
// non-interactive cards are unaffected. (The Card primitive doesn't forward
// onClick, so wrapping is the clean way to add it.)
function Clickable({ onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  if (!onClick) return children;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--radius)',
        transition: 'transform .12s ease, box-shadow .12s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 22px color-mix(in oklch, var(--accent) 16%, transparent)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Hero stat ───────────────────────────────────────────────────────
// Big twin-hero tile for the contractor briefing (decisions + service health):
// a bold colour-coded number with an optional click-through + hover lift.
function HeroStat({ eyebrow, value, unit = '', sub, color, onClick }) {
  const [hover, setHover] = React.useState(false);
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
        gap: 6,
        padding: '18px 20px',
        borderRadius: 14,
        background: `color-mix(in oklch, ${color} 8%, var(--surface))`,
        border: `1px solid ${hover && onClick ? color : 'var(--border)'}`,
        borderLeft: `4px solid ${color}`,
        transition: 'border-color .15s, transform .12s, box-shadow .12s',
        transform: hover && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: hover && onClick ? `0 8px 22px color-mix(in oklch, ${color} 18%, transparent)` : 'none',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontWeight: 700,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color, letterSpacing: -0.02 }}>{value}</span>
        {unit && <span style={{ fontSize: 20, fontWeight: 700, color }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{sub}</div>
    </button>
  );
}

// ─── Services strip ──────────────────────────────────────────────────
// Live servicing across the building — overall adherence + a tile per service
// line (Cleaning / Security / Hospitality / Maintenance). Same numbers as the
// OPERATE → Services roll-up (shared useServicingRollup). Each tile opens it.
function adhColor(adh) {
  if (adh == null) return 'var(--text)';
  return adh >= 90 ? '#10b981' : adh >= 75 ? '#f59e0b' : '#ef4444';
}

function ServiceDomainTile({ domainKey, stat, series, onOpen }) {
  const sl = useSL();
  const t = useT();
  const meta = SERVICING_DOMAIN_META[domainKey];
  const lbl = (() => {
    const v = t(meta?.labelKey);
    return v && v !== meta?.labelKey ? v : meta?.fallback;
  })();
  const DIcon = Icon[meta?.icon] || Icon.sparkle;
  const accent = domainAccent(domainKey);
  const [hover, setHover] = React.useState(false);
  const adh = stat?.adh;
  const barColor = adhColor(adh);
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        background: 'var(--surface)',
        border: `1px solid ${hover ? accent : 'var(--border)'}`,
        transition: 'border-color .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 6,
            background: domainSoft(domainKey),
          }}
        >
          <DIcon size={13} style={{ color: accent }} />
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-soft)',
          }}
        >
          {lbl}
        </span>
        <div style={{ flex: 1 }} />
        {stat && series && <TrendSpark data={series} color={barColor} width={56} height={20} />}
      </div>
      {stat ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: barColor, lineHeight: 1 }}>
              {adh}
              <span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
              {stat.overdue > 0 ? `${stat.overdue} ${sl('overdue', 'en retard')}` : sl('on track', 'à jour')}
              {stat.open > 0 ? ` · ${stat.open} ${sl('open', 'ouv.')}` : ''}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, adh || 0))}%`,
                background: barColor,
                borderRadius: 999,
                transition: 'width .3s',
              }}
            />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{sl('No data', 'Aucune donnée')}</div>
      )}
    </button>
  );
}

// Gauge-led "Service health" hero (right twin). Tinted card matching HeroStat.
function ServiceHealthHero({ eyebrow, pct, color, sub, onClick }) {
  const [hover, setHover] = React.useState(false);
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
        alignItems: 'center',
        gap: 18,
        padding: '14px 20px',
        borderRadius: 14,
        background: `color-mix(in oklch, ${color} 8%, var(--surface))`,
        border: `1px solid ${hover && onClick ? color : 'var(--border)'}`,
        borderLeft: `4px solid ${color}`,
        transition: 'border-color .15s, transform .12s, box-shadow .12s',
        transform: hover && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: hover && onClick ? `0 8px 22px color-mix(in oklch, ${color} 18%, transparent)` : 'none',
      }}
    >
      <RadialGauge pct={pct} color={color} size={92} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.45 }}>{sub}</div>
      </div>
    </button>
  );
}

function ServiceTrendCard({ lines, onOpen }) {
  const sl = useSL();
  const t = useT();
  const lbl = (k) => {
    const m = SERVICING_DOMAIN_META[k];
    const v = t(m?.labelKey);
    return v && v !== m?.labelKey ? v : m?.fallback;
  };
  return (
    <Card pad style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {sl('SERVICE ADHERENCE', 'CONFORMITÉ DU SERVICE')}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {sl('Last 20 hours', 'Dernières 20 heures')}
          </div>
        </div>
        <button
          onClick={onOpen}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {sl('Open Services →', 'Ouvrir Services →')}
        </button>
      </div>
      <MultiTrendChart lines={lines} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
        {lines.map((l) => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{lbl(l.key)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: adhColor(l.adh) }}>{l.adh}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Compact, contained service-status card for a contractor's My Day right rail
// (replaces the owner Routes/Shift placeholders). Same numbers + tiles as the
// Services roll-up, but only the contractor's contracted lines (viewer RPC),
// stacked for the narrow column.
function ContractorServicesCard({ rollup, onOpen, showOverall = true, history = {} }) {
  const sl = useSL();
  const { byTop, overall, loaded } = rollup;
  const lines = SERVICING_GROUP_DOMAINS.filter((k) => byTop[k]);
  return (
    <Card pad style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {sl('TODAY AT A GLANCE', 'AUJOURD’HUI EN BREF')}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {sl('Service status', 'État du service')}
          </div>
        </div>
        <button
          onClick={onOpen}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {sl('Open Services →', 'Ouvrir Services →')}
        </button>
      </div>
      {!loaded ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <AdaptivLoader size="sm" />
        </div>
      ) : overall.total === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5, padding: '2px 0' }}>
          {sl(
            'Gathering today’s servicing across your lines — check back shortly.',
            'Collecte du service du jour sur vos métiers — revenez bientôt.',
          )}
        </div>
      ) : (
        <>
          {showOverall && (
            <button
              onClick={onOpen}
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'color-mix(in oklch, var(--accent) 6%, var(--surface))',
                border: '1px solid var(--accent-line)',
                borderLeft: `3px solid ${adhColor(overall.adh)}`,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 800, color: adhColor(overall.adh) }}>
                {overall.adh}
                <span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                {sl('overall', 'global')}
                {overall.overdue > 0
                  ? ` · ${overall.overdue} ${sl('overdue', 'en retard')}`
                  : ` · ${sl('on track', 'à jour')}`}
                {overall.open > 0 ? ` · ${overall.open} ${sl('open', 'ouv.')}` : ''}
              </span>
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map((k) => (
              <ServiceDomainTile
                key={k}
                domainKey={k}
                stat={byTop[k]}
                onOpen={onOpen}
                series={history[k] && history[k].length >= 2 ? history[k] : synthTrend(k, byTop[k]?.adh ?? 90, 12)}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function ServicesStrip({ rollup, onOpen }) {
  const sl = useSL();
  const { byTop, overall } = rollup;
  return (
    <Card pad style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Icon.sparkle size={16} style={{ color: 'var(--accent)' }} />
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            fontWeight: 700,
          }}
        >
          {sl('SERVICES · NOW', 'SERVICES · MAINTENANT')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
          {sl('What’s being done across the building', 'Ce qui est fait dans le bâtiment')}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onOpen}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {sl('Open Services →', 'Ouvrir Services →')}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {/* Overall summary tile */}
        <button
          onClick={onOpen}
          style={{
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 12,
            borderRadius: 10,
            background: 'color-mix(in oklch, var(--accent) 6%, var(--surface))',
            border: '1px solid var(--accent-line)',
            borderLeft: `3px solid ${adhColor(overall.adh)}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-soft)',
            }}
          >
            {sl('Overall adherence', 'Adhérence globale')}
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, color: adhColor(overall.adh) }}>
            {overall.adh != null ? overall.adh : '—'}
            <span style={{ fontSize: 13, fontWeight: 600 }}>%</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            {overall.total} {sl('items', 'élém.')} · {overall.overdue} {sl('overdue', 'en retard')} · {overall.open}{' '}
            {sl('open', 'ouv.')}
          </div>
        </button>
        {SERVICING_GROUP_DOMAINS.map((k) => (
          <ServiceDomainTile key={k} domainKey={k} stat={byTop[k]} onOpen={onOpen} />
        ))}
      </div>
    </Card>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, sub, tone = 'ok', trend = 'up', data = null, onClick }) {
  const TONE_COLORS = {
    ok: '#10b981',
    warn: '#f59e0b',
    risk: '#ef4444',
  };
  const trendColor = TONE_COLORS[tone] || TONE_COLORS.ok;
  // Tint + accent only the cards that need attention (warn/risk) so the eye
  // goes there; "ok" cards stay clean.
  const elevated = tone === 'warn' || tone === 'risk';
  const tint =
    tone === 'risk'
      ? 'color-mix(in oklch, #ef4444 7%, var(--surface-2))'
      : tone === 'warn'
        ? 'color-mix(in oklch, #f59e0b 7%, var(--surface-2))'
        : undefined;
  const inner = (
    <Card
      pad
      style={{
        padding: 14,
        height: '100%',
        minHeight: 150,
        display: 'flex',
        flexDirection: 'column',
        ...(elevated ? { background: tint, borderLeft: `3px solid ${trendColor}` } : {}),
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: -0.02 }}>
          {value}
        </div>
        {unit && <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-dim)' }}>{unit}</div>}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-dim)',
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{sub}</span>
        {onClick && <span style={{ color: 'var(--text-faint)', fontWeight: 700, flexShrink: 0 }}>→</span>}
      </div>
      {/* Full-width chart fills the card's lower real estate so each KPI reads
          as a living trend, not a number with a corner squiggle. */}
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <MiniSpark full height={48} color={trendColor} flavour={trend} data={data} />
      </div>
    </Card>
  );
  return onClick ? (
    <Clickable onClick={onClick} style={{ height: '100%' }}>
      {inner}
    </Clickable>
  ) : (
    inner
  );
}

// ─── Forecast tile ───────────────────────────────────────────────────
function ForecastTile({ label, sub, value, unit, pill, trend = 'info', spark, onClick }) {
  const inner = (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        // Fill the grid cell so every tile is the same height regardless of
        // whether it carries a pill (the BREACH-RISK tile used to render taller).
        height: '100%',
        minHeight: 132,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18 }}>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 700,
          }}
        >
          {label}
        </div>
        {pill && (
          <span
            style={{
              padding: '2px 7px',
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: 'color-mix(in oklch, #ef4444 14%, transparent)',
              color: '#ef4444',
              border: '1px solid color-mix(in oklch, #ef4444 36%, transparent)',
              borderRadius: 999,
              textTransform: 'uppercase',
            }}
          >
            {pill}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sub}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{unit}</div>
      </div>
      {/* marginTop:auto pins the chart to the bottom so every tile's spark sits
          on the same baseline; full-width so it fills the card, not a corner. */}
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <MiniSpark full height={42} color={trend === 'risk' ? '#ef4444' : '#3b82f6'} flavour={spark || trend} />
      </div>
    </div>
  );
  return onClick ? (
    <Clickable onClick={onClick} style={{ height: '100%' }}>
      {inner}
    </Clickable>
  ) : (
    inner
  );
}

// ─── Decision card ───────────────────────────────────────────────────
function DecisionCard({ event }) {
  const [busy, setBusy] = React.useState(null);
  const sl = useSL();
  const agentId = event.processed_by_agent_id || event.kind;
  const title = event.decision_reason || event.payload?.title || `${event.kind} signal`;
  const propose = event.payload?.body || event.payload?.sub || null;
  const outcome = event.payload?.outcome || null;
  const confidence = event.confidence ?? null;
  // Ask title/body/outcome are server-generated prose in the write-time
  // language (English). Translate on read so a French reader sees French —
  // /api/translate caches, so this is a one-time cost per unique string.
  const txTitle = useTranslatedText(title);
  const txPropose = useTranslatedText(propose || '');
  const txOutcome = useTranslatedText(outcome || '');

  async function act(actionId) {
    if (busy) return;
    setBusy(actionId);
    try {
      await resolveEvent(event.id, actionId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <MerlinAvatar size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          MERLIN ASK · {prettyAgent(agentId)}
          {confidence != null && (
            <span style={{ marginLeft: 8, color: 'var(--text-faint)', fontWeight: 600 }}>
              {Math.round(confidence)}% {sl('confidence', 'confiance')}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.4,
            marginBottom: propose ? 6 : 10,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        >
          {txTitle || title}
        </div>
        {propose && (
          <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{sl('Propose', 'Proposition')}:</span>{' '}
            {txPropose || propose}
          </div>
        )}
        {outcome && (
          <div
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              marginBottom: 10,
              fontSize: 11,
              fontWeight: 700,
              color: '#10b981',
              background: 'transparent',
            }}
          >
            {txOutcome || outcome}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => act('approve')}
            disabled={!!busy}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 700,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy && busy !== 'approve' ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {busy === 'approve' ? '…' : sl('Approve', 'Approuver')}
          </button>
          <button
            onClick={() => act('hold')}
            disabled={!!busy}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 700,
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy && busy !== 'hold' ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {busy === 'hold' ? '…' : sl('Modify', 'Modifier')}
          </button>
          <button
            onClick={() => act('dismiss')}
            disabled={!!busy}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              padding: '6px 0',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-dim)',
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy === 'dismiss' ? '…' : sl('Dismiss', 'Ignorer')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Routes status stat block ────────────────────────────────────────
// ─── Recently-handled row (the "autopilot" feed on a good day) ────────
function HandledRow({ item, rel }) {
  const summary = item.legacySummary || item.summary || item.reason || 'Handled';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
        borderTop: '1px solid var(--border)',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 700,
          }}
        >
          {prettyAgent(item.agentId)}
        </span>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--text-soft)',
            lineHeight: 1.4,
            marginTop: 1,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        >
          {summary}
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          flexShrink: 0,
          fontFamily: 'var(--mono)',
          whiteSpace: 'nowrap',
        }}
      >
        {rel}
      </span>
    </div>
  );
}
