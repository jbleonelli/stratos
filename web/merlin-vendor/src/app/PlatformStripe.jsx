// Platform → Stripe — cross-tenant payment-ops surface.
//
// Surfaces what's happening with Stripe Checkout (migration 097) +
// the failure-surface columns (migration 098): orgs with a Stripe
// customer record, paid orders + gross revenue, orders awaiting
// payment, orders carrying a last_payment_error, cancelled orders.
//
// Mirrors PlatformUsers / PlatformTenants conventions: Hero + filter
// strip + sortable table. Row click navigates to the order's tenant
// detail page (the closest existing surface — no per-order drilldown
// yet). Stripe session id + payment intent id are exposed as
// copyable strings so an Adaptiv admin can cross-link to the Stripe
// dashboard manually.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { navigateTo } from './use-route.js';
import { useStripeOverview, STRIPE_STATUS_TONES, createOrderRefund, refreshStripe } from './platform-data.js';
import { useT } from './i18n.js';

function fmtCents(cents, currency = 'USD') {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      cents / 100,
    );
  } catch {
    return `$${Math.round(cents / 100)}`;
  }
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().slice(0, 10);
}

export function PlatformStripePage() {
  const t = useT();
  const { stats, orders, ready } = useStripeOverview();

  const [filter, setFilter] = useState('all'); // all | paid | awaiting | failed | cancelled | refunded
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [refundOrder, setRefundOrder] = useState(null); // order to refund (modal open when set)

  const filtered = useMemo(() => {
    let rows = orders.slice();
    if (filter === 'paid') rows = rows.filter((o) => !!o.paidAt && o.status !== 'cancelled' && !o.refundedAt);
    if (filter === 'awaiting') rows = rows.filter((o) => !o.paidAt && o.status === 'placed');
    if (filter === 'failed') rows = rows.filter((o) => !!o.lastPaymentError);
    if (filter === 'cancelled') rows = rows.filter((o) => o.status === 'cancelled');
    if (filter === 'refunded') rows = rows.filter((o) => !!o.refundedAt);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (o) =>
          (o.orgName || '').toLowerCase().includes(q) ||
          (o.orgSlug || '').toLowerCase().includes(q) ||
          (o.id || '').toLowerCase().includes(q) ||
          (o.stripeSessionId || '').toLowerCase().includes(q) ||
          (o.stripePaymentIntentId || '').toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [orders, filter, search, sort]);

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero stats={stats} ready={ready} t={t} />

      <Card pad={false}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <SearchBox value={search} onChange={setSearch} t={t} />
          <FilterPills value={filter} onChange={setFilter} stats={stats} t={t} />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {ready
              ? t('platform.stripe.count', { n: filtered.length, total: orders.length })
              : t('platform.audit.loading')}
          </div>
        </div>
        <OrdersTable rows={filtered} sort={sort} onSort={setSort} ready={ready} t={t} onRefund={setRefundOrder} />
      </Card>
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onDone={() => {
            setRefundOrder(null);
            refreshStripe();
          }}
          t={t}
        />
      )}
    </div>
  );
}

