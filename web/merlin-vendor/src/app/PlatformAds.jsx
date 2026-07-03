// Platform → Ads catalog (SaaS v1, phase 6).
// Adaptiv-side editor for the platform_product_ads table. Per-tenant
// hide/pin lives in each customer's Admin → Product ads.

import React, { useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import {
  useAllPlatformAds,
  refreshPlatformAds,
  platformCreateAd,
  platformUpdateAd,
  platformDeleteAd,
  platformSetAdActive,
} from './platform-data.js';
import {
  emptyProductAd,
  ILLUSTRATION_OPTIONS,
  BULLET_ICON_OPTIONS,
  uploadProductAdImage,
  deleteProductAdImage,
  MAX_AD_IMAGE_BYTES,
  refreshProductAdsCustomerCache,
} from './product-ads.js';
import { useAdsGloballyHidden, setAdsGloballyHidden } from './platform-settings.js';
import { confirmDialog } from './dialogs.jsx';
import { useT } from './i18n.js';

export function PlatformAdsPage() {
  const t = useT();
  const { ads, ready } = useAllPlatformAds();
  const [editingId, setEditingId] = useState(null); // id, '__new__', or null
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const startEdit = (ad) => {
    setEditingId(ad.id);
    setDraft({ ...ad, bullets: (ad.bullets || []).map((b) => [...b]) });
    setErr('');
  };
  const startNew = () => {
    setEditingId('__new__');
    setDraft(emptyProductAd());
    setErr('');
  };
  const cancel = () => {
    setEditingId(null);
    setDraft(null);
    setErr('');
  };

  const save = async () => {
    if (!draft) return;
    const id = (draft.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!id) {
      setErr(t('platform.ads.editor.field.slug_required'));
      return;
    }
    if (!draft.name?.trim()) {
      setErr(t('platform.ads.editor.field.name_required'));
      return;
    }
    if (editingId === '__new__' && ads.some((a) => a.id === id)) {
      setErr(t('platform.ads.editor.field.slug_exists', { id }));
      return;
    }
    const cleaned = {
      ...draft,
      id,
      bullets: (draft.bullets || []).map(([icon, text]) => [icon, (text || '').trim()]).filter(([, t]) => t.length > 0),
    };
    setBusy(true);
    setErr('');
    try {
      if (editingId === '__new__') {
        await platformCreateAd(cleaned);
      } else {
        await platformUpdateAd(editingId, cleaned);
      }
      await refreshProductAdsCustomerCache(); // poke the customer-side cache
      cancel();
    } catch (ex) {
      setErr(ex.message || t('platform.ads.editor.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!(await confirmDialog({ body: t('platform.ads.delete_confirm', { id }), danger: true }))) return;
    setBusy(true);
    setErr('');
    try {
      await platformDeleteAd(id);
      await refreshProductAdsCustomerCache();
      if (editingId === id) cancel();
    } catch (ex) {
      setErr(ex.message || t('platform.ads.editor.delete_failed'));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id, nextActive) => {
    setBusy(true);
    setErr('');
    try {
      await platformSetAdActive(id, nextActive);
      await refreshProductAdsCustomerCache();
    } catch (ex) {
      setErr(ex.message || t('platform.ads.editor.update_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero
        count={ads.length}
        onNew={startNew}
        disabled={busy || !!editingId}
        onRefresh={() => {
          refreshPlatformAds();
          refreshProductAdsCustomerCache();
        }}
      />

      <GlobalAdsKillSwitch />

      <Card pad={false}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Icon.sparkle size={13} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.ads.catalog')}</div>
          <Pill tone="accent">{ads.length}</Pill>
          <Pill tone="ok">{t('platform.ads.active_count', { n: ads.filter((a) => a.active).length })}</Pill>
        </div>

        {!ready && (
          <div style={{ padding: 24, fontSize: 12, color: 'var(--text-dim)' }}>{t('platform.audit.loading')}</div>
        )}

        {ready && ads.length === 0 && editingId !== '__new__' && (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 12.5, color: 'var(--text-dim)' }}>
            {t('platform.ads.empty')}{' '}
            <button
              onClick={startNew}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {t('platform.ads.empty_create')}
            </button>
            .
          </div>
        )}

        {editingId === '__new__' && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <AdEditor
              draft={draft}
              setDraft={setDraft}
              onCancel={cancel}
              onSave={save}
              busy={busy}
              err={err}
              isNew={true}
            />
          </div>
        )}

        {ready &&
          ads.map((ad) => (
            <div key={ad.id} style={{ borderTop: '1px solid var(--border)' }}>
              {editingId === ad.id ? (
                <AdEditor
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={cancel}
                  onSave={save}
                  busy={busy}
                  err={err}
                  isNew={false}
                />
              ) : (
                <AdRow
                  ad={ad}
                  onEdit={() => startEdit(ad)}
                  onDelete={() => remove(ad.id)}
                  onToggleActive={() => toggleActive(ad.id, !ad.active)}
                  busy={busy}
                />
              )}
            </div>
          ))}
      </Card>
    </div>
  );
}

// Global "hide ads on every tenant" kill switch. Reads + writes the
// `ads_globally_hidden` row in platform_settings (migration 076).
// When enabled, customer-side product-ads.js loads an empty catalog
// for every tenant regardless of per-tenant pin/hide config.
//
// Staged-toggle pattern: flipping the switch sets *local* state but
// does NOT persist. A Save button appears alongside the toggle when
// local diverges from the saved value. Cancel reverts to saved.
// Stops a fat-finger from killing ads on every customer mid-call.
function GlobalAdsKillSwitch() {
  const t = useT();
  const { enabled, ready } = useAdsGloballyHidden();
  const [local, setLocal] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Sync local state once the read lands.
  React.useEffect(() => {
    if (ready) setLocal(enabled);
  }, [enabled, ready]);

  const dirty = ready && local !== enabled;

  const onToggle = () => {
    if (busy || !ready) return;
    setLocal((v) => !v);
    setErr('');
  };

  const onSave = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    setErr('');
    try {
      await setAdsGloballyHidden(local);
      await refreshProductAdsCustomerCache();
    } catch (ex) {
      setLocal(enabled); // revert on failure
      setErr(ex.message || t('platform.ads.kill.error'));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = () => {
    if (busy) return;
    setLocal(enabled);
    setErr('');
  };

  return (
    <Card pad>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Icon.shield
          size={16}
          style={{ color: local ? 'var(--risk)' : 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.ads.kill.title')}</div>
            {dirty && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  background: 'color-mix(in oklch, var(--warn) 14%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
                  color: 'var(--warn)',
                  borderRadius: 999,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                }}
              >
                {t('platform.ads.kill.unsaved')}
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>{t('platform.ads.kill.body')}</p>
          {err && <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--risk)' }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {dirty && (
            <>
              <button onClick={onCancel} disabled={busy} style={ghostBtn}>
                {t('platform.ads.kill.cancel')}
              </button>
              <button onClick={onSave} disabled={busy} style={primaryBtn}>
                {busy
                  ? t('platform.ads.kill.saving')
                  : t('platform.ads.kill.save') || (local ? 'Save — hide ads' : 'Save — show ads')}
              </button>
            </>
          )}
          <button
            onClick={onToggle}
            disabled={busy || !ready}
            aria-pressed={local}
            style={{
              position: 'relative',
              width: 44,
              height: 24,
              padding: 0,
              background: local ? 'var(--risk)' : 'var(--surface-3)',
              border: `1px solid ${local ? 'var(--risk)' : 'var(--border)'}`,
              borderRadius: 12,
              cursor: busy || !ready ? 'default' : 'pointer',
              opacity: busy || !ready ? 0.5 : 1,
              transition: 'background .12s, border-color .12s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: local ? 22 : 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                transition: 'left .14s ease',
              }}
            />
          </button>
        </div>
      </div>
    </Card>
  );
}

function Hero({ count, onNew, disabled, onRefresh }) {
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
            {t('platform.ads.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.ads.title')} <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>· {count}</span>
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>{t('platform.ads.body')}</p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--surface-2)',
            color: 'var(--text-soft)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Icon.sparkle size={12} /> {t('platform.ads.refresh')}
        </button>
        <button
          onClick={onNew}
          disabled={disabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            background: disabled ? 'color-mix(in oklch, var(--accent) 50%, transparent)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: disabled ? 'none' : '0 4px 12px color-mix(in oklch, var(--accent) 35%, transparent)',
          }}
        >
          <Icon.plus size={13} />
          {t('platform.ads.new')}
        </button>
      </div>
    </Card>
  );
}

function AdRow({ ad, onEdit, onDelete, onToggleActive, busy }) {
  const t = useT();
  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: ad.active ? 1 : 0.6,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          flexShrink: 0,
          background: ad.imageUrl
            ? `url("${ad.imageUrl}") center/cover, var(--surface-3)`
            : 'linear-gradient(135deg, var(--accent), color-mix(in oklch, var(--accent) 60%, #20286D))',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!ad.imageUrl && <Icon.sparkle size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{ad.name || ad.id}</div>
          {!ad.active && <Pill tone="off">{t('platform.ads.inactive')}</Pill>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
          {ad.id} · {ad.illustrationKey} · pos {ad.position}
        </div>
        {ad.spec && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-soft)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ad.spec}
          </div>
        )}
      </div>
      <button
        onClick={onToggleActive}
        disabled={busy}
        style={ghostBtn}
        title={ad.active ? t('platform.ads.deactivate_title') : t('platform.ads.activate_title')}
      >
        {ad.active ? t('platform.ads.deactivate') : t('platform.ads.activate')}
      </button>
      <button onClick={onEdit} disabled={busy} style={ghostBtn}>
        {t('platform.ads.edit')}
      </button>
      <button onClick={onDelete} disabled={busy} style={{ ...ghostBtn, color: 'var(--risk)' }}>
        {t('platform.ads.delete')}
      </button>
    </div>
  );
}

