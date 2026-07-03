// Shared row + form primitives for the source_catalog / source_connection
// surface. Extracted from Agentic.jsx so the contractor surface
// (Operations → Sources, PR 5) can render the same chrome without
// dragging the Agentic lazy chunk in.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill } from './primitives.jsx';
import { useT } from './i18n.js';
import {
  PROVIDER_KINDS,
  CATALOG_STATUSES,
  CONNECTION_STATUSES,
  SIGNAL_KIND_ICON,
  SIMULATOR_PAYLOAD_PROFILES,
  isSimulatedConnection,
  webhookTokenForConnection,
} from './sources-data.js';

// ────── Local styles + helpers ─────────────────────────────────────

const inputStyle = {
  padding: '7px 10px',
  fontSize: 12.5,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  outline: 'none',
};
const btnPrimary = {
  padding: '7px 12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnGhost = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnDanger = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--risk)',
  border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

function Field({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export function ErrBanner({ text }) {
  if (!text) return null;
  return (
    <div
      style={{
        margin: '0 0 12px',
        padding: 10,
        fontSize: 12,
        background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
        color: 'var(--risk)',
        borderRadius: 7,
      }}
    >
      {text}
    </div>
  );
}

function providerPill(t, providerKind) {
  const def = PROVIDER_KINDS.find((p) => p.id === providerKind) || PROVIDER_KINDS[0];
  return <Pill tone={def.tone}>{t(def.labelKey)}</Pill>;
}

function statusPill(t, statuses, statusId) {
  const def = statuses.find((s) => s.id === statusId) || statuses[0];
  return <Pill tone={def.tone}>{t(def.labelKey)}</Pill>;
}

// ────── CatalogRow ──────────────────────────────────────────────────
// Shows one source_catalog entry. Inline edit when editing===row.id.

export function CatalogRow({
  row,
  editing,
  isAdmin,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  usageCount,
  // PR 3: pass buildings to render the per-building scope pill with a
  // friendly name instead of the raw location_id.
  buildings = null,
  // PR 5: contractor-proposed entries get an Accept button on the
  // counterparty side. actorRole drives visibility ('author' |
  // 'accepter' | 'both' | 'observer' — defaults to 'both' for the
  // same-org case so existing callers don't break).
  actorRole = 'both',
  onAccept,
  extraLine,
  // When true, render a compact Devices-style card (for grid layouts) instead
  // of the default full-width row. Used by the AGENTIC → Data sources catalog.
  asCard = false,
}) {
  const t = useT();
  const IconC = Icon[SIGNAL_KIND_ICON[row.signal_kind] || 'gateway'] || Icon.gateway;
  const isPending = !row.accepted_at;
  const scopeLabel = row.location_id ? buildings?.[row.location_id]?.name || row.location_id : null;

  if (editing) {
    // In a card grid the inline edit form spans the full width so it isn't
    // crammed into one cell.
    return (
      <div
        style={{ ...(asCard ? { gridColumn: '1 / -1' } : { borderTop: '1px solid var(--border)' }), padding: '12px 0' }}
      >
        <CatalogForm initial={row} onCancel={onCancel} onSave={onSave} />
      </div>
    );
  }

  if (asCard) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              flexShrink: 0,
              background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconC size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-dim)',
                marginTop: 2,
                fontFamily: 'var(--mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.signal_kind} · {row.transport}
            </div>
          </div>
          {providerPill(t, row.provider_kind)}
        </div>
        {row.description && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-soft)',
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {row.description}
          </div>
        )}
        {extraLine && <div style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>{extraLine}</div>}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 'auto',
            paddingTop: 8,
            borderTop: '1px dashed var(--border)',
          }}
        >
          {scopeLabel && (
            <Pill tone="info" title={t('sources.scope.building_hint')}>
              {t('sources.scope.building_prefix')} {scopeLabel}
            </Pill>
          )}
          {isPending && <Pill tone="warn">{t('sources.catalog.pending')}</Pill>}
          {!isPending && row.status !== 'available' && statusPill(t, CATALOG_STATUSES, row.status)}
          {typeof usageCount === 'number' && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
              {t('sources.catalog.usage', { n: usageCount })}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {isPending && actorRole === 'accepter' && onAccept && (
            <button onClick={onAccept} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11 }}>
              {t('sources.catalog.accept')}
            </button>
          )}
          {isAdmin && (
            <>
              <button onClick={onEdit} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }}>
                {t('sources.edit')}
              </button>
              <button onClick={onDelete} style={{ ...btnDanger, padding: '4px 9px', fontSize: 11 }}>
                {t('sources.delete')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 6px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          flexShrink: 0,
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconC size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{row.name}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1, fontFamily: 'var(--mono)' }}>
          {row.signal_kind} · {row.transport}
          {typeof usageCount === 'number' && ` · ${t('sources.catalog.usage', { n: usageCount })}`}
        </div>
        {row.description && (
          <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginTop: 2 }}>{row.description}</div>
        )}
        {extraLine && <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginTop: 2 }}>{extraLine}</div>}
      </div>
      {providerPill(t, row.provider_kind)}
      {scopeLabel && (
        <Pill tone="info" title={t('sources.scope.building_hint')}>
          {t('sources.scope.building_prefix')} {scopeLabel}
        </Pill>
      )}
      {isPending && <Pill tone="warn">{t('sources.catalog.pending')}</Pill>}
      {!isPending && row.status !== 'available' && statusPill(t, CATALOG_STATUSES, row.status)}
      {/* PR 5: counterparty (customer side on contractor-proposed rows)
          gets the Accept action while the row is pending. */}
      {isPending && actorRole === 'accepter' && onAccept && (
        <button onClick={onAccept} style={{ ...btnPrimary, padding: '5px 12px', fontSize: 11 }}>
          {t('sources.catalog.accept')}
        </button>
      )}
      {isAdmin && (
        <>
          <button onClick={onEdit} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
            {t('sources.edit')}
          </button>
          <button onClick={onDelete} style={{ ...btnDanger, padding: '5px 10px', fontSize: 11 }}>
            {t('sources.delete')}
          </button>
        </>
      )}
    </div>
  );
}

