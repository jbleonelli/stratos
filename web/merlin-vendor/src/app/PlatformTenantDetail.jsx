// Platform → Tenant detail (SaaS v1, phase 3).
// Header summary, members list, and lifecycle action panel
// (suspend / un-suspend / soft-delete + edit primary contact email).

import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { navigateTo } from './use-route.js';
import {
  fetchTenantById,
  fetchTenantMembers,
  fetchTenantLocationsBreakdown,
  fetchTenantLocations,
  fetchTenantBranchCount,
  platformCreateLocation,
  platformUpdateLocation,
  platformDeleteLocation,
  platformSuspendTenant,
  platformUnsuspendTenant,
  platformSoftDeleteTenant,
  platformUpdateTenantContact,
  platformUpdateTenantSlug,
  platformUpdateTenantPlan,
  platformImpersonateStart,
  updateTenantResellerFields,
  updateTenantBedrockGeo,
  updateTenantModels,
  AI_MODEL_OPTIONS,
  fetchResellerOrgs,
  KIND_LABELS,
  LIFECYCLE_LABELS,
  LIFECYCLE_TONES,
} from './platform-data.js';
import { useSession } from './auth.js';
import { PlatformUserDrawer } from './PlatformUserDrawer.jsx';
import { LocationDrawer } from './LocationDrawer.jsx';
import { confirmDialog, alertDialog } from './dialogs.jsx';
import { useT } from './i18n.js';

export function PlatformTenantDetailPage({ tenantId }) {
  const t = useT();
  const [tenant, setTenant] = useState(null);
  const [members, setMembers] = useState([]);
  const [locBreak, setLocBreak] = useState({ total: 0, byKind: [], distinctAddresses: 0 });
  const [locations, setLocations] = useState([]);
  const [branchCnt, setBranchCnt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bumpAt, setBumpAt] = useState(0); // refresh trigger after mutations

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [t, m, lb, locs, bc] = await Promise.all([
        fetchTenantById(tenantId),
        fetchTenantMembers(tenantId),
        fetchTenantLocationsBreakdown(tenantId),
        fetchTenantLocations(tenantId),
        fetchTenantBranchCount(tenantId),
      ]);
      if (!cancelled) {
        setTenant(t);
        setMembers(m);
        setLocBreak(lb);
        setLocations(locs);
        setBranchCnt(bc);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, bumpAt]);

  const refresh = () => setBumpAt(Date.now());

  if (loading) {
    return (
      <div style={{ padding: 'var(--pad)' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.detail.loading')}</div>
      </div>
    );
  }
  if (!tenant) {
    return (
      <div style={{ padding: 'var(--pad)' }}>
        <BackButton />
        <Card>
          <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{t('platform.detail.not_found')}</div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <BackButton />
      <DetailHero tenant={tenant} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
        <ContactCard tenant={tenant} onSaved={refresh} />
        <SlugCard tenant={tenant} onSaved={refresh} />
      </div>
      <LifecycleCard tenant={tenant} onChanged={refresh} />
      <PlanCard tenant={tenant} onChanged={refresh} />
      <AiRegionCard tenant={tenant} onChanged={refresh} />
      <AiModelsCard tenant={tenant} onChanged={refresh} />
      <ResellerChannelCard tenant={tenant} onChanged={refresh} />
      <LocationsBreakdownCard breakdown={locBreak} branchCount={branchCnt} />
      <LocationsCard tenantId={tenant.id} locations={locations} onChanged={refresh} />
      <MembersCard members={members} tenantId={tenant.id} onChanged={refresh} />
    </div>
  );
}

// Subscription plan override (Super-Admin only).
// Stripe Customer Portal drives plan changes for self-serve customers.
// Enterprise customers are typically on negotiated annual contracts
// billed outside Stripe — there's no Customer Portal flow for them.
// This card is the Super-Admin override: set the plan column directly.
// Server-side platform_update_tenant_plan RPC (migration 134) audit-logs
// the change.
function PlanCard({ tenant, onChanged }) {
  const t = useT();
  const session = useSession();

  const [plan, setPlan] = useState(tenant.plan || 'starter');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setPlan(tenant.plan || 'starter');
  }, [tenant.plan]);

  // Super-Admin-only — early return AFTER hooks (rules-of-hooks).
  if (!session?.isSuperAdmin) return null;

  const dirty = plan !== (tenant.plan || 'starter');

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      await platformUpdateTenantPlan(tenant.id, plan);
      onChanged?.();
    } catch (ex) {
      const code = ex.message || 'plan_save_failed';
      setErr(
        t(`platform.detail.plan.err.${code}`) === `platform.detail.plan.err.${code}`
          ? t('platform.detail.plan.err.generic')
          : t(`platform.detail.plan.err.${code}`),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon.cart size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.detail.plan.title')}</div>
        <Pill tone="accent">{t('platform.detail.plan.super_admin_only')}</Pill>
        <Pill tone="neutral">{t(`platform.detail.plan.value.${tenant.plan || 'starter'}`)}</Pill>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 14px', maxWidth: 640 }}>
        {t('platform.detail.plan.subtitle')}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <select
          value={plan}
          disabled={busy}
          onChange={(e) => setPlan(e.target.value)}
          style={{
            padding: '8px 10px',
            fontSize: 12.5,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            fontFamily: 'inherit',
            minWidth: 180,
          }}
        >
          <option value="starter">{t('platform.detail.plan.value.starter')}</option>
          <option value="pro">{t('platform.detail.plan.value.pro')}</option>
          <option value="enterprise">{t('platform.detail.plan.value.enterprise')}</option>
        </select>
        <button
          onClick={save}
          disabled={!dirty || busy}
          style={{
            padding: '8px 16px',
            fontSize: 12.5,
            fontWeight: 700,
            background: dirty ? 'var(--accent)' : 'var(--surface-2)',
            color: dirty ? '#fff' : 'var(--text-dim)',
            border: '1px solid ' + (dirty ? 'var(--accent)' : 'var(--border)'),
            borderRadius: 8,
            cursor: dirty && !busy ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {busy ? t('platform.detail.plan.saving') : t('platform.detail.plan.save')}
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-faint)', maxWidth: 640 }}>
        {t('platform.detail.plan.audit_note')}
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--risk)', marginTop: 10 }}>{err}</div>}
    </Card>
  );
}

