// CheckoutResultPage — landing surface for Stripe Checkout redirects.
//
// Two paths:
//   /checkout/success?session_id=…&order_id=…
//     Poll device_orders.paid_at until the webhook flips it (typically
//     1–3 seconds in test mode). Once paid_at is set, show a confirmation
//     with the order id and a deep-link into the Orders tab; until then,
//     show a "Confirming your payment…" spinner.
//   /checkout/cancel?order_id=…
//     Customer hit "back" on the Stripe page. The order row stays at
//     status='placed' so they can retry from the cart. We just surface
//     the cancellation and offer a "Resume checkout" button.
//
// Chrome-less by intent: this is a transition surface, not a workspace
// pane. Picks up the brand wordmark + accent color for continuity.

import React, { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { navigateTo } from './use-route.js';
import { formatCents, createCheckoutSession } from './hardware-store.js';
import { useT } from './i18n.js';

const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 30_000;

export function CheckoutResultPage({ kind, orderId, flow = 'order' }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        padding: 24,
      }}
    >
      <Card style={{ maxWidth: 520, width: '100%', padding: 32 }}>
        {kind === 'success' ? (
          flow === 'subscription' ? (
            <SubscriptionSuccessBody />
          ) : (
            <SuccessBody orderId={orderId} />
          )
        ) : flow === 'subscription' ? (
          <SubscriptionCancelBody />
        ) : (
          <CancelBody orderId={orderId} />
        )}
      </Card>
    </div>
  );
}

