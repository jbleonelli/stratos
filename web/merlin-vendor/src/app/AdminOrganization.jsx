// Admin — Organization section: the org's identity + admin surface. Owns
// OrganizationSection and its cards (Branding, Subscription, Location-access
// grants, Invites) + the ORG_ROLE_LABEL_KEY label map. Extracted from Admin.jsx
// (G2 split — the last section out; Admin.jsx is now just AdminPage + Hero).
// Exports OrganizationSection; the cards stay file-internal.

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { Input, btnPrimary, btnGhost, btnDanger } from './admin-ui.tsx';
import { useT, useLanguage } from './i18n.js';
import { useSession, initialsOf } from './auth.js';
import {
  useActiveOrg,
  useOrgMembers,
  useIsOrgAdmin,
  useIsOrgOwner,
  useOrgCanWhiteLabel,
  invalidateActiveOrg,
  updateOrgName,
  usePendingInvites,
  createInvite,
  revokeInvite,
  inviteLink,
  useOrgGrants,
  createGrant,
  revokeGrant,
} from './org-data.js';
import { useBuildingsForActiveOrg, flattenTreeForPicker } from './custom-locations.js';
import { confirmDialog, alertDialog } from './dialogs.jsx';
import { uploadBrandingAsset, deleteBrandingAsset, saveOrgBranding } from './branding-data.js';
import {
  openCustomerPortal,
  useUpcomingInvoice,
  formatStripeAmount,
  useDataSourceUsage,
  dataSourceCapFor,
} from './subscription-data.js';

// ─────────────────────────── Organization (Phase 11c) ───────────────────────────

const ORG_ROLE_LABEL_KEY = {
  owner: 'admin.org.role.owner',
  admin: 'admin.org.role.admin',
  member: 'admin.org.role.member',
};

