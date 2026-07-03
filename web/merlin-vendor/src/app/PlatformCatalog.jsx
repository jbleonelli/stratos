// Platform → Devices · Catalog (phase 1b).
// SKUs (every product we sell or build) and Profiles (predefined kits
// that bundle SKUs for a use case). Click a row/card to edit; "+ New"
// in each tab opens a blank drawer. Soft-delete via the Active toggle.

import React, { useEffect, useState } from 'react';
import { Card } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useDeviceCatalog, saveSku, setSkuActive, saveProfile, setProfileActive } from './devices-platform-data.js';
import { useT } from './i18n.js';

const TABS = [
  { id: 'skus', labelKey: 'platform.catalog.tab.skus' },
  { id: 'profiles', labelKey: 'platform.catalog.tab.profiles' },
];

const FAMILIES = ['display', 'sensor', 'aggregator', 'controller'];
const KINDS = [
  'display_touch',
  'display_eink',
  'display_sdg',
  'airq',
  'occupancy',
  'pc_counter',
  'camera',
  'badge',
  'leak',
  'beacon',
];
const USE_CASES = ['restroom', 'conference_room', 'open_floor', 'lobby', 'security', 'leak_monitoring'];

export function PlatformCatalogPage() {
  const t = useT();
  const [tab, setTab] = useState('skus');
  const { skus, profiles, ready, error, refresh } = useDeviceCatalog();
  const [editingSku, setEditingSku] = useState(null); // null | { ...sku } | 'new'
  const [editingProfile, setEditingProfile] = useState(null); // null | { ...profile, items: [...] } | 'new'

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero skuCount={skus.length} profileCount={profiles.length} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            gap: 2,
            background: 'var(--surface-2)',
            padding: 2,
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
        >
          {TABS.map((x) => {
            const active = tab === x.id;
            return (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.25,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                {t(x.labelKey)}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        {tab === 'skus' && (
          <button onClick={() => setEditingSku('new')} style={primaryBtn()}>
            <Icon.plus size={11} /> {t('platform.catalog.new_sku')}
          </button>
        )}
        {tab === 'profiles' && (
          <button onClick={() => setEditingProfile('new')} style={primaryBtn()}>
            <Icon.plus size={11} /> {t('platform.catalog.new_profile')}
          </button>
        )}
      </div>

      {!ready && (
        <Card pad>
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.catalog.loading')}</div>
        </Card>
      )}
      {ready && error && (
        <Card pad>
          <div style={{ color: 'var(--risk)', fontSize: 12 }}>{error}</div>
        </Card>
      )}

      {ready && !error && tab === 'skus' && (
        <SkusTable
          skus={skus}
          onEdit={(s) => setEditingSku(s)}
          onToggleActive={async (s) => {
            await setSkuActive(s.id, !s.active);
            refresh();
          }}
        />
      )}
      {ready && !error && tab === 'profiles' && (
        <ProfilesGrid
          profiles={profiles}
          onEdit={(p) => setEditingProfile(p)}
          onToggleActive={async (p) => {
            await setProfileActive(p.id, !p.active);
            refresh();
          }}
        />
      )}

      {editingSku && (
        <SkuEditorDrawer
          sku={editingSku === 'new' ? {} : editingSku}
          isNew={editingSku === 'new'}
          onClose={() => setEditingSku(null)}
          onSaved={() => {
            setEditingSku(null);
            refresh();
          }}
        />
      )}
      {editingProfile && (
        <ProfileEditorDrawer
          profile={editingProfile === 'new' ? { items: [] } : editingProfile}
          isNew={editingProfile === 'new'}
          skus={skus}
          onClose={() => setEditingProfile(null)}
          onSaved={() => {
            setEditingProfile(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Hero({ skuCount, profileCount }) {
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
          {t('platform.catalog.eyebrow')}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('platform.catalog.title')}{' '}
          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
            · {skuCount} {t('platform.catalog.skus')} · {profileCount} {t('platform.catalog.kits')}
          </span>
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>{t('platform.catalog.body')}</p>
      </div>
    </Card>
  );
}

function SkusTable({ skus, onEdit, onToggleActive }) {
  const t = useT();
  if (skus.length === 0) {
    return (
      <Card pad>
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.catalog.skus_empty')}</div>
      </Card>
    );
  }
  return (
    <Card pad={false}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(160px, 200px) minmax(220px, 1fr) minmax(110px, 130px) minmax(130px, 160px) minmax(100px, 120px) minmax(80px, 100px)',
          fontSize: 12,
        }}
      >
        <Header>{t('platform.catalog.col.id')}</Header>
        <Header>{t('platform.catalog.col.name')}</Header>
        <Header>{t('platform.catalog.col.family')}</Header>
        <Header>{t('platform.catalog.col.kind')}</Header>
        <Header align="right">{t('platform.catalog.col.price')}</Header>
        <Header align="right">{t('platform.catalog.col.active')}</Header>
        {skus.map((s, i) => (
          <RowGroup key={s.id} onClick={() => onEdit(s)} first={i === 0}>
            <Cell mono>{s.id}</Cell>
            <Cell>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
              {s.short_description && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{s.short_description}</div>
              )}
            </Cell>
            <Cell>{s.family}</Cell>
            <Cell mono>{s.kind}</Cell>
            <Cell align="right" mono>
              {formatPrice(s.list_price_cents, s.currency)}
            </Cell>
            <Cell align="right">
              <ActiveToggle
                active={s.active}
                onToggle={(e) => {
                  e.stopPropagation();
                  onToggleActive(s);
                }}
              />
            </Cell>
          </RowGroup>
        ))}
      </div>
    </Card>
  );
}

function ProfilesGrid({ profiles, onEdit, onToggleActive }) {
  const t = useT();
  if (profiles.length === 0) {
    return (
      <Card pad>
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.catalog.profiles_empty')}</div>
      </Card>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--pad)' }}>
      {profiles.map((p) => (
        <Card
          key={p.id}
          pad
          interactive
          style={{ cursor: 'pointer', opacity: p.active ? 1 : 0.55 }}
          onClick={() => onEdit(p)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{p.id}</div>
              <h3 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700 }}>
                {p.name}
                {p.recommended && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: '2px 6px',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent-line)',
                      borderRadius: 4,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                      textTransform: 'uppercase',
                      verticalAlign: 'middle',
                    }}
                  >
                    {t('platform.catalog.recommended')}
                  </span>
                )}
                {!p.active && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: '2px 6px',
                      background: 'var(--surface-3)',
                      color: 'var(--text-dim)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                      textTransform: 'uppercase',
                      verticalAlign: 'middle',
                    }}
                  >
                    {t('platform.catalog.inactive')}
                  </span>
                )}
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.use_case}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatPrice(p.list_price_cents, p.currency)}
              </div>
              {p.estimated_install_minutes != null && (
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                  {t('platform.catalog.install_min', { n: p.estimated_install_minutes })}
                </div>
              )}
            </div>
          </div>
          {p.description && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-soft)' }}>{p.description}</p>
          )}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: 6,
              }}
            >
              {t('platform.catalog.bom')}
            </div>
            {(p.items || []).length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                {t('platform.catalog.bom_empty')}
              </div>
            )}
            {(p.items || []).map((it) => (
              <div
                key={it.sku_id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}
              >
                <span style={{ color: 'var(--text-soft)' }}>{it.sku_name}</span>
                <span
                  style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)' }}
                >
                  ×{it.qty}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <ActiveToggle
              active={p.active}
              onToggle={(e) => {
                e.stopPropagation();
                onToggleActive(p);
              }}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ────── SKU editor

function SkuEditorDrawer({ sku, isNew, onClose, onSaved }) {
  const t = useT();
  const [form, setForm] = useState(() => ({ ...sku, currency: sku.currency || 'USD', active: sku.active ?? true }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (isNew) {
        if (!form.id || !/^[a-z0-9-]+$/.test(form.id)) throw new Error(t('platform.catalog.err_id'));
      }
      if (!form.name) throw new Error(t('platform.catalog.err_name'));
      if (!form.family) throw new Error(t('platform.catalog.err_family'));
      if (!form.kind) throw new Error(t('platform.catalog.err_kind'));
      await saveSku(form, { isNew });
      onSaved();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      onClose={onClose}
      title={isNew ? t('platform.catalog.new_sku') : t('platform.catalog.edit_sku')}
      footer={<DrawerFooter onCancel={onClose} onSave={submit} busy={busy} err={err} />}
    >
      <Field label={t('platform.catalog.col.id')} hint={t('platform.catalog.id_hint')}>
        <input
          value={form.id || ''}
          onChange={(e) => update({ id: e.target.value })}
          disabled={!isNew}
          placeholder="sd-touch-pro-2"
          style={inputStyle(!isNew)}
        />
      </Field>
      <Field label={t('platform.catalog.col.name')}>
        <input value={form.name || ''} onChange={(e) => update({ name: e.target.value })} style={inputStyle()} />
      </Field>
      <Row>
        <Field label={t('platform.catalog.col.family')}>
          <select value={form.family || ''} onChange={(e) => update({ family: e.target.value })} style={selectStyle()}>
            <option value="">{t('platform.catalog.placeholder.choose')}</option>
            {FAMILIES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('platform.catalog.col.kind')}>
          <select value={form.kind || ''} onChange={(e) => update({ kind: e.target.value })} style={selectStyle()}>
            <option value="">{t('platform.catalog.placeholder.choose')}</option>
            {KINDS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      <Field label={t('platform.catalog.field.short_desc')}>
        <input
          value={form.short_description || ''}
          onChange={(e) => update({ short_description: e.target.value })}
          style={inputStyle()}
        />
      </Field>
      <Field label={t('platform.catalog.field.description')}>
        <textarea
          value={form.description || ''}
          onChange={(e) => update({ description: e.target.value })}
          rows={3}
          style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'var(--font)' }}
        />
      </Field>
      <Row>
        <Field label={t('platform.catalog.field.list_price')} hint={t('platform.catalog.price_hint')}>
          <input
            type="number"
            min="0"
            step="100"
            value={form.list_price_cents ?? ''}
            onChange={(e) => update({ list_price_cents: e.target.value })}
            style={inputStyle()}
          />
        </Field>
        <Field label={t('platform.catalog.field.msrp')} hint={t('platform.catalog.price_hint')}>
          <input
            type="number"
            min="0"
            step="100"
            value={form.msrp_cents ?? ''}
            onChange={(e) => update({ msrp_cents: e.target.value })}
            style={inputStyle()}
          />
        </Field>
        <Field label={t('platform.catalog.field.currency')}>
          <input
            value={form.currency || ''}
            onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
            maxLength={3}
            style={inputStyle()}
          />
        </Field>
      </Row>
      <Row>
        <Field label={t('platform.catalog.field.firmware')}>
          <input
            value={form.default_firmware || ''}
            onChange={(e) => update({ default_firmware: e.target.value })}
            placeholder="4.7.2"
            style={inputStyle()}
          />
        </Field>
        <Field label={t('platform.catalog.field.manufacturer')}>
          <input
            value={form.manufacturer || ''}
            onChange={(e) => update({ manufacturer: e.target.value })}
            style={inputStyle()}
          />
        </Field>
      </Row>
      <Field label={t('platform.catalog.field.hero_image')}>
        <input
          value={form.hero_image_url || ''}
          onChange={(e) => update({ hero_image_url: e.target.value })}
          placeholder="https://…"
          style={inputStyle()}
        />
      </Field>
      <Field label={t('platform.catalog.field.long_desc')} hint={t('platform.catalog.markdown_hint')}>
        <textarea
          value={form.long_description || ''}
          onChange={(e) => update({ long_description: e.target.value })}
          rows={6}
          style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 11.5 }}
        />
      </Field>
      <CheckboxField
        label={t('platform.catalog.field.active')}
        checked={form.active !== false}
        onChange={(v) => update({ active: v })}
        hint={t('platform.catalog.active_hint')}
      />
    </Drawer>
  );
}

