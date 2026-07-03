// Slide-in editor for a single tenant member. Reached by clicking
// any row in the MembersCard on /platform/tenants/<id>.
//
// Lets a platform admin:
//   - Edit profile fields (name, phone, title, company, full address)
//   - Change membership role (owner / admin / member)
//   - Send the password-recovery email
//   - Remove the member from this tenant

import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import {
  fetchMemberProfile,
  platformUpdateMemberProfile,
  platformResetMemberPassword,
  platformSetMemberRole,
  platformRemoveMember,
} from './platform-data.js';
import { useT } from './i18n.js';
import { confirmDialog } from './dialogs.jsx';

const PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'display_name',
  'phone',
  'title',
  'company',
  'address_line1',
  'address_line2',
  'city',
  'region',
  'postal_code',
  'country',
];

export function PlatformUserDrawer({ member, tenantId, onClose, onChanged }) {
  const t = useT();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [role, setRole] = useState(member.orgRole);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  // Hydrate full profile on mount; bare member row only has email + role.
  useEffect(() => {
    let alive = true;
    setBusy(true);
    fetchMemberProfile(member.userId).then((p) => {
      if (!alive) return;
      setProfile(p);
      const seed = {};
      for (const k of PROFILE_FIELDS) seed[k] = p?.[k] || '';
      setForm(seed);
      setBusy(false);
    });
    return () => {
      alive = false;
    };
  }, [member.userId]);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Build a patch of only changed fields so we don't overwrite values
  // we never showed (defensive against schema drift).
  const buildPatch = () => {
    const patch = {};
    for (const k of PROFILE_FIELDS) {
      const cur = profile?.[k] || '';
      const next = form[k] || '';
      if (cur !== next) patch[k] = next;
    }
    return patch;
  };

  const onSave = async () => {
    setErr('');
    setInfo('');
    setBusy(true);
    try {
      const patch = buildPatch();
      if (Object.keys(patch).length > 0) {
        await platformUpdateMemberProfile(member.userId, patch);
      }
      // Only update role when we have a tenant context AND the role
      // actually changed. Orgless users (drawer opened from the
      // cross-tenant Users page) save profile-only.
      if (tenantId && role !== member.orgRole) {
        await platformSetMemberRole(tenantId, member.userId, role);
      }
      onChanged?.();
      onClose();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.user.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  const onResetPw = async () => {
    setErr('');
    setInfo('');
    setBusy(true);
    try {
      const r = await platformResetMemberPassword(member.userId);
      setInfo(t('platform.detail.user.reset_sent', { email: r.email || member.email }));
    } catch (ex) {
      setErr(ex.message || t('platform.detail.user.reset_failed'));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (
      !(await confirmDialog({ body: t('platform.detail.members.remove_confirm', { name: member.name }), danger: true }))
    )
      return;
    setErr('');
    setBusy(true);
    try {
      await platformRemoveMember(tenantId, member.userId);
      onChanged?.();
      onClose();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.members.remove_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'color-mix(in oklch, #000 32%, transparent)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
          overflowY: 'auto',
        }}
      >
        <header
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.name}
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
              {member.email}
            </div>
          </div>
          <button onClick={onClose} style={ghostBtn()} disabled={busy}>
            <Icon.close size={12} />
          </button>
        </header>

        <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {info && <Banner tone="ok">{info}</Banner>}
          {err && <Banner tone="risk">{err}</Banner>}

          {/* Role — only meaningful when we have a tenant scope. When
              the drawer was opened from the cross-tenant Users page
              on an orgless user, tenantId is null and role mutation
              can't target a row — hide it rather than show a
              non-functional control. */}
          {tenantId && (
            <Field label={t('platform.detail.user.role')}>
              <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy} style={selectStyle()}>
                <option value="owner">{t('platform.detail.members.role.owner')}</option>
                <option value="admin">{t('platform.detail.members.role.admin')}</option>
                <option value="member">{t('platform.detail.members.role.member')}</option>
              </select>
            </Field>
          )}

          {/* Identity */}
          <Section title={t('platform.detail.user.section.identity')}>
            <Row>
              <Field label={t('platform.detail.user.first_name')}>
                <input value={form.first_name || ''} onChange={update('first_name')} style={inputStyle()} />
              </Field>
              <Field label={t('platform.detail.user.last_name')}>
                <input value={form.last_name || ''} onChange={update('last_name')} style={inputStyle()} />
              </Field>
            </Row>
            <Field label={t('platform.detail.user.display_name')} hint={t('platform.detail.user.display_name_hint')}>
              <input value={form.display_name || ''} onChange={update('display_name')} style={inputStyle()} />
            </Field>
          </Section>

          {/* Contact */}
          <Section title={t('platform.detail.user.section.contact')}>
            <Row>
              <Field label={t('platform.detail.user.phone')}>
                <input
                  value={form.phone || ''}
                  onChange={update('phone')}
                  placeholder="+1 415 …"
                  type="tel"
                  style={inputStyle()}
                />
              </Field>
              <Field label={t('platform.detail.user.title')}>
                <input value={form.title || ''} onChange={update('title')} style={inputStyle()} />
              </Field>
            </Row>
            <Field label={t('platform.detail.user.company')}>
              <input value={form.company || ''} onChange={update('company')} style={inputStyle()} />
            </Field>
          </Section>

          {/* Address */}
          <Section title={t('platform.detail.user.section.address')}>
            <Field label={t('platform.detail.user.address_line1')}>
              <input value={form.address_line1 || ''} onChange={update('address_line1')} style={inputStyle()} />
            </Field>
            <Field label={t('platform.detail.user.address_line2')}>
              <input value={form.address_line2 || ''} onChange={update('address_line2')} style={inputStyle()} />
            </Field>
            <Row>
              <Field label={t('platform.detail.user.city')}>
                <input value={form.city || ''} onChange={update('city')} style={inputStyle()} />
              </Field>
              <Field label={t('platform.detail.user.region')}>
                <input value={form.region || ''} onChange={update('region')} style={inputStyle()} />
              </Field>
            </Row>
            <Row>
              <Field label={t('platform.detail.user.postal_code')}>
                <input value={form.postal_code || ''} onChange={update('postal_code')} style={inputStyle()} />
              </Field>
              <Field label={t('platform.detail.user.country')}>
                <input value={form.country || ''} onChange={update('country')} style={inputStyle()} />
              </Field>
            </Row>
          </Section>

          {/* Account actions — destructive / asynchronous */}
          <Section title={t('platform.detail.user.section.account')}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={onResetPw} disabled={busy} style={ghostBtn()}>
                <Icon.shield size={11} /> {t('platform.detail.user.reset_password')}
              </button>
              {/* Remove is tenant-scoped (revoke from this org's
                  organization_members). Hide for orgless users. */}
              {tenantId && (
                <button onClick={onRemove} disabled={busy} style={dangerBtn()}>
                  <Icon.close size={11} /> {t('platform.detail.user.remove')}
                </button>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6 }}>
              {t('platform.detail.user.actions_hint')}
            </div>
          </Section>
        </div>

        <footer
          style={{
            flexShrink: 0,
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <button onClick={onClose} disabled={busy} style={ghostBtn()}>
            {t('platform.catalog.cancel')}
          </button>
          <button onClick={onSave} disabled={busy} style={primaryBtn()}>
            {busy ? t('platform.catalog.saving') : t('platform.catalog.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Banner({ tone, children }) {
  const bg =
    tone === 'risk'
      ? 'color-mix(in oklch, var(--risk) 12%, transparent)'
      : 'color-mix(in oklch, var(--ok) 12%, transparent)';
  const fg = tone === 'risk' ? 'var(--risk)' : 'var(--ok)';
  return (
    <div
      style={{
        padding: '8px 10px',
        fontSize: 11.5,
        fontWeight: 600,
        color: fg,
        background: bg,
        border: `1px solid ${fg}`,
        borderRadius: 6,
      }}
    >
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingTop: 10,
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{hint}</span>}
    </label>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>;
}

function inputStyle() {
  return {
    padding: '7px 10px',
    fontSize: 12.5,
    color: 'var(--text)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontFamily: 'var(--font)',
    width: '100%',
  };
}
function selectStyle() {
  return {
    padding: '7px 10px',
    fontSize: 12.5,
    color: 'var(--text)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    width: '100%',
  };
}
function primaryBtn() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    background: 'var(--accent)',
    color: '#fff',
    border: '1px solid var(--accent)',
    borderRadius: 6,
    cursor: 'pointer',
  };
}
function ghostBtn() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    background: 'transparent',
    color: 'var(--text-soft)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
  };
}
function dangerBtn() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    background: 'transparent',
    color: 'var(--risk)',
    border: '1px solid color-mix(in oklch, var(--risk) 40%, transparent)',
    borderRadius: 6,
    cursor: 'pointer',
  };
}