// Refund composer — full-balance default, partial via amount input.
// Reason is free-text 280 chars; goes into Stripe metadata + the
// device_orders.refund_reason column for surfacing in the customer's
// Orders banner.
function RefundModal({ order, onClose, onDone, t }) {
  const refundable = (order.totalCents || 0) - (order.refundedAmountCents || 0);
  const [amountInput, setAmountInput] = useState(''); // empty = full refund
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const fullRefund = !amountInput.trim();
  const partialCents = fullRefund ? null : Math.round(Number(amountInput) * 100);
  const partialInvalid =
    !fullRefund && (!Number.isFinite(partialCents) || partialCents <= 0 || partialCents > refundable);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await createOrderRefund({
        orderId: order.id,
        amountCents: fullRefund ? null : partialCents,
        reason: reason.trim() || null,
      });
      onDone();
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div
      onClick={busy ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.shield size={14} style={{ color: 'var(--warn)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{t('platform.stripe.refund.title')}</div>
          <button
            onClick={busy ? undefined : onClose}
            disabled={busy}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
              color: 'var(--text-dim)',
            }}
          >
            <Icon.close size={14} />
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
            {t('platform.stripe.refund.hint')}
          </div>
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              fontSize: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Row label={t('platform.stripe.refund.row_order')} value={`#${order.id.slice(0, 8)} · ${order.orgName}`} />
            <Row label={t('platform.stripe.refund.row_total')} value={fmtCents(order.totalCents, order.currency)} />
            {(order.refundedAmountCents || 0) > 0 && (
              <Row
                label={t('platform.stripe.refund.row_already_refunded')}
                value={fmtCents(order.refundedAmountCents, order.currency)}
                tone="warn"
              />
            )}
            <Row
              label={t('platform.stripe.refund.row_refundable')}
              value={fmtCents(refundable, order.currency)}
              tone="accent"
            />
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>
              {t('platform.stripe.refund.amount_label')}
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={t('platform.stripe.refund.amount_full_placeholder', {
                amount: fmtCents(refundable, order.currency),
              })}
              disabled={busy}
              style={{
                padding: '7px 9px',
                fontSize: 12,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
              {fullRefund
                ? t('platform.stripe.refund.amount_full_note', { amount: fmtCents(refundable, order.currency) })
                : t('platform.stripe.refund.amount_partial_note')}
            </span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>
              {t('platform.stripe.refund.reason_label')}
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 280))}
              rows={3}
              placeholder={t('platform.stripe.refund.reason_placeholder')}
              disabled={busy}
              style={{
                padding: '7px 9px',
                fontSize: 12,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </label>
          {err && (
            <div
              style={{
                padding: 10,
                borderRadius: 6,
                fontSize: 11,
                background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
                color: 'var(--risk)',
                fontFamily: 'var(--mono)',
              }}
            >
              {err}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={busy ? undefined : onClose}
            disabled={busy}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {t('platform.stripe.refund.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy || partialInvalid}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              background: busy || partialInvalid ? 'var(--surface-3)' : 'var(--risk)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: busy || partialInvalid ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy || partialInvalid ? 0.6 : 1,
            }}
          >
            {busy
              ? t('platform.stripe.refund.refunding')
              : t('platform.stripe.refund.submit', {
                  amount: fmtCents(fullRefund ? refundable : partialCents, order.currency),
                })}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }) {
  const colors = {
    warn: 'var(--warn)',
    accent: 'var(--accent)',
    risk: 'var(--risk)',
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: colors[tone] || 'var(--text)' }}>{value}</span>
    </div>
  );
}

function Hero({ stats, ready, t }) {
  const dollarsPaid = stats ? fmtCents(stats.grossPaidCents) : '—';
  const dollars30d = stats ? fmtCents(stats.last30dPaidCents) : '—';
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
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('platform.stripe.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.stripe.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13, maxWidth: 760 }}>
            {t('platform.stripe.body')}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            marginTop: 4,
          }}
        >
          <StatTile
            label={t('platform.stripe.stat.gross')}
            value={dollarsPaid}
            sub={ready ? t('platform.stripe.stat.gross_sub', { n: stats?.paidCount ?? 0 }) : ''}
            tone="accent"
          />
          <StatTile
            label={t('platform.stripe.stat.last30d')}
            value={dollars30d}
            sub={ready ? t('platform.stripe.stat.last30d_sub', { n: stats?.last30dPaidCount ?? 0 }) : ''}
          />
          <StatTile
            label={t('platform.stripe.stat.awaiting')}
            value={ready ? String(stats?.awaitingCount ?? 0) : '—'}
            sub={t('platform.stripe.stat.awaiting_sub')}
            tone={(stats?.awaitingCount ?? 0) > 0 ? 'info' : 'neutral'}
          />
          <StatTile
            label={t('platform.stripe.stat.failed')}
            value={ready ? String(stats?.failedCount ?? 0) : '—'}
            sub={t('platform.stripe.stat.failed_sub')}
            tone={(stats?.failedCount ?? 0) > 0 ? 'warn' : 'neutral'}
          />
          {(stats?.refundedCount ?? 0) > 0 && (
            <StatTile
              label={t('platform.stripe.stat.refunded')}
              value={fmtCents(stats?.grossRefundedCents ?? 0)}
              sub={t('platform.stripe.stat.refunded_sub', { n: stats?.refundedCount ?? 0 })}
              tone="warn"
            />
          )}
          <StatTile
            label={t('platform.stripe.stat.customers')}
            value={ready ? String(stats?.orgsWithStripe ?? 0) : '—'}
            sub={t('platform.stripe.stat.customers_sub')}
          />
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, sub, tone }) {
  const bg =
    tone === 'accent'
      ? 'var(--accent-soft)'
      : tone === 'warn'
        ? 'color-mix(in oklch, var(--warn) 14%, transparent)'
        : tone === 'info'
          ? 'color-mix(in oklch, var(--accent) 10%, transparent)'
          : 'var(--surface-2)';
  const fg =
    tone === 'accent'
      ? 'var(--accent)'
      : tone === 'warn'
        ? 'var(--warn)'
        : tone === 'info'
          ? 'var(--accent)'
          : 'var(--text-soft)';
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: bg,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.1, textTransform: 'uppercase', color: fg }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  );
}