// ────── CatalogForm ─────────────────────────────────────────────────

export function CatalogForm({
  initial,
  onCancel,
  onSave,
  // PR 3: when the user is viewing a specific building in Agentic →
  // Sources, the form offers a scope toggle ('org' vs 'building').
  // The Save callback receives `scope` so the caller can route the
  // insert with the right buildingId.
  currentBuilding = null,
  // PR 5: contractor surface needs 'contractor' as a provider option;
  // same-org Agentic surface does not. Default off.
  allowContractor = false,
  // PR 5: contractor surface locks providerKind='contractor' since
  // that's the whole point of the propose flow.
  lockProviderToContractor = false,
}) {
  const t = useT();
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name || '');
  const [signalKind, setSignalKind] = useState(initial?.signal_kind || 'sensor');
  const [transport, setTransport] = useState(initial?.transport || 'rest');
  const [description, setDescription] = useState(initial?.description || '');
  const [providerKind, setProviderKind] = useState(
    initial?.provider_kind || (lockProviderToContractor ? 'contractor' : 'adaptiv'),
  );
  const [status, setStatus] = useState(initial?.status || 'available');
  // Scope is locked once a row exists (changing it would require a new
  // row anyway). For new rows, default to building when the user is in
  // a building context — admins typically expect "the source I'm adding
  // belongs to the building I'm looking at."
  const initialScope = initial?.id ? (initial.location_id ? 'building' : 'org') : currentBuilding ? 'building' : 'org';
  const [scope, setScope] = useState(initialScope);
  const [saving, setSaving] = useState(false);
  const canSave = name.trim() && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        signal_kind: signalKind.trim() || 'sensor',
        transport: transport.trim() || 'rest',
        description: description.trim() || null,
        provider_kind: providerKind,
        status,
        scope, // 'org' | 'building' — caller maps to location_id
      });
    } catch {
      /* parent surfaces */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <Field label={t('sources.field.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sources.field.name_ph')}
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        <Field label={t('sources.field.signal_kind')}>
          <input
            value={signalKind}
            onChange={(e) => setSignalKind(e.target.value)}
            placeholder="sensor"
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        <Field label={t('sources.field.transport')}>
          <input
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            placeholder="rest"
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('sources.field.provider_kind')}>
          <select
            value={providerKind}
            onChange={(e) => setProviderKind(e.target.value)}
            disabled={lockProviderToContractor}
            style={{ ...inputStyle, width: '100%', opacity: lockProviderToContractor ? 0.7 : 1 }}
          >
            {PROVIDER_KINDS.filter((p) => p.id !== 'contractor' || allowContractor).map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.labelKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('sources.field.status')}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            {CATALOG_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.labelKey)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {currentBuilding && (
        <Field label={t('sources.field.scope')}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setScope('org')}
              disabled={isEdit}
              style={{
                ...(scope === 'org' ? btnPrimary : btnGhost),
                padding: '6px 12px',
                fontSize: 12,
                opacity: isEdit ? 0.5 : 1,
              }}
            >
              {t('sources.scope.org')}
            </button>
            <button
              type="button"
              onClick={() => setScope('building')}
              disabled={isEdit}
              style={{
                ...(scope === 'building' ? btnPrimary : btnGhost),
                padding: '6px 12px',
                fontSize: 12,
                opacity: isEdit ? 0.5 : 1,
              }}
            >
              {t('sources.scope.building_only', { name: currentBuilding.name })}
            </button>
          </div>
          <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            {isEdit ? t('sources.scope.locked_hint') : t('sources.scope.hint')}
          </div>
        </Field>
      )}

      <Field label={t('sources.field.description')}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={t('sources.field.description_ph')}
          style={{ ...inputStyle, width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} disabled={saving} style={btnGhost}>
          {t('sources.cancel')}
        </button>
        <button onClick={submit} disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.6 }}>
          {saving ? t('sources.saving') : isEdit ? t('sources.save_changes') : t('sources.create')}
        </button>
      </div>
    </div>
  );
}

