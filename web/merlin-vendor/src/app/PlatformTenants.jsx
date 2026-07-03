// Platform → Tenants list (SaaS v1, phase 3).
// Adaptiv staff see every tenant org here. Click a row to open detail.
// "New tenant" opens a create modal that calls platform_create_tenant.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { navigateTo } from './use-route.js';
import {
  useAllTenants,
  platformCreateTenant,
  KIND_LABELS,
  LIFECYCLE_LABELS,
  LIFECYCLE_TONES,
  isDemoOrgSlug,
} from './platform-data.js';
import { inviteLink } from './org-data.js';
import { useT } from './i18n.js';
import { promptDialog } from './dialogs.jsx';

const KIND_FILTER_OPTIONS = [
  { id: 'all', labelKey: 'platform.tenants.kind.all' },
  { id: 'real_estate', labelKey: 'platform.tenants.kind.real_estate' },
  { id: 'contractor', labelKey: 'platform.tenants.kind.contractor' },
  { id: 'adaptiv', labelKey: 'platform.tenants.kind.adaptiv' },
];

const LIFECYCLE_FILTER_OPTIONS = [
  { id: 'all', labelKey: 'platform.tenants.state.all' },
  { id: 'active', labelKey: 'platform.tenants.state.active' },
  { id: 'suspended', labelKey: 'platform.tenants.state.suspended' },
  { id: 'deleted', labelKey: 'platform.tenants.state.deleted' },
];

export function PlatformTenantsPage() {
  const t = useT();
  const { tenants, ready } = useAllTenants();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  // Sort oldest-first by default — Meridian HQ (the demo workspace
  // most platform admins reach for) is the earliest org, and putting
  // newest-first hid it below the fold for JB. Click the column
  // header to flip if you want recent signups on top.
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'asc' });

  const filtered = useMemo(() => {
    let rows = tenants.slice();
    const q = search.trim().toLowerCase();
    if (q)
      rows = rows.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.primaryContactEmail || '').toLowerCase().includes(q),
      );
    if (kindFilter !== 'all') rows = rows.filter((t) => t.kind === kindFilter);
    if (stateFilter !== 'all') rows = rows.filter((t) => t.lifecycleState === stateFilter);
    rows.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [tenants, search, kindFilter, stateFilter, sort]);

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero count={tenants.length} onCreate={() => setCreateOpen(true)} />

      <Card pad={false}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <SearchBox value={search} onChange={setSearch} />
          <Select
            label={t('platform.tenants.kind_label')}
            value={kindFilter}
            onChange={setKindFilter}
            options={KIND_FILTER_OPTIONS}
          />
          <Select
            label={t('platform.tenants.state_label')}
            value={stateFilter}
            onChange={setStateFilter}
            options={LIFECYCLE_FILTER_OPTIONS}
          />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {ready
              ? t('platform.audit.count', { n: filtered.length, total: tenants.length })
              : t('platform.audit.loading')}
          </div>
        </div>
        <TenantsTable rows={filtered} sort={sort} onSort={setSort} ready={ready} />
      </Card>

      {createOpen && (
        <CreateTenantModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            navigateTo(`/platform/tenants/${id}`);
          }}
        />
      )}
    </div>
  );
}

function Hero({ count, onCreate }) {
  const t = useT();
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
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
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
            {t('platform.tenants.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.tenants.title')} <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>· {count}</span>
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>{t('platform.tenants.body')}</p>
        </div>
        <button
          onClick={onCreate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px color-mix(in oklch, var(--accent) 35%, transparent)',
          }}
        >
          <Icon.plus size={13} />
          {t('platform.tenants.new')}
        </button>
      </div>
    </Card>
  );
}

