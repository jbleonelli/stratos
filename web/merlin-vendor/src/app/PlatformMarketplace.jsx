// Platform → Marketplace.
// Adaptiv-side CMS for the marketplace_vendors table (migration 072).
// Reads via useVendors() hook (realtime-subscribed); writes go through
// createVendor / updateVendor / deleteVendor with RLS-enforced
// platform-admin gating.

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, IconBtn, AdaptivLoader } from './primitives.jsx';
import { useVendors, createVendor, updateVendor, deleteVendor } from './vendors-data.js';
import { confirmDialog } from './dialogs.jsx';
import { REGIONS, REGION_META, STATUS_TONE, STATUS_LABEL_KEY, DEPLOY_TYPE_LABEL_KEY } from './innovate-catalog.js';
import { useT } from './i18n.js';

const CATEGORIES = [
  { id: 'wellbeing', labelKey: 'innovate.cat.wellbeing.label' },
  { id: 'energy', labelKey: 'innovate.cat.energy.label' },
  { id: 'safety', labelKey: 'innovate.cat.safety.label' },
  { id: 'compliance', labelKey: 'innovate.cat.compliance.label' },
  { id: 'operations', labelKey: 'innovate.cat.operations.label' },
  { id: 'financial', labelKey: 'innovate.cat.financial.label' },
];

const DEPLOY_TYPES = ['sensor', 'hardware', 'service', 'software'];
const STATUSES = ['available', 'beta', 'coming-soon'];

function emptyVendor() {
  return {
    id: '',
    name: '',
    categoryId: 'operations',
    deployType: 'software',
    region: 'global',
    status: 'available',
    tagline: '',
    desc: '',
    longDesc: '',
    keyFeatures: [],
    products: [],
    integration: '',
    pricing: '',
    url: '',
    isFeatured: false,
    featuredOrder: null,
    featuredPitch: '',
    displayOrder: 100,
  };
}

export function PlatformMarketplacePage() {
  const t = useT();
  const vendors = useVendors();
  const [filter, setFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [editing, setEditing] = useState(null); // vendor object, '__new__', or null

  const ready = vendors !== null;
  const list = vendors || [];

  const visible = useMemo(
    () =>
      list.filter(
        (v) =>
          (filter === 'all' || v.categoryId === filter) &&
          (regionFilter === 'all' || (v.region || 'global') === regionFilter),
      ),
    [list, filter, regionFilter],
  );

  const startEdit = (v) =>
    setEditing({ ...v, keyFeatures: [...(v.keyFeatures || [])], products: (v.products || []).map((p) => ({ ...p })) });
  const startNew = () => setEditing({ ...emptyVendor(), __new: true });
  const cancel = () => setEditing(null);

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero count={list.length} featuredCount={list.filter((v) => v.isFeatured).length} onNew={startNew} t={t} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
          {t('platform.marketplace.filter.category')}:
        </span>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('innovate.filter.all')} {list.length}
        </FilterPill>
        {CATEGORIES.map((c) => {
          const n = list.filter((v) => v.categoryId === c.id).length;
          return (
            <FilterPill key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {t(c.labelKey)} {n}
            </FilterPill>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: -8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{t('innovate.region.eyebrow')}:</span>
        <FilterPill active={regionFilter === 'all'} onClick={() => setRegionFilter('all')}>
          {t('innovate.filter.all')}
        </FilterPill>
        {REGIONS.map((r) => {
          const n = list.filter((v) => (v.region || 'global') === r.id).length;
          if (n === 0 && r.id !== 'global') return null;
          return (
            <FilterPill key={r.id} active={regionFilter === r.id} onClick={() => setRegionFilter(r.id)}>
              <span style={{ marginRight: 4 }}>{r.flag}</span>
              {t(r.labelKey)} {n}
            </FilterPill>
          );
        })}
      </div>

      {/* List */}
      <Card pad={false}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 80px',
            gap: 12,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.12,
          }}
        >
          <div>{t('platform.marketplace.col.vendor')}</div>
          <div>{t('platform.marketplace.col.category')}</div>
          <div>{t('platform.marketplace.col.region')}</div>
          <div>{t('platform.marketplace.col.deploy')}</div>
          <div>{t('platform.marketplace.col.status')}</div>
          <div>{t('platform.marketplace.col.featured')}</div>
        </div>
        {!ready ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <AdaptivLoader size="sm" />
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>
            {t('platform.marketplace.empty')}
          </div>
        ) : (
          visible.map((v) => <VendorRow key={v.id} vendor={v} onClick={() => startEdit(v)} t={t} />)
        )}
      </Card>

      {editing && (
        <VendorEditor
          vendor={editing}
          isNew={!!editing.__new}
          existingIds={list.map((v) => v.id)}
          onClose={cancel}
          t={t}
        />
      )}
    </div>
  );
}

