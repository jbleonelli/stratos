// Platform → Users — cross-tenant user directory.
//
// Adaptiv-side flat list of every profile row across every org, with
// the user's primary org + membership count + profile role surfaced
// inline. Filterable by org + role; sortable by every column; click
// a row to open the user-detail drawer (edit profile, change role,
// reset password, remove from primary tenant).
//
// Data source: useAllUsers() in platform-data.js. The platform-admin
// RLS bypass (migration 060) is what makes this work — non-platform
// users would only see their own profile row.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { useAllUsers, refreshUsers, KIND_LABELS, isDemoOrgSlug } from './platform-data.js';
import { PlatformUserDrawer } from './PlatformUserDrawer.jsx';
import { useT } from './i18n.js';

const ROLE_TONES = {
  superadmin: 'risk',
  facility: 'accent',
  property_manager: 'accent',
  cleaning: 'info',
  maintenance: 'info',
  security: 'info',
  tenant: 'neutral',
  auditor: 'neutral',
  fm_network: 'neutral',
  executive: 'neutral',
};

export function PlatformUsersPage() {
  const t = useT();
  const { users, ready } = useAllUsers();

  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'asc' });
  // Selected user → opens PlatformUserDrawer in a side overlay. The
  // drawer wants a `member`-shaped object (userId, name, email, orgRole)
  // and a tenantId for role/remove operations. Both come from the row.
  const [selected, setSelected] = useState(null);

  // Build option lists from the actual data so the filters only show
  // values that are present (no empty "no match" pickers).
  const orgOptions = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (u.primaryOrgId && !map.has(u.primaryOrgId)) {
        map.set(u.primaryOrgId, { id: u.primaryOrgId, name: u.primaryOrgName, kind: u.primaryOrgKind });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const roleOptions = useMemo(() => {
    const set = new Set(users.map((u) => u.profileRole).filter(Boolean));
    return [...set].sort();
  }, [users]);

  const filtered = useMemo(() => {
    let rows = users.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          (u.company || '').toLowerCase().includes(q) ||
          (u.primaryOrgName || '').toLowerCase().includes(q),
      );
    }
    if (orgFilter !== 'all') rows = rows.filter((u) => u.primaryOrgId === orgFilter);
    if (roleFilter !== 'all') rows = rows.filter((u) => u.profileRole === roleFilter);
    if (kindFilter !== 'all') rows = rows.filter((u) => u.primaryOrgKind === kindFilter);
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
  }, [users, search, orgFilter, roleFilter, kindFilter, sort]);

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero count={users.length} filtered={filtered.length} t={t} />

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
          <SearchBox value={search} onChange={setSearch} t={t} />
          <FilterSelect
            label={t('platform.users.org_label')}
            value={orgFilter}
            onChange={setOrgFilter}
            options={[
              { id: 'all', label: t('platform.users.org_all') },
              ...orgOptions.map((o) => ({ id: o.id, label: o.name })),
            ]}
          />
          <FilterSelect
            label={t('platform.users.kind_label')}
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { id: 'all', label: t('platform.users.kind_all') },
              { id: 'real_estate', label: KIND_LABELS.real_estate },
              { id: 'contractor', label: KIND_LABELS.contractor },
              { id: 'adaptiv', label: KIND_LABELS.adaptiv },
            ]}
          />
          <FilterSelect
            label={t('platform.users.role_label')}
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { id: 'all', label: t('platform.users.role_all') },
              ...roleOptions.map((r) => ({ id: r, label: r })),
            ]}
          />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {ready
              ? t('platform.users.count', { n: filtered.length, total: users.length })
              : t('platform.audit.loading')}
          </div>
        </div>
        <UsersTable rows={filtered} sort={sort} onSort={setSort} ready={ready} t={t} onSelect={setSelected} />
      </Card>
      {selected && (
        <PlatformUserDrawer
          member={{
            userId: selected.userId,
            name: selected.displayName,
            email: selected.email,
            orgRole: selected.primaryOrgRole || 'member',
          }}
          tenantId={selected.primaryOrgId}
          onClose={() => setSelected(null)}
          onChanged={() => {
            refreshUsers();
          }}
        />
      )}
    </div>
  );
}

function Hero({ count, filtered, t }) {
  const showFiltered = filtered !== count;
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
          {t('platform.users.eyebrow')}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('platform.users.title')}{' '}
          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
            · {showFiltered ? `${filtered} / ${count}` : count}
          </span>
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13, maxWidth: 760 }}>
          {t('platform.users.body')}
        </p>
      </div>
    </Card>
  );
}