// ────── ConnectionRow ───────────────────────────────────────────────

export function ConnectionRow({
  row,
  catalogById,
  locationName,
  editing,
  isAdmin,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}) {
  const t = useT();
  const catalog = catalogById?.[row.catalog_id];
  const signalKind = catalog?.signal_kind || 'sensor';
  const IconC = Icon[SIGNAL_KIND_ICON[signalKind] || 'gateway'] || Icon.gateway;
  const displayName = row.name || row.external_id || row.id.slice(0, 8);
  const heartbeat = row.last_heartbeat_at
    ? new Date(row.last_heartbeat_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : null;
  const simulated = isSimulatedConnection(row);
  const simInterval = row.metadata?.simulator?.interval_min;
  const hasWebhook = !!row.metadata?.webhook?.token;

  if (editing) {
    return (
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
        <ConnectionForm initial={row} onCancel={onCancel} onSave={onSave} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 6px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          flexShrink: 0,
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconC size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1, fontFamily: 'var(--mono)' }}>
          {locationName || row.location_id}
          {catalog?.name && ` · ${catalog.name}`}
          {heartbeat && ` · ${t('sources.conn.last_heartbeat')} ${heartbeat}`}
        </div>
      </div>
      {simulated && (
        <Pill tone="info" title={t('sources.conn.simulator.pill_hint')}>
          {simInterval
            ? t('sources.conn.simulator.pill_every_n_min', { n: simInterval })
            : t('sources.conn.simulator.pill_simulating')}
        </Pill>
      )}
      {hasWebhook && !simulated && (
        <Pill tone="accent" title={t('sources.conn.webhook.pill_hint')}>
          {t('sources.conn.webhook.pill')}
        </Pill>
      )}
      {statusPill(t, CONNECTION_STATUSES, row.status)}
      {isAdmin && (
        <>
          <button onClick={onEdit} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
            {t('sources.edit')}
          </button>
          <button onClick={onDelete} style={{ ...btnDanger, padding: '5px 10px', fontSize: 11 }}>
            {t('sources.delete')}
          </button>
        </>
      )}
    </div>
  );
}

