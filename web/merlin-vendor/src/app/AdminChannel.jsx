// Admin — Reseller channel section: manage child tenants (list, change plan,
// release from channel). Extracted from Admin.jsx (G2 split). Visible only when
// the active org has is_reseller=true; backed by reseller-data.js (mig 135 RPCs).
// Self-contained. Exports ChannelSection; StatTile / ChildRow stay file-internal.

import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { btnGhost } from './admin-ui.tsx';
import { useT } from './i18n.js';
import { useActiveOrg, useIsOrgAdmin } from './org-data.js';
import { useResellerChildren, updateChildPlan, releaseChild } from './reseller-data.js';
import { confirmDialog } from './dialogs.jsx';

// ─────────────────────── Reseller channel admin ───────────────────────
// Visible only when the active org has is_reseller=true. The org's
// owners + admins manage their child tenants here: see the list, change
// child plans, release a child from the channel.
//
// Backed by reseller-data.js (uses migration 135 RPCs: reseller_update_
// child_plan, reseller_release_child). RLS lets reseller-parent admins
// SELECT children's organizations rows; writes are gated by the RPCs.
export function ChannelSection() {
  const t = useT();
  const org = useActiveOrg();
  const isOrgAdmin = useIsOrgAdmin();
  const { rows: children, loading } = useResellerChildren(org?.id);

  if (!org?.is_reseller) {
    return (
      <Card>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('admin.channel.not_a_reseller')}</div>
      </Card>
    );
  }

  // Stats row — counts by plan + total children + branding-state breakdown.
  const stats = {
    total: children.length,
    enterprise: children.filter((c) => c.plan === 'enterprise').length,
    pro: children.filter((c) => c.plan === 'pro').length,
    starter: children.filter((c) => c.plan === 'starter').length,
    inheriting: children.filter((c) => c.brandingState === 'inheriting').length,
    own: children.filter((c) => c.brandingState === 'own').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon.beacon size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.channel.title')}</div>
          <Pill tone="accent">{t('admin.channel.reseller_hub_badge')}</Pill>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 14px', maxWidth: 720 }}>
          {t('admin.channel.subtitle')}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
          }}
        >
          <StatTile label={t('admin.channel.stat.total')} value={stats.total} tone="accent" />
          <StatTile label={t('admin.channel.stat.enterprise')} value={stats.enterprise} />
          <StatTile label={t('admin.channel.stat.pro')} value={stats.pro} />
          <StatTile label={t('admin.channel.stat.starter')} value={stats.starter} />
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)' }}>
          {t('admin.channel.branding_summary', { inheriting: stats.inheriting, own: stats.own })}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon.building size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.channel.children_title')}</div>
          <Pill>{children.length}</Pill>
        </div>

        {loading && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 16 }}>{t('admin.channel.loading')}</div>
        )}

        {!loading && children.length === 0 && (
          <div
            style={{
              padding: 22,
              background: 'var(--surface-2)',
              borderRadius: 8,
              border: '1px dashed var(--border)',
              fontSize: 12.5,
              color: 'var(--text-dim)',
              textAlign: 'center',
            }}
          >
            {t('admin.channel.empty')}
          </div>
        )}

        {!loading && children.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 1fr 1fr 1.4fr 130px',
                gap: 10,
                padding: '6px 12px',
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.15,
              }}
            >
              <div>{t('admin.channel.col.tenant')}</div>
              <div>{t('admin.channel.col.plan')}</div>
              <div>{t('admin.channel.col.branding')}</div>
              <div>{t('admin.channel.col.contact')}</div>
              <div style={{ textAlign: 'right' }}>{t('admin.channel.col.actions')}</div>
            </div>
            {children.map((c) => (
              <ChildRow key={c.id} child={c} parentOrgId={org.id} canWrite={isOrgAdmin} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatTile({ label, value, tone }) {
  const palette =
    tone === 'accent'
      ? { fg: 'var(--accent)', bg: 'var(--accent-soft)' }
      : { fg: 'var(--text)', bg: 'var(--surface-2)' };
  return (
    <div
      style={{
        padding: 10,
        background: palette.bg,
        borderRadius: 8,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
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
      <span style={{ fontSize: 18, fontWeight: 700, color: palette.fg, lineHeight: 1.1 }}>{value}</span>
    </div>
  );
}

function ChildRow({ child, parentOrgId, canWrite }) {
  const t = useT();
  const [plan, setPlan] = useState(child.plan);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Sync state when the child row refreshes after a save.
  useEffect(() => {
    setPlan(child.plan);
  }, [child.plan]);

  const dirty = plan !== child.plan;

  const onSavePlan = async () => {
    setErr('');
    setBusy(true);
    try {
      await updateChildPlan(child.id, plan, parentOrgId);
    } catch (ex) {
      setErr(ex.message || t('admin.channel.err.plan_failed'));
      setPlan(child.plan); // revert UI
    } finally {
      setBusy(false);
    }
  };

  const onRelease = async () => {
    if (!(await confirmDialog({ body: t('admin.channel.release_confirm', { name: child.name }), danger: true })))
      return;
    setErr('');
    setBusy(true);
    try {
      await releaseChild(child.id, parentOrgId);
    } catch (ex) {
      setErr(ex.message || t('admin.channel.err.release_failed'));
    } finally {
      setBusy(false);
    }
  };

  const brandingTone = child.brandingState === 'own' ? 'warn' : 'accent';
  const brandingLabel =
    child.brandingState === 'own' ? t('admin.channel.branding.own') : t('admin.channel.branding.inheriting');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1.4fr 130px',
        gap: 10,
        padding: '12px',
        background: 'var(--surface-2)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        alignItems: 'center',
        minHeight: 56,
      }}
    >
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
          {child.name}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {child.slug} · {child.memberCount} {t('admin.channel.members_short')}
        </div>
      </div>
      <div>
        {canWrite ? (
          <select
            value={plan}
            disabled={busy}
            onChange={(e) => setPlan(e.target.value)}
            onBlur={() => {
              if (dirty) onSavePlan();
            }}
            style={{
              padding: '5px 8px',
              fontSize: 12,
              background: 'var(--surface)',
              border: '1px solid ' + (dirty ? 'var(--accent-line)' : 'var(--border-strong)'),
              borderRadius: 6,
              fontFamily: 'inherit',
            }}
          >
            <option value="starter">{t('platform.detail.plan.value.starter')}</option>
            <option value="pro">{t('platform.detail.plan.value.pro')}</option>
            <option value="enterprise">{t('platform.detail.plan.value.enterprise')}</option>
          </select>
        ) : (
          <Pill tone="neutral">{t(`platform.detail.plan.value.${child.plan}`)}</Pill>
        )}
        {dirty && !busy && canWrite && (
          <button onClick={onSavePlan} style={{ ...btnGhost, marginLeft: 6, color: 'var(--accent)' }}>
            {t('admin.channel.save')}
          </button>
        )}
      </div>
      <div>
        <Pill tone={brandingTone}>{brandingLabel}</Pill>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--text-soft)',
          fontFamily: 'var(--mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {child.primaryContactEmail || '—'}
      </div>
      <div style={{ textAlign: 'right' }}>
        {canWrite && (
          <button onClick={onRelease} disabled={busy} style={{ ...btnGhost, color: 'var(--warn)' }}>
            {t('admin.channel.release')}
          </button>
        )}
      </div>
      {err && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--risk)', marginTop: 6 }}>{err}</div>}
    </div>
  );
}