// AI (Bedrock) inference region override (Super-Admin only). Sets
// organizations.bedrock_geo, read per-request by api/_lib/claude-client.ts
// resolveOrgGeo() to route this tenant's Claude calls to us-east-1 (default) or
// eu-central-1 (data residency). Mirrors PlanCard.
function AiRegionCard({ tenant, onChanged }) {
  const t = useT();
  const session = useSession();

  const current = tenant.bedrockGeo === 'eu' ? 'eu' : 'us';
  const [geo, setGeo] = useState(current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setGeo(tenant.bedrockGeo === 'eu' ? 'eu' : 'us');
  }, [tenant.bedrockGeo]);

  // Super-Admin-only — early return AFTER hooks (rules-of-hooks).
  if (!session?.isSuperAdmin) return null;

  const dirty = geo !== current;

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      await updateTenantBedrockGeo(tenant.id, geo);
      onChanged?.();
    } catch {
      setErr(t('platform.detail.airegion.err.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon.map size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.detail.airegion.title')}</div>
        <Pill tone="accent">{t('platform.detail.airegion.super_admin_only')}</Pill>
        <Pill tone="neutral">{t(`platform.detail.airegion.value.${current}`)}</Pill>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 14px', maxWidth: 640 }}>
        {t('platform.detail.airegion.subtitle')}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <select
          value={geo}
          disabled={busy}
          onChange={(e) => setGeo(e.target.value)}
          style={{
            padding: '8px 10px',
            fontSize: 12.5,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            fontFamily: 'inherit',
            minWidth: 220,
          }}
        >
          <option value="us">{t('platform.detail.airegion.value.us')}</option>
          <option value="eu">{t('platform.detail.airegion.value.eu')}</option>
        </select>
        <button
          onClick={save}
          disabled={!dirty || busy}
          style={{
            padding: '8px 16px',
            fontSize: 12.5,
            fontWeight: 700,
            background: dirty ? 'var(--accent)' : 'var(--surface-2)',
            color: dirty ? '#fff' : 'var(--text-dim)',
            border: '1px solid ' + (dirty ? 'var(--accent)' : 'var(--border)'),
            borderRadius: 8,
            cursor: dirty && !busy ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {busy ? t('platform.detail.airegion.saving') : t('platform.detail.airegion.save')}
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-faint)', maxWidth: 640 }}>
        {t('platform.detail.airegion.note')}
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--risk)', marginTop: 10 }}>{err}</div>}
    </Card>
  );
}