// ────── Profile editor (with BOM management)

function ProfileEditorDrawer({ profile, isNew, skus, onClose, onSaved }) {
  const t = useT();
  const [form, setForm] = useState(() => ({
    ...profile,
    currency: profile.currency || 'USD',
    active: profile.active ?? true,
    recommended: profile.recommended ?? false,
  }));
  const [items, setItems] = useState(() => (profile.items || []).map((it) => ({ sku_id: it.sku_id, qty: it.qty })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const updateItem = (i, patch) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const removeItem = (i) => setItems((arr) => arr.filter((_, j) => j !== i));
  const addItem = () => setItems((arr) => [...arr, { sku_id: '', qty: 1 }]);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (isNew) {
        if (!form.id || !/^[a-z0-9-]+$/.test(form.id)) throw new Error(t('platform.catalog.err_id'));
      }
      if (!form.name) throw new Error(t('platform.catalog.err_name'));
      if (!form.use_case) throw new Error(t('platform.catalog.err_use_case'));
      // Drop blanks; sku_id required.
      const cleaned = items.filter((it) => it.sku_id && Number(it.qty) > 0);
      await saveProfile(form, cleaned, { isNew });
      onSaved();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  // Compute BOM total live (sum of sku list_price × qty).
  const skuById = new Map(skus.map((s) => [s.id, s]));
  const bomTotal = items.reduce((acc, it) => {
    const sku = skuById.get(it.sku_id);
    return acc + (sku?.list_price_cents || 0) * (Number(it.qty) || 0);
  }, 0);

  return (
    <Drawer
      onClose={onClose}
      title={isNew ? t('platform.catalog.new_profile') : t('platform.catalog.edit_profile')}
      footer={<DrawerFooter onCancel={onClose} onSave={submit} busy={busy} err={err} />}
    >
      <Field label={t('platform.catalog.col.id')} hint={t('platform.catalog.id_hint')}>
        <input
          value={form.id || ''}
          onChange={(e) => update({ id: e.target.value })}
          disabled={!isNew}
          placeholder="kit-restroom-pro"
          style={inputStyle(!isNew)}
        />
      </Field>
      <Field label={t('platform.catalog.col.name')}>
        <input value={form.name || ''} onChange={(e) => update({ name: e.target.value })} style={inputStyle()} />
      </Field>
      <Row>
        <Field label={t('platform.catalog.field.use_case')}>
          <select
            value={form.use_case || ''}
            onChange={(e) => update({ use_case: e.target.value })}
            style={selectStyle()}
          >
            <option value="">{t('platform.catalog.placeholder.choose')}</option>
            {USE_CASES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('platform.catalog.field.install_minutes')}>
          <input
            type="number"
            min="0"
            value={form.estimated_install_minutes ?? ''}
            onChange={(e) => update({ estimated_install_minutes: e.target.value })}
            style={inputStyle()}
          />
        </Field>
      </Row>
      <Field label={t('platform.catalog.field.description')}>
        <textarea
          value={form.description || ''}
          onChange={(e) => update({ description: e.target.value })}
          rows={3}
          style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'var(--font)' }}
        />
      </Field>
      <Row>
        <Field label={t('platform.catalog.field.list_price')} hint={t('platform.catalog.price_hint')}>
          <input
            type="number"
            min="0"
            step="100"
            value={form.list_price_cents ?? ''}
            onChange={(e) => update({ list_price_cents: e.target.value })}
            style={inputStyle()}
          />
        </Field>
        <Field label={t('platform.catalog.field.currency')}>
          <input
            value={form.currency || ''}
            onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
            maxLength={3}
            style={inputStyle()}
          />
        </Field>
      </Row>
      <Field label={t('platform.catalog.field.hero_image')}>
        <input
          value={form.hero_image_url || ''}
          onChange={(e) => update({ hero_image_url: e.target.value })}
          placeholder="https://…"
          style={inputStyle()}
        />
      </Field>

      {/* BOM editor */}
      <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            {t('platform.catalog.bom')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {t('platform.catalog.bom_total')}{' '}
            <strong style={{ color: 'var(--text)' }}>{formatPrice(bomTotal, form.currency)}</strong>
          </div>
        </div>
        {items.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', padding: '8px 0' }}>
            {t('platform.catalog.bom_empty')}
          </div>
        )}
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 28px',
              gap: 8,
              marginBottom: 6,
              alignItems: 'center',
            }}
          >
            <select
              value={it.sku_id || ''}
              onChange={(e) => updateItem(i, { sku_id: e.target.value })}
              style={selectStyle()}
            >
              <option value="">{t('platform.catalog.placeholder.choose_sku')}</option>
              {skus
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
            </select>
            <input
              type="number"
              min="1"
              value={it.qty}
              onChange={(e) => updateItem(i, { qty: e.target.value })}
              style={inputStyle()}
            />
            <button onClick={() => removeItem(i)} title={t('platform.catalog.remove_sku')} style={ghostBtn()}>
              <Icon.close size={11} />
            </button>
          </div>
        ))}
        <button onClick={addItem} style={{ ...ghostBtn(), marginTop: 4, padding: '6px 12px', width: '100%' }}>
          <Icon.plus size={11} /> {t('platform.catalog.add_sku')}
        </button>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CheckboxField
          label={t('platform.catalog.field.recommended')}
          checked={!!form.recommended}
          onChange={(v) => update({ recommended: v })}
          hint={t('platform.catalog.recommended_hint')}
        />
        <CheckboxField
          label={t('platform.catalog.field.active')}
          checked={form.active !== false}
          onChange={(v) => update({ active: v })}
          hint={t('platform.catalog.active_hint')}
        />
      </div>
    </Drawer>
  );
}