// ────── ConnectionForm ──────────────────────────────────────────────
//
// Three-way create flow + simple edit. On create the form opens with a
// "kind" picker at the top — Adaptiv device, External feed, Simulated —
// which controls which sub-fields render. The picker is hidden on edit
// (kind is a property of the connection's existence; changing it would
// mean a different row anyway).
//
// Kind drives the submit payload:
//   adaptiv:    { catalog_id, location_id, name, external_id }
//   external:   { catalog_id, location_id, name, external_id } — PR 2
//               will surface the per-connection webhook ingest URL
//               from this branch. Today it's identical to adaptiv on
//               the wire; only the form chrome differs.
//   simulated:  same fields PLUS simulator: { enabled, interval_min,
//               payload_profile }. createConnection seeds the row as
//               healthy + last_heartbeat_at=now() so it goes green
//               immediately. The minute-cadence simulator-tick cron
//               keeps the heartbeat fresh thereafter.

const CONNECTION_KINDS = [
  { id: 'adaptiv', labelKey: 'sources.conn.kind.adaptiv', icon: 'gateway' },
  { id: 'external', labelKey: 'sources.conn.kind.external', icon: 'bolt' },
  { id: 'simulated', labelKey: 'sources.conn.kind.simulated', icon: 'play' },
];

const SIMULATOR_INTERVALS = [1, 5, 15, 30, 60];

function inferKindFromRow(row) {
  if (!row) return 'adaptiv';
  if (isSimulatedConnection(row)) return 'simulated';
  if (row.device_id) return 'adaptiv';
  return 'external';
}

