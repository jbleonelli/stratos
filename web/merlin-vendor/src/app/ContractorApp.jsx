// Phase G-3a — Contractor Manager view, extended to a full ops surface
// for cleaning-services (and other) contractor orgs.
//
// The contractor manager's mental model is "my crew across many
// contracts" — same primitives the in-house facility manager uses
// (today / weekly grid / team / routes) but scoped to the contractor
// org rather than a specific building. Each section reuses the
// underlying section component from Schedules.jsx with scope='org'.
// Insights surfaces the cleaning + supply + amenity slice of the
// insight pool.

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { useT } from './i18n.js';
import { useActiveOrg } from './org-data.js';
import { useContractorContracts, useContractorBuildings } from './queries/contractor.ts';
import {
  useContractPerformance,
  useContractorRecommendations,
  useContractorAnalytics,
  draftContractRenewal,
} from './slas-data.js';
import { useVendors } from './vendors-data.js';
import { HypervisorPage } from './Hypervisor.jsx';
import { createTopLevelBuilding } from './custom-locations.js';
// Hardware-commerce UI split out 2026-06-05 into contractor-hardware.jsx.
// Re-imported so ContractorSection / ContractorHardwarePage keep working.
import { ContractorHardware } from './contractor-hardware.jsx';
// Contract drawer/detail/reports/proposals split out 2026-06-05 into
// contract-detail.jsx. The contracts dashboard below uses ContractDetail /
// ReportsSection / ProposalsSection; the three public exports are re-exported
// for external consumers (PrintReportPage, Manager inboxes).
import { ContractSlaRow, ContractDrawerById, ContractDetail, ReportPilotRow } from './contract-detail.jsx';
export { ContractSlaRow, ContractDrawerById, ReportPilotRow };

// The standalone ContractorApp shell was retired in early 2026 when
// contractor managers were moved into the unified FM shell. The named
// pieces below (ContractorTopBar, ContractorSubNav, ContractorSection,
// SUB_NAV) used to compose that shell. They're kept here because some
// — like ContractDrawerById, ContractsPage, ContractorBuildingsPage,
// ContractorHardwarePage, ContractSlaRow, ReportPilotRow — are still
// imported elsewhere. The shell function itself is gone (knip cleanup,
// 2026-05-12). Watch for collapsing this file into smaller modules
// once the leaf components migrate to their own homes.

// Standalone page wrapper so the main shell's Operations → Contracts
// can render this without going through the (now-retired) ContractorApp
// shell. Resolves session + active org from hooks rather than props.
export function ContractsPage() {
  const session = useSession();
  const org = useActiveOrg();
  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
      <ContractsDashboard session={session} org={org} />
    </main>
  );
}

// Same wrapper pattern for the Buildings + Hardware tabs added in
// PRs #202/#203/#205/#206. The original work landed them inside
// ContractorApp's SUB_NAV which became dead code when the shell was
// retired — Operations.jsx imports these page wrappers directly.
export function ContractorBuildingsPage() {
  const session = useSession();
  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <ContractorBuildings session={session} />
    </main>
  );
}

export function ContractorHardwarePage() {
  const session = useSession();
  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
      <ContractorHardware session={session} />
    </main>
  );
}