// ────── Drawer + form primitives

function Drawer({ title, onClose, footer, children }) {
  // ESC closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'color-mix(in oklch, #000 32%, transparent)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          height: '100%',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={ghostBtn()}>
            <Icon.close size={12} />
          </button>
        </div>
        <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
        <div
          style={{
            flexShrink: 0,
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

function DrawerFooter({ onCancel, onSave, busy, err }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {err && <div style={{ flex: 1, color: 'var(--risk)', fontSize: 11.5 }}>{err}</div>}
      <div style={{ flex: err ? 0 : 1 }} />
      <button onClick={onCancel} disabled={busy} style={ghostBtn(true)}>
        {t('platform.catalog.cancel')}
      </button>
      <button onClick={onSave} disabled={busy} style={primaryBtn()}>
        {busy ? t('platform.catalog.saving') : t('platform.catalog.save')}
      </button>
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

function CheckboxField({ label, checked, onChange, hint }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</span>}
      </div>
    </label>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>;
}

function ActiveToggle({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '3px 10px',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.2,
        textTransform: 'uppercase',
        background: active ? 'var(--accent-soft)' : 'var(--surface-3)',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
        borderRadius: 5,
        cursor: 'pointer',
      }}
    >
      {active ? '✓' : '—'}
    </button>
  );
}

function RowGroup({ children, onClick, first }) {
  return React.Children.map(children, (child, idx) =>
    React.cloneElement(child, { onClick, first, last: idx === React.Children.count(children) - 1 }),
  );
}

function Header({ children, align = 'left' }) {
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
        textAlign: align,
        background: 'var(--surface-2)',
      }}
    >
      {children}
    </div>
  );
}

function Cell({ children, mono, first, align = 'left', onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderTop: first ? 'none' : '1px solid var(--border)',
        color: 'var(--text-soft)',
        textAlign: align,
        fontFamily: mono ? 'var(--mono)' : undefined,
        fontVariantNumeric: 'tabular-nums',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  );
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
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    background: 'var(--accent)',
    color: '#fff',
    border: '1px solid var(--accent)',
    borderRadius: 6,
    cursor: 'pointer',
  };
}

function ghostBtn(disabled = false) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    background: 'transparent',
    color: 'var(--text-soft)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function formatPrice(cents, currency = 'USD') {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
}
