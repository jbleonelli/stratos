// Admin — Users section (roster table, role changes, create/delete users).
// Extracted from Admin.jsx (G2 split). Self-contained: role gating via
// canManageUser / assignableRoles + the admin* auth helpers. Exports UsersSection;
// UserRow / UserCreateForm stay file-internal.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { Input, btnPrimary, btnGhost, btnDanger } from './admin-ui.tsx';
import {
  useUsers,
  useSession,
  adminCreateUser,
  adminUpdateUserRole,
  adminDeleteUser,
  canManageUser,
  assignableRoles,
  initialsOf,
} from './auth.js';
import { ROLES } from './roles.js';
import { confirmDialog, alertDialog } from './dialogs.jsx';
import { useT } from './i18n.js';

// ─────────────────────────── Users ───────────────────────────

export function UsersSection() {
  const t = useT();
  const users = useUsers();
  const session = useSession();
  const myRole = session?.role;
  const [creating, setCreating] = useState(false);
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.people size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.section.users')}</div>
        <Pill>{users.length}</Pill>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setCreating(true)}
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
          <Icon.plus size={11} /> {t('admin.users.new_user')}
        </button>
      </div>

      {creating && <UserCreateForm onClose={() => setCreating(false)} actorRole={myRole} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        {users.map((u) => (
          <UserRow key={u.id} user={u} actorRole={myRole} />
        ))}
        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', fontSize: 12.5 }}>
            {t('admin.users.empty')}
          </div>
        )}
      </div>
    </Card>
  );
}

function UserRow({ user, actorRole }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(user.role || 'facility');
  const roleObj = ROLES[user.role] || ROLES.facility;
  const canManage = canManageUser(actorRole, user.role);
  const allowedRoles = assignableRoles(actorRole);
  const save = () => {
    adminUpdateUserRole(user.id, role);
    setEditing(false);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto auto',
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
        {initialsOf(user.name)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{user.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {user.email} {user.company && `· ${user.company}`}
        </div>
      </div>
      {editing ? (
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            padding: '6px 8px',
            fontSize: 12,
            fontWeight: 600,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 7,
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          {allowedRoles.map((id) => (
            <option key={id} value={id}>
              {ROLES[id]?.name || id}
            </option>
          ))}
        </select>
      ) : (
        <Pill tone={user.role === 'superadmin' ? 'risk' : 'accent'}>{roleObj.name}</Pill>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        {!canManage ? (
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic', padding: '7px 4px' }}>
            {t('admin.users.read_only')}
          </span>
        ) : editing ? (
          <>
            <button onClick={save} style={btnPrimary}>
              {t('admin.users.save')}
            </button>
            <button
              onClick={() => {
                setRole(user.role || 'facility');
                setEditing(false);
              }}
              style={btnGhost}
            >
              {t('admin.users.cancel')}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} style={btnGhost}>
              {t('admin.users.edit_role')}
            </button>
            <button
              onClick={async () => {
                if (
                  !(await confirmDialog({ body: t('admin.users.remove_confirm', { name: user.name }), danger: true }))
                )
                  return;
                try {
                  await adminDeleteUser(user.id);
                } catch (ex) {
                  alertDialog(ex.message || t('admin.users.delete_failed'));
                }
              }}
              style={btnDanger}
            >
              {t('admin.users.remove')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function UserCreateForm({ onClose, actorRole }) {
  const t = useT();
  const allowed = assignableRoles(actorRole);
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', role: allowed[0] || 'cleaning' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await adminCreateUser(form);
      onClose();
    } catch (ex) {
      setErr(ex.message || t('admin.users.create_failed'));
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 10,
        marginBottom: 14,
        padding: 14,
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-line)',
        borderRadius: 10,
      }}
    >
      <Input placeholder={t('admin.users.placeholder_name')} value={form.name} onChange={upd('name')} required />
      <Input
        placeholder={t('admin.users.placeholder_email')}
        value={form.email}
        onChange={upd('email')}
        type="email"
        required
      />
      <Input
        placeholder={t('admin.users.placeholder_password')}
        value={form.password}
        onChange={upd('password')}
        type="password"
        required
      />
      <Input placeholder={t('admin.users.placeholder_company')} value={form.company} onChange={upd('company')} />
      <select
        value={form.role}
        onChange={upd('role')}
        style={{
          padding: '8px 10px',
          fontSize: 12.5,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          fontFamily: 'inherit',
        }}
      >
        {allowed.map((id) => (
          <option key={id} value={id}>
            {ROLES[id]?.name || id}
          </option>
        ))}
      </select>
      {err && <div style={{ gridColumn: '1 / -1', color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={btnGhost}>
          {t('admin.users.cancel')}
        </button>
        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving ? t('admin.users.creating') : t('admin.users.create_user')}
        </button>
      </div>
    </form>
  );
}