// Phase C: subscription success — polls organizations.subscription_status
// until the customer.subscription.created webhook lands and flips it to
// 'active' or 'trialing'. Same UX pattern as SuccessBody but reads org
// rather than device_orders.
function SubscriptionSuccessBody() {
  const t = useT();
  const [, setStatus] = useState(null);
  const [polling, setPolling] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    async function tick() {
      if (cancelled) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPolling(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_org_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const orgId = profile?.active_org_id;
      if (!orgId) {
        setPolling(false);
        return;
      }
      const { data: org } = await supabase
        .from('organizations')
        .select('plan, subscription_status, stripe_subscription_id')
        .eq('id', orgId)
        .maybeSingle();
      if (cancelled) return;
      setStatus(org?.subscription_status || null);
      if (org?.subscription_status === 'active' || org?.subscription_status === 'trialing') {
        setPolling(false);
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPolling(false);
        setTimedOut(true);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  if (polling) {
    return (
      <CenteredColumn>
        <Spinner />
        <h1 style={titleStyle}>{t('checkout.sub.confirming.title')}</h1>
        <p style={bodyStyle}>{t('checkout.sub.confirming.body')}</p>
      </CenteredColumn>
    );
  }

  if (timedOut) {
    return (
      <CenteredColumn>
        <Icon.warn size={28} style={{ color: 'var(--warn)' }} />
        <h1 style={titleStyle}>{t('checkout.sub.timeout.title')}</h1>
        <p style={bodyStyle}>{t('checkout.sub.timeout.body')}</p>
        <PrimaryButton onClick={() => navigateTo('/')}>{t('checkout.success.timeout.cta')}</PrimaryButton>
      </CenteredColumn>
    );
  }

  return (
    <CenteredColumn>
      <Icon.check size={28} style={{ color: 'var(--ok)' }} />
      <h1 style={titleStyle}>{t('checkout.sub.confirmed.title')}</h1>
      <p style={bodyStyle}>{t('checkout.sub.confirmed.body')}</p>
      <PrimaryButton onClick={() => navigateTo('/')}>{t('checkout.success.continue')}</PrimaryButton>
    </CenteredColumn>
  );
}

// Phase C: subscription cancel — customer abandoned the Stripe Checkout
// page. Their org still has plan='pro' (set during signup) but no
// active subscription, so we land them in the app with a notice they
// can subscribe from Settings later.
function SubscriptionCancelBody() {
  const t = useT();
  return (
    <CenteredColumn>
      <Icon.close size={26} style={{ color: 'var(--text-faint)' }} />
      <h1 style={titleStyle}>{t('checkout.sub.cancelled.title')}</h1>
      <p style={bodyStyle}>{t('checkout.sub.cancelled.body')}</p>
      <PrimaryButton onClick={() => navigateTo('/')}>{t('checkout.cancel.back')}</PrimaryButton>
    </CenteredColumn>
  );
}

function SuccessBody({ orderId }) {
  const t = useT();
  const [order, setOrder] = useState(null);
  const [polling, setPolling] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setPolling(false);
      return;
    }
    let cancelled = false;
    const startedAt = Date.now();

    async function tick() {
      if (cancelled) return;
      const { data } = await supabase
        .from('device_orders')
        .select('id, status, paid_at, total_cents, currency')
        .eq('id', orderId)
        .maybeSingle();
      if (cancelled) return;
      setOrder(data || null);
      if (data?.paid_at) {
        setPolling(false);
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPolling(false);
        setTimedOut(true);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!orderId) {
    return <ErrorState title={t('checkout.error.missing_order.title')} body={t('checkout.error.missing_order.body')} />;
  }

  if (polling) {
    return (
      <CenteredColumn>
        <Spinner />
        <h1 style={titleStyle}>{t('checkout.success.confirming.title')}</h1>
        <p style={bodyStyle}>{t('checkout.success.confirming.body')}</p>
        <code style={refStyle}>{orderId}</code>
      </CenteredColumn>
    );
  }

  if (timedOut) {
    return (
      <CenteredColumn>
        <Icon.warn size={28} style={{ color: 'var(--warn)' }} />
        <h1 style={titleStyle}>{t('checkout.success.timeout.title')}</h1>
        <p style={bodyStyle}>{t('checkout.success.timeout.body')}</p>
        <PrimaryButton onClick={() => navigateTo('/')}>{t('checkout.success.timeout.cta')}</PrimaryButton>
      </CenteredColumn>
    );
  }

  return (
    <CenteredColumn>
      <Icon.check size={28} style={{ color: 'var(--ok)' }} />
      <h1 style={titleStyle}>{t('checkout.success.confirmed.title')}</h1>
      <p style={bodyStyle}>{t('checkout.success.confirmed.body')}</p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 12,
          background: 'var(--surface-2)',
          borderRadius: 8,
          width: '100%',
        }}
      >
        <Row label={t('checkout.row.order')} value={orderId.slice(0, 8) + '…'} mono />
        <Row label={t('checkout.row.status')} value={order?.status || t('checkout.status.paid')} />
        {order?.total_cents != null && (
          <Row label={t('checkout.row.total')} value={formatCents(order.total_cents, order.currency || 'USD')} />
        )}
      </div>
      <PrimaryButton onClick={() => navigateTo('/')}>{t('checkout.success.continue')}</PrimaryButton>
    </CenteredColumn>
  );
}

function CancelBody({ orderId }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [order, setOrder] = useState(null);

  // Best-effort fetch — if the webhook has already landed an expired
  // event by the time the customer hits /checkout/cancel, we want to
  // surface the cancellation reason rather than the generic "no
  // charge was made" copy. RLS gates this; failure is silent.
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('device_orders')
        .select('status, cancellation_reason, last_payment_error')
        .eq('id', orderId)
        .maybeSingle();
      if (!cancelled) setOrder(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function resume() {
    if (!orderId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const handoff = await createCheckoutSession(orderId);
      if (handoff?.mode === 'stripe' && handoff.url) {
        window.location.href = handoff.url;
        return;
      }
      // Demo-mode handoff — just route back into the app; the order
      // is still at status='placed'.
      navigateTo('/');
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  // Three shapes the cancel page renders, in priority order:
  //   1. Webhook already cancelled the order (session expired) — show
  //      a definitive "session expired" message + the Resume button
  //      mints a fresh session.
  //   2. A prior payment intent failed (card declined) — show the
  //      decline reason so the customer doesn't have to guess.
  //   3. Generic abandoned-from-Stripe-page — current copy.
  const sessionExpired = order?.status === 'cancelled' && order?.cancellation_reason === 'checkout_session_expired';
  const hasPaymentError = !!order?.last_payment_error?.message;

  const title = sessionExpired
    ? t('checkout.cancel.expired.title')
    : hasPaymentError
      ? t('checkout.cancel.failed.title')
      : t('checkout.cancel.cancelled.title');
  const body = sessionExpired
    ? t('checkout.cancel.expired.body')
    : hasPaymentError
      ? order.last_payment_error.message
      : t('checkout.cancel.cancelled.body');

  return (
    <CenteredColumn>
      <Icon.close
        size={26}
        style={{ color: sessionExpired || hasPaymentError ? 'var(--risk)' : 'var(--text-faint)' }}
      />
      <h1 style={titleStyle}>{title}</h1>
      <p style={bodyStyle}>{body}</p>
      {hasPaymentError && (order.last_payment_error.decline_code || order.last_payment_error.code) && (
        <code style={{ ...refStyle, color: 'var(--risk)' }}>
          {[order.last_payment_error.decline_code, order.last_payment_error.code].filter(Boolean).join(' · ')}
        </code>
      )}
      {orderId && <code style={refStyle}>{orderId}</code>}
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
            width: '100%',
          }}
        >
          {err}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <SecondaryButton onClick={() => navigateTo('/')}>{t('checkout.cancel.back')}</SecondaryButton>
        {orderId && (
          <PrimaryButton onClick={resume} disabled={busy}>
            {busy ? t('checkout.cancel.resuming') : t('checkout.cancel.resume')}
          </PrimaryButton>
        )}
      </div>
    </CenteredColumn>
  );
}

function ErrorState({ title, body }) {
  return (
    <CenteredColumn>
      <Icon.warn size={26} style={{ color: 'var(--warn)' }} />
      <h1 style={titleStyle}>{title}</h1>
      <p style={bodyStyle}>{body}</p>
      <PrimaryButton onClick={() => navigateTo('/')}>Back to app</PrimaryButton>
    </CenteredColumn>
  );
}

function CenteredColumn({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
      <span
        style={{
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
          fontSize: 10.5,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span style={{ color: 'var(--text)', fontFamily: mono ? 'var(--mono)' : 'inherit', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 700,
        background: disabled ? 'var(--surface-3)' : 'var(--accent)',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
        flex: 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 700,
        background: 'var(--surface-2)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flex: 1,
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '3px solid var(--accent-soft)',
        borderTopColor: 'var(--accent)',
        animation: 'merlin-spin 0.8s linear infinite',
      }}
    >
      <style>{`@keyframes merlin-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const titleStyle = { margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' };
const bodyStyle = { margin: 0, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.55, maxWidth: 380 };
const refStyle = { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)' };