function ContractsDashboard({ session, org }) {
  const t = useT();
  const { data: contracts = null } = useContractorContracts(session?.organizationId);
  const [selected, setSelected] = useState(null);
  // Pending proposal draft handed in by ContractMerlinTake's
  // "Convert to proposal" action. When set, opening the drawer also
  // opens the Proposals section in compose mode with the body
  // pre-filled. Cleared after the drawer is closed.
  // MUST be declared before the contracts === null early return below
  // — moving it after the return triggered "Rendered more hooks than
  // during the previous render" the moment the contracts query
  // resolved (the loading render had 5 hooks, the loaded render had
  // 6). Classic Rules-of-Hooks violation; lesson learned, all useState
  // calls live above any early return.
  const [pendingDraft, setPendingDraft] = useState(null);

  const counts = useMemo(() => {
    const c = contracts || [];
    return {
      total: c.length,
      active: c.filter((x) => x.status === 'active').length,
      draft: c.filter((x) => x.status === 'draft').length,
      monthlyValue: c.filter((x) => x.status === 'active').reduce((sum, x) => sum + (Number(x.monthly_value) || 0), 0),
    };
  }, [contracts]);

  if (contracts === null) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)' }}>{t('contractor.loading')}</div>;
  }

  function openContract(c, draft = null) {
    setSelected(c);
    setPendingDraft(draft);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero org={org} counts={counts} />
      <AnalyticsStrip orgId={session?.organizationId} />
      {contracts.length === 0 && <EmptyState />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {contracts.map((c) => (
          <ContractCard
            key={c.id}
            contract={c}
            onOpen={() => openContract(c)}
            onConvertProposal={(item) => {
              // Phase 5: item is { text, vendor_id }. When the AI
              // suggested a partner, default the proposal to the
              // 'innovation_partner' category so the composer reads
              // as Merlin intended.
              const text = typeof item === 'string' ? item : item.text;
              const vendor_id = typeof item === 'object' ? item.vendor_id || null : null;
              openContract(c, {
                body: text,
                vendor_id,
                category: vendor_id ? 'innovation_partner' : 'cadence_change',
              });
            }}
            onConvertRenewal={(draft) => {
              // Phase 8.10 — renewal flow. Haiku draft already
              // includes title + body + monthly_value_delta +
              // expected_outcome; ProposalsSection's initialDraft
              // hook picks up all four.
              openContract(c, {
                title: draft.title,
                body: draft.body,
                category: draft.category || 'scope_expansion',
                expected_outcome: draft.expected_outcome || '',
                monthly_value_delta: draft.monthly_value_delta,
                vendor_id: null,
              });
            }}
          />
        ))}
      </div>
      {selected && (
        <ContractDetail
          contract={selected}
          initialDraft={pendingDraft}
          onClose={() => {
            setSelected(null);
            setPendingDraft(null);
          }}
        />
      )}
    </div>
  );
}

// ──── Buildings tab (PR1 + PR2 + PR3 — contractor portfolio) ────
// Lists every building the contractor either has an active contract
// on (path 1 — manager-invited) or owns directly (path 2 — self-
// serve). Clicking a card opens the Hypervisor scoped to that
// building. For contracted buildings we pass `orgIdOverride` so the
// LocationTree's org-filtered fetch lands on the FM's tree; for
// self-owned buildings we let the default session org flow through.
// `editable={true}` for both — migration 091 opened the locations
// + building_zones write paths for contractors on both flows, so
// the inline tree CRUD and bulk-load CSV work as expected.
function ContractorBuildings({ session }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: buildings = null } = useContractorBuildings(session?.organizationId);
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (buildings === null) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)', fontSize: 13 }}>
        {t('contractor.buildings.loading')}
      </div>
    );
  }

  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setSelected(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icon.chevR size={11} style={{ transform: 'rotate(180deg)' }} />
            {t('contractor.buildings.back')}
          </button>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{selected.name}</div>
          {selected.ownership === 'managed' && (
            <Pill tone="neutral">{t('contractor.buildings.managed_by', { name: selected.managerName })}</Pill>
          )}
          {selected.ownership === 'self' && <Pill tone="accent">{t('contractor.buildings.self_owned')}</Pill>}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <HypervisorPage
            building={{ id: selected.id, name: selected.name, kind: selected.kind }}
            orgIdOverride={selected.ownership === 'managed' ? selected.managerOrgId : undefined}
            editable={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {t('contractor.buildings.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {buildings.length === 0
              ? t('contractor.buildings.subtitle_empty')
              : t('contractor.buildings.subtitle', { n: buildings.length })}
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          <Icon.plus size={12} />
          {t('contractor.buildings.new_cta')}
        </button>
      </div>

      {buildings.length === 0 ? (
        <Card style={{ padding: 32, textAlign: 'center', maxWidth: 520, margin: '20px auto' }}>
          <Icon.building size={20} style={{ opacity: 0.6 }} />
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>{t('contractor.buildings.empty_title')}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('contractor.buildings.empty_body')}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelected(b)}
              style={{
                textAlign: 'left',
                fontFamily: 'inherit',
                cursor: 'pointer',
                padding: 16,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 120ms, transform 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-line)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon.building size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {b.ownership === 'managed'
                      ? t('contractor.buildings.managed_by', { name: b.managerName })
                      : t('contractor.buildings.self_owned')}
                  </div>
                </div>
                <Icon.chevR size={12} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 4 }} />
              </div>
              {b.contracts.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {b.contracts.map((c) => (
                    <Pill key={c.id} tone="accent">
                      {c.service_kind}
                    </Pill>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {createOpen && (
        <NewBuildingModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ['contractor-buildings', session?.organizationId] });
          }}
        />
      )}
    </div>
  );
}