function SearchBox({ value, onChange }) {
  const t = useT();
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        minWidth: 280,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <Icon.search size={12} style={{ color: 'var(--text-dim)' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('platform.tenants.search_ph')}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: 12.5,
          minWidth: 0,
        }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  const t = useT();
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '5px 8px',
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {t(o.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TenantsTable({ rows, sort, onSort, ready }) {
  const t = useT();
  const cols = [
    { key: 'name', label: t('platform.tenants.col.name'), flex: '2 1 200px' },
    { key: 'slug', label: t('platform.tenants.col.slug'), flex: '1 1 120px' },
    { key: 'kind', label: t('platform.tenants.col.kind'), flex: '1 1 120px' },
    { key: 'membersCount', label: t('platform.tenants.col.members'), flex: '0 1 80px', align: 'right' },
    { key: 'locationsCount', label: t('platform.tenants.col.locations'), flex: '0 1 90px', align: 'right' },
    { key: 'lifecycleState', label: t('platform.tenants.col.state'), flex: '0 1 100px' },
    { key: 'createdAt', label: t('platform.tenants.col.created'), flex: '0 1 110px' },
    { key: 'primaryContactEmail', label: t('platform.tenants.col.contact'), flex: '1 1 180px' },
  ];
  const toggleSort = (key) => {
    onSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '10px 14px',
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      >
        {cols.map((c) => (
          <button
            key={c.key}
            onClick={() => toggleSort(c.key)}
            style={{
              flex: c.flex,
              textAlign: c.align || 'left',
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'inherit',
              fontWeight: 700,
              fontSize: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
            }}
          >
            {c.label}
            {sort.key === c.key && (
              <span style={{ fontSize: 9, color: 'var(--accent)' }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>
        ))}
      </div>
      {!ready && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.audit.loading')}</div>
      )}
      {ready && rows.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.tenants.empty_filter')}</div>
      )}
      {ready &&
        rows.map((t) => (
          <button
            key={t.id}
            onClick={() => navigateTo(`/platform/tenants/${t.id}`)}
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 14px',
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--text)',
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ flex: cols[0].flex, minWidth: 0, fontWeight: 700, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {t.name}
                </span>
                {isDemoOrgSlug(t.slug) && <DemoBadge />}
              </div>
            </div>
            <div style={{ flex: cols[1].flex, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
              {t.slug}
            </div>
            <div style={{ flex: cols[2].flex, fontSize: 12, color: 'var(--text-soft)' }}>
              {KIND_LABELS[t.kind] || t.kind}
            </div>
            <div style={{ flex: cols[3].flex, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              {t.membersCount}
            </div>
            <div style={{ flex: cols[4].flex, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              {t.locationsCount}
            </div>
            <div style={{ flex: cols[5].flex }}>
              <Pill tone={LIFECYCLE_TONES[t.lifecycleState] || 'neutral'}>
                {LIFECYCLE_LABELS[t.lifecycleState] || t.lifecycleState}
              </Pill>
            </div>
            <div style={{ flex: cols[6].flex, fontSize: 11.5, color: 'var(--text-dim)' }}>
              {t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '—'}
            </div>
            <div
              style={{
                flex: cols[7].flex,
                fontSize: 12,
                color: 'var(--text-soft)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {t.primaryContactEmail || <span style={{ color: 'var(--text-faint)' }}>—</span>}
            </div>
          </button>
        ))}
    </div>
  );
}

function CreateTenantModal({ onClose, onCreated }) {
  const t = useT();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState('real_estate');
  const [email, setEmail] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // After successful create with an owner email, capture the result and
  // show the invite-link surface instead of immediately navigating away.
  // The platform admin needs to copy + share that link.
  const [created, setCreated] = useState(null); // { orgId, inviteToken } or null

  // Auto-derive slug from name until the user explicitly edits it.
  const [slugDirty, setSlugDirty] = useState(false);
  const computedSlug = slugDirty ? slug : slugify(name);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const result = await platformCreateTenant({
        name: name.trim(),
        slug: computedSlug.trim(),
        kind,
        primaryContactEmail: email.trim() || null,
        ownerEmail: ownerEmail.trim() || null,
      });
      // If we minted an invite, hold the modal so the admin can copy the link.
      // Otherwise, navigate straight to the tenant detail.
      if (result.inviteToken) {
        setCreated(result);
      } else {
        onCreated(result.orgId);
      }
    } catch (ex) {
      setErr(ex.message || t('platform.tenants.modal.create_failed'));
    } finally {
      setBusy(false);
    }
  }

  // Success-with-invite view: show the link + copy button, then "Continue"
  // navigates to the tenant detail.
  if (created) {
    return (
      <CreateTenantSuccess
        orgId={created.orgId}
        inviteToken={created.inviteToken}
        ownerEmail={ownerEmail}
        onClose={onClose}
        onContinue={() => onCreated(created.orgId)}
      />
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: 460,
          maxWidth: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              letterSpacing: 0.15,
              textTransform: 'uppercase',
            }}
          >
            {t('platform.tenants.modal.eyebrow')}
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>{t('platform.tenants.modal.title')}</h2>
        </header>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label={t('platform.tenants.modal.field.name')} hint={t('platform.tenants.modal.field.name_hint')}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Acme Corp"
              style={inputStyle}
            />
          </Field>
          <Field label={t('platform.tenants.modal.field.slug')} hint={t('platform.tenants.modal.field.slug_hint')}>
            <input
              value={computedSlug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugDirty(true);
              }}
              onBlur={(e) => {
                if (!e.target.value) setSlugDirty(false);
              }}
              required
              pattern="[a-z0-9-]+"
              placeholder="acme-corp"
              style={inputStyle}
            />
          </Field>
          <Field label={t('platform.tenants.modal.field.kind')} hint={t('platform.tenants.modal.field.kind_hint')}>
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
              <option value="real_estate">{t('platform.tenants.kind.real_estate')}</option>
              <option value="contractor">{t('platform.tenants.kind.contractor')}</option>
            </select>
          </Field>
          <Field
            label={t('platform.tenants.modal.field.contact')}
            hint={t('platform.tenants.modal.field.contact_hint')}
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="ops@acme.com"
              style={inputStyle}
            />
          </Field>
          <Field
            label={t('platform.tenants.modal.field.owner_email')}
            hint={t('platform.tenants.modal.field.owner_email_hint')}
          >
            <input
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              type="email"
              placeholder="founder@acme.com"
              style={inputStyle}
            />
          </Field>
          {err && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--risk)',
                background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--risk) 35%, transparent)',
                borderRadius: 8,
              }}
            >
              {err}
            </div>
          )}
        </div>
        <footer
          style={{
            padding: 14,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" onClick={onClose} disabled={busy} style={btnGhost}>
            {t('platform.tenants.modal.cancel')}
          </button>
          <button type="submit" disabled={busy || !name.trim() || !computedSlug.trim()} style={btnPrimary}>
            {busy ? t('platform.tenants.modal.creating') : t('platform.tenants.modal.create')}
          </button>
        </footer>
      </form>
    </div>
  );
}

// Post-create success state for tenants provisioned with an owner email:
// the platform admin copies the invite URL and shares it out of band
// (slack / email). "Continue" lands on the tenant detail; "Done" closes
// the modal and stays on the tenants list.
function CreateTenantSuccess({ inviteToken, ownerEmail, onClose, onContinue }) {
  const t = useT();
  const url = inviteLink(inviteToken);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / no clipboard permission — fall back to selection.
      const ok = await promptDialog({ body: t('platform.tenants.success.copy_prompt'), defaultValue: url });
      if (ok !== null) setCopied(true);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--ok)',
              letterSpacing: 0.15,
              textTransform: 'uppercase',
            }}
          >
            {t('platform.tenants.success.eyebrow')}
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>
            {t('platform.tenants.success.title', { who: ownerEmail || t('platform.tenants.success.owner_fallback') })}
          </h2>
        </header>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.5 }}>
            {t('platform.tenants.success.body')}
            <strong>{t('platform.tenants.success.body_owner_bold')}</strong>
            {t('platform.tenants.success.body_post')}
          </p>
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              color: 'var(--text)',
              wordBreak: 'break-all',
            }}
          >
            {url}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={copy}
              style={{
                flex: 1,
                padding: '8px 14px',
                background: copied ? 'var(--ok)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copied ? t('platform.tenants.success.copied') : t('platform.tenants.success.copy')}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('platform.tenants.success.note')}
            <strong>{t('platform.tenants.success.note_path')}</strong>
            {t('platform.tenants.success.note_post')}
          </p>
        </div>
        <footer
          style={{
            padding: 14,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button onClick={onClose} style={btnGhost}>
            {t('platform.tenants.success.done')}
          </button>
          <button onClick={onContinue} style={btnPrimary}>
            {t('platform.tenants.success.open')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-soft)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  padding: '8px 10px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
};
const btnGhost = {
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnPrimary = {
  padding: '8px 14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
};

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

// Small inline badge marking demo / seed tenants so they're easy to
// scan-distinguish from real customers in the table. Warn-toned amber
// to differentiate from the pink STAFF badge on the users surface.
function DemoBadge() {
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '1px 6px',
        fontSize: 9.5,
        fontWeight: 800,
        color: 'var(--warn)',
        background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--warn) 32%, transparent)',
        borderRadius: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.15,
      }}
    >
      DEMO
    </span>
  );
}
