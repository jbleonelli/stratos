// Shared slide-in editor for a single location row. Used both on the
// customer side (Admin → Locations: edit existing rows) and the
// platform side (/platform/tenants/<id>: create + edit any tenant's
// locations). Pure UX — the parent passes onCreate / onUpdate /
// onDelete callbacks wired to the appropriate helpers:
//   - Customer side → custom-locations.js (createBuilding /
//     createEcosystem / updateLocation / deleteLocation)
//   - Platform side → platform-data.js (platformCreateLocation /
//     platformUpdateLocation / platformDeleteLocation)
// Both code paths write to the same `locations` table.

import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { confirmDialog } from './dialogs.jsx';

// Kind values ordered to match the canonical hierarchy:
//
//   Ecosystem  — collection of building-addresses
//   Location   — a building's mailing address (informational level)
//   Building   — physical structure with floors + zones
//   Floor      — has rooms and a surface area
//   Zone       — grouping of rooms inside a building, used for
//                routes (cleaning / security / inspection)
//   Room       — has devices at specific positions, surface area
//   Position   — precise spot inside a room (device mount, furniture,
//                asset beacon anchor)
//
// Schema accepts any text on `kind` so this list is purely UI; the
// hierarchy is enforced via parent_id chains.
const KIND_OPTIONS = [
  'ecosystem',
  'site',
  'building',
  'branch',
  'floor',
  'zone',
  'room',
  'restroom',
  'meeting_room',
  'conference_room',
  'training_room',
  'lounge',
  'lobby',
  'amenity',
  'auditorium',
  'cafeteria',
  'server_room',
  'dock',
  'boardroom',
  'mailroom',
  'position',
];

