// Main dashboard — the Metrics surface (WidgetGrid + catalog). Also home to
// the SLARisk / MerlinToday / BuildingSatisfaction widgets the catalog mounts.
import React, { useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { useAppData } from './simulator.js';
import { useDevicesForLocation } from './custom-locations.js';
import { useT } from './i18n.js';
import { useFormatRelative } from './locale-format.js';
import { useSession } from './auth.js';
import { useLatestAgentActions } from './agent-runs.js';
import { useAgentActionRenderer } from './ask-render.js';
import { WidgetGrid } from './MetricsLayout.jsx';
import {
  KpiRingWidget,
  GradientAreaWidget,
  GradientAreaSettings,
  BranchHeatmapWidget,
  AgentDonutWidget,
  LiveStreamWidget,
  LiveStreamSettings,
  WeatherWidget,
  WeatherSettings,
  EcosystemMapWidget,
  BuildingMapWidget,
} from './MetricsWidgets.jsx';
import {
  SlaBreachStrip,
  BankComplianceCard,
  BankFinesTrendCard,
  BankBranchStatusPanel,
} from './DashboardBankPanels.jsx';

// Dashboard now renders only the Metrics surface. Incidents view moved
// to Calls for action under OPERATE; Agents tab moved to OPERATE; Firehose
// moved into the gear-menu Agentic page (super-admin only).
// The BRIEFING category sub-nav (Briefing | Metrics) wraps this surface.
// Widget catalog — owned here so the wrapper components close over
// in-file declarations (no circular import with MetricsLayout).
// Exported so Chat.jsx can project to a metadata-only payload and
// hand it to Merlin's tool-using chat backend.
export const METRICS_WIDGET_CATALOG = [
  {
    id: 'kpi-ring',
    labelKey: 'widget.cat.kpi_ring.label',
    descKey: 'widget.cat.kpi_ring.desc',
    icon: 'sla',
    span: 'third',
    tags: ['featured', 'graphic'],
    Component: KpiRingWidget,
  },
  {
    id: 'gradient-area',
    labelKey: 'widget.cat.area.label',
    descKey: 'widget.cat.area.desc',
    icon: 'bolt',
    span: 'third',
    tags: ['featured', 'graphic'],
    Component: GradientAreaWidget,
    Settings: GradientAreaSettings,
  },
  {
    id: 'branch-heatmap',
    labelKey: 'widget.cat.heatmap.label',
    descKey: 'widget.cat.heatmap.desc',
    icon: 'map',
    span: 'third',
    tags: ['featured', 'graphic', 'bank'],
    Component: BranchHeatmapWidget,
  },
  {
    id: 'agent-donut',
    labelKey: 'widget.cat.donut.label',
    descKey: 'widget.cat.donut.desc',
    icon: 'panel',
    span: 'third',
    tags: ['featured', 'graphic'],
    Component: AgentDonutWidget,
  },
  {
    id: 'live-stream',
    labelKey: 'widget.cat.stream.label',
    descKey: 'widget.cat.stream.desc',
    icon: 'beacon',
    span: 'third',
    tags: ['live', 'graphic'],
    Component: LiveStreamWidget,
    Settings: LiveStreamSettings,
  },
  {
    id: 'weather',
    labelKey: 'widget.cat.weather.label',
    descKey: 'widget.cat.weather.desc',
    icon: 'sparkle',
    span: 'third',
    tags: ['featured', 'context'],
    Component: WeatherWidget,
    Settings: WeatherSettings,
  },
  {
    id: 'ecosystem-map',
    labelKey: 'widget.cat.ecomap.label',
    descKey: 'widget.cat.ecomap.desc',
    icon: 'map',
    span: 'third',
    tags: ['featured', 'context'],
    Component: EcosystemMapWidget,
  },
  {
    id: 'building-map',
    labelKey: 'widget.cat.bldgmap.label',
    descKey: 'widget.cat.bldgmap.desc',
    icon: 'map',
    span: 'third',
    tags: ['featured', 'context'],
    Component: BuildingMapWidget,
  },
  {
    id: 'sla-strip',
    labelKey: 'widget.cat.sla_strip.label',
    descKey: 'widget.cat.sla_strip.desc',
    icon: 'warn',
    span: 'third',
    tags: ['operational'],
    Component: ({ ctx }) => <SlaBreachStrip orgId={ctx.orgId} onView={ctx.onView} />,
  },
  {
    id: 'bank-compliance',
    labelKey: 'widget.cat.bank_compliance.label',
    descKey: 'widget.cat.bank_compliance.desc',
    icon: 'shield',
    span: 'third',
    tags: ['operational', 'bank'],
    Component: ({ ctx }) => <BankComplianceCard orgId={ctx.orgId} />,
  },
  {
    id: 'bank-fines-trend',
    labelKey: 'widget.cat.bank_trend.label',
    descKey: 'widget.cat.bank_trend.desc',
    icon: 'bolt',
    span: 'third',
    tags: ['operational', 'bank'],
    Component: ({ ctx }) => <BankFinesTrendCard orgId={ctx.orgId} />,
  },
  {
    id: 'bank-branches',
    labelKey: 'widget.cat.bank_branches.label',
    descKey: 'widget.cat.bank_branches.desc',
    icon: 'building',
    span: 'third',
    tags: ['operational', 'bank'],
    Component: ({ ctx }) => <BankBranchStatusPanel orgId={ctx.orgId} />,
  },
  {
    id: 'sla-risk',
    labelKey: 'widget.cat.sla_risk.label',
    descKey: 'widget.cat.sla_risk.desc',
    icon: 'sla',
    span: 'third',
    tags: ['operational'],
    Component: ({ ctx }) => <SLARisk slas={ctx.slas} />,
  },
  {
    id: 'merlin-today',
    labelKey: 'widget.cat.today.label',
    descKey: 'widget.cat.today.desc',
    icon: 'sparkle',
    span: 'third',
    tags: ['daily'],
    Component: ({ ctx }) => <MerlinToday building={ctx.building} role={ctx.role} />,
  },
  {
    id: 'satisfaction',
    labelKey: 'widget.cat.satisfaction.label',
    descKey: 'widget.cat.satisfaction.desc',
    icon: 'people',
    span: 'third',
    tags: ['daily'],
    Component: ({ ctx }) => <BuildingSatisfaction building={ctx.building} />,
  },
];

export const METRICS_DEFAULT_LAYOUT = [
  'weather',
  'building-map',
  'ecosystem-map',
  'sla-strip',
  'kpi-ring',
  'bank-compliance',
  'gradient-area',
  'branch-heatmap',
  'bank-fines-trend',
  'bank-branches',
  'agent-donut',
  'live-stream',
  'sla-risk',
  'merlin-today',
  'satisfaction',
];

export function Dashboard({ building, role, incidents, slas, onOpenChat, onView, onAddDataSource }) {
  const session = useSession();
  const ctx = {
    orgId: session?.organizationId,
    building,
    role,
    incidents,
    slas,
    onOpenChat,
    onView,
  };

  // Hero (greeting + KPIs + suggestion chips) was collapsing to a 2px
  // border-only sliver because flex-column shrinking ate its 174px of
  // content. Rendered as a stray separator line under the tabs, which
  // JB called out. Same greeting + critical-incident summary already
  // live on the Briefing tab next door, so the cleanest fix is to
  // drop the broken render here. If the greeting is wanted back, the
  // Hero component below is still defined; either restore the call
  // with `flexShrink: 0` on the Card or move the content into a row
  // above MonitorPane where flex-shrink can't squash it.
  //
  // Tenant-readiness gate: custom user-created buildings with zero
  // devices have no real telemetry, but many widgets read from
  // data.js static demo arrays directly (not via ctx.live), so they
  // leak Meridian-flavored content. Show an empty state instead of
  // a wall of fake widgets. Surfaced by PRO TEST smoke-test
  // 2026-05-18. Demo buildings (hq, imf, nybank — `custom !== true`)
  // keep their existing widgets so demos still look populated.
  const devices = useDevicesForLocation(building?.id);
  const isEmptyTenantBuilding = !!(building?.custom && devices.length === 0);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
        {isEmptyTenantBuilding ? (
          <MetricsEmpty building={building} onAddDataSource={onAddDataSource} />
        ) : (
          <WidgetGrid catalog={METRICS_WIDGET_CATALOG} defaults={METRICS_DEFAULT_LAYOUT} ctx={ctx} />
        )}
      </main>
    </div>
  );
}