function AdEditor({ draft, setDraft, onCancel, onSave, busy, err, isNew }) {
  const t = useT();
  const setField = (key, value) => setDraft({ ...draft, [key]: value });
  const setBullet = (idx, key, value) => {
    const next = (draft.bullets || []).map((b, i) => (i === idx ? (key === 0 ? [value, b[1]] : [b[0], value]) : b));
    setDraft({ ...draft, bullets: next });
  };
  const addBullet = () => setDraft({ ...draft, bullets: [...(draft.bullets || []), ['sparkle', '']] });
  const removeBullet = (idx) => setDraft({ ...draft, bullets: (draft.bullets || []).filter((_, i) => i !== idx) });

  return (
    <div
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--surface-2)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.1,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {isNew ? t('platform.ads.editor.new') : t('platform.ads.editor.editing', { id: draft.id })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('platform.ads.editor.field.slug')} hint={t('platform.ads.editor.field.slug_hint')}>
          <input
            value={draft.id}
            onChange={(e) => setField('id', e.target.value)}
            disabled={!isNew}
            style={inputStyle}
            placeholder="e.g. sdc-pro"
          />
        </Field>
        <Field label={t('platform.ads.editor.field.name')}>
          <input
            value={draft.name}
            onChange={(e) => setField('name', e.target.value)}
            style={inputStyle}
            placeholder="Smart Display Classic"
          />
        </Field>
      </div>

      <Field label={t('platform.ads.editor.field.spec')} hint={t('platform.ads.editor.field.spec_hint')}>
        <input
          value={draft.spec || ''}
          onChange={(e) => setField('spec', e.target.value)}
          style={inputStyle}
          placeholder='ADX-SDC-V1 · 7" e-ink · LTE · 3-year battery'
        />
      </Field>

      <Field label={t('platform.ads.editor.field.pitch')} hint={t('platform.ads.editor.field.pitch_hint')}>
        <textarea
          value={draft.pitch || ''}
          onChange={(e) => setField('pitch', e.target.value)}
          style={{ ...inputStyle, minHeight: 70, lineHeight: 1.5, resize: 'vertical' }}
          placeholder="The workhorse of the Adaptiv fleet…"
        />
      </Field>

      <Field label={t('platform.ads.editor.field.bullets')} hint={t('platform.ads.editor.field.bullets_hint')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(draft.bullets || []).map(([icon, text], i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <select
                value={icon}
                onChange={(e) => setBullet(i, 0, e.target.value)}
                style={{ ...inputStyle, width: 110 }}
              >
                {BULLET_ICON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                value={text}
                onChange={(e) => setBullet(i, 1, e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder={t('platform.ads.editor.bullet_ph')}
              />
              <button
                onClick={() => removeBullet(i)}
                style={{ ...ghostBtn, color: 'var(--risk)', padding: '6px 10px' }}
              >
                −
              </button>
            </div>
          ))}
          <button onClick={addBullet} style={{ ...ghostBtn, alignSelf: 'flex-start' }}>
            {t('platform.ads.editor.add_bullet')}
          </button>
        </div>
      </Field>

      <Field
        label={t('platform.ads.editor.field.image')}
        hint={t('platform.ads.editor.field.image_hint', { mb: MAX_AD_IMAGE_BYTES / 1024 / 1024 })}
      >
        <ImageUploader value={draft.imageUrl || null} adId={draft.id} onChange={(url) => setField('imageUrl', url)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field
          label={t('platform.ads.editor.field.illustration')}
          hint={draft.imageUrl ? t('platform.ads.editor.field.illustration_hint') : null}
        >
          <select
            value={draft.illustrationKey || 'generic'}
            onChange={(e) => setField('illustrationKey', e.target.value)}
            style={inputStyle}
          >
            {ILLUSTRATION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('platform.ads.editor.field.position')} hint={t('platform.ads.editor.field.position_hint')}>
          <input
            type="number"
            value={draft.position ?? 100}
            onChange={(e) => setField('position', parseInt(e.target.value, 10) || 0)}
            style={inputStyle}
          />
        </Field>
        <Field label={t('platform.ads.editor.field.active')}>
          <select
            value={draft.active !== false ? 'yes' : 'no'}
            onChange={(e) => setField('active', e.target.value === 'yes')}
            style={inputStyle}
          >
            <option value="yes">{t('platform.ads.editor.field.active_yes')}</option>
            <option value="no">{t('platform.ads.editor.field.active_no')}</option>
          </select>
        </Field>
      </div>

      <Field label={t('platform.ads.editor.field.chat')} hint={t('platform.ads.editor.field.chat_hint')}>
        <input
          value={draft.chatPrompt || ''}
          onChange={(e) => setField('chatPrompt', e.target.value)}
          style={inputStyle}
          placeholder="Tell me more about the Smart Display Classic"
        />
      </Field>

      {err && (
        <div
          style={{
            padding: '8px 10px',
            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
            color: 'var(--risk)',
            border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} disabled={busy} style={ghostBtn}>
          {t('platform.ads.editor.cancel')}
        </button>
        <button onClick={onSave} disabled={busy} style={primaryBtn}>
          {busy ? t('platform.ads.editor.saving') : t('platform.ads.editor.save')}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{hint}</span>}
    </label>
  );
}

function ImageUploader({ value, adId, onChange }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const url = await uploadProductAdImage(adId, file);
      if (value) deleteProductAdImage(value).catch(() => {});
      onChange(url);
    } catch (ex) {
      setErr(ex.message || t('platform.ads.editor.image.upload_failed'));
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  const clear = async () => {
    if (!value) return;
    if (!(await confirmDialog({ body: t('platform.ads.editor.image.remove_confirm'), danger: true }))) return;
    const old = value;
    onChange(null);
    deleteProductAdImage(old).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 88,
              height: 66,
              flexShrink: 0,
              background: 'var(--surface-3)',
              borderRadius: 6,
              backgroundImage: `url("${value}")`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              border: '1px solid var(--border)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 }}>
              {t('platform.ads.editor.image.attached')}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                fontFamily: 'var(--mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {value.split('/').pop()}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <button onClick={() => inputRef.current?.click()} disabled={busy} style={ghostBtn}>
                {busy ? t('platform.ads.editor.image.uploading') : t('platform.ads.editor.image.replace')}
              </button>
              <button onClick={clear} disabled={busy} style={{ ...ghostBtn, color: 'var(--risk)' }}>
                {t('platform.ads.editor.image.remove')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            padding: 18,
            background: dragOver ? 'var(--accent-soft)' : 'var(--surface)',
            border: `1px dashed ${dragOver ? 'var(--accent-line)' : 'var(--border)'}`,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon.sparkle size={16} style={{ color: dragOver ? 'var(--accent)' : 'var(--text-dim)' }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' }}>
            {busy
              ? t('platform.ads.editor.image.uploading')
              : dragOver
                ? t('platform.ads.editor.image.drop')
                : t('platform.ads.editor.image.click')}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
            {t('platform.ads.editor.image.formats', { mb: MAX_AD_IMAGE_BYTES / 1024 / 1024 })}
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        onChange={onPick}
        style={{ display: 'none' }}
      />
      {err && (
        <div
          style={{
            padding: '6px 10px',
            fontSize: 11.5,
            color: 'var(--risk)',
            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
            borderRadius: 6,
          }}
        >
          {err}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  padding: '7px 10px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: 6,
  fontSize: 12.5,
  fontFamily: 'inherit',
};
const primaryBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const ghostBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 12px',
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