function SearchBox({ value, onChange, t }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        minWidth: 280,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <Icon.search size={12} style={{ color: 'var(--text-dim)' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('platform.stripe.search_ph')}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: 12.5,
          minWidth: 0,
        }}
      />
    </div>
  );
}

function FilterPills({ value, onChange, stats, t }) {
  const pills = [
    {
      id: 'all',
      labelKey: 'platform.stripe.filter.all',
      count: stats
        ? stats.paidCount + stats.awaitingCount + stats.cancelledCount + stats.failedCount + (stats.refundedCount || 0)
        : null,
    },
    { id: 'paid', labelKey: 'platform.stripe.filter.paid', count: stats?.paidCount },
    { id: 'awaiting', labelKey: 'platform.stripe.filter.awaiting', count: stats?.awaitingCount },
    { id: 'failed', labelKey: 'platform.stripe.filter.failed', count: stats?.failedCount },
    { id: 'cancelled', labelKey: 'platform.stripe.filter.cancelled', count: stats?.cancelledCount },
    { id: 'refunded', labelKey: 'platform.stripe.filter.refunded', count: stats?.refundedCount },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {pills.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: active ? 'var(--accent)' : 'var(--text-soft)',
              border: '1px solid ' + (active ? 'var(--accent-line)' : 'var(--border)'),
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t(p.labelKey)}
            {p.count != null && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, opacity: 0.8 }}>{p.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function OrdersTable({ rows, sort, onSort, ready, t, onRefund }) {
  const cols = [
    { key: 'createdAt', label: t('platform.stripe.col.placed'), flex: '0 1 110px' },
    { key: 'orgName', label: t('platform.stripe.col.org'), flex: '1.5 1 200px' },
    { key: 'status', label: t('platform.stripe.col.status'), flex: '0 1 110px' },
    { key: 'totalCents', label: t('platform.stripe.col.amount'), flex: '0 1 110px', align: 'right' },
    { key: 'paidAt', label: t('platform.stripe.col.paid_at'), flex: '0 1 110px' },
    { key: 'stripeSessionId', label: t('platform.stripe.col.session'), flex: '1.5 1 180px' },
    { key: 'state', label: t('platform.stripe.col.signal'), flex: '1 1 160px' },
    // Actions column — not sortable; the toggleSort no-ops since
    // STRIPE_STATUS_TONES doesn't reference it.
    { key: 'actions', label: '', flex: '0 1 110px', align: 'right', static: true },
  ];
  const toggleSort = (key) => {
    onSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '10px 14px',
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      >
        {cols.map((c) =>
          c.static ? (
            <div key={c.key} style={{ flex: c.flex }} />
          ) : (
            <button
              key={c.key}
              onClick={() => toggleSort(c.key)}
              style={{
                flex: c.flex,
                textAlign: c.align || 'left',
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: 'inherit',
                fontWeight: 700,
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
              }}
            >
              {c.label}
              {sort.key === c.key && (
                <span style={{ fontSize: 9, color: 'var(--accent)' }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
              )}
            </button>
          ),
        )}
      </div>
      {!ready && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.audit.loading')}</div>
      )}
      {ready && rows.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.stripe.empty')}</div>
      )}
      {ready && rows.map((o) => <OrderRow key={o.id} o={o} cols={cols} t={t} onRefund={onRefund} />)}
    </div>
  );
}

function OrderRow({ o, cols, t, onRefund }) {
  const tone = STRIPE_STATUS_TONES[o.status] || 'neutral';
  const isAwaiting = o.status === 'placed' && !o.paidAt;
  const isPaid = !!o.paidAt && o.status !== 'cancelled';
  const isFailed = !!o.lastPaymentError;
  const isCancelled = o.status === 'cancelled';
  const isRefunded = !!o.refundedAt;
  // Refund eligibility:
  //   - Must have been paid (paid_at set)
  //   - Must have a real Stripe payment intent (not demo-fulfilled)
  //   - Must have remaining refundable balance
  const refundable = (o.totalCents || 0) - (o.refundedAmountCents || 0);
  const canRefund = !!o.paidAt && !!o.stripePaymentIntentId && refundable > 0;
  // Signal column: a short human-readable cell that explains what's
  // distinct about this row beyond status (failed-payment code, who
  // cancelled, demo vs real session, etc.).
  const signal = (() => {
    if (isRefunded) {
      // Full refund — promote to a refunded pill so the row stands out
      // (status pill already reads 'refunded' too; this is the reason).
      return {
        label: o.refundReason ? o.refundReason.slice(0, 24) : t('platform.stripe.signal.refunded'),
        tone: 'warn',
      };
    }
    if (refundable < (o.totalCents || 0) && (o.refundedAmountCents || 0) > 0) {
      // Partial refund — status is still 'delivered' but we want the
      // row to advertise the partial credit-back.
      return {
        label: t('platform.stripe.signal.partial_refund', { amount: fmtCents(o.refundedAmountCents, o.currency) }),
        tone: 'warn',
      };
    }
    if (isFailed) {
      const code = o.lastPaymentError?.code || o.lastPaymentError?.decline_code || 'payment_failed';
      return { label: code, tone: 'warn' };
    }
    if (isCancelled) {
      return { label: o.cancellationReason || 'cancelled', tone: 'risk' };
    }
    if (isAwaiting) {
      return { label: t('platform.stripe.signal.awaiting'), tone: 'info' };
    }
    if (isPaid && o.stripeSessionId?.startsWith('demo_')) {
      return { label: t('platform.stripe.signal.demo'), tone: 'neutral' };
    }
    if (isPaid) return { label: t('platform.stripe.signal.paid'), tone: 'ok' };
    return { label: '—', tone: 'neutral' };
  })();
  return (
    <button
      onClick={() => navigateTo(`/platform/tenants/${o.orgId}`)}
      title={t('platform.stripe.open_tenant')}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        color: 'var(--text)',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ flex: cols[0].flex, fontSize: 12, color: 'var(--text-soft)', fontFamily: 'var(--mono)' }}>
        {fmtDate(o.createdAt)}
      </div>
      <div style={{ flex: cols[1].flex, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {o.orgName}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>#{o.id.slice(0, 8)}</div>
      </div>
      <div style={{ flex: cols[2].flex }}>
        <Pill tone={tone}>{o.status}</Pill>
      </div>
      <div
        style={{
          flex: cols[3].flex,
          textAlign: 'right',
          fontSize: 13,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtCents(o.totalCents, o.currency)}
      </div>
      <div style={{ flex: cols[4].flex, fontSize: 12, color: 'var(--text-soft)', fontFamily: 'var(--mono)' }}>
        {fmtDate(o.paidAt)}
      </div>
      <div
        style={{
          flex: cols[5].flex,
          fontSize: 11,
          color: 'var(--text-soft)',
          fontFamily: 'var(--mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={o.stripeSessionId || ''}
      >
        {o.stripeSessionId || <span style={{ color: 'var(--text-faint)' }}>—</span>}
      </div>
      <div style={{ flex: cols[6].flex }}>
        {signal.label !== '—' ? (
          <Pill tone={signal.tone}>{signal.label}</Pill>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>
        )}
      </div>
      <div style={{ flex: cols[7].flex, display: 'flex', justifyContent: 'flex-end' }}>
        {canRefund && (
          // span+role=button instead of <button> because the outer row
          // is itself a <button>, and nested buttons are invalid HTML
          // (React strips the inner one in some flows).
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRefund?.(o);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRefund?.(o);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 700,
              background: 'color-mix(in oklch, var(--warn) 12%, transparent)',
              color: 'var(--warn)',
              border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              userSelect: 'none',
            }}
          >
            <Icon.shield size={10} />
            {t('platform.stripe.action.refund')}
          </span>
        )}
      </div>
    </button>
  );
}