function SearchBox({ value, onChange, t }) {
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
        placeholder={t('platform.users.search_ph')}
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

function FilterSelect({ label, value, onChange, options }) {
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
          maxWidth: 220,
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UsersTable({ rows, sort, onSort, ready, t, onSelect }) {
  const cols = [
    { key: 'displayName', label: t('platform.users.col.name'), flex: '1.5 1 220px' },
    { key: 'email', label: t('platform.users.col.email'), flex: '1.5 1 220px' },
    { key: 'profileRole', label: t('platform.users.col.role'), flex: '0 1 140px' },
    { key: 'primaryOrgName', label: t('platform.users.col.primary_org'), flex: '1.5 1 220px' },
    { key: 'primaryOrgKind', label: t('platform.users.col.org_kind'), flex: '0 1 130px' },
    { key: 'memberCount', label: t('platform.users.col.memberships'), flex: '0 1 90px', align: 'right' },
    { key: 'createdAt', label: t('platform.users.col.created'), flex: '0 1 110px' },
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <AdaptivLoader size="sm" />
        </div>
      )}
      {ready && rows.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.users.empty_filter')}</div>
      )}
      {ready && rows.map((u) => <UserRow key={u.userId} u={u} cols={cols} t={t} onSelect={onSelect} />)}
    </div>
  );
}

function UserRow({ u, cols, t, onSelect }) {
  // Row click opens the user-detail drawer (edit profile, change role,
  // reset password, remove from primary tenant). Users without a
  // primary org are still actionable for profile edits / password
  // reset — only the role / remove buttons need a tenantId, and the
  // drawer handles missing tenantId by hiding those actions.
  const handleClick = () => onSelect?.(u);
  const roleTone = ROLE_TONES[u.profileRole] || 'neutral';
  const created = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '—';
  return (
    <button
      onClick={handleClick}
      title={t('platform.users.open_user')}
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
      <div style={{ flex: cols[0].flex, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Name + DEMO badge. Flex row so the badge sits beside the
            truncating name without overflow:hidden clipping its
            rounded bottom (same shape we fixed on team-activity's
            STAFF badge). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {u.displayName}
          </span>
          {u.isMerlinOwner && <OwnerBadge t={t} />}
          {!u.isMerlinOwner &&
            (isDemoOrgSlug(u.primaryOrgSlug) || (u.memberships || []).some((m) => isDemoOrgSlug(m.orgSlug))) && (
              <DemoBadge />
            )}
        </div>
        {u.company && (
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {u.company}
          </div>
        )}
      </div>
      <div
        style={{
          flex: cols[1].flex,
          fontSize: 12,
          color: 'var(--text-soft)',
          fontFamily: 'var(--mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {u.email}
      </div>
      <div style={{ flex: cols[2].flex, display: 'flex', alignItems: 'flex-start' }}>
        {u.profileRole ? (
          <Pill tone={roleTone}>{u.profileRole}</Pill>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>
        )}
      </div>
      <div style={{ flex: cols[3].flex, minWidth: 0, fontSize: 12.5 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.primaryOrgName}
        </div>
        {u.primaryOrgRole && (
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>
            {t('platform.users.org_role', { role: u.primaryOrgRole })}
          </div>
        )}
      </div>
      <div style={{ flex: cols[4].flex, fontSize: 11.5, color: 'var(--text-soft)' }}>
        {u.primaryOrgKind ? KIND_LABELS[u.primaryOrgKind] || u.primaryOrgKind : '—'}
      </div>
      <div
        style={{
          flex: cols[5].flex,
          textAlign: 'right',
          fontSize: 12.5,
          fontVariantNumeric: 'tabular-nums',
        }}
        title={u.memberships.map((m) => m.orgName).join(', ')}
      >
        {u.memberCount > 0 ? u.memberCount : <span style={{ color: 'var(--text-faint)' }}>0</span>}
      </div>
      <div style={{ flex: cols[6].flex, fontSize: 12, color: 'var(--text-soft)', fontFamily: 'var(--mono)' }}>
        {created}
      </div>
    </button>
  );
}

// Marks users who belong to a demo / seed tenant — same warn-toned
// amber as on /platform/tenants so the two surfaces share visual
// language. Distinct from the pink STAFF badge on /platform/team-activity.
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

// Marks the single human Merlin Owner (migration 129) — the "god mode"
// account that's the only user permitted to promote / demote platform
// admins. Filled-gold treatment so it stands out from STAFF (pink) and
// DEMO (amber). At most one person ever — partial unique index on
// profiles.is_merlin_owner enforces it.
function OwnerBadge({ t }) {
  return (
    <span
      title={t('platform.team.type.owner_tip')}
      style={{
        flexShrink: 0,
        padding: '1px 6px',
        fontSize: 9.5,
        fontWeight: 800,
        color: '#3b2700',
        background: '#facc15',
        border: '1px solid #a16207',
        borderRadius: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.15,
      }}
    >
      OWNER
    </span>
  );
}