export function OrganizationSection({ building }) {
  const t = useT();
  const org = useActiveOrg();
  const members = useOrgMembers();
  const session = useSession();
  const isAdmin = useIsOrgAdmin();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(org?.name || '');
    setErr('');
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setErr('');
  };
  const save = async () => {
    if (!draft.trim()) {
      setErr(t('admin.org.name_empty'));
      return;
    }
    setSaving(true);
    try {
      await updateOrgName(org.id, draft);
      setEditing(false);
    } catch (ex) {
      setErr(ex.message || t('admin.org.update_failed'));
    } finally {
      setSaving(false);
    }
  };

  // Sort: owners first, then admins, then members; within each group by joined_at asc.
  const sortedMembers = [...members].sort((a, b) => {
    const rank = { owner: 0, admin: 1, member: 2 };
    const ra = rank[a.role] ?? 9;
    const rb = rank[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    return new Date(a.joined_at) - new Date(b.joined_at);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon.sparkle size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.section.organization')}</div>
          <div style={{ flex: 1 }} />
          {!editing && isAdmin && (
            <button onClick={startEdit} style={btnGhost}>
              {t('admin.org.rename')}
            </button>
          )}
        </div>

        {!org && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 4px' }}>
            <AdaptivLoader size="sm" />
          </div>
        )}

        {org && !editing && (
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.2,
                fontWeight: 700,
              }}
            >
              {t('admin.org.workspace')}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{org.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, fontFamily: 'var(--mono)' }}>
              {org.slug}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
              {t('admin.org.created', {
                date: new Date(org.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }),
              })}
            </div>
          </div>
        )}

        {org && editing && (
          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: 14,
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              borderRadius: 10,
            }}
          >
            <Input
              placeholder={t('admin.org.placeholder_name')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            {err && <div style={{ color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button type="button" onClick={cancel} style={btnGhost}>
                {t('admin.users.cancel')}
              </button>
              <button type="button" onClick={save} disabled={saving} style={btnPrimary}>
                {saving ? t('admin.le.saving') : t('admin.users.save')}
              </button>
            </div>
          </div>
        )}
      </Card>

      <SubscriptionCard org={org} isAdmin={isAdmin} building={building} />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon.people size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.members')}</div>
          <Pill>{sortedMembers.length}</Pill>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {sortedMembers.map((m) => {
            const isYou = m.user_id === session?.userId;
            const p = m.profile || {};
            const displayName =
              p.display_name ||
              [p.first_name, p.last_name].filter(Boolean).join(' ') ||
              p.email ||
              t('admin.org.unknown');
            const tone = m.role === 'owner' ? 'risk' : m.role === 'admin' ? 'accent' : 'neutral';
            return (
              <div
                key={m.user_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px minmax(0, 1fr) auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 9,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #20286D, #FF00B2)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.3,
                  }}
                >
                  {initialsOf(displayName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayName}
                    {isYou && (
                      <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 600, marginLeft: 6 }}>
                        {t('admin.org.you')}
                      </span>
                    )}
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
                    {p.email}
                    {p.role ? ` · ${p.role}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <Pill tone={tone}>{ORG_ROLE_LABEL_KEY[m.role] ? t(ORG_ROLE_LABEL_KEY[m.role]) : m.role}</Pill>
                  <div style={{ fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                    {t('admin.org.joined', {
                      date: new Date(m.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          {sortedMembers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', fontSize: 12.5 }}>
              {t('admin.org.no_members')}
            </div>
          )}
        </div>
      </Card>

      {isAdmin && <InvitesCard />}
      {isAdmin && <LocationAccessCard members={sortedMembers} />}
      <BrandingCard />
    </div>
  );
}

// White-label branding (migration 133 + Phase 2 UI).
// Visible only when the org satisfies the gate AND the caller is an
// org owner. Three controls: logo, accent color, favicon. RLS + the
// branding-gate CHECK constraint are the source of truth; this card
// is the typed handle.
function BrandingCard() {
  const t = useT();
  const org = useActiveOrg();
  const isOwner = useIsOrgOwner();
  const canBrand = useOrgCanWhiteLabel();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [accent, setAccent] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');

  useEffect(() => {
    if (!org) return;
    setEnabled(!!org.branding_enabled);
    setAccent(org.branding_accent_hex || '');
    setLogoUrl(org.branding_logo_url || '');
    setFaviconUrl(org.branding_favicon_url || '');
  }, [org]);

  // Owner-only visibility. Brand identity is the workspace owner's
  // territory; admins and members don't need to see it at all (the
  // previous read-only-for-admins compromise leaked the feature gate
  // to every employee in an Enterprise org). RLS at the DB layer
  // already blocks non-owner writes via the branding-gate CHECK
  // constraint — this hides the UI to match.
  if (!org || !canBrand || !isOwner) return null;

  const onUpload = async (kind, ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const url = await uploadBrandingAsset(org.id, file, kind);
      if (kind === 'logo') setLogoUrl(url);
      if (kind === 'favicon') setFaviconUrl(url);
    } catch (ex) {
      setErr(ex.message || t('admin.branding.upload_failed'));
    } finally {
      setBusy(false);
      ev.target.value = '';
    }
  };

  const onRemoveLogo = async () => {
    if (!logoUrl) return;
    setBusy(true);
    try {
      await deleteBrandingAsset(logoUrl);
    } catch {}
    setLogoUrl('');
    setBusy(false);
  };
  const onRemoveFavicon = async () => {
    if (!faviconUrl) return;
    setBusy(true);
    try {
      await deleteBrandingAsset(faviconUrl);
    } catch {}
    setFaviconUrl('');
    setBusy(false);
  };

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      const accentClean = accent.trim();
      if (accentClean && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accentClean)) {
        throw new Error(t('admin.branding.bad_hex'));
      }
      await saveOrgBranding(org.id, {
        brandingEnabled: enabled,
        accentHex: accentClean || null,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
      });
      invalidateActiveOrg();
    } catch (ex) {
      setErr(ex.message || t('admin.branding.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.branding.title')}</div>
        <Pill tone="accent">{t('admin.branding.enterprise_badge')}</Pill>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 14px', maxWidth: 600 }}>
        {t('admin.branding.subtitle')}
      </p>

      {/* Toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => setEnabled(e.target.checked)} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t('admin.branding.enable')}</span>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Logo */}
        <div
          style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 9, border: '1px solid var(--border)' }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.15,
              marginBottom: 8,
            }}
          >
            {t('admin.branding.logo_label')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 64,
                height: 64,
                background: 'var(--surface)',
                border: '1px dashed var(--border-strong)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <Icon.sparkle size={20} style={{ color: 'var(--text-faint)' }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...btnGhost, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon.plus size={11} />
                {t('admin.branding.upload')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={busy}
                  onChange={(e) => onUpload('logo', e)}
                  style={{ display: 'none' }}
                />
              </label>
              {logoUrl && (
                <button onClick={onRemoveLogo} disabled={busy} style={{ ...btnGhost, color: 'var(--warn)' }}>
                  {t('admin.branding.remove')}
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 8 }}>
            {t('admin.branding.logo_hint')}
          </div>
        </div>

        {/* Accent color */}
        <div
          style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 9, border: '1px solid var(--border)' }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.15,
              marginBottom: 8,
            }}
          >
            {t('admin.branding.accent_label')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={accent || '#FF00B2'}
              disabled={busy}
              onChange={(e) => setAccent(e.target.value)}
              style={{ width: 56, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
            <input
              type="text"
              placeholder="#0066FF"
              value={accent}
              disabled={busy}
              onChange={(e) => setAccent(e.target.value)}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12.5,
                padding: '6px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                width: 120,
              }}
            />
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 8 }}>
            {t('admin.branding.accent_hint')}
          </div>
        </div>
      </div>

      {/* Favicon */}
      <div
        style={{
          padding: 12,
          background: 'var(--surface-2)',
          borderRadius: 9,
          border: '1px solid var(--border)',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.15,
            marginBottom: 8,
          }}
        >
          {t('admin.branding.favicon_label')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--surface)',
              border: '1px dashed var(--border-strong)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {faviconUrl ? (
              <img src={faviconUrl} alt="favicon" style={{ maxWidth: '100%', maxHeight: '100%' }} />
            ) : (
              <Icon.sparkle size={14} style={{ color: 'var(--text-faint)' }} />
            )}
          </div>
          <label style={{ ...btnGhost, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon.plus size={11} />
            {t('admin.branding.upload')}
            <input
              type="file"
              accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
              disabled={busy}
              onChange={(e) => onUpload('favicon', e)}
              style={{ display: 'none' }}
            />
          </label>
          {faviconUrl && (
            <button onClick={onRemoveFavicon} disabled={busy} style={{ ...btnGhost, color: 'var(--warn)' }}>
              {t('admin.branding.remove')}
            </button>
          )}
        </div>
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--risk)', marginBottom: 10 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={busy} style={btnPrimary}>
          {busy ? t('admin.branding.saving') : t('admin.branding.save')}
        </button>
      </div>
    </Card>
  );
}
// removed: LoadDemoCard + DemoPickerModal (demo workspace feature) — see git history before 2026-05-05

// Subscription state + Customer Portal entrypoint. Renders inside
// OrganizationSection between the workspace card and the members
// roster. Admins/owners with an active Stripe customer get a "Manage
// subscription" button; everyone else sees the current plan label
// without the CTA.
function SubscriptionCard({ org, isAdmin, building }) {
  const t = useT();
  const lang = useLanguage();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Only fetch when on Pro — saves a roundtrip for Starter / Enterprise.
  const orgIdForInvoice = org?.plan === 'pro' ? org.id : null;
  const upcoming = useUpcomingInvoice(orgIdForInvoice);

  // Data-source cap: Pro = per-building, Starter/Enterprise = org-wide.
  // useDataSourceUsage skips the RPC when orgId is null (Enterprise
  // is unlimited, but we still fetch + show the count for visibility).
  const cap = dataSourceCapFor(org?.plan);
  const usageBuildingId = cap.perBuilding ? building?.id || null : null;
  const usage = useDataSourceUsage(org?.id, usageBuildingId);

  if (!org) return null;

  // Plan label sources: i18n key per plan, with sensible fallback for
  // any plan we don't yet have copy for (defensive against future plans).
  const plan = org.plan || 'starter';
  const planKey = `admin.org.plan.${plan}`;
  const planLabel = t(planKey);

  const status = org.subscription_status || null;
  // Tone of the status pill:
  //   active/trialing   → neutral (green-ish in the design system)
  //   past_due/unpaid   → warn
  //   canceled/incomplete → risk
  //   anything else / null → don't render a status pill
  const statusTone =
    status === 'active' || status === 'trialing'
      ? 'accent'
      : status === 'past_due' || status === 'unpaid'
        ? 'warn'
        : status === 'canceled' || status === 'incomplete' || status === 'incomplete_expired'
          ? 'risk'
          : null;
  const statusLabel = status ? t(`admin.org.sub_status.${status}`) : null;

  // CTA visibility:
  //   - Need admin/owner role server-side AND client-side.
  //   - Need a Stripe customer on the org row (set after first Checkout).
  //   - Enterprise plans bill manually — no portal CTA.
  const canManage = isAdmin && plan !== 'enterprise' && Boolean(org.stripe_customer_id);
  // Starter orgs with no Stripe customer get a softer Upgrade CTA back
  // to the public pricing page.
  const canUpgrade = isAdmin && plan === 'starter' && !org.stripe_customer_id;

  async function onManage() {
    setErr('');
    setBusy(true);
    const result = await openCustomerPortal();
    setBusy(false);
    if (!result.ok) {
      // Server error strings are intentionally human-readable
      // ('no stripe customer for this org' etc.). Map the known ones
      // to localized copy; anything else falls back to a generic
      // failure with the raw message appended so support can debug.
      const errStr = String(result.error || '');
      const key =
        errStr === 'demo_mode'
          ? 'admin.org.portal_demo_mode'
          : errStr.startsWith('no stripe customer')
            ? 'admin.org.portal_no_customer'
            : 'admin.org.portal_failed';
      setErr(t(key));
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.beacon size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.org.subscription')}</div>
        <Pill tone={statusTone || undefined}>{planLabel}</Pill>
        {statusLabel && <Pill tone={statusTone || undefined}>{statusLabel}</Pill>}
        <div style={{ flex: 1 }} />
        {canManage && (
          <button type="button" onClick={onManage} disabled={busy} style={btnGhost}>
            {busy ? t('admin.org.portal_opening') : t('admin.org.manage_subscription')}
          </button>
        )}
        {canUpgrade && (
          <a
            href="/pricing"
            style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            {t('admin.org.upgrade_to_pro')}
          </a>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>
        {plan === 'enterprise'
          ? t('admin.org.sub_blurb_enterprise')
          : plan === 'pro'
            ? t('admin.org.sub_blurb_pro')
            : t('admin.org.sub_blurb_starter')}
      </div>

      {/* Data-source usage. Cap rule (pricing PR):
            starter    → 25 org-wide
            pro        → 250 per building (+50 / $25/mo overage)
            enterprise → unlimited (no cap shown)
          Soft-warn (warn tone) when over cap — no hard block today;
          enforcement + Stripe overage billing is a follow-up. */}
      {!usage.loading && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: 'var(--surface-2)',
            border: `1px solid ${cap.limit && usage.count > cap.limit ? 'color-mix(in oklch, var(--warn) 40%, var(--border))' : 'var(--border)'}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.2,
              fontWeight: 700,
            }}
          >
            {cap.perBuilding && building?.name
              ? t('admin.org.datasources_label_building', { building: building.name })
              : t('admin.org.datasources_label_org')}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: cap.limit && usage.count > cap.limit ? 'var(--warn)' : 'var(--text)',
            }}
          >
            {usage.count}
            {cap.limit != null ? ` / ${cap.limit}` : ''}
          </div>
          {cap.limit == null && (
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{t('admin.org.datasources_unlimited')}</span>
          )}
          {cap.limit != null && usage.count > cap.limit && (
            <span style={{ fontSize: 12, color: 'var(--warn)' }}>
              {plan === 'pro'
                ? t('admin.org.datasources_overage_pro', { over: usage.count - cap.limit })
                : t('admin.org.datasources_over_cap')}
            </span>
          )}
        </div>
      )}

      {/* Pro orgs: surface Stripe's authoritative next-invoice total.
          We hide the row entirely when unavailable (loading slow,
          non-billable status, demo mode) so the card never shows a
          partial / scary state. */}
      {plan === 'pro' && upcoming.available && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.2,
                fontWeight: 700,
              }}
            >
              {t('admin.org.next_invoice')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {formatStripeAmount(upcoming.invoice.amount_due, upcoming.invoice.currency, lang)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {t('admin.org.next_invoice_on', {
                date: new Date(upcoming.invoice.period_end * 1000).toLocaleDateString(
                  lang === 'fr' ? 'fr-FR' : 'en-US',
                  { month: 'short', day: 'numeric', year: 'numeric' },
                ),
              })}
            </div>
          </div>
          {(upcoming.invoice.lines || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {upcoming.invoice.lines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--text-dim)',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {line.description || t('admin.org.next_invoice_line_unnamed')}
                    {line.quantity > 1 ? ` × ${line.quantity}` : ''}
                  </span>
                  <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {formatStripeAmount(line.amount, upcoming.invoice.currency, lang)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <div style={{ marginTop: 10, color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
    </Card>
  );
}

function LocationAccessCard({ members }) {
  const t = useT();
  const grants = useOrgGrants();
  const buildings = useBuildingsForActiveOrg();
  const locationOptions = useMemo(() => flattenTreeForPicker(buildings, { kind: null }), [buildings]);
  const [grantingFor, setGrantingFor] = useState(null); // user_id being edited

  // Group grants by user
  const byUser = {};
  for (const g of grants) (byUser[g.user_id] ||= []).push(g);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon.building size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.location_access')}</div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 14 }}>{t('admin.access.body')}</div>

      <div style={{ display: 'grid', gap: 8 }}>
        {members.map((m) => {
          const userGrants = byUser[m.user_id] || [];
          const p = m.profile || {};
          const displayName =
            p.display_name ||
            [p.first_name, p.last_name].filter(Boolean).join(' ') ||
            p.email ||
            t('admin.org.unknown');
          const isGranting = grantingFor === m.user_id;
          return (
            <div
              key={m.user_id}
              style={{
                padding: '12px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px minmax(0, 1fr) auto',
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: userGrants.length > 0 || isGranting ? 10 : 0,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #20286D, #FF00B2)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.3,
                  }}
                >
                  {initialsOf(displayName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {userGrants.length === 0
                      ? t('admin.access.full_access')
                      : t(userGrants.length === 1 ? 'admin.access.n_grants_one' : 'admin.access.n_grants_many', {
                          n: userGrants.length,
                        })}
                  </div>
                </div>
                {!isGranting && (
                  <button onClick={() => setGrantingFor(m.user_id)} style={btnGhost}>
                    {t('admin.access.add_grant')}
                  </button>
                )}
              </div>

              {userGrants.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 42 }}>
                  {userGrants.map((g) => {
                    const opt = locationOptions.find((o) => o.id === g.location_id);
                    const label = opt?.label || g.location_id;
                    return (
                      <div
                        key={g.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 7,
                          fontSize: 11.5,
                        }}
                      >
                        <Icon.building size={10} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <button
                          onClick={async () => {
                            if (
                              !(await confirmDialog({
                                body: t('admin.access.revoke_confirm', { label }),
                                danger: true,
                              }))
                            )
                              return;
                            try {
                              await revokeGrant(g.id);
                            } catch (ex) {
                              alertDialog(ex.message || t('admin.access.revoke_failed'));
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--risk)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '2px 6px',
                          }}
                        >
                          {t('admin.access.revoke')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {isGranting && (
                <GrantPicker
                  options={locationOptions}
                  existing={userGrants.map((g) => g.location_id)}
                  onCancel={() => setGrantingFor(null)}
                  onGrant={async (locationId) => {
                    try {
                      await createGrant({ user_id: m.user_id, location_id: locationId });
                      setGrantingFor(null);
                    } catch (ex) {
                      alertDialog(ex.message || t('admin.access.grant_failed'));
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function GrantPicker({ options, existing, onCancel, onGrant }) {
  const t = useT();
  const [pick, setPick] = useState('');
  const available = options.filter((o) => !existing.includes(o.id));
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 6,
        marginLeft: 42,
        padding: 10,
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-line)',
        borderRadius: 8,
      }}
    >
      <select
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        style={{
          padding: '6px 8px',
          fontSize: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          fontFamily: 'inherit',
        }}
      >
        <option value="">{t('admin.access.pick')}</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>
            {'— '.repeat(o.depth)}
            {o.label}
          </option>
        ))}
      </select>
      <button onClick={onCancel} style={btnGhost}>
        {t('admin.access.cancel')}
      </button>
      <button disabled={!pick} onClick={() => onGrant(pick)} style={btnPrimary}>
        {t('admin.access.grant')}
      </button>
    </div>
  );
}

function InvitesCard() {
  const t = useT();
  const invites = usePendingInvites();
  const [inviting, setInviting] = useState(false);
  const [freshLink, setFreshLink] = useState(null);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.ship size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.pending_invites')}</div>
        <Pill>{invites.length}</Pill>
        <div style={{ flex: 1 }} />
        {!inviting && (
          <button
            onClick={() => {
              setInviting(true);
              setFreshLink(null);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Icon.plus size={11} /> {t('admin.invites.invite')}
          </button>
        )}
      </div>

      {inviting && (
        <InviteForm
          onClose={() => setInviting(false)}
          onCreated={(row) => {
            setFreshLink(row);
            setInviting(false);
          }}
        />
      )}

      {freshLink && <InviteLinkCallout invite={freshLink} onDone={() => setFreshLink(null)} />}

      <div style={{ display: 'grid', gap: 6 }}>
        {invites.map((inv) => (
          <InviteRow key={inv.id} invite={inv} />
        ))}
        {invites.length === 0 && !inviting && !freshLink && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: 12.5 }}>
            {(() => {
              const tmpl = t('admin.invites.empty', { strong: 'XSTRONGX' });
              const [pre, post = ''] = tmpl.split('XSTRONGX');
              return (
                <>
                  {pre}
                  <strong style={{ color: 'var(--text-soft)' }}>{t('admin.invites.invite')}</strong>
                  {post}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </Card>
  );
}

function InviteForm({ onClose, onCreated }) {
  const t = useT();
  // Tier gating (migration 132): admins can only invite at role='member'.
  // Owners can invite at any role. The server enforces this via RLS on
  // organization_invites; this just keeps the UI honest so the caller
  // doesn't see a confusing post-submit failure.
  const isOwner = useIsOrgOwner();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const row = await createInvite({ email, role });
      onCreated(row);
    } catch (ex) {
      setErr(ex.message || t('admin.invites.create_failed'));
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 140px auto auto',
        gap: 10,
        marginBottom: 14,
        padding: 14,
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-line)',
        borderRadius: 10,
        alignItems: 'center',
      }}
    >
      <Input
        placeholder={t('admin.invites.placeholder_email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
        autoFocus
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        style={{
          padding: '8px 10px',
          fontSize: 12.5,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          fontFamily: 'inherit',
        }}
      >
        <option value="member">{t('admin.org.role.member')}</option>
        {isOwner && <option value="admin">{t('admin.org.role.admin')}</option>}
        {isOwner && <option value="owner">{t('admin.org.role.owner')}</option>}
      </select>
      <button type="button" onClick={onClose} style={btnGhost}>
        {t('admin.access.cancel')}
      </button>
      <button type="submit" disabled={saving} style={btnPrimary}>
        {saving ? t('admin.invites.creating') : t('admin.invites.create_link')}
      </button>
      {err && <div style={{ gridColumn: '1 / -1', color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
    </form>
  );
}

function InviteLinkCallout({ invite, onDone }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const link = inviteLink(invite.token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select the input.
      const el = document.getElementById(`invite-link-${invite.id}`);
      el?.select();
    }
  };
  return (
    <div
      style={{
        padding: 14,
        marginBottom: 14,
        background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--ok) 35%, transparent)',
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon.check size={14} style={{ color: 'var(--ok)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
          {t('admin.invites.created_for', { email: invite.email })}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onDone} style={btnGhost}>
          {t('admin.invites.dismiss')}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 8 }}>
        {t('admin.invites.share_expires', {
          date: new Date(invite.expires_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
        <input
          id={`invite-link-${invite.id}`}
          value={link}
          readOnly
          onFocus={(e) => e.target.select()}
          style={{
            padding: '8px 10px',
            fontSize: 12,
            fontFamily: 'var(--mono)',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            color: 'var(--text)',
            minWidth: 0,
          }}
        />
        <button onClick={copy} style={btnPrimary}>
          {copied ? t('admin.invites.copied') : t('admin.invites.copy_link')}
        </button>
      </div>
    </div>
  );
}

function InviteRow({ invite }) {
  const t = useT();
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const toneByRole = { owner: 'risk', admin: 'accent', member: 'neutral' };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const doRevoke = async () => {
    if (!(await confirmDialog({ body: t('admin.invites.revoke_confirm', { email: invite.email }), danger: true })))
      return;
    setRevoking(true);
    try {
      await revokeInvite(invite.id);
    } catch (ex) {
      alertDialog(ex.message || t('admin.access.revoke_failed'));
      setRevoking(false);
    }
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
        gap: 10,
        alignItems: 'center',
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 9,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {invite.email}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
          {t('admin.invites.expires', {
            date: new Date(invite.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          })}
        </div>
      </div>
      <Pill tone={toneByRole[invite.role] || 'neutral'}>
        {ORG_ROLE_LABEL_KEY[invite.role] ? t(ORG_ROLE_LABEL_KEY[invite.role]) : invite.role}
      </Pill>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={copy} style={btnGhost}>
          {copied ? t('admin.invites.copied') : t('admin.invites.copy_link')}
        </button>
        <button onClick={doRevoke} disabled={revoking} style={btnDanger}>
          {revoking ? '…' : t('admin.invites.revoke')}
        </button>
      </div>
    </div>
  );
}
