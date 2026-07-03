// /platform/pricing — Adaptiv-side editor for the public /pricing page.
//
// Sub-PR A.1 of the 3-plan rollout. Mirrors the
// platform_settings.pricing_content row (see pricing-content.js for
// the schema). Every text field has English + French side-by-side so
// localized copy stays in sync as it evolves.
//
// Adding a new plan or audience requires more than a copy edit — the
// page structure (Starter/Pro/Enterprise) is fixed in the seed
// migration. This editor lets you change all copy, prices, features,
// and CTAs but not add a 4th plan card. Add structural changes via
// migration when needed.

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './primitives.jsx';
import { usePricingContent, savePricingContent } from './pricing-content.js';

const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];
const AUDIENCES = [
  { id: 'real_estate', label: 'Property Managers' },
  { id: 'contractor', label: 'Contractors' },
];

// Deep-clone the JSON tree so per-field setters mutate the local copy
// instead of the cached state from usePricingContent().
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function PlatformPricingPage() {
  const { content, ready } = usePricingContent();
  const [local, setLocal] = useState(content);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  // Re-mirror when the upstream cache changes (e.g. realtime push or
  // initial hydration). Drop unsaved edits — same compromise the
  // feature-flags editor makes; concurrent multi-admin editing is a
  // future problem.
  useEffect(() => {
    setLocal(content);
  }, [content]);

  const dirty = useMemo(() => JSON.stringify(local) !== JSON.stringify(content), [local, content]);

  async function onSave() {
    if (busy) return;
    setBusy(true);
    setErr('');
    setOk(false);
    try {
      await savePricingContent(local);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function onReset() {
    setLocal(content);
    setErr('');
    setOk(false);
  }

  function setHero(lang, field, value) {
    const next = clone(local);
    if (!next.hero[lang]) next.hero[lang] = {};
    next.hero[lang][field] = value;
    setLocal(next);
  }
  function setToggle(lang, audience, value) {
    const next = clone(local);
    if (!next.toggle[lang]) next.toggle[lang] = {};
    next.toggle[lang][audience] = value;
    setLocal(next);
  }
  function setPlan(audience, planIndex, mutator) {
    const next = clone(local);
    next.plans[audience][planIndex] = mutator(next.plans[audience][planIndex]);
    setLocal(next);
  }

  return (
    <div style={{ padding: 24, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
          backdropFilter: 'blur(8px)',
          margin: '-24px -24px 0',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Pricing page content</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Edit the public <code>/pricing</code> page. Changes go live on Save — no deploy needed.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {dirty && !busy && !ok && <span style={{ color: 'var(--warn, #c80)', fontSize: 13 }}>Unsaved changes</span>}
          {ok && <span style={{ color: 'var(--ok, #0a0)', fontSize: 13 }}>Saved</span>}
          {err && <span style={{ color: 'var(--risk, #c33)', fontSize: 13 }}>{err}</span>}
          <button onClick={onReset} disabled={!dirty || busy} style={btnSubtle}>
            Reset
          </button>
          <button onClick={onSave} disabled={!dirty || busy || !ready} style={btnPrimary}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {!ready && (
        <Card>
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</div>
        </Card>
      )}

      {ready && (
        <>
          <Card>
            <div style={cardInner}>
              <h2 style={sectionH}>Hero</h2>
              <FieldRow
                label="Title"
                field="title"
                getter={(l) => local.hero?.[l]?.title || ''}
                setter={(l, v) => setHero(l, 'title', v)}
              />
              <FieldRow
                label="Subtitle"
                field="subtitle"
                multiline
                getter={(l) => local.hero?.[l]?.subtitle || ''}
                setter={(l, v) => setHero(l, 'subtitle', v)}
              />
              <FieldRow
                label="Footer text (before link)"
                field="footerText"
                getter={(l) => local.hero?.[l]?.footerText || ''}
                setter={(l, v) => setHero(l, 'footerText', v)}
              />
              <FieldRow
                label="Footer link label"
                field="footerLinkLabel"
                getter={(l) => local.hero?.[l]?.footerLinkLabel || ''}
                setter={(l, v) => setHero(l, 'footerLinkLabel', v)}
              />
              <FieldRow
                label="Footer link URL"
                field="footerLinkUrl"
                getter={(l) => local.hero?.[l]?.footerLinkUrl || ''}
                setter={(l, v) => setHero(l, 'footerLinkUrl', v)}
              />
            </div>
          </Card>

          <Card>
            <div style={cardInner}>
              <h2 style={sectionH}>Audience toggle labels</h2>
              <FieldRow
                label="Property Managers tab"
                field="toggle.real_estate"
                getter={(l) => local.toggle?.[l]?.real_estate || ''}
                setter={(l, v) => setToggle(l, 'real_estate', v)}
              />
              <FieldRow
                label="Contractors tab"
                field="toggle.contractor"
                getter={(l) => local.toggle?.[l]?.contractor || ''}
                setter={(l, v) => setToggle(l, 'contractor', v)}
              />
            </div>
          </Card>

          {AUDIENCES.map((aud) => (
            <Card key={aud.id}>
              <div style={cardInner}>
                <h2 style={sectionH}>{aud.label} plans</h2>
                {(local.plans?.[aud.id] || []).map((plan, planIndex) => (
                  <PlanEditor
                    key={plan.id || planIndex}
                    plan={plan}
                    onChange={(mutator) => setPlan(aud.id, planIndex, mutator)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function PlanEditor({ plan, onChange }) {
  // Lockstep features arrays — same length across EN + FR by
  // construction. The visual editor shows one row per feature with
  // EN on the left and FR on the right, plus a remove button. Add
  // creates an empty pair at the end.
  const enFeatures = plan.en?.features || [];
  const frFeatures = plan.fr?.features || [];
  const maxLen = Math.max(enFeatures.length, frFeatures.length);

  function setText(lang, field, value) {
    onChange((p) => {
      const next = clone(p);
      if (!next[lang]) next[lang] = {};
      next[lang][field] = value;
      return next;
    });
  }
  function setFeature(lang, idx, value) {
    onChange((p) => {
      const next = clone(p);
      if (!next[lang]) next[lang] = {};
      if (!Array.isArray(next[lang].features)) next[lang].features = [];
      while (next[lang].features.length <= idx) next[lang].features.push('');
      next[lang].features[idx] = value;
      return next;
    });
  }
  function removeFeature(idx) {
    onChange((p) => {
      const next = clone(p);
      if (Array.isArray(next.en?.features)) next.en.features = next.en.features.filter((_, i) => i !== idx);
      if (Array.isArray(next.fr?.features)) next.fr.features = next.fr.features.filter((_, i) => i !== idx);
      return next;
    });
  }
  function addFeature() {
    onChange((p) => {
      const next = clone(p);
      if (!Array.isArray(next.en?.features)) next.en = { ...(next.en || {}), features: [] };
      if (!Array.isArray(next.fr?.features)) next.fr = { ...(next.fr || {}), features: [] };
      next.en.features.push('');
      next.fr.features.push('');
      return next;
    });
  }
  function setFeatured(value) {
    onChange((p) => ({ ...p, featured: value }));
  }
  function setCtaTarget(value) {
    onChange((p) => ({ ...p, ctaTarget: value }));
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        background: plan.featured ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'var(--surface)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}
      >
        <div>
          <strong style={{ fontSize: 15 }}>{plan.id}</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>plan</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!plan.featured} onChange={(e) => setFeatured(e.target.checked)} />
          Mark as "Most popular"
        </label>
      </div>

      <FieldRow
        label="Plan name"
        field={`${plan.id}.name`}
        getter={(l) => plan[l]?.name || ''}
        setter={(l, v) => setText(l, 'name', v)}
      />
      <FieldRow
        label="Tagline"
        field={`${plan.id}.tagline`}
        multiline
        getter={(l) => plan[l]?.tagline || ''}
        setter={(l, v) => setText(l, 'tagline', v)}
      />
      <FieldRow
        label="Price (displayed)"
        field={`${plan.id}.price`}
        getter={(l) => plan[l]?.price || ''}
        setter={(l, v) => setText(l, 'price', v)}
      />
      <FieldRow
        label="Price unit"
        field={`${plan.id}.priceUnit`}
        getter={(l) => plan[l]?.priceUnit || ''}
        setter={(l, v) => setText(l, 'priceUnit', v)}
      />
      <FieldRow
        label="CTA button label"
        field={`${plan.id}.ctaLabel`}
        getter={(l) => plan[l]?.ctaLabel || ''}
        setter={(l, v) => setText(l, 'ctaLabel', v)}
      />

      <div style={{ marginTop: 10, marginBottom: 6 }}>
        <label style={fieldLabel}>CTA target (URL or mailto:)</label>
        <input
          type="text"
          value={plan.ctaTarget || ''}
          onChange={(e) => setCtaTarget(e.target.value)}
          style={textInput}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Same URL for both languages (signup is locale-aware on its own).
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={fieldLabel}>Features</label>
        {Array.from({ length: maxLen }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, marginBottom: 6 }}>
            <input
              type="text"
              value={enFeatures[i] || ''}
              onChange={(e) => setFeature('en', i, e.target.value)}
              placeholder="EN"
              style={textInput}
            />
            <input
              type="text"
              value={frFeatures[i] || ''}
              onChange={(e) => setFeature('fr', i, e.target.value)}
              placeholder="FR"
              style={textInput}
            />
            <button onClick={() => removeFeature(i)} title="Remove feature" style={iconBtn}>
              ×
            </button>
          </div>
        ))}
        <button onClick={addFeature} style={btnSubtle}>
          + Add feature
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, field, getter, setter, multiline = false }) {
  const Input = multiline ? 'textarea' : 'input';
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={fieldLabel}>{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {LANGS.map((l) => (
          <Input
            key={l.id}
            value={getter(l.id)}
            onChange={(e) => setter(l.id, e.target.value)}
            placeholder={l.label}
            rows={multiline ? 2 : undefined}
            style={multiline ? textArea : textInput}
            data-field={`${field}.${l.id}`}
          />
        ))}
      </div>
    </div>
  );
}

// ────── styles
const cardInner = { padding: 20, display: 'flex', flexDirection: 'column', gap: 8 };
const sectionH = { margin: '0 0 14px', fontSize: 16, fontWeight: 700 };
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
const textArea = { ...textInput, fontFamily: 'inherit', resize: 'vertical', minHeight: 36 };
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
const iconBtn = {
  width: 32,
  height: 32,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};