// ────── Hero

function Hero({ count, featuredCount, onNew, t }) {
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(600px 220px at 90% 0%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon.sparkle size={11} style={{ color: 'var(--accent)' }} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('platform.marketplace.eyebrow')}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {t('platform.marketplace.title')}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-soft)', maxWidth: 640, lineHeight: 1.5 }}>
            {t('platform.marketplace.body', { count, featuredCount })}
          </p>
        </div>
        <button
          onClick={onNew}
          style={{
            padding: '10px 16px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 6px 18px color-mix(in oklch, var(--accent) 30%, transparent)',
          }}
        >
          <Icon.plus size={11} /> {t('platform.marketplace.new')}
        </button>
      </div>
    </Card>
  );
}

// ────── List row

function VendorRow({ vendor, onClick, t }) {
  const region = REGION_META[vendor.region || 'global'];
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 80px',
        gap: 12,
        alignItems: 'center',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '';
      }}
    >
      <div>
        <div style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {vendor.name}
          {region && <span style={{ fontSize: 13 }}>{region.flag}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
          {vendor.id}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{t('innovate.cat.' + vendor.categoryId + '.label')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{region ? t(region.labelKey) : ''}</div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{t(DEPLOY_TYPE_LABEL_KEY[vendor.deployType] || '')}</div>
      <div>
        <Pill tone={STATUS_TONE[vendor.status] || 'off'}>
          {t(STATUS_LABEL_KEY[vendor.status] || 'innovate.status.coming_soon')}
        </Pill>
      </div>
      <div>
        {vendor.isFeatured ? (
          <Pill tone="accent">★ {vendor.featuredOrder ?? '-'}</Pill>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>
        )}
      </div>
    </div>
  );
}

// ────── Editor (slide-in panel)