// Per-org LLM model override (Super-Admin only). Sets organizations.model_fast /
// model_thoughtful, read per-request by resolveOrgLlm(). Empty = inherit the
// platform default. Two roles: fast (agents/translate/quick chat) and thoughtful
// (analytical chat/extract/compliance). Mirrors AiRegionCard.
function AiModelsCard({ tenant, onChanged }) {
  const t = useT();
  const session = useSession();

  const [fast, setFast] = useState(tenant.modelFast || '');
  const [thoughtful, setThoughtful] = useState(tenant.modelThoughtful || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setFast(tenant.modelFast || '');
    setThoughtful(tenant.modelThoughtful || '');
  }, [tenant.modelFast, tenant.modelThoughtful]);

  // Super-Admin-only — early return AFTER hooks (rules-of-hooks).
  if (!session?.isSuperAdmin) return null;

  const dirty = fast !== (tenant.modelFast || '') || thoughtful !== (tenant.modelThoughtful || '');

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      await updateTenantModels(tenant.id, { fast, thoughtful });
      onChanged?.();
    } catch {
      setErr(t('platform.detail.aimodels.err.generic'));
    } finally {
      setBusy(false);
    }
  };

  const selectStyle = {
    padding: '8px 10px',
    fontSize: 12.5,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    fontFamily: 'inherit',
    minWidth: 260,
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon.cog size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.detail.aimodels.title')}</div>
        <Pill tone="accent">{t('platform.detail.aimodels.super_admin_only')}</Pill>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 14px', maxWidth: 640 }}>
        {t('platform.detail.aimodels.subtitle')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 150 }}>
            {t('platform.detail.aimodels.role.fast')}
          </span>
          <select value={fast} disabled={busy} onChange={(e) => setFast(e.target.value)} style={selectStyle}>
            <option value="">{t('platform.detail.aimodels.inherit')}</option>
            {AI_MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 150 }}>
            {t('platform.detail.aimodels.role.thoughtful')}
          </span>
          <select
            value={thoughtful}
            disabled={busy}
            onChange={(e) => setThoughtful(e.target.value)}
            style={selectStyle}
          >
            <option value="">{t('platform.detail.aimodels.inherit')}</option>
            {AI_MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={save}
        disabled={!dirty || busy}
        style={{
          padding: '8px 16px',
          fontSize: 12.5,
          fontWeight: 700,
          background: dirty ? 'var(--accent)' : 'var(--surface-2)',
          color: dirty ? '#fff' : 'var(--text-dim)',
          border: '1px solid ' + (dirty ? 'var(--accent)' : 'var(--border)'),
          borderRadius: 8,
          cursor: dirty && !busy ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
        }}
      >
        {busy ? t('platform.detail.aimodels.saving') : t('platform.detail.aimodels.save')}
      </button>

      <div style={{ fontSize: 11, color: 'var(--text-faint)', maxWidth: 640, marginTop: 12 }}>
        {t('platform.detail.aimodels.note')}
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--risk)', marginTop: 10 }}>{err}</div>}
    </Card>
  );
}

