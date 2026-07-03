// /platform/device-keys — provisioning console for the events-ingest API.
//
// Each row is a sha256-hashed device or web-service key. Creating a key
// reveals the FULL secret ONCE in a copy-now modal; only the prefix +
// hash are persisted afterwards. Revoke stamps `revoked_at` and the
// API rejects subsequent ingest calls with 401.
//
// Lives under the "Devices" pillar alongside Inventory + Fleet. See
// docs/integrations/events-api.md for the customer-facing perspective.

import React, { useMemo, useState } from 'react';
import { Card, Pill } from './primitives.jsx';
import { useDeviceKeys, createDeviceKey, revokeDeviceKey } from './platform-device-keys.js';
import { useAllTenants } from './platform-data.js';
import { confirmDialog, alertDialog } from './dialogs.jsx';

export function PlatformDeviceKeysPage() {
  const { rows, loading, error, refresh } = useDeviceKeys();
  const { tenants } = useAllTenants();
  const [showCreate, setShowCreate] = useState(false);
  const [orgFilter, setOrgFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active'); // active | revoked | all
  const [revealSecret, setRevealSecret] = useState(null); // { secret, prefix, label, org }

  const filtered = useMemo(() => {
    let next = rows.slice();
    if (orgFilter !== 'all') next = next.filter((r) => r.organization_id === orgFilter);
    if (statusFilter === 'active') next = next.filter((r) => !r.revoked_at);
    if (statusFilter === 'revoked') next = next.filter((r) => r.revoked_at);
    return next;
  }, [rows, orgFilter, statusFilter]);

  return (
    <div style={{ padding: 24, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Device keys</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            API keys for <code>/api/events/ingest</code>. Hand one to a device firmware or integration adapter. The full
            secret is shown once at creation — after that only the prefix and hash live in Postgres. See{' '}
            <a href="/docs/integrations/events-api" style={{ color: 'var(--accent)' }}>
              integration docs
            </a>
            .
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={refresh} disabled={loading} style={btnSubtle}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>
            + New device key
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select value={orgFilter} onChange={setOrgFilter}>
          <option value="all">All tenants</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={setStatusFilter}>
          <option value="active">Active only</option>
          <option value="revoked">Revoked only</option>
          <option value="all">All states</option>
        </Select>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${filtered.length.toLocaleString()} key${filtered.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {error && (
        <Card>
          <div style={{ padding: 16, color: 'var(--risk, #c33)', fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <Card>
        {filtered.length === 0 && !loading ? (
          <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            {orgFilter === 'all' && statusFilter === 'active'
              ? 'No device keys yet. Click "New device key" to provision one.'
              : 'No keys match the current filters.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={th}>Tenant</th>
                <th style={th}>Label</th>
                <th style={th}>Prefix</th>
                <th style={th}>Device</th>
                <th style={th}>Scope</th>
                <th style={th}>Last seen</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <KeyRow key={r.id} r={r} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showCreate && (
        <CreateDialog
          tenants={tenants}
          onClose={() => setShowCreate(false)}
          onCreated={(payload) => {
            setShowCreate(false);
            refresh();
            // payload includes the full `secret` — surface it in the
            // copy-once modal. After the user dismisses, the secret is
            // unrecoverable.
            const org = tenants.find((t) => t.id === payload.organization_id);
            setRevealSecret({
              secret: payload.secret,
              prefix: payload.key_prefix,
              label: payload.label,
              org: org?.name || payload.organization_id,
            });
          }}
        />
      )}

      {revealSecret && <SecretRevealModal {...revealSecret} onClose={() => setRevealSecret(null)} />}
    </div>
  );
}

function KeyRow({ r, onChanged }) {
  const [busy, setBusy] = useState(false);
  const revoked = !!r.revoked_at;
  const scopeLine = formatScope(r.scope);

  async function revoke() {
    if (busy) return;
    if (
      !(await confirmDialog({
        body:
          `Revoke key ${r.key_prefix}…?\n\n` +
          `Any device or integration using it will start receiving 401 on its next ingest call. ` +
          `This cannot be undone — provision a replacement key first if you need rotation.`,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await revokeDeviceKey(r.id);
      onChanged();
    } catch (e) {
      alertDialog(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={{ borderTop: '1px solid var(--border)', opacity: revoked ? 0.55 : 1 }}>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{r.organization?.name || '—'}</div>
        {r.organization?.slug && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
            {r.organization.slug}
          </div>
        )}
      </td>
      <td style={td}>{r.label || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
      <td style={td}>
        <code style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{r.key_prefix}…</code>
      </td>
      <td style={td}>
        {r.device?.external_id ? (
          <div>
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{r.device.external_id}</div>
            {r.device.kind && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.device.kind}</div>}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>web-service</span>
        )}
      </td>
      <td style={td}>
        <div style={{ fontSize: 12 }}>{scopeLine}</div>
      </td>
      <td style={td}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {r.last_seen_at ? formatRelative(r.last_seen_at) : 'never'}
        </span>
      </td>
      <td style={td}>{revoked ? <Pill tone="risk">Revoked</Pill> : <Pill tone="ok">Active</Pill>}</td>
      <td style={td}>
        {!revoked && (
          <button onClick={revoke} disabled={busy} style={btnDanger}>
            {busy ? '…' : 'Revoke'}
          </button>
        )}
      </td>
    </tr>
  );
}

function formatScope(scope) {
  if (!scope || typeof scope !== 'object') return 'unrestricted';
  const parts = [];
  if (Array.isArray(scope.kinds) && scope.kinds.length > 0) {
    parts.push(`kinds: ${scope.kinds.join(', ')}`);
  }
  if (scope.location_prefix) {
    parts.push(`loc: ${scope.location_prefix}`);
  }
  return parts.length === 0 ? 'unrestricted' : parts.join(' · ');
}

function formatRelative(ts) {
  if (!ts) return 'never';
  const d = new Date(ts);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

// ────── Create dialog
//
// Inputs: tenant (required), label (optional but recommended), device
// link (optional), scope.kinds (optional comma-separated list),
// scope.location_prefix (optional). Posts to
// /api/platform/device-keys and bubbles the full secret back up via
// onCreated.

function CreateDialog({ tenants, onClose, onCreated }) {
  const [orgId, setOrgId] = useState(tenants[0]?.id || '');
  const [label, setLabel] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [kindsCsv, setKindsCsv] = useState('');
  const [locationPrefix, setLocationPrefix] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const params = { organization_id: orgId };
      if (label.trim()) params.label = label.trim();
      if (deviceId.trim()) params.device_id = deviceId.trim();
      const scope = {};
      const kinds = kindsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (kinds.length > 0) scope.kinds = kinds;
      if (locationPrefix.trim()) scope.location_prefix = locationPrefix.trim();
      if (Object.keys(scope).length > 0) params.scope = scope;
      const payload = await createDeviceKey(params);
      onCreated(payload);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>New device key</h2>

      <Field label="Tenant">
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={textInput}>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Hint>The key can only ingest events into this tenant.</Hint>
      </Field>

      <Field label="Label">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="HQ floor-32 IAQ probe"
          style={textInput}
        />
        <Hint>Shown in this table only. Pick something the operator will recognise.</Hint>
      </Field>

      <Field label="Device ID (optional)">
        <input
          type="text"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="uuid of a row in public.devices"
          style={textInput}
        />
        <Hint>Link to an existing device for heartbeat tracking. Leave blank for web-service / integration keys.</Hint>
      </Field>

      <Field label="Allowed kinds (optional, comma-separated)">
        <input
          type="text"
          value={kindsCsv}
          onChange={(e) => setKindsCsv(e.target.value)}
          placeholder="voc_spike, water_leak"
          style={textInput}
        />
        <Hint>Blank = any event kind for the tenant.</Hint>
      </Field>

      <Field label="Location prefix (optional)">
        <input
          type="text"
          value={locationPrefix}
          onChange={(e) => setLocationPrefix(e.target.value)}
          placeholder="hq-fl-32"
          style={textInput}
        />
        <Hint>Events with location_id outside this prefix are rejected with 400.</Hint>
      </Field>

      {error && <div style={{ color: 'var(--risk, #c33)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={btnSubtle}>
          Cancel
        </button>
        <button onClick={submit} disabled={busy || !orgId} style={btnPrimary}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}

// ────── Secret-reveal modal
//
// The ONE time the full secret is rendered. Closes idempotently and
// the secret is unrecoverable after that — by design. Clipboard copy
// + a fat "I have copied it" confirm to make the deletion explicit.

function SecretRevealModal({ secret, prefix, label, org, onClose }) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — operator can select manually.
    }
  }

  return (
    <Modal onClose={confirmed ? onClose : undefined}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Secret created</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
        This is the only time the full secret is shown. Copy it into the device firmware or your vault now. After this
        dialog closes, Merlin can show only the prefix <code>{prefix}…</code>.
      </p>

      <div
        style={{
          background: 'var(--surface-2, #fafafa)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.15,
            color: 'var(--text-muted)',
            fontWeight: 700,
          }}
        >
          {label || 'Unlabelled'} · {org}
        </div>
        <code
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 13,
            color: 'var(--text)',
            wordBreak: 'break-all',
            background: 'transparent',
          }}
        >
          {secret}
        </code>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copy} style={btnPrimary}>
            {copied ? 'Copied!' : 'Copy secret'}
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
        Send it via your devices' usual provisioning channel. <strong>Don't paste it into Slack or email.</strong> If
        you suspect it leaked, revoke and provision a new one.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I have copied the
        secret and stored it safely.
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={!confirmed} style={btnPrimary}>
          Done
        </button>
      </div>
    </Modal>
  );
}

// ────── Shared building blocks

function Modal({ onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{children}</div>;
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '6px 10px',
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        color: 'var(--text)',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </select>
  );
}

// ────── Styles (mirroring PlatformPromoCodes for visual continuity)

const fieldLabel = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 };
const textInput = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface-2, #fafafa)',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--text)',
  boxSizing: 'border-box',
};
const th = { padding: '10px 14px', fontWeight: 600, fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase' };
const td = { padding: '10px 14px', verticalAlign: 'middle' };
const btnSubtle = {
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};
const btnPrimary = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 6,
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};
const btnDanger = {
  padding: '6px 12px',
  border: '1px solid color-mix(in oklch, var(--risk, #c33) 50%, var(--border))',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--risk, #c33)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};