function VendorEditor({ vendor, isNew, existingIds, onClose, t }) {
  const [draft, setDraft] = useState(vendor);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setErr('');
    const id = (draft.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!id) {
      setErr(t('platform.marketplace.err.id_required'));
      return;
    }
    if (!draft.name?.trim()) {
      setErr(t('platform.marketplace.err.name_required'));
      return;
    }
    if (isNew && existingIds.includes(id)) {
      setErr(t('platform.marketplace.err.id_taken', { id }));
      return;
    }
    const clean = {
      ...draft,
      id,
      keyFeatures: (draft.keyFeatures || []).map((s) => (s || '').trim()).filter(Boolean),
      products: (draft.products || [])
        .map((p) => ({ name: (p.name || '').trim(), desc: (p.desc || '').trim() }))
        .filter((p) => p.name),
      featuredOrder: draft.isFeatured ? Number(draft.featuredOrder) || 100 : null,
    };
    setBusy(true);
    try {
      if (isNew) await createVendor(clean);
      else await updateVendor(vendor.id, clean);
      onClose();
    } catch (ex) {
      setErr(ex.message || t('platform.marketplace.err.save'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ body: t('platform.marketplace.delete_confirm', { name: vendor.name }), danger: true })))
      return;
    setBusy(true);
    setErr('');
    try {
      await deleteVendor(vendor.id);
      onClose();
    } catch (ex) {
      setErr(ex.message || t('platform.marketplace.err.delete'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 40,
          animation: 'merlinFadeIn .12s ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(640px, 96vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.10)',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
          animation: 'merlinSlideIn .18s ease-out',
          fontFamily: 'var(--font)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {isNew
                ? t('platform.marketplace.editor.title_new')
                : t('platform.marketplace.editor.title_edit', { name: vendor.name })}
            </div>
          </div>
          <IconBtn onClick={onClose} title={t('action.close')}>
            <Icon.close size={13} />
          </IconBtn>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {err && <Banner tone="risk">{err}</Banner>}

          {/* Identity */}
          <Section title={t('platform.marketplace.section.identity')}>
            <Field
              label={t('platform.marketplace.field.id')}
              hint={isNew ? t('platform.marketplace.field.id_hint') : t('platform.marketplace.field.id_locked')}
            >
              <Input value={draft.id} onChange={(v) => set({ id: v })} disabled={!isNew} placeholder="penbase" />
            </Field>
            <Field label={t('platform.marketplace.field.name')}>
              <Input value={draft.name} onChange={(v) => set({ name: v })} placeholder="Penbase" />
            </Field>
            <Field label={t('platform.marketplace.field.url')}>
              <Input value={draft.url || ''} onChange={(v) => set({ url: v })} placeholder="https://penbase.com" />
            </Field>
          </Section>

          {/* Taxonomy */}
          <Section title={t('platform.marketplace.section.taxonomy')}>
            <Row>
              <Field label={t('platform.marketplace.field.category')}>
                <Select
                  value={draft.categoryId}
                  onChange={(v) => set({ categoryId: v })}
                  options={CATEGORIES.map((c) => ({ value: c.id, label: t(c.labelKey) }))}
                />
              </Field>
              <Field label={t('platform.marketplace.field.deploy')}>
                <Select
                  value={draft.deployType}
                  onChange={(v) => set({ deployType: v })}
                  options={DEPLOY_TYPES.map((d) => ({ value: d, label: t(DEPLOY_TYPE_LABEL_KEY[d]) }))}
                />
              </Field>
            </Row>
            <Row>
              <Field label={t('platform.marketplace.field.region')}>
                <Select
                  value={draft.region}
                  onChange={(v) => set({ region: v })}
                  options={REGIONS.map((r) => ({ value: r.id, label: r.flag + ' ' + t(r.labelKey) }))}
                />
              </Field>
              <Field label={t('platform.marketplace.field.status')}>
                <Select
                  value={draft.status}
                  onChange={(v) => set({ status: v })}
                  options={STATUSES.map((s) => ({ value: s, label: t(STATUS_LABEL_KEY[s]) }))}
                />
              </Field>
            </Row>
          </Section>

          {/* Card content */}
          <Section title={t('platform.marketplace.section.card')}>
            <Field label={t('platform.marketplace.field.tagline')} hint={t('platform.marketplace.field.tagline_hint')}>
              <Input value={draft.tagline} onChange={(v) => set({ tagline: v })} />
            </Field>
            <Field label={t('platform.marketplace.field.desc')} hint={t('platform.marketplace.field.desc_hint')}>
              <Textarea value={draft.desc} onChange={(v) => set({ desc: v })} rows={2} />
            </Field>
          </Section>

          {/* Detail-drawer content */}
          <Section title={t('platform.marketplace.section.detail')}>
            <Field
              label={t('platform.marketplace.field.long_desc')}
              hint={t('platform.marketplace.field.long_desc_hint')}
            >
              <Textarea value={draft.longDesc || ''} onChange={(v) => set({ longDesc: v })} rows={4} />
            </Field>
            <Field label={t('platform.marketplace.field.key_features')}>
              <ListEditor
                items={draft.keyFeatures || []}
                onChange={(arr) => set({ keyFeatures: arr })}
                placeholder={t('platform.marketplace.field.key_features_placeholder')}
              />
            </Field>
            <Field label={t('platform.marketplace.field.products')}>
              <ProductsEditor products={draft.products || []} onChange={(arr) => set({ products: arr })} t={t} />
            </Field>
            <Field
              label={t('platform.marketplace.field.integration')}
              hint={t('platform.marketplace.field.integration_hint')}
            >
              <Textarea value={draft.integration || ''} onChange={(v) => set({ integration: v })} rows={3} />
            </Field>
            <Field label={t('platform.marketplace.field.pricing')}>
              <Input
                value={draft.pricing || ''}
                onChange={(v) => set({ pricing: v })}
                placeholder="SaaS · per building"
              />
            </Field>
          </Section>

          {/* Featured */}
          <Section title={t('platform.marketplace.section.featured')}>
            <Field label="">
              <Toggle
                checked={!!draft.isFeatured}
                onChange={(v) => set({ isFeatured: v })}
                label={t('platform.marketplace.field.is_featured')}
              />
            </Field>
            {draft.isFeatured && (
              <>
                <Field
                  label={t('platform.marketplace.field.featured_order')}
                  hint={t('platform.marketplace.field.featured_order_hint')}
                >
                  <Input
                    value={String(draft.featuredOrder ?? '')}
                    onChange={(v) => set({ featuredOrder: v === '' ? null : Number(v) })}
                  />
                </Field>
                <Field
                  label={t('platform.marketplace.field.featured_pitch')}
                  hint={t('platform.marketplace.field.featured_pitch_hint')}
                >
                  <Textarea value={draft.featuredPitch || ''} onChange={(v) => set({ featuredPitch: v })} rows={2} />
                </Field>
              </>
            )}
          </Section>

          {/* Sort */}
          <Section title={t('platform.marketplace.section.sort')}>
            <Field
              label={t('platform.marketplace.field.display_order')}
              hint={t('platform.marketplace.field.display_order_hint')}
            >
              <Input
                value={String(draft.displayOrder ?? 100)}
                onChange={(v) => set({ displayOrder: Number(v) || 100 })}
              />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: 'var(--surface-2)',
          }}
        >
          {!isNew && (
            <button
              onClick={remove}
              disabled={busy}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: 'transparent',
                color: 'var(--risk)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {t('action.delete')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {t('action.cancel')}
          </button>
          <button
            onClick={save}
            disabled={busy}
            style={{
              padding: '8px 18px',
              fontSize: 12.5,
              fontWeight: 700,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? t('action.saving') : isNew ? t('platform.marketplace.create') : t('action.save')}
          </button>
        </div>
      </div>
    </>
  );
}

// ────── Form primitives

function Section({ title, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' }}>{label}</span>}
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</span>}
    </label>
  );
}