function MetricsEmpty({ building, onAddDataSource }) {
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <Icon.grid size={28} style={{ color: 'var(--text-dim)' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>No metrics yet for {building?.name || 'this building'}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', maxWidth: 480, lineHeight: 1.55 }}>
            Connect a data source to start charting occupancy, temperature, energy, and more — devices, APIs, and
            integrations all flow into the widgets here.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAddDataSource && onAddDataSource()}
          style={{
            marginTop: 4,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--accent)',
            color: 'var(--accent-fg, #fff)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Add a data source
        </button>
      </div>
    </Card>
  );
}

function SLARisk({ slas }) {
  const t = useT();
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.sla size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('dashboard.sla_health')}</div>
        <div style={{ flex: 1 }} />
        <Pill tone="risk">
          <Dot tone="risk" size={5} pulse /> {t('sla.pill_at_risk', { n: 1 })}
        </Pill>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slas.map((s) => (
          <div key={s.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
              <div
                style={{
                  fontSize: 11,
                  color: s.current < s.target ? 'var(--risk)' : 'var(--text-dim)',
                  fontFamily: 'var(--mono)',
                  fontWeight: 700,
                }}
              >
                {s.current}% / {s.target}%
              </div>
            </div>
            <div
              style={{
                height: 4,
                background: 'var(--surface-3)',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${s.current}%`,
                  background:
                    s.current >= s.target ? 'var(--ok)' : s.current >= s.target - 3 ? 'var(--warn)' : 'var(--risk)',
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  bottom: -2,
                  left: `${s.target}%`,
                  width: 1,
                  background: 'var(--text-dim)',
                  opacity: 0.5,
                }}
              />
            </div>
            {s.at_risk > 0 && (
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3 }}>
                {t('sla.approaching', { a: s.at_risk, b: s.breaches_mtd })}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// Per-role allow-list for the Merlin-today widget. Mirrors the same
// shape used by Briefing's HandledSection (Briefing.jsx). Kept local
// to keep this fix self-contained; if a third surface needs this map
// it should move to roles.js.
const MERLIN_TODAY_AGENTS_BY_ROLE = {
  superadmin: null, // null = all agents
  property_manager: null,
  facility: ['cleaning', 'hvac', 'space', 'supply', 'energy', 'compliance', 'security', 'parking'],
  fm_network: ['cleaning', 'space', 'energy'],
  auditor: ['compliance', 'security'],
  cleaning: ['cleaning', 'space', 'supply'],
  maintenance: ['hvac', 'energy'],
  security: ['security', 'compliance'],
  executive: ['cleaning', 'hvac', 'space', 'energy', 'compliance', 'security'],
  tenant: ['cleaning', 'space', 'hvac'],
};

// kind → icon map for the Merlin-Today action list. Small presentational
// const, intentionally duplicated (Briefing.jsx + DashboardAgents.jsx keep
// their own copies) rather than shared from a module.
const ACTION_KIND_ICON = {
  setpoint_change: 'bolt',
  supply_order: 'supply',
  booking_release: 'floor',
  setback_proposal: 'bolt',
  audit_evidence: 'shield',
  escalation: 'badge',
};

function MerlinToday({ building, role }) {
  const t = useT();
  const session = useSession();
  const renderAction = useAgentActionRenderer();
  const fmtRel = useFormatRelative();
  // Real agent activity from the same six action tables Briefing's
  // 'Since you last checked' card reads. Previous render hard-coded
  // MERLIN_TODAY_BY_ROLE marketing copy on every workspace; JB called
  // it out as static. Same role-scoped allow-list rules apply. Scoped
  // to the active building so multi-building tenants don't blend each
  // other's agent activity.
  const latestActions = useLatestAgentActions(session?.organizationId, building?.id);
  const items = useMemo(() => {
    const allow = MERLIN_TODAY_AGENTS_BY_ROLE[role.id];
    const all = Object.values(latestActions || {});
    const scoped = allow == null ? all : all.filter((a) => allow.includes(a.agentId));
    return scoped
      .filter((a) => a.applied_at)
      .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
      .slice(0, 4);
  }, [latestActions, role.id]);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('dashboard.merlin_today')}</div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('dashboard.merlin_today.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((action) => {
            const IconComp = Icon[ACTION_KIND_ICON[action.kind] || 'sparkle'] || Icon.sparkle;
            const tone = action.tone || 'accent';
            const { summary, reason } = renderAction(action);
            const when = fmtRel(action.applied_at);
            return (
              <div
                key={action.agentId + ':' + action.applied_at}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    flexShrink: 0,
                    borderRadius: 7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `color-mix(in oklch, var(--${tone}) 14%, transparent)`,
                    color: `var(--${tone})`,
                  }}
                >
                  <IconComp size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {summary || action.legacySummary || '—'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                    {when}
                    {reason ? ' · ' + reason : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ──────────────────────── BUILDING SATISFACTION ────────────────────────

function BuildingSatisfaction({ building }) {
  const live = useAppData(building);
  const t = useT();
  const ratings = live.satisfaction.ratings;
  const total = Object.values(ratings).reduce((a, b) => a + b, 0);
  const avg = ((5 * ratings[5] + 4 * ratings[4] + 3 * ratings[3] + 2 * ratings[2] + 1 * ratings[1]) / total).toFixed(2);
  const trendData = live.satisfaction.trend;
  const trend = +(trendData[trendData.length - 1] - trendData[0]).toFixed(2);
  const promoterPct = Math.round(((ratings[5] + ratings[4]) / total) * 100);

  // Top/bottom performers (compact list)
  const isEco = building?.kind === 'ecosystem';
  const floors = isEco
    ? [
        { name: 'Manhattan \u00b7 Madison Ave', avg: 4.91, tone: 'ok' },
        { name: 'Kingston \u00b7 Chestnut Dr', avg: 3.42, tone: 'warn' },
        { name: 'Binghamton \u00b7 Court St', avg: 3.08, tone: 'risk' },
      ]
    : [
        { name: 'Floor 48 · Exec', avg: 4.82, tone: 'ok' },
        { name: 'Floor 32 · East', avg: 3.61, tone: 'warn' },
        { name: 'Floor 24 · Men\u2019s', avg: 3.24, tone: 'risk' },
      ];

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon.display size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('dashboard.satisfaction')}</div>
        <div style={{ flex: 1 }} />
        <Pill tone={trend > 0 ? 'ok' : 'risk'}>
          {trend > 0 ? '\u25b2' : '\u25bc'} {Math.abs(trend).toFixed(2)}
        </Pill>
      </div>

      {/* Big number + sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 12 }}>
        <div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: -0.02,
              color: 'var(--accent)',
              lineHeight: 1,
              fontFamily: 'var(--font)',
            }}
          >
            {avg}
          </div>
          <div style={{ fontSize: 13, color: 'var(--warn)', marginTop: 2, letterSpacing: 2 }}>★★★★☆</div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            {t('sat.ratings_7d', { n: total.toLocaleString() })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {t('sat.promoter', { pct: promoterPct })}
          </div>
          <div style={{ marginTop: 6 }}>
            <TrendSparkline data={trendData} />
          </div>
        </div>
      </div>

      {/* Rating bars */}
      <div style={{ paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
        {[5, 4, 3, 2, 1].map((n) => {
          const pct = (ratings[n] / total) * 100;
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ width: 14, fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)' }}>{n}★</span>
              <div style={{ flex: 1, height: 5, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: n >= 4 ? 'var(--ok)' : n === 3 ? 'var(--warn)' : 'var(--risk)',
                    borderRadius: 3,
                  }}
                />
              </div>
              <span
                style={{
                  width: 42,
                  textAlign: 'right',
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {ratings[n].toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Top + bottom floors */}
      <div style={{ paddingTop: 10, marginTop: 10, borderTop: '1px dashed var(--border)' }}>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.15,
            marginBottom: 6,
          }}
        >
          {t('sat.needs_attention')}
        </div>
        {floors.map((f) => {
          const color = { ok: 'var(--ok)', warn: 'var(--warn)', risk: 'var(--risk)' }[f.tone];
          return (
            <div
              key={f.name}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 11.5 }}
            >
              <Dot tone={f.tone} size={5} />
              <span
                style={{
                  flex: 1,
                  color: 'var(--text-soft)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name}
              </span>
              <span style={{ color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{f.avg.toFixed(2)}★</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TrendSparkline({ data }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(0.15, max - min);
  const w = 100,
    h = 22;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--ok)"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