// White-label + reseller channel administration (Super-Admin only).
// Three controls:
//   - is_reseller toggle: marks this org as a reseller hub
//   - whitelabel_enabled toggle: allows branding even off-plan
//                                (partnership / custom-contract escape hatch)
//   - parent_org_id select:      assigns this tenant to a reseller hub
// The customer-side Branding card on Admin → Organization is what the
// org owner uses to actually upload logo / pick color. This card is
// the prerequisite — flipping the gates that let the customer use it.
function ResellerChannelCard({ tenant, onChanged }) {
  const t = useT();
  const session = useSession();
  // Super-Admin-only (defense-in-depth — the platform shell sidebar also hides
  // this surface for Normal Users via mig 131 tier gating). The early return is
  // AFTER the hooks below (rules-of-hooks); the effect self-guards so a
  // non-super-admin never fires a denied fetch.

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [isReseller, setIsReseller] = useState(!!tenant.isReseller);
  const [whitelabelEnabled, setWhitelabelEnabled] = useState(!!tenant.whitelabelEnabled);
  const [parentOrgId, setParentOrgId] = useState(tenant.parentOrgId || '');
  const [resellerOptions, setResellerOptions] = useState([]);

  useEffect(() => {
    if (!session?.isSuperAdmin) return undefined;
    let cancelled = false;
    fetchResellerOrgs().then((rows) => {
      if (cancelled) return;
      // Don't let an org be its own parent.
      setResellerOptions((rows || []).filter((r) => r.id !== tenant.id));
    });
    return () => {
      cancelled = true;
    };
  }, [tenant.id, session?.isSuperAdmin]);

  if (!session?.isSuperAdmin) return null;

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      await updateTenantResellerFields(tenant.id, {
        isReseller,
        whitelabelEnabled,
        parentOrgId: parentOrgId || null,
      });
      onChanged?.();
    } catch (ex) {
      setErr(ex.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    isReseller !== !!tenant.isReseller ||
    whitelabelEnabled !== !!tenant.whitelabelEnabled ||
    (parentOrgId || '') !== (tenant.parentOrgId || '');

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.detail.reseller.title')}</div>
        <Pill tone="accent">{t('platform.detail.reseller.super_admin_only')}</Pill>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 14px', maxWidth: 640 }}>
        {t('platform.detail.reseller.subtitle')}
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={isReseller}
            disabled={busy}
            onChange={(e) => setIsReseller(e.target.checked)}
          />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('platform.detail.reseller.is_reseller_label')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {t('platform.detail.reseller.is_reseller_hint')}
            </div>
          </div>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={whitelabelEnabled}
            disabled={busy}
            onChange={(e) => setWhitelabelEnabled(e.target.checked)}
          />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('platform.detail.reseller.whitelabel_label')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {t('platform.detail.reseller.whitelabel_hint')}
            </div>
          </div>
        </label>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.15,
            marginBottom: 6,
          }}
        >
          {t('platform.detail.reseller.parent_label')}
        </div>
        <select
          value={parentOrgId}
          disabled={busy || isReseller}
          onChange={(e) => setParentOrgId(e.target.value)}
          style={{
            padding: '8px 10px',
            fontSize: 12.5,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            fontFamily: 'inherit',
            minWidth: 280,
          }}
        >
          <option value="">{t('platform.detail.reseller.parent_none')}</option>
          {resellerOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 6 }}>
          {isReseller ? t('platform.detail.reseller.parent_self_hint') : t('platform.detail.reseller.parent_hint')}
        </div>
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--risk)', marginBottom: 10 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={save}
          disabled={!dirty || busy}
          style={{
            padding: '8px 16px',
            fontSize: 12.5,
            fontWeight: 700,
            background: dirty ? 'var(--accent)' : 'var(--surface-2)',
            color: dirty ? '#fff' : 'var(--text-dim)',
            border: '1px solid ' + (dirty ? 'var(--accent)' : 'var(--border)'),
            borderRadius: 8,
            cursor: dirty && !busy ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {busy ? t('platform.detail.reseller.saving') : t('platform.detail.reseller.save')}
        </button>
      </div>
    </Card>
  );
}

function BackButton() {
  const t = useT();
  return (
    <button
      onClick={() => navigateTo('/platform/tenants')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'transparent',
        color: 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        alignSelf: 'flex-start',
      }}
    >
      <Icon.chevR size={10} style={{ transform: 'rotate(180deg)' }} />
      {t('platform.detail.back')}
    </button>
  );
}

