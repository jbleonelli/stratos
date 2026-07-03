// Public sales-inquiry form at /pricing/contact. Replaces the
// Enterprise-tier mailto: CTAs on the pricing page with a structured
// intake form so leads end up in `sales_inquiries` (migration 125)
// rather than scattered across inbox folders.
//
// Auth: none. Anyone can submit. The /api/sales/inquiry endpoint
// validates server-side and inserts via service_role.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { navigateTo } from './use-route.js';
import { useLanguage, useT } from './i18n.js';

const VERTICAL_OPTIONS = [
  { value: 'real_estate', labelKey: 'pricing.contact.vertical.real_estate' },
  { value: 'contractor', labelKey: 'pricing.contact.vertical.contractor' },
  { value: 'mixed', labelKey: 'pricing.contact.vertical.mixed' },
  { value: 'other', labelKey: 'pricing.contact.vertical.other' },
];

export function PricingContactPage() {
  const t = useT();
  const lang = useLanguage();
  const [form, setForm] = useState({
    company: '',
    contact_name: '',
    email: '',
    phone: '',
    role: '',
    buildings_est: '',
    vertical: '',
    message: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.email.trim() || !form.company.trim() || !form.message.trim()) {
      setErr(t('pricing.contact.err.missing_required'));
      return;
    }
    setBusy(true);
    try {
      const buildings_est = form.buildings_est.trim() ? parseInt(form.buildings_est, 10) : null;
      const resp = await fetch('/api/sales/inquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          company: form.company.trim(),
          contact_name: form.contact_name.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role.trim() || null,
          buildings_est: Number.isInteger(buildings_est) ? buildings_est : null,
          vertical: form.vertical || null,
          message: form.message.trim(),
          source: 'pricing-enterprise',
          locale: lang,
        }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErr(payload.error || t('pricing.contact.err.submit_failed'));
        return;
      }
      setDone(true);
    } catch {
      setErr(t('pricing.contact.err.submit_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--surface-1)',
        padding: '48px 24px 96px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 640 }}>
        <button
          type="button"
          onClick={() => navigateTo('/pricing')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 24,
          }}
        >
          ← {t('pricing.contact.back_to_pricing')}
        </button>

        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('pricing.contact.title')}
        </h1>
        <p style={{ margin: '0 0 32px', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.5 }}>
          {t('pricing.contact.subtitle')}
        </p>

        {done ? (
          <ThankYouCard t={t} />
        ) : (
          <form
            onSubmit={submit}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <Field label={t('pricing.contact.field.company')} required>
              <Input value={form.company} onChange={update('company')} autoFocus />
            </Field>
            <Row>
              <Field label={t('pricing.contact.field.contact_name')}>
                <Input value={form.contact_name} onChange={update('contact_name')} />
              </Field>
              <Field label={t('pricing.contact.field.email')} required>
                <Input type="email" value={form.email} onChange={update('email')} />
              </Field>
            </Row>
            <Row>
              <Field label={t('pricing.contact.field.phone')}>
                <Input value={form.phone} onChange={update('phone')} placeholder="+1 …" />
              </Field>
              <Field label={t('pricing.contact.field.role')}>
                <Input
                  value={form.role}
                  onChange={update('role')}
                  placeholder={t('pricing.contact.field.role_placeholder')}
                />
              </Field>
            </Row>
            <Row>
              <Field label={t('pricing.contact.field.buildings_est')}>
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  value={form.buildings_est}
                  onChange={update('buildings_est')}
                  placeholder="1, 5, 20+"
                />
              </Field>
              <Field label={t('pricing.contact.field.vertical')}>
                <select value={form.vertical} onChange={update('vertical')} style={selectStyle}>
                  <option value="">{t('pricing.contact.field.vertical_choose')}</option>
                  {VERTICAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>
            <Field label={t('pricing.contact.field.message')} required>
              <textarea
                value={form.message}
                onChange={update('message')}
                placeholder={t('pricing.contact.field.message_placeholder')}
                rows={6}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 120, fontFamily: 'inherit' }}
              />
            </Field>

            {err && (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--risk-soft)',
                  border: '1px solid var(--risk-line)',
                  borderRadius: 8,
                  color: 'var(--risk)',
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => navigateTo('/pricing')} style={btnGhost}>
                {t('pricing.contact.cancel')}
              </button>
              <button type="submit" disabled={busy} style={btnPrimary}>
                {busy ? t('pricing.contact.sending') : t('pricing.contact.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function ThankYouCard({ t }) {
  return (
    <div
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-line)',
        borderRadius: 12,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon.check size={22} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>{t('pricing.contact.thanks_title')}</h2>
      <p style={{ margin: '0 0 20px', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.55 }}>
        {t('pricing.contact.thanks_body')}
      </p>
      <button type="button" onClick={() => navigateTo('/pricing')} style={btnPrimary}>
        {t('pricing.contact.thanks_back')}
      </button>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
        {label}
        {required && <span style={{ color: 'var(--risk)', marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </label>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{children}</div>;
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};
const selectStyle = { ...inputStyle, appearance: 'auto' };

function Input(props) {
  return <input {...props} style={inputStyle} />;
}

const btnGhost = {
  padding: '10px 16px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
};

const btnPrimary = {
  padding: '10px 20px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: '#fff',
  cursor: 'pointer',
  boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 10px color-mix(in oklch, var(--accent) 30%, transparent)',
};