// PR3 — Self-serve building creation. Tiny modal: name input → submit
// calls createTopLevelBuilding which inserts a top-level locations
// row owned by the contractor's org. The new building appears in the
// Buildings tab grid after the parent component bumps refreshTick.
function NewBuildingModal({ onClose, onCreated }) {
  const t = useT();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await createTopLevelBuilding({ name });
      onCreated();
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(460px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.building size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{t('contractor.buildings.new_title')}</div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
          >
            <Icon.close size={14} />
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55 }}>
            {t('contractor.buildings.new_body')}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
              {t('contractor.buildings.new_name_label')}
            </span>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              disabled={busy}
              placeholder={t('contractor.buildings.new_name_placeholder')}
              style={{
                padding: '8px 10px',
                fontSize: 13,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'inherit',
              }}
            />
          </label>
          {err && (
            <div
              style={{
                padding: 10,
                borderRadius: 6,
                fontSize: 11.5,
                background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
                color: 'var(--risk)',
                fontFamily: 'var(--mono)',
              }}
            >
              {err}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('contractor.buildings.new_cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              background: name.trim() ? 'var(--accent)' : 'var(--surface-3)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: busy || !name.trim() ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: name.trim() ? 1 : 0.6,
            }}
          >
            {busy ? t('contractor.buildings.new_busy') : t('contractor.buildings.new_submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Hero({ org, counts }) {
  const t = useT();
  const fmt = (n, currency = 'USD') => {
    if (!n) return '—';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `$${Math.round(n).toLocaleString()}`;
    }
  };
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
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          {t('contractor.hero.eyebrow', { ws: org?.name || t('contractor.hero.workspace_fallback') })}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>{t('tab.contracts')}</h1>
        <p style={{ margin: '6px 0 12px', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
          {t('contractor.hero.body')}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat label={t('contractor.stat.active')} value={counts.active} tone="ok" />
          <Stat label={t('contractor.stat.draft')} value={counts.draft} tone="warn" />
          <Stat label={t('contractor.stat.total')} value={counts.total} tone="neutral" />
          <Stat label={t('contractor.stat.monthly_value')} value={fmt(counts.monthlyValue)} tone="accent" />
        </div>
      </div>
    </Card>
  );
}

// AnalyticsStrip — Phase 8.8 of the contractor intelligence loop.
// Sits below the Hero on Operations → Contracts, surfacing the
// contractor org's portfolio analytics: lifetime revenue, win rate,
// median FM decision time, biggest pilot improvement this quarter.
// Computed entirely client-side from already-realtime contracts +
// proposals + reports. Hides itself if there's nothing to show
// (empty contractor, just signed up).
function AnalyticsStrip({ orgId }) {
  const { metrics, loaded } = useContractorAnalytics(orgId);
  if (!loaded) return null;
  // Hide when there's not enough history to be interesting — avoids
  // a row of dashes on a brand-new contractor.
  if (metrics.activeContracts === 0 && metrics.proposalsTotal === 0) return null;

  const fmtMoney = (n, currency = 'USD') => {
    if (n == null || Number.isNaN(n)) return '—';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `$${Math.round(n).toLocaleString()}`;
    }
  };
  const fmtPct = (n) => (n == null ? '—' : `${Math.round(n * 100)}%`);

  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          Run my business
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <AnalyticsCard
            label="Lifetime revenue"
            value={fmtMoney(metrics.lifetimeRevenue)}
            sub={`across ${metrics.activeContracts} active contract${metrics.activeContracts === 1 ? '' : 's'}`}
            tone="ok"
            icon="sla"
          />
          <AnalyticsCard
            label="Run rate"
            value={`${fmtMoney(metrics.monthlyRunRate)}/mo`}
            sub={`annualized: ${fmtMoney(metrics.monthlyRunRate * 12)}`}
            tone="accent"
            icon="bolt"
          />
          <AnalyticsCard
            label="Proposal win rate"
            value={fmtPct(metrics.winRate)}
            sub={
              metrics.winRate == null
                ? `${metrics.proposalsTotal} total · need ≥3 decided`
                : `${metrics.proposalsAccepted} accepted of ${metrics.proposalsTotal} total`
            }
            tone={metrics.winRate != null && metrics.winRate >= 0.5 ? 'ok' : 'neutral'}
            icon="check"
          />
          <AnalyticsCard
            label="Median decision time"
            value={metrics.decisionDays == null ? '—' : `${metrics.decisionDays}d`}
            sub={metrics.decisionDays == null ? 'need ≥3 decided proposals' : 'submitted → decided across all FMs'}
            tone="neutral"
            icon="sparkle"
          />
          {metrics.proposalsPending > 0 && (
            <AnalyticsCard
              label="Awaiting decision"
              value={metrics.proposalsPending}
              sub="proposals submitted or countered"
              tone="warn"
              icon="warn"
            />
          )}
        </div>
        {metrics.biggestImprovement && (
          <div
            style={{
              padding: 12,
              background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Icon.sparkle size={14} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: 'var(--ok)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                }}
              >
                Biggest improvement this quarter
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 3 }}>
                {metrics.biggestImprovement.sla_name}{' '}
                <span style={{ color: 'var(--ok)' }}>+{metrics.biggestImprovement.delta}pp</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 2 }}>
                from “{metrics.biggestImprovement.pilot_title}”
                {metrics.biggestImprovement.vendor_name && ` · partner: ${metrics.biggestImprovement.vendor_name}`}
                {metrics.biggestImprovement.decided_at &&
                  ` · accepted ${new Date(metrics.biggestImprovement.decided_at).toLocaleDateString()}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function AnalyticsCard({ label, value, sub, tone, icon }) {
  const palette = {
    ok: { fg: 'var(--ok)', bg: 'color-mix(in oklch, var(--ok) 10%, transparent)' },
    warn: { fg: 'var(--warn)', bg: 'color-mix(in oklch, var(--warn) 10%, transparent)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
    neutral: { fg: 'var(--text-soft)', bg: 'var(--surface-2)' },
  }[tone] || { fg: 'var(--text-soft)', bg: 'var(--surface-2)' };
  const IconC = (icon && Icon[icon]) || Icon.sparkle;
  return (
    <div
      style={{
        padding: 12,
        background: palette.bg,
        borderRadius: 8,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconC size={11} style={{ color: palette.fg }} />
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
      </div>
      <span style={{ fontSize: 20, fontWeight: 700, color: palette.fg, lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.4 }}>{sub}</span>}
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
        minWidth: 100,
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

function EmptyState() {
  const t = useT();
  return (
    <Card>
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Icon.sparkle size={28} style={{ color: 'var(--text-faint)' }} />
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: 'var(--text)' }}>
          {t('contractor.empty.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, maxWidth: 420, marginInline: 'auto' }}>
          {t('contractor.empty.body_pre')}
          <em>{t('contractor.empty.body_active')}</em>
          {t('contractor.empty.body_post')}
        </div>
      </div>
    </Card>
  );
}

const STATUS_TONE = { active: 'ok', draft: 'warn', expired: 'neutral', terminated: 'risk' };

function ContractCard({ contract, onOpen, onConvertProposal, onConvertRenewal }) {
  const t = useT();
  const locs = contract.contract_locations || [];
  const locNames = locs.map((cl) => cl.locations?.name || cl.location_id).filter(Boolean);
  const fmt = (n) => {
    if (!n) return null;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: contract.currency || 'USD',
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `$${Math.round(n).toLocaleString()}`;
    }
  };
  // Hoisted up to the card so both ContractSlaStrip + ContractMerlinTake
  // share the same fetch — avoids a duplicate /api/contracts/:id/performance
  // call. null contractId disables the hook for non-active contracts.
  const isActive = contract.status === 'active';
  const { slas, loaded } = useContractPerformance(isActive ? contract.id : null);

  // Phase 8.10 — renewal detection. Surface a callout when the contract
  // is active AND end_date is within 60 days. Lets the contractor
  // pre-empt the renewal conversation with an AI-drafted proposal.
  const daysToEnd = contract.end_date
    ? Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86_400_000)
    : null;
  const renewalEligible = isActive && daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 60;
  const [drafting, setDrafting] = useState(false);
  const [renewalError, setRenewalError] = useState(null);
  async function handleDraftRenewal(e) {
    e.stopPropagation();
    setDrafting(true);
    setRenewalError(null);
    try {
      const draft = await draftContractRenewal(contract.id);
      onConvertRenewal?.({
        title: draft.title,
        body: draft.body,
        category: 'scope_expansion',
        expected_outcome: draft.expected_outcome,
        monthly_value_delta: draft.monthly_value_delta,
      });
    } catch (err) {
      setRenewalError(err?.message || String(err));
    } finally {
      setDrafting(false);
    }
  }

  // Outer is a div+role="button" instead of a real <button> so we can
  // nest interactive children (the Merlin's take expand toggle) without
  // tripping the button-in-button HTML invariant. Enter/Space + click
  // both open the drawer to keep keyboard parity.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        padding: 16,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'var(--text)',
        gap: 10,
        transition: 'border-color .12s, background .12s, transform .12s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-line)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            {contract.manager_org?.name || t('contractor.card.unknown_client')}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {contract.name}
          </div>
        </div>
        <Pill tone={STATUS_TONE[contract.status] || 'neutral'}>{contract.status}</Pill>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Pill tone="info">{contract.service_kind}</Pill>
        {contract.monthly_value && (
          <Pill tone="accent">{t('contractor.card.monthly_suffix', { value: fmt(contract.monthly_value) })}</Pill>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>
        <div
          style={{
            fontWeight: 600,
            color: 'var(--text-dim)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.15,
            marginBottom: 3,
          }}
        >
          {locs.length === 1
            ? t('contractor.card.covers_one', { n: locs.length })
            : t('contractor.card.covers_many', { n: locs.length })}
        </div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {locNames.slice(0, 3).join(' · ')}
          {locNames.length > 3 && t('contractor.card.more_suffix', { n: locNames.length - 3 })}
          {locNames.length === 0 && (
            <span style={{ fontStyle: 'italic', color: 'var(--text-faint)' }}>{t('contractor.card.no_locations')}</span>
          )}
        </div>
      </div>

      {isActive && <ContractSlaStrip slas={slas} loaded={loaded} />}
      {isActive && (
        <ContractMerlinTake
          contractId={contract.id}
          perfSnapshot={slas}
          loaded={loaded}
          onConvertProposal={onConvertProposal}
        />
      )}

      <div style={{ fontSize: 10.5, color: 'var(--text-faint)', display: 'flex', gap: 10 }}>
        <span>{t('contractor.card.start', { date: contract.start_date })}</span>
        {contract.end_date && <span>{t('contractor.card.end', { date: contract.end_date })}</span>}
      </div>

      {/* Phase 8.10 — renewal callout. Visible only when end_date is
          ≤60d out. Click "Draft renewal" → Haiku composes a proposal
          grounded in the year's pilots; opens drawer with composer
          pre-filled. */}
      {renewalEligible && (
        <div
          style={{
            padding: 10,
            background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon.warn size={14} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              {daysToEnd === 0
                ? 'Contract ends today'
                : `Contract ends in ${daysToEnd} day${daysToEnd === 1 ? '' : 's'}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2, lineHeight: 1.4 }}>
              Get ahead of the conversation — let Merlin draft a renewal proposal grounded in the year's accepted
              pilots.
            </div>
            {renewalError && <div style={{ fontSize: 11, color: 'var(--risk)', marginTop: 4 }}>{renewalError}</div>}
            <button
              onClick={handleDraftRenewal}
              disabled={drafting}
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: 11.5,
                fontWeight: 700,
                color: drafting ? 'var(--text-faint)' : 'var(--accent)',
                cursor: drafting ? 'not-allowed' : 'pointer',
              }}
            >
              <Icon.sparkle size={11} />
              {drafting ? 'Drafting…' : 'Draft renewal with Merlin'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// SLA performance strip — Phase 1 of the contractor intelligence loop.
// Receives data from the parent ContractCard so the underlying
// useContractPerformance fetch is shared with ContractMerlinTake.
function ContractSlaStrip({ slas, loaded }) {
  if (!loaded) {
    return (
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 10,
          marginTop: 4,
          fontSize: 11,
          color: 'var(--text-faint)',
          fontStyle: 'italic',
        }}
      >
        Loading performance…
      </div>
    );
  }
  if (!slas || slas.length === 0) return null;

  const VISIBLE = 4;
  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 10,
        marginTop: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        SLA performance · this contract
      </div>
      {slas.slice(0, VISIBLE).map((s) => (
        <ContractSlaRow key={s.id} sla={s} />
      ))}
      {slas.length > VISIBLE && (
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
          +{slas.length - VISIBLE} more SLA{slas.length - VISIBLE === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}

// ContractMerlinTake — Phase 2 of the contractor intelligence loop.
// Lazy-renders Haiku-generated recommendations across 3 buckets:
//   operational  (do now)
//   strategic    (propose to the FM)
//   risk_alerts  (forward-looking)
// Click the toggle to expand → fetch → render. Cached per
// (contractId + perf snapshot) so collapse/expand doesn't re-fire.
function ContractMerlinTake({ contractId, perfSnapshot, loaded: perfLoaded, onConvertProposal }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useContractorRecommendations(contractId, perfSnapshot, open && perfLoaded);
  // Phase 5 — vendor lookup so MerlinBucket can render the AI-suggested
  // partner as a chip alongside each strategic recommendation.
  // useVendors is realtime-subscribed at module level, so calling it
  // here piggybacks on Innovate's existing subscription — no extra
  // network cost.
  const vendors = useVendors();
  const vendorsById = useMemo(() => {
    const m = new Map();
    if (Array.isArray(vendors)) for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);

  // No SLAs computable → no useful Merlin take to generate. Hide the toggle
  // entirely rather than offer an action that returns empty.
  if (perfLoaded && (!perfSnapshot || perfSnapshot.length === 0)) return null;

  const toggle = (e) => {
    // Prevent the parent card's onClick (which opens the drawer) from
    // firing when the user just wants to expand Merlin's take inline.
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
      <button
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '4px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          color: 'var(--accent)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        <Icon.sparkle size={11} />
        <span>Merlin's take</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--text-dim)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
              Drafting recommendations…
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11.5, color: 'var(--risk)' }}>Couldn't generate recommendations: {error}</div>
          )}
          {data && (
            <>
              <MerlinBucket label="Do now" tone="warn" items={data.operational} icon="bolt" />
              <MerlinBucket
                label="Propose to client"
                tone="accent"
                items={data.strategic}
                icon="sparkle"
                onConvert={onConvertProposal}
                vendorsById={vendorsById}
              />
              <MerlinBucket label="Risk alerts" tone="risk" items={data.risk_alerts} icon="warn" />
              {data.operational.length === 0 && data.strategic.length === 0 && data.risk_alerts.length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                  All clear — no specific recommendations right now.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MerlinBucket({ label, tone, items, icon, onConvert, vendorsById }) {
  if (!items || items.length === 0) return null;
  const palette =
    tone === 'risk'
      ? { bar: 'var(--risk)', text: 'var(--risk)', bg: 'color-mix(in oklch, var(--risk) 8%, transparent)' }
      : tone === 'warn'
        ? { bar: 'var(--warn)', text: 'var(--warn)', bg: 'color-mix(in oklch, var(--warn) 8%, transparent)' }
        : tone === 'accent'
          ? { bar: 'var(--accent)', text: 'var(--accent)', bg: 'var(--accent-soft)' }
          : { bar: 'var(--text-soft)', text: 'var(--text-soft)', bg: 'var(--surface-2)' };
  const IconComp = Icon[icon] || Icon.sparkle;

  // Items can be plain strings (operational + risk_alerts buckets) or
  // objects `{ text, vendor_id }` (strategic bucket post-Phase-5).
  // Normalize once here so the render code below stays simple.
  const normalized = items
    .map((it) => {
      if (typeof it === 'string') return { text: it, vendor_id: null };
      if (it && typeof it === 'object' && typeof it.text === 'string') {
        return { text: it.text, vendor_id: it.vendor_id || null };
      }
      return null;
    })
    .filter(Boolean);

  return (
    <div
      style={{
        borderLeft: `3px solid ${palette.bar}`,
        background: palette.bg,
        borderRadius: '0 8px 8px 0',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 9.5,
          fontWeight: 700,
          color: palette.text,
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        <IconComp size={10} />
        <span>{label}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {normalized.map((item, i) => {
          const vendor = item.vendor_id && vendorsById ? vendorsById.get(item.vendor_id) : null;
          return (
            <li
              key={i}
              style={{
                fontSize: 11.5,
                color: 'var(--text)',
                lineHeight: 1.4,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flex: 1 }}>{item.text}</span>
                {onConvert && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConvert(item);
                    }}
                    title={
                      vendor
                        ? `Convert into a proposal pre-attached to ${vendor.name}`
                        : 'Convert this recommendation into a proposal you can submit to the client'
                    }
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '2px 7px',
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 999,
                      fontFamily: 'inherit',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: 0.15,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon.send size={9} />
                    Make proposal
                  </button>
                )}
              </div>
              {vendor && (
                <div
                  title={vendor.tagline || ''}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 7px',
                    background: 'var(--surface)',
                    border: '1px solid var(--accent-line)',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    letterSpacing: 0.1,
                  }}
                >
                  <Icon.sparkle size={9} />
                  Suggested partner: {vendor.name}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