function Input({ value, onChange, disabled, placeholder }) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: disabled ? 'var(--surface-2)' : 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        fontSize: 13,
        fontFamily: 'inherit',
        color: 'var(--text)',
        boxSizing: 'border-box',
      }}
    />
  );
}

function Textarea({ value, onChange, rows = 3 }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        fontSize: 13,
        fontFamily: 'inherit',
        color: 'var(--text)',
        resize: 'vertical',
        lineHeight: 1.5,
        boxSizing: 'border-box',
      }}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        fontSize: 13,
        fontFamily: 'inherit',
        color: 'var(--text)',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 4px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: checked ? 'var(--accent)' : 'var(--border-strong)',
          position: 'relative',
          transition: 'background .15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: '#fff',
            transition: 'left .15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
    </button>
  );
}

function ListEditor({ items, onChange, placeholder }) {
  const set = (i, val) => onChange(items.map((x, j) => (j === i ? val : x)));
  const add = () => onChange([...items, '']);
  const del = (i) => onChange(items.filter((_, j) => j !== i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <Input value={it} onChange={(v) => set(i, v)} placeholder={placeholder} />
          <IconBtn onClick={() => del(i)} title="Remove">
            <Icon.close size={11} />
          </IconBtn>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: 'flex-start',
          padding: '5px 10px',
          fontSize: 11.5,
          fontWeight: 600,
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Icon.plus size={10} /> Add
      </button>
    </div>
  );
}

function ProductsEditor({ products, onChange, t }) {
  const set = (i, patch) => onChange(products.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const add = () => onChange([...products, { name: '', desc: '' }]);
  const del = (i) => onChange(products.filter((_, j) => j !== i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {products.map((p, i) => (
        <div
          key={i}
          style={{
            padding: 10,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Input
                value={p.name}
                onChange={(v) => set(i, { name: v })}
                placeholder={t('platform.marketplace.field.product_name')}
              />
            </div>
            <IconBtn onClick={() => del(i)} title="Remove">
              <Icon.close size={11} />
            </IconBtn>
          </div>
          <Textarea value={p.desc} onChange={(v) => set(i, { desc: v })} rows={2} />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: 'flex-start',
          padding: '5px 10px',
          fontSize: 11.5,
          fontWeight: 600,
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Icon.plus size={10} /> {t('platform.marketplace.field.add_product')}
      </button>
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11.5,
        fontWeight: 600,
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: '1px solid ' + (active ? 'var(--accent-line)' : 'var(--border)'),
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Banner({ tone, children }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        background: `color-mix(in oklch, var(--${tone}) 12%, transparent)`,
        border: `1px solid color-mix(in oklch, var(--${tone}) 35%, transparent)`,
        color: `var(--${tone})`,
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