export function LocationDrawer({ location, parents, isNew, onCreate, onUpdate, onDelete, onClose, onChanged }) {
  const t = useT();
  const seed = isNew
    ? {
        id: '',
        kind: 'building',
        name: '',
        addr: '',
        parent_id: '',
        floors: 1,
        sqft: '',
        displays: 0,
        sensors: 0,
        branches: '',
        latitude: '',
        longitude: '',
      }
    : {
        id: location.id,
        kind: location.kind || 'building',
        name: location.name || '',
        addr: location.addr || '',
        parent_id: location.parent_id || '',
        floors: location.floors ?? 1,
        sqft: location.sqft || '',
        displays: location.displays ?? 0,
        sensors: location.sensors ?? 0,
        branches: location.branches ?? '',
        latitude: location.latitude ?? '',
        longitude: location.longitude ?? '',
      };
  const [form, setForm] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSave = async () => {
    setErr('');
    setBusy(true);
    try {
      // Normalise ID; trim parent.
      const payload = { ...form, parent_id: form.parent_id || null };
      if (isNew) {
        if (!form.id || !/^[a-z0-9_-]+$/i.test(form.id)) throw new Error(t('platform.detail.location.err_id'));
        if (!form.name) throw new Error(t('platform.detail.location.err_name'));
        if (!onCreate) throw new Error('onCreate handler missing');
        await onCreate(payload);
      } else {
        // id is immutable on update — strip it from the patch.
        const { id, ...patch } = payload;
        if (!onUpdate) throw new Error('onUpdate handler missing');
        await onUpdate(location.id, patch);
      }
      onChanged?.();
      onClose();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.location.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (
      !(await confirmDialog({
        body: t('platform.detail.location.delete_confirm', { name: location.name }),
        danger: true,
      }))
    )
      return;
    setErr('');
    setBusy(true);
    try {
      if (!onDelete) throw new Error('onDelete handler missing');
      await onDelete(location.id);
      onChanged?.();
      onClose();
    } catch (ex) {
      setErr(ex.message || t('platform.detail.location.delete_failed'));
    } finally {
      setBusy(false);
    }
  };

  // Filter parent options: same org; never the row itself; never a
  // descendant either (would create a cycle, but full descendant
  // detection requires graph traversal — keep it light, the DB will
  // reject FK cycles on its own if anyone slips through).
  const parentOptions = (parents || []).filter((p) => p.id !== form.id);

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
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {isNew ? t('platform.detail.location.new') : t('platform.detail.location.edit')}
            </div>
            {!isNew && (
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{location.id}</div>
            )}
          </div>
          <button onClick={onClose} style={ghostBtn()} disabled={busy}>
            <Icon.close size={12} />
          </button>
        </header>

        <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--risk)',
                background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--risk) 35%, transparent)',
                borderRadius: 6,
              }}
            >
              {err}
            </div>
          )}

          <Section title={t('platform.detail.location.section.identity')}>
            <Row>
              <Field label={t('platform.detail.location.id')} hint={t('platform.detail.location.id_hint')}>
                <input
                  value={form.id}
                  onChange={update('id')}
                  disabled={!isNew}
                  placeholder="hq-fl-32-east"
                  style={inputStyle(!isNew)}
                />
              </Field>
              <Field label={t('platform.detail.location.kind')}>
                <select value={form.kind} onChange={update('kind')} style={selectStyle()}>
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>
            <Field label={t('platform.detail.location.name')}>
              <input value={form.name} onChange={update('name')} style={inputStyle()} />
            </Field>
            <Field label={t('platform.detail.location.addr')}>
              <input
                value={form.addr}
                onChange={update('addr')}
                placeholder="450 Sansome St, San Francisco CA 94111"
                style={inputStyle()}
              />
            </Field>
            <Field label={t('platform.detail.location.parent')} hint={t('platform.detail.location.parent_hint')}>
              <select value={form.parent_id} onChange={update('parent_id')} style={selectStyle()}>
                <option value="">{t('platform.detail.location.parent_none')}</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.kind})
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title={t('platform.detail.location.section.geography')}>
            <Row>
              <Field label={t('platform.detail.location.latitude')}>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={update('latitude')}
                  placeholder="40.7128"
                  style={inputStyle()}
                />
              </Field>
              <Field label={t('platform.detail.location.longitude')}>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={update('longitude')}
                  placeholder="-74.0060"
                  style={inputStyle()}
                />
              </Field>
            </Row>
          </Section>

          <Section title={t('platform.detail.location.section.metrics')}>
            <Row>
              <Field label={t('platform.detail.location.floors')}>
                <input type="number" min="0" value={form.floors} onChange={update('floors')} style={inputStyle()} />
              </Field>
              <Field label={t('platform.detail.location.sqft')}>
                <input value={form.sqft} onChange={update('sqft')} placeholder="50,000" style={inputStyle()} />
              </Field>
            </Row>
            <Row>
              <Field label={t('platform.detail.location.displays')}>
                <input type="number" min="0" value={form.displays} onChange={update('displays')} style={inputStyle()} />
              </Field>
              <Field label={t('platform.detail.location.sensors')}>
                <input type="number" min="0" value={form.sensors} onChange={update('sensors')} style={inputStyle()} />
              </Field>
              <Field label={t('platform.detail.location.branches')} hint={t('platform.detail.location.branches_hint')}>
                <input
                  type="number"
                  min="0"
                  value={form.branches}
                  onChange={update('branches')}
                  placeholder="—"
                  style={inputStyle()}
                />
              </Field>
            </Row>
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
          }}
        >
          {!isNew && onDelete && (
            <button onClick={handleDelete} disabled={busy} style={dangerBtn()}>
              <Icon.close size={11} /> {t('platform.detail.location.delete')}
            </button>
          )}
          <div style={{ flex: 1 }} />
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
function inputStyle(disabled = false) {
  return {
    padding: '7px 10px',
    fontSize: 12.5,
    color: 'var(--text)',
    background: disabled ? 'var(--surface-2)' : 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontFamily: 'var(--mono)',
    width: '100%',
    opacity: disabled ? 0.7 : 1,
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
    fontFamily: 'var(--font)',
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