function DetailHero({ tenant }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const startImpersonate = async () => {
    if (busy) return;
    const ok = await confirmDialog(t('platform.detail.impersonate_confirm', { name: tenant.name }));
    if (!ok) return;
    setBusy(true);
    try {
      await platformImpersonateStart(tenant.id);
    } catch (ex) {
      alertDialog(ex.message || t('platform.detail.impersonate_failed'));
      setBusy(false);
    }
  };

  const canImpersonate = tenant.kind !== 'adaptiv' && tenant.lifecycleState !== 'deleted';

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
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('platform.detail.eyebrow', { kind: KIND_LABELS[tenant.kind] || tenant.kind })}
          </div>
          <h1
            style={{
              margin: '6px 0 0',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.01,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {tenant.name}
            <Pill tone={LIFECYCLE_TONES[tenant.lifecycleState] || 'neutral'}>
              {LIFECYCLE_LABELS[tenant.lifecycleState] || tenant.lifecycleState}
            </Pill>
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              marginTop: 10,
              color: 'var(--text-dim)',
              fontSize: 12,
            }}
          >
            <Stat
              label={t('platform.detail.stat.slug')}
              value={<span style={{ fontFamily: 'var(--mono)' }}>{tenant.slug}</span>}
            />
            <Stat
              label={t('platform.detail.stat.created')}
              value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleString() : '—'}
            />
            {tenant.suspendedAt && (
              <Stat
                label={t('platform.detail.stat.suspended')}
                value={new Date(tenant.suspendedAt).toLocaleString()}
                tone="warn"
              />
            )}
            {tenant.deletedAt && (
              <Stat
                label={t('platform.detail.stat.deleted')}
                value={new Date(tenant.deletedAt).toLocaleString()}
                tone="risk"
              />
            )}
          </div>
          {tenant.suspendedReason && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 10px',
                background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--warn)',
                fontWeight: 600,
              }}
            >
              {t('platform.detail.reason', { reason: tenant.suspendedReason })}
            </div>
          )}
        </div>
        {canImpersonate && (
          <button
            onClick={startImpersonate}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: busy ? 'color-mix(in oklch, var(--accent) 50%, transparent)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px color-mix(in oklch, var(--accent) 35%, transparent)',
              flexShrink: 0,
            }}
          >
            <Icon.chevR size={12} />
            {busy ? t('platform.detail.impersonate_busy') : t('platform.detail.impersonate_btn')}
          </button>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          color: tone === 'warn' ? 'var(--warn)' : tone === 'risk' ? 'var(--risk)' : 'var(--text-soft)',
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SlugCard({ tenant, onSaved }) {
  const t = useT();
  // Local mirror so the field is editable. Reset to incoming when
  // the parent refreshes (other mutation landed). Slugs are cleaned
  // client-side to lowercase letters / digits / hyphens — server does
  // the same validation + uniqueness, so a malformed slug is rejected
  // with a translated error string instead of failing silently.
  const [slug, setSlug] = useState(tenant.slug || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setSlug(tenant.slug || '');
    setErr('');
  }, [tenant.slug]);

  const cleaned = slug.toLowerCase().trim();
  const dirty = cleaned !== (tenant.slug || '');
  const valid =
    cleaned.length >= 2 &&
    cleaned.length <= 60 &&
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(cleaned) &&
    !cleaned.includes('--');

  async function save() {
    setErr('');
    setBusy(true);
    try {
      await platformUpdateTenantSlug(tenant.id, cleaned);
      onSaved();
    } catch (ex) {
      // Map server error codes to friendly i18n strings; fall back
      // to the raw message if it's something we didn't anticipate.
      const m = ex.message || '';
      const key = m.includes('slug_taken')
        ? 'platform.detail.slug.err.taken'
        : m.includes('slug_format')
          ? 'platform.detail.slug.err.format'
          : m.includes('slug_length')
            ? 'platform.detail.slug.err.length'
            : m.includes('slug_required')
              ? 'platform.detail.slug.err.required'
              : m.includes('tenant_not_found')
                ? 'platform.detail.slug.err.not_found'
                : null;
      const localized = key ? t(key) : null;
      setErr(localized && localized !== key ? localized : m || t('platform.detail.slug.save_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeader title={t('platform.detail.slug.title')} subtitle={t('platform.detail.slug.subtitle')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="acme-corp"
          spellCheck={false}
          style={{
            padding: '8px 10px',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'var(--mono)',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{t('platform.detail.slug.hint')}</div>
        {dirty && !valid && <ErrorRow text={t('platform.detail.slug.err.format')} />}
        {err && <ErrorRow text={err} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button disabled={!dirty || !valid || busy} onClick={save} style={btnPrimary(!dirty || !valid || busy)}>
            {busy ? t('platform.detail.slug.saving') : t('platform.detail.slug.save')}
          </button>
        </div>
      </div>
    </Card>
  );
}

function ContactCard({ tenant, onSaved }) {
  const t = useT();
  const [email, setEmail] = useState(tenant.primaryContactEmail || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dirty = email !== (tenant.primaryContactEmail || '');

  async function save() {
    setErr('');
    setBusy(true);
    try {
      await platformUpdateTenantContact(tenant.id, email.trim());
      onSaved();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.contact.save_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeader title={t('platform.detail.contact.title')} subtitle={t('platform.detail.contact.subtitle')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="ops@example.com"
          style={{
            padding: '8px 10px',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        {err && <ErrorRow text={err} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button disabled={!dirty || busy} onClick={save} style={btnPrimary(!dirty || busy)}>
            {busy ? t('platform.detail.contact.saving') : t('platform.detail.contact.save')}
          </button>
        </div>
      </div>
    </Card>
  );
}

function LifecycleCard({ tenant, onChanged }) {
  const t = useT();
  return (
    <Card>
      <SectionHeader title={t('platform.detail.lifecycle.title')} subtitle={t('platform.detail.lifecycle.subtitle')} />
      {/* alignItems: flex-start prevents the flex column from
          stretching child rows to full pane width. JB called the
          full-width Suspend / Soft-delete buttons too aggressive;
          natural-width buttons read as cautious admin actions. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        {tenant.lifecycleState === 'active' && <SuspendRow tenantId={tenant.id} onChanged={onChanged} />}
        {tenant.lifecycleState === 'suspended' && <UnsuspendRow tenantId={tenant.id} onChanged={onChanged} />}
        {tenant.lifecycleState !== 'deleted' && <SoftDeleteRow tenantId={tenant.id} onChanged={onChanged} />}
        {tenant.lifecycleState === 'deleted' && (
          <div
            style={{
              padding: '10px 12px',
              background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--risk) 35%, transparent)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--risk)',
              fontWeight: 600,
            }}
          >
            {t('platform.detail.lifecycle.deleted_note')}
          </div>
        )}
      </div>
    </Card>
  );
}

function SuspendRow({ tenantId, onChanged }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setErr('');
    setBusy(true);
    try {
      await platformSuspendTenant(tenantId, reason.trim() || null);
      setOpen(false);
      setReason('');
      onChanged();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.suspend.failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={btnWarn()}>
        {t('platform.detail.suspend.btn')}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'stretch', width: '100%' }}>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('platform.detail.suspend.reason_ph')}
        style={{
          padding: '8px 10px',
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          borderRadius: 8,
          fontSize: 12.5,
        }}
      />
      {err && <ErrorRow text={err} />}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            setOpen(false);
            setErr('');
          }}
          disabled={busy}
          style={btnGhost()}
        >
          {t('platform.detail.suspend.cancel')}
        </button>
        <button onClick={go} disabled={busy} style={btnWarn()}>
          {busy ? t('platform.detail.suspend.busy') : t('platform.detail.suspend.confirm')}
        </button>
      </div>
    </div>
  );
}

function UnsuspendRow({ tenantId, onChanged }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setErr('');
    setBusy(true);
    try {
      await platformUnsuspendTenant(tenantId);
      onChanged();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.unsuspend.failed'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button onClick={go} disabled={busy} style={btnPrimary(busy)}>
        {busy ? t('platform.detail.unsuspend.busy') : t('platform.detail.unsuspend.btn')}
      </button>
      {err && <ErrorRow text={err} />}
    </>
  );
}

function SoftDeleteRow({ tenantId, onChanged }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setErr('');
    setBusy(true);
    try {
      await platformSoftDeleteTenant(tenantId);
      setOpen(false);
      onChanged();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.softdel.failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={btnRisk()}>
        {t('platform.detail.softdel.btn')}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'stretch', width: '100%' }}>
      <div
        style={{
          padding: '8px 10px',
          background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
          border: '1px solid color-mix(in oklch, var(--risk) 35%, transparent)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--risk)',
          fontWeight: 600,
        }}
      >
        {t('platform.detail.softdel.warning')}
      </div>
      {err && <ErrorRow text={err} />}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            setOpen(false);
            setErr('');
          }}
          disabled={busy}
          style={btnGhost()}
        >
          {t('platform.detail.softdel.cancel')}
        </button>
        <button onClick={go} disabled={busy} style={btnRisk()}>
          {busy ? t('platform.detail.softdel.busy') : t('platform.detail.softdel.confirm')}
        </button>
      </div>
    </div>
  );
}

// Locations breakdown — counts by kind + distinct-address count + (for
// FEB-style ecosystems) total branches inferred from device telemetry.
// Solves the Meridian-411-vs-FEB-6 confusion: shows that FEB has 6
// regional grouping rows in `locations` but 581 actual branch coords
// referenced from `devices.telemetry`.
const KIND_LABELS_FALLBACK = {
  ecosystem: 'Ecosystems',
  site: 'Sites',
  building: 'Buildings',
  branch: 'Branches',
  floor: 'Floors',
  zone: 'Zones',
  room: 'Rooms',
  restroom: 'Restrooms',
  meeting_room: 'Meeting rooms',
  conference_room: 'Conference rooms',
  training_room: 'Training rooms',
  lounge: 'Lounges',
  lobby: 'Lobby',
  amenity: 'Amenities',
  auditorium: 'Auditoriums',
  cafeteria: 'Cafeteria',
  server_room: 'Server rooms',
  dock: 'Loading docks',
  boardroom: 'Boardrooms',
  mailroom: 'Mailrooms',
  position: 'Positions',
};
function LocationsBreakdownCard({ breakdown }) {
  const t = useT();
  const {
    total,
    byKind,
    distinctAddresses,
    buildings,
    floors,
    zones,
    rooms,
    positions,
    operationalZones,
    routes,
    devices,
    sqftBuildings,
    sqftFloors,
    sqftRooms,
  } = breakdown;
  // Display "zones" as the operational count whenever the tenant has
  // any building_zones rows (e.g. Meridian's 208) — the locations-only
  // count (which would be 0 there) is almost always misleading. Falls
  // back to the locations count for tenants that haven't adopted
  // building_zones yet so the column never drops out.
  const displayedZones = operationalZones || zones || 0;
  const fmt = (n) => Number(n || 0).toLocaleString();
  const fmtSqft = (n) => (n > 0 ? `${Math.round(n).toLocaleString()} ft²` : '—');
  return (
    <Card>
      <SectionHeader title={t('platform.detail.locations.title')} subtitle={t('platform.detail.locations.subtitle')} />

      {/* Counts row — the canonical hierarchy. */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 4 }}
      >
        <Stat label={t('platform.detail.locations.stat.locations_addr')} value={fmt(distinctAddresses)} />
        <Stat label={t('platform.detail.locations.stat.buildings')} value={fmt(buildings)} />
        <Stat label={t('platform.detail.locations.stat.floors')} value={fmt(floors)} />
        <Stat label={t('platform.detail.locations.stat.zones')} value={fmt(displayedZones)} />
        <Stat label={t('platform.detail.locations.stat.rooms')} value={fmt(rooms)} />
        <Stat label={t('platform.detail.locations.stat.positions')} value={fmt(positions)} />
        {routes > 0 && <Stat label={t('platform.detail.locations.stat.routes')} value={fmt(routes)} />}
        {devices > 0 && <Stat label={t('platform.detail.locations.stat.devices')} value={fmt(devices)} tone="accent" />}
      </div>

      {/* Surface area row — the inner hierarchy where rooms roll up
          into floors which roll up into buildings. Each total comes
          from the locations.sqft text column parsed defensively. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
        }}
      >
        <Stat label={t('platform.detail.locations.stat.sqft_buildings')} value={fmtSqft(sqftBuildings)} />
        <Stat label={t('platform.detail.locations.stat.sqft_floors')} value={fmtSqft(sqftFloors)} />
        <Stat label={t('platform.detail.locations.stat.sqft_rooms')} value={fmtSqft(sqftRooms)} />
        {floors > 0 && (
          <Stat label={t('platform.detail.locations.stat.rooms_per_floor')} value={(rooms / floors).toFixed(1)} />
        )}
      </div>

      {byKind.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 8,
            }}
          >
            {t('platform.detail.locations.by_kind')} · {fmt(total)} {t('platform.detail.locations.total_rows')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {byKind.map((k) => (
              <Pill key={k.kind} tone="neutral">
                {KIND_LABELS_FALLBACK[k.kind] || k.kind} · <strong>{fmt(k.count)}</strong>
              </Pill>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// Editable locations list. Search + paginated rows + click-to-edit
// + "+ New" creates a fresh row in the drawer. Writes through
// platform-data.js helpers (RLS = is_platform_admin()), same table
// the customer-side Admin → Locations editor uses, so changes show
// up on both surfaces.
const LOCATIONS_PAGE_SIZE = 50;
function LocationsCard({ tenantId, locations, onChanged }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null); // location row in edit mode
  const [creating, setCreating] = useState(false); // shows new-mode drawer

  const q = search.trim().toLowerCase();
  const filtered = q
    ? locations.filter(
        (l) =>
          (l.name || '').toLowerCase().includes(q) ||
          (l.id || '').toLowerCase().includes(q) ||
          (l.addr || '').toLowerCase().includes(q) ||
          (l.kind || '').toLowerCase().includes(q),
      )
    : locations;
  const visible = filtered.slice(page * LOCATIONS_PAGE_SIZE, (page + 1) * LOCATIONS_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / LOCATIONS_PAGE_SIZE));

  // Parent dropdown options for the drawer — every other location in
  // this tenant. Sorted same way as the list for consistency.
  const parentOptions = locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind }));

  return (
    <>
      <Card pad={false}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              {t('platform.detail.locations_list.title', { n: locations.length.toLocaleString() })}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>
              {t('platform.detail.locations_list.subtitle')}
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={t('platform.detail.locations_list.search')}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              minWidth: 200,
            }}
          />
          <button
            onClick={() => setCreating(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: 'var(--accent)',
              color: '#fff',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <Icon.plus size={11} /> {t('platform.detail.locations_list.new')}
          </button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>
            {q ? t('platform.detail.locations_list.empty_filter') : t('platform.detail.locations_list.empty')}
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(160px, 200px) minmax(110px, 140px) minmax(180px, 1fr) minmax(220px, 1.5fr)',
                fontSize: 12,
              }}
            >
              <Header>{t('platform.detail.locations_list.col.id')}</Header>
              <Header>{t('platform.detail.locations_list.col.kind')}</Header>
              <Header>{t('platform.detail.locations_list.col.name')}</Header>
              <Header>{t('platform.detail.locations_list.col.addr')}</Header>
              {visible.map((l, i) => (
                <RowGroup key={l.id} onClick={() => setEditing(l)} first={i === 0}>
                  <Cell mono>{l.id}</Cell>
                  <Cell>{KIND_LABELS_FALLBACK[l.kind] || l.kind}</Cell>
                  <Cell>{l.name}</Cell>
                  <Cell>{l.addr || <span style={{ color: 'var(--text-faint)' }}>—</span>}</Cell>
                </RowGroup>
              ))}
            </div>
            {filtered.length > LOCATIONS_PAGE_SIZE && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button disabled={page === 0} onClick={() => setPage(page - 1)} style={pagerBtn(page === 0)}>
                  ← {t('platform.detail.locations_list.prev')}
                </button>
                <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {t('platform.detail.locations_list.page_of', { p: page + 1, total: totalPages })}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                  style={pagerBtn(page >= totalPages - 1)}
                >
                  {t('platform.detail.locations_list.next')} →
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {creating && (
        <LocationDrawer
          location={null}
          parents={parentOptions}
          isNew
          onCreate={(record) => platformCreateLocation(tenantId, record)}
          onUpdate={(id, patch) => platformUpdateLocation(id, patch)}
          onDelete={(id) => platformDeleteLocation(id)}
          onClose={() => setCreating(false)}
          onChanged={() => {
            setCreating(false);
            onChanged?.();
          }}
        />
      )}
      {editing && (
        <LocationDrawer
          location={editing}
          parents={parentOptions}
          isNew={false}
          onCreate={(record) => platformCreateLocation(tenantId, record)}
          onUpdate={(id, patch) => platformUpdateLocation(id, patch)}
          onDelete={(id) => platformDeleteLocation(id)}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function Header({ children }) {
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
        background: 'var(--surface-2)',
      }}
    >
      {children}
    </div>
  );
}
function Cell({ children, mono, first, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderTop: first ? 'none' : '1px solid var(--border)',
        color: 'var(--text-soft)',
        fontFamily: mono ? 'var(--mono)' : undefined,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}
function RowGroup({ children, onClick, first }) {
  return React.Children.map(children, (child) => React.cloneElement(child, { onClick, first }));
}
function pagerBtn(disabled) {
  return {
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    background: disabled ? 'transparent' : 'var(--surface-2)',
    color: disabled ? 'var(--text-faint)' : 'var(--text-soft)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function MembersCard({ members, tenantId, onChanged }) {
  const t = useT();
  // Member being edited in the drawer; null when no drawer is open.
  const [editing, setEditing] = useState(null);

  return (
    <>
      <Card>
        <SectionHeader
          title={t('platform.detail.members.title', { n: members.length })}
          subtitle={t('platform.detail.members.subtitle')}
        />
        {members.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('platform.detail.members.empty')}</div>
        ) : (
          <div>
            {members.map((m) => (
              <button
                key={m.userId}
                onClick={() => setEditing(m)}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '10px 12px',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.email}
                  </div>
                </div>
                <div
                  style={{
                    flex: '0 1 100px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--text-soft)',
                    alignSelf: 'center',
                  }}
                >
                  {t(`platform.detail.members.role.${m.orgRole}`)}
                </div>
                <div
                  style={{
                    flex: '0 1 100px',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    textAlign: 'right',
                    alignSelf: 'center',
                  }}
                >
                  {m.joinedAt ? new Date(m.joinedAt).toISOString().slice(0, 10) : '—'}
                </div>
                <Icon.chevR size={11} style={{ color: 'var(--text-faint)', alignSelf: 'center' }} />
              </button>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <PlatformUserDrawer
          member={editing}
          tenantId={tenantId}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <header style={{ marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
      {subtitle && (
        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>{subtitle}</p>
      )}
    </header>
  );
}

function ErrorRow({ text }) {
  return (
    <div
      style={{
        padding: '6px 10px',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--risk)',
        background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--risk) 35%, transparent)',
        borderRadius: 6,
      }}
    >
      {text}
    </div>
  );
}

const btnPrimary = (disabled) => ({
  padding: '8px 14px',
  background: disabled ? 'color-mix(in oklch, var(--accent) 50%, transparent)' : 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
const btnGhost = () => ({
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
});
const btnWarn = () => ({
  padding: '8px 14px',
  background: 'var(--warn)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
});
const btnRisk = () => ({
  padding: '8px 14px',
  background: 'var(--risk)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
});