export function ConnectionForm({ initial, onCancel, onSave, catalogOptions = [], locationOptions = [] }) {
  const t = useT();
  const isEdit = !!initial?.id;
  const [kind, setKind] = useState(inferKindFromRow(initial));
  const [name, setName] = useState(initial?.name || '');
  const [externalId, setExternalId] = useState(initial?.external_id || '');
  const [catalogId, setCatalogId] = useState(initial?.catalog_id || catalogOptions[0]?.id || '');
  const [locationId, setLocationId] = useState(initial?.location_id || locationOptions[0]?.id || '');
  const [status, setStatus] = useState(initial?.status || 'pending');
  const [simInterval, setSimInterval] = useState(initial?.metadata?.simulator?.interval_min || 5);
  const [simProfile, setSimProfile] = useState(
    initial?.metadata?.simulator?.payload_profile || SIMULATOR_PAYLOAD_PROFILES[0].id,
  );
  const [saving, setSaving] = useState(false);
  const canSave = catalogId && locationId && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const base = {
        kind, // sources-data createConnection reads this
        name: name.trim() || null,
        external_id: externalId.trim() || null,
        catalog_id: catalogId,
        location_id: locationId,
        status,
      };
      if (kind === 'simulated' && !isEdit) {
        base.simulator = {
          enabled: true,
          interval_min: simInterval,
          payload_profile: simProfile,
        };
      }
      await onSave(base);
    } catch {
      /* parent surfaces */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!isEdit && (
        <Field label={t('sources.conn.kind.label')}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CONNECTION_KINDS.map((k) => {
              const IconC = Icon[k.icon] || Icon.gateway;
              const active = kind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  style={{
                    ...(active ? btnPrimary : btnGhost),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    fontSize: 12,
                  }}
                >
                  <IconC size={12} />
                  {t(k.labelKey)}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            {t(`sources.conn.kind.${kind}.hint`)}
          </div>
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('sources.field.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sources.conn.name_ph')}
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        {kind !== 'simulated' && (
          <Field label={t('sources.field.external_id')}>
            <input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder={t(kind === 'external' ? 'sources.conn.external_id_ext_ph' : 'sources.conn.external_id_ph')}
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label={t('sources.conn.catalog')}>
          <select
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            disabled={isEdit}
            style={{ ...inputStyle, width: '100%' }}
          >
            {catalogOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('sources.conn.location')}>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          >
            {locationOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        {kind !== 'simulated' ? (
          <Field label={t('sources.field.status')}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              {CONNECTION_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.labelKey)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={t('sources.conn.simulator.interval')}>
            <select
              value={simInterval}
              onChange={(e) => setSimInterval(Number(e.target.value))}
              disabled={isEdit}
              style={{ ...inputStyle, width: '100%' }}
            >
              {SIMULATOR_INTERVALS.map((n) => (
                <option key={n} value={n}>
                  {t('sources.conn.simulator.every_n_min', { n })}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {kind === 'simulated' && (
        <Field label={t('sources.conn.simulator.profile')}>
          <select
            value={simProfile}
            onChange={(e) => setSimProfile(e.target.value)}
            disabled={isEdit}
            style={{ ...inputStyle, width: '100%' }}
          >
            {SIMULATOR_PAYLOAD_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            {t('sources.conn.simulator.profile_hint')}
          </div>
        </Field>
      )}

      {isEdit && webhookTokenForConnection(initial) && <IngestUrlPanel token={webhookTokenForConnection(initial)} />}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} disabled={saving} style={btnGhost}>
          {t('sources.cancel')}
        </button>
        <button onClick={submit} disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.6 }}>
          {saving ? t('sources.saving') : isEdit ? t('sources.save_changes') : t('sources.create')}
        </button>
      </div>
    </div>
  );
}

// ────── IngestUrlPanel (External / webhook connections) ────────────
//
// Shown inside ConnectionForm when editing an External connection that
// has a webhook token. Surfaces three things the customer needs to wire
// up the upstream side:
//   1. The full ingest URL with token embedded
//   2. A copy-paste curl example with a minimal body
//   3. A "what to expect" note about heartbeat behavior + status flips
//
// We deliberately keep the token visible — there's no "regenerate" or
// "rotate" flow yet (follow-up). Anyone with org-read access to the
// connection row can see it; that's the v1 trade-off.

function IngestUrlPanel({ token }) {
  const t = useT();
  const [copied, setCopied] = useState(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/api/sources/ingest/${token}`;
  const curl = `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"ok": true}'`;

  const copy = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied((k) => (k === kind ? null : k)), 1800);
    } catch {
      /* ignore — clipboard may be unavailable */
    }
  };

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--accent) 4%, var(--surface-2))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon.bolt size={12} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 12, fontWeight: 700 }}>{t('sources.conn.webhook.title')}</div>
        <Pill tone="ok">{t('sources.conn.webhook.ready')}</Pill>
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            marginBottom: 4,
          }}
        >
          {t('sources.conn.webhook.url_label')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <code
            style={{
              flex: 1,
              minWidth: 0,
              padding: '7px 10px',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--text)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {url}
          </code>
          <button onClick={() => copy(url, 'url')} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
            {copied === 'url' ? t('sources.conn.webhook.copied') : t('sources.conn.webhook.copy')}
          </button>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            marginBottom: 4,
          }}
        >
          {t('sources.conn.webhook.curl_label')}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <pre
            style={{
              flex: 1,
              minWidth: 0,
              margin: 0,
              padding: '7px 10px',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--text-soft)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              overflow: 'auto',
              whiteSpace: 'pre',
            }}
          >
            {curl}
          </pre>
          <button onClick={() => copy(curl, 'curl')} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
            {copied === 'curl' ? t('sources.conn.webhook.copied') : t('sources.conn.webhook.copy')}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>{t('sources.conn.webhook.note')}</div>
    </div>
  );
}

// ────── TabBtn (shared visual primitive) ────────────────────────────

export function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        fontSize: 12.5,
        fontWeight: 600,
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-soft)',
        border: '1px solid var(--border)',
        borderBottom: active ? '1px solid var(--surface)' : '1px solid var(--border)',
        borderRadius: '7px 7px 0 0',
        marginBottom: -1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
