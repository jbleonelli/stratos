// /platform/stripe/products — list + create Stripe Products and their
// Prices directly from Merlin, no Dashboard hop.
//
// Lists every active Product with its active Prices. Click the create
// button to spin up a new Product + Price atomically; the response
// surfaces the new price_id so the operator can paste it into the
// matching STRIPE_PRICE_ID_* env var on Vercel.

import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { useT } from './i18n.js';
import { supabase } from './supabase.js';

function fmtAmount(cents, currency) {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${cents / 100} ${(currency || 'usd').toUpperCase()}`;
  }
}

async function callApi(path, opts = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('not signed in');
  const resp = await fetch(path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      ...(opts.headers || {}),
    },
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(payload.error || `HTTP ${resp.status}`);
  return payload;
}

export function PlatformStripeProductsPage() {
  const t = useT();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [creatorOpen, setCreatorOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr('');
    try {
      const data = await callApi('/api/stripe/products');
      setProducts(data.products || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t('platform.stripe_products.title')}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
            {t('platform.stripe_products.subtitle')}
          </p>
        </div>
        <button onClick={() => setCreatorOpen(true)} style={btnPrimary}>
          <Icon.plus size={12} /> {t('platform.stripe_products.create')}
        </button>
      </div>

      {err && (
        <Card>
          <div style={{ color: 'var(--risk)', fontSize: 13 }}>{err}</div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <AdaptivLoader size="sm" />
          </div>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: 20, textAlign: 'center' }}>
            {t('platform.stripe_products.empty')}
          </div>
        </Card>
      ) : (
        products.map((p) => <ProductCard key={p.id} product={p} onChanged={refresh} />)
      )}

      {creatorOpen && (
        <CreatorModal
          onClose={() => setCreatorOpen(false)}
          onCreated={() => {
            setCreatorOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductCard({ product, onChanged }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [addingPrice, setAddingPrice] = useState(false);
  const [busyPriceId, setBusyPriceId] = useState(null);
  const [err, setErr] = useState('');

  async function togglePriceActive(price) {
    setErr('');
    setBusyPriceId(price.id);
    try {
      await callApi('/api/stripe/products', {
        method: 'PATCH',
        body: JSON.stringify({ price_id: price.id, active: !price.active }),
      });
      onChanged?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyPriceId(null);
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Icon.cart size={14} style={{ color: 'var(--accent-pink)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{product.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{product.id}</div>
        </div>
        {!product.active && <Pill tone="risk">{t('platform.stripe_products.inactive')}</Pill>}
        <button onClick={() => setEditing(true)} style={btnGhost}>
          {t('platform.stripe_products.edit')}
        </button>
      </div>
      {product.description && (
        <div style={{ fontSize: 12.5, color: 'var(--text-soft)', marginBottom: 10 }}>{product.description}</div>
      )}
      {product.prices?.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {product.prices.map((price) => (
            <div
              key={price.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: price.active === false ? 'transparent' : 'var(--surface-2)',
                borderRadius: 6,
                border: `1px solid ${price.active === false ? 'color-mix(in oklch, var(--risk) 25%, transparent)' : 'var(--border)'}`,
                fontSize: 12,
                opacity: price.active === false ? 0.6 : 1,
              }}
            >
              <span style={{ fontWeight: 700 }}>{fmtAmount(price.unit_amount, price.currency)}</span>
              {price.recurring && <Pill>{t(`platform.stripe_products.interval.${price.recurring.interval}`)}</Pill>}
              {!price.recurring && <Pill>{t('platform.stripe_products.interval.one_time')}</Pill>}
              {price.active === false && <Pill tone="risk">{t('platform.stripe_products.inactive')}</Pill>}
              <span style={{ flex: 1 }} />
              <code style={{ fontSize: 11, color: 'var(--text-dim)', userSelect: 'all' }}>{price.id}</code>
              <button
                onClick={() => togglePriceActive(price)}
                disabled={busyPriceId === price.id}
                style={{ ...btnGhost, padding: '3px 8px', fontSize: 11 }}
              >
                {busyPriceId === price.id
                  ? '…'
                  : price.active === false
                    ? t('platform.stripe_products.reactivate')
                    : t('platform.stripe_products.deactivate')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{t('platform.stripe_products.no_prices')}</div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <button onClick={() => setAddingPrice(true)} style={btnGhost}>
          <Icon.plus size={11} /> {t('platform.stripe_products.add_price')}
        </button>
        {err && <span style={{ fontSize: 11, color: 'var(--risk)', alignSelf: 'center' }}>{err}</span>}
      </div>

      {editing && (
        <EditProductModal
          product={product}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged?.();
          }}
        />
      )}
      {addingPrice && (
        <AddPriceModal
          product={product}
          onClose={() => setAddingPrice(false)}
          onCreated={() => {
            setAddingPrice(false);
            onChanged?.();
          }}
        />
      )}
    </Card>
  );
}

function CreatorModal({ onClose, onCreated }) {
  const t = useT();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [interval, setInterval] = useState('month');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr(t('platform.stripe_products.err.name'));
      return;
    }
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setErr(t('platform.stripe_products.err.amount'));
      return;
    }
    setBusy(true);
    try {
      const data = await callApi('/api/stripe/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          amount_cents: cents,
          currency: currency.toLowerCase().trim(),
          interval,
        }),
      });
      setResult(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon.plus size={14} style={{ color: 'var(--accent-pink)' }} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>
            {result ? t('platform.stripe_products.created_title') : t('platform.stripe_products.create_title')}
          </div>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', padding: 4, color: 'var(--text-dim)' }}>
            <Icon.close size={14} />
          </button>
        </div>

        {result ? (
          <ResultPanel result={result} t={t} onDone={onCreated} />
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label={t('platform.stripe_products.field.name')} required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Merlin Pro — Property Manager"
                style={inputStyle}
                autoFocus
              />
            </Field>
            <Field label={t('platform.stripe_products.field.description')}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 10 }}>
              <Field label={t('platform.stripe_products.field.amount')} required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="149.00"
                  style={inputStyle}
                />
              </Field>
              <Field label={t('platform.stripe_products.field.currency')}>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  maxLength={3}
                  style={{ ...inputStyle, textTransform: 'uppercase' }}
                />
              </Field>
              <Field label={t('platform.stripe_products.field.interval')} required>
                <select value={interval} onChange={(e) => setInterval(e.target.value)} style={inputStyle}>
                  <option value="month">{t('platform.stripe_products.interval.month')}</option>
                  <option value="year">{t('platform.stripe_products.interval.year')}</option>
                  <option value="one_time">{t('platform.stripe_products.interval.one_time')}</option>
                </select>
              </Field>
            </div>
            {err && <div style={{ color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={btnGhost}>
                {t('platform.stripe_products.cancel')}
              </button>
              <button type="submit" disabled={busy} style={busy ? btnDisabled : btnPrimary}>
                {busy ? t('platform.stripe_products.creating') : t('platform.stripe_products.create')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ResultPanel({ result, t, onDone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          padding: 12,
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent-line)',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-pink)', marginBottom: 8 }}>
          {t('platform.stripe_products.created_blurb')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
          {t('platform.stripe_products.product_id')}:
        </div>
        <code
          style={{
            display: 'block',
            padding: '6px 8px',
            background: 'var(--surface-1)',
            borderRadius: 4,
            fontSize: 12,
            userSelect: 'all',
          }}
        >
          {result.product.id}
        </code>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10, marginBottom: 4 }}>
          {t('platform.stripe_products.price_id')}:
        </div>
        <code
          style={{
            display: 'block',
            padding: '6px 8px',
            background: 'var(--surface-1)',
            borderRadius: 4,
            fontSize: 12,
            userSelect: 'all',
          }}
        >
          {result.price.id}
        </code>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
        {t('platform.stripe_products.env_hint')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onDone} style={btnPrimary}>
          {t('platform.stripe_products.done')}
        </button>
      </div>
    </div>
  );
}

// Edit existing Product — name / description / active toggle. Stripe
// allows these without restrictions. unit_amount + currency live on
// Prices, not Products, so they're not part of this modal (use
// AddPriceModal for "change the price").
function EditProductModal({ product, onClose, onSaved }) {
  const t = useT();
  const [name, setName] = useState(product.name || '');
  const [description, setDescription] = useState(product.description || '');
  const [active, setActive] = useState(product.active !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr(t('platform.stripe_products.err.name'));
      return;
    }
    setBusy(true);
    try {
      await callApi('/api/stripe/products', {
        method: 'PATCH',
        body: JSON.stringify({
          product_id: product.id,
          name: name.trim(),
          description: description.trim(),
          active,
        }),
      });
      onSaved?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon.cart size={14} style={{ color: 'var(--accent-pink)' }} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>{t('platform.stripe_products.edit_title')}</div>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', padding: 4, color: 'var(--text-dim)' }}>
            <Icon.close size={14} />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label={t('platform.stripe_products.field.name')} required>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
          </Field>
          <Field label={t('platform.stripe_products.field.description')}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Field>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('platform.stripe_products.field.active')}
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            {t('platform.stripe_products.edit_price_hint')}
          </div>
          {err && <div style={{ color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={btnGhost}>
              {t('platform.stripe_products.cancel')}
            </button>
            <button type="submit" disabled={busy} style={busy ? btnDisabled : btnPrimary}>
              {busy ? t('platform.stripe_products.saving') : t('platform.stripe_products.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add a new Price to an existing Product. Stripe's standard pattern
// for "change the price" — create new + deactivate old. The new
// price_id needs to land in the Vercel env var for the customer-
// facing checkout to switch over to it.
function AddPriceModal({ product, onClose, onCreated }) {
  const t = useT();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [interval, setInterval] = useState('month');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setErr(t('platform.stripe_products.err.amount'));
      return;
    }
    setBusy(true);
    try {
      const data = await callApi('/api/stripe/products', {
        method: 'POST',
        body: JSON.stringify({
          product_id: product.id,
          amount_cents: cents,
          currency: currency.toLowerCase().trim(),
          interval,
        }),
      });
      setResult(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon.plus size={14} style={{ color: 'var(--accent-pink)' }} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>
            {result
              ? t('platform.stripe_products.add_price_done')
              : t('platform.stripe_products.add_price_title', { name: product.name })}
          </div>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', padding: 4, color: 'var(--text-dim)' }}>
            <Icon.close size={14} />
          </button>
        </div>
        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: 12,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                {t('platform.stripe_products.price_id')}:
              </div>
              <code
                style={{
                  display: 'block',
                  padding: '6px 8px',
                  background: 'var(--surface-1)',
                  borderRadius: 4,
                  fontSize: 12,
                  userSelect: 'all',
                }}
              >
                {result.price.id}
              </code>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
              {t('platform.stripe_products.env_hint')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onCreated} style={btnPrimary}>
                {t('platform.stripe_products.done')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 10 }}>
              <Field label={t('platform.stripe_products.field.amount')} required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="149.00"
                  style={inputStyle}
                  autoFocus
                />
              </Field>
              <Field label={t('platform.stripe_products.field.currency')}>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  maxLength={3}
                  style={{ ...inputStyle, textTransform: 'uppercase' }}
                />
              </Field>
              <Field label={t('platform.stripe_products.field.interval')} required>
                <select value={interval} onChange={(e) => setInterval(e.target.value)} style={inputStyle}>
                  <option value="month">{t('platform.stripe_products.interval.month')}</option>
                  <option value="year">{t('platform.stripe_products.interval.year')}</option>
                  <option value="one_time">{t('platform.stripe_products.interval.one_time')}</option>
                </select>
              </Field>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              {t('platform.stripe_products.add_price_hint')}
            </div>
            {err && <div style={{ color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose} style={btnGhost}>
                {t('platform.stripe_products.cancel')}
              </button>
              <button type="submit" disabled={busy} style={busy ? btnDisabled : btnPrimary}>
                {busy ? t('platform.stripe_products.creating') : t('platform.stripe_products.add_price')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.2,
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--risk)', marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
};
const btnGhost = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '7px 12px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
};
const btnPrimary = {
  ...btnGhost,
  background: 'var(--accent-pink)',
  borderColor: 'var(--accent-pink)',
  color: '#fff',
};
const btnDisabled = { ...btnGhost, opacity: 0.5, cursor: 'not-allowed' };
const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};
const modalCard = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  width: 'min(560px, 90vw)',
  maxHeight: '85vh',
  overflow: 'auto',
};
