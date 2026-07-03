// /platform/promo-codes — Adaptiv-side editor for Stripe promotion codes.
//
// Sub-PR A.2 of the 3-plan rollout. Stripe owns the data; this page is
// a thin admin shell that creates / lists / disables codes via
// /api/promo-codes/{list,create,disable}. No DB migration needed.
//
// Workflow: JB creates a code here → shares
//   https://merlin.adaptiv.systems/pricing?promo=ABC
// with a prospect → /pricing validates via /api/promo-codes/check and
// shows a pill → at Stripe Checkout (Phase C) the code is passed to
// `discounts: [{ promotion_code: id }]` for the real discount.

import React, { useMemo, useState } from 'react';
import { Card, Pill } from './primitives.jsx';
import { usePromoCodes, createPromoCode, disablePromoCode } from './promo-codes.js';
import { confirmDialog, alertDialog } from './dialogs.jsx';

const PRICING_ORIGIN = 'https://merlin.adaptiv.systems';

export function PlatformPromoCodesPage() {
  const { codes, loading, error, refresh } = usePromoCodes();
  const [showCreate, setShowCreate] = useState(false);

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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Promo codes</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Stripe promotion codes for the public <code>/pricing</code> page. Share as{' '}
            <code>{PRICING_ORIGIN}/pricing?promo=CODE</code>.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={refresh} disabled={loading} style={btnSubtle}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>
            + New code
          </button>
        </div>
      </header>

      {error && (
        <Card>
          <div style={{ padding: 16, color: 'var(--risk, #c33)', fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <Card>
        {codes.length === 0 && !loading ? (
          <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            No promo codes yet. Click "New code" to create one.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={th}>Code</th>
                <th style={th}>Discount</th>
                <th style={th}>Duration</th>
                <th style={th}>Redeemed</th>
                <th style={th}>Expires</th>
                <th style={th}>Status</th>
                <th style={th}>Share URL</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((pc) => (
                <CodeRow key={pc.id} pc={pc} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CodeRow({ pc, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const discount = useMemo(() => {
    const c = pc.coupon;
    if (!c) return '—';
    if (c.percent_off != null) return `${c.percent_off}% off`;
    if (c.amount_off != null) return `${(c.amount_off / 100).toFixed(2)} ${(c.currency || 'USD').toUpperCase()} off`;
    return '—';
  }, [pc]);

  const duration = useMemo(() => {
    const c = pc.coupon;
    if (!c) return '—';
    if (c.duration === 'forever') return 'Forever';
    if (c.duration === 'once') return 'Once';
    if (c.duration === 'repeating')
      return `${c.duration_in_months ?? '?'} month${c.duration_in_months === 1 ? '' : 's'}`;
    return c.duration || '—';
  }, [pc]);

  const redeemed = `${pc.times_redeemed ?? 0}${pc.max_redemptions ? ` / ${pc.max_redemptions}` : ''}`;

  const expires = pc.expires_at ? new Date(pc.expires_at * 1000).toISOString().slice(0, 10) : '—';

  const shareUrl = `${PRICING_ORIGIN}/pricing?promo=${encodeURIComponent(pc.code)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (insecure context) — silent fallback.
    }
  }

  async function disable() {
    if (busy) return;
    if (
      !(await confirmDialog({
        body: `Disable promo code "${pc.code}"? This cannot be undone — create a new code if you want it back.`,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await disablePromoCode(pc.id);
      onChanged();
    } catch (e) {
      alertDialog(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={td}>
        <code style={{ fontWeight: 700 }}>{pc.code}</code>
      </td>
      <td style={td}>{discount}</td>
      <td style={td}>{duration}</td>
      <td style={td}>{redeemed}</td>
      <td style={td}>{expires}</td>
      <td style={td}>
        <Pill tone={pc.active ? 'ok' : 'neutral'}>{pc.active ? 'Active' : 'Disabled'}</Pill>
      </td>
      <td style={td}>
        <button onClick={copy} style={btnSubtle}>
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </td>
      <td style={td}>
        {pc.active && (
          <button onClick={disable} disabled={busy} style={btnDanger}>
            {busy ? '…' : 'Disable'}
          </button>
        )}
      </td>
    </tr>
  );
}

function CreateDialog({ onClose, onCreated }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [percentOff, setPercentOff] = useState('25');
  const [amountOffCents, setAmountOffCents] = useState('1000');
  const [currency, setCurrency] = useState('usd');
  const [duration, setDuration] = useState('once');
  const [durationInMonths, setDurationInMonths] = useState('3');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState(''); // YYYY-MM-DD
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const params = {
        code: code.trim().toUpperCase(),
        duration,
      };
      if (discountType === 'percent') params.percent_off = Number(percentOff);
      else {
        params.amount_off_cents = Number(amountOffCents);
        params.currency = currency;
      }
      if (duration === 'repeating') params.duration_in_months = Number(durationInMonths);
      if (maxRedemptions) params.max_redemptions = Number(maxRedemptions);
      if (expiresAt) {
        // YYYY-MM-DD → unix seconds at midnight UTC of that date
        params.expires_at = Math.floor(new Date(`${expiresAt}T00:00:00Z`).getTime() / 1000);
      }
      if (name.trim()) params.name = name.trim();
      await createPromoCode(params);
      onCreated();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>New promo code</h2>

        <Field label="Code (customer-facing)">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH25"
            style={textInput}
          />
          <Hint>3-40 chars. A-Z 0-9 _ -. This is what goes in the URL.</Hint>
        </Field>

        <Field label="Internal label (optional)">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring 2026 launch"
            style={textInput}
          />
          <Hint>Visible in Stripe dashboard only. Not shown to customers.</Hint>
        </Field>

        <Field label="Discount type">
          <div style={{ display: 'flex', gap: 8 }}>
            <RadioBtn checked={discountType === 'percent'} onClick={() => setDiscountType('percent')}>
              Percent off
            </RadioBtn>
            <RadioBtn checked={discountType === 'amount'} onClick={() => setDiscountType('amount')}>
              Amount off
            </RadioBtn>
          </div>
        </Field>

        {discountType === 'percent' ? (
          <Field label="Percent off">
            <input
              type="number"
              min="1"
              max="100"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              style={textInput}
            />
            <Hint>1-100.</Hint>
          </Field>
        ) : (
          <>
            <Field label="Amount off (cents)">
              <input
                type="number"
                min="1"
                value={amountOffCents}
                onChange={(e) => setAmountOffCents(e.target.value)}
                style={textInput}
              />
              <Hint>1000 = $10.00.</Hint>
            </Field>
            <Field label="Currency">
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toLowerCase())}
                style={textInput}
                maxLength={3}
              />
              <Hint>3-letter ISO code (usd, eur, …).</Hint>
            </Field>
          </>
        )}

        <Field label="Duration (for subscriptions)">
          <select value={duration} onChange={(e) => setDuration(e.target.value)} style={textInput}>
            <option value="once">Once — applies to first invoice only</option>
            <option value="repeating">Repeating — applies for N months</option>
            <option value="forever">Forever — applies to all invoices</option>
          </select>
        </Field>

        {duration === 'repeating' && (
          <Field label="Duration (months)">
            <input
              type="number"
              min="1"
              value={durationInMonths}
              onChange={(e) => setDurationInMonths(e.target.value)}
              style={textInput}
            />
          </Field>
        )}

        <Field label="Max redemptions (optional)">
          <input
            type="number"
            min="1"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unlimited"
            style={textInput}
          />
          <Hint>Total times this code can be redeemed across all customers.</Hint>
        </Field>

        <Field label="Expires on (optional)">
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={textInput} />
          <Hint>Code stops accepting new redemptions at midnight UTC of this date.</Hint>
        </Field>

        {error && <div style={{ color: 'var(--risk, #c33)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={busy} style={btnSubtle}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !code.trim()} style={btnPrimary}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
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

function RadioBtn({ checked, onClick, children }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: '6px 12px',
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        background: checked ? 'color-mix(in oklch, var(--accent) 10%, transparent)' : 'var(--surface)',
        color: 'var(--text)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

// ────── styles
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
