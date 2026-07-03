// Subscription self-serve helpers — Customer Portal entrypoint,
// per-building quantity sync fire-and-forget, and upcoming-invoice
// preview hook for the Subscription card.

import { useEffect, useState } from 'react';
//
// Server endpoint at api/checkout/customer-portal.ts creates a Stripe
// Billing Portal session and returns its URL. We redirect the browser
// there; on portal close, Stripe routes the user back to the
// configured return_url (Admin → Organization).

import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

// Returns { ok: true } after kicking off a redirect, or { ok: false,
// error } when the endpoint can't open a session (no Stripe customer,
// caller lacks admin role, etc.). On error the caller is responsible
// for surfacing a toast / inline message — we don't throw because the
// failure modes here are user-visible state, not exceptions.
export async function openCustomerPortal() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'not_signed_in' };

  let resp;
  try {
    resp = await fetch('/api/checkout/customer-portal', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: '{}',
    });
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'network_error' };
  }

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: payload.error || `http_${resp.status}` };
  }
  // Demo mode (Stripe key missing) — soft-fail with a recognizable code
  // so the UI can label it differently from a real error.
  if (payload.mode === 'demo') return { ok: false, error: 'demo_mode' };
  if (!payload.url) return { ok: false, error: 'no_url' };
  window.location.href = payload.url;
  return { ok: true };
}

// Fire-and-forget: POSTs to /api/checkout/sync-subscription-quantity
// after a building create or delete so the Pro subscription's quantity
// stays in lockstep with locations count. Endpoint is idempotent and
// gracefully no-ops on non-applicable orgs (free plan, contractor flat
// pricing, no active subscription) — so callers can blindly fire after
// any building mutation without checking org state first.
//
// Errors are logged to console only; we never block or interrupt the
// caller's UI flow. The endpoint itself is the source of truth.
export function triggerQuantitySync() {
  // setTimeout(0) so this runs after the current tick — keeps the
  // calling code's UI updates from waiting on a network round-trip.
  setTimeout(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const resp = await fetch('/api/checkout/sync-subscription-quantity', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: '{}',
      });
      if (!resp.ok) {
        // eslint-disable-next-line no-console
        console.warn('[quantity-sync] non-OK', resp.status);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[quantity-sync] failed', e?.message || e);
    }
  }, 0);
}

// Pulls Stripe's upcoming-invoice preview for the active org. Returns
// one of:
//   { loading: true }
//   { loading: false, available: false }                — non-Pro / no sub / demo mode / errored
//   { loading: false, available: true, invoice: {…} }
//
// invoice.amount_due is in the smallest currency unit (cents for USD).
// invoice.period_end is a unix timestamp (seconds). Callers format both.
//
// Re-fetches whenever the orgId arg changes. Safe to call from any
// rendering position — soft-fails to `available: false` rather than
// throwing, so the card just hides the row if Stripe is unreachable.
export function useUpcomingInvoice(orgId) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let cancelled = false;
    if (!orgId) {
      setState({ loading: false, available: false });
      return;
    }
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setState({ loading: false, available: false });
          return;
        }
        const resp = await fetch('/api/subscription/upcoming', {
          method: 'GET',
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload.mode !== 'stripe') {
          setState({ loading: false, available: false });
          return;
        }
        setState({ loading: false, available: true, invoice: payload });
      } catch {
        if (!cancelled) setState({ loading: false, available: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);
  return state;
}

// Format a Stripe smallest-unit amount (cents for USD, etc.) as a
// human-readable string. Uses Intl.NumberFormat so French locale
// renders "942,00 €" instead of "$942.00". Caller passes the language
// (the i18n module's lang code) to drive the locale.
export function formatStripeAmount(amount, currency, lang) {
  const safeLang = lang === 'fr' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.NumberFormat(safeLang, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      maximumFractionDigits: 0,
    }).format((amount || 0) / 100);
  } catch {
    return `${((amount || 0) / 100).toFixed(0)} ${(currency || 'usd').toUpperCase()}`;
  }
}

// Per-plan data-source caps from the pricing rule (PR-pricing-rule):
//   starter:   25 total
//   pro:       250 per building (with +50 overage at $25/mo)
//   enterprise: unlimited
//
// Returns { limit: number | null, perBuilding: boolean } — limit=null
// means unlimited. perBuilding tells the UI whether to scope the
// counter to the active building or aggregate across the org.
export function dataSourceCapFor(plan) {
  if (plan === 'pro') return { limit: 250, perBuilding: true };
  if (plan === 'enterprise') return { limit: null, perBuilding: false };
  return { limit: 25, perBuilding: false }; // starter + null = same cap
}

// Reads count_data_sources RPC (migration 127). Refetches whenever
// orgId or buildingId changes. `buildingId` may be null to count
// org-wide (used for starter + enterprise plans where the cap is not
// per-building). Returns:
//   { loading: true }
//   { loading: false, count: number }
//   { loading: false, count: 0, error: string }
export function useDataSourceUsage(orgId, buildingId) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let cancelled = false;
    if (!orgId) {
      setState({ loading: false, count: 0 });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('count_data_sources', {
        p_org_id: orgId,
        p_building_id: buildingId || null,
      });
      if (cancelled) return;
      if (error) {
        captureException(error, { where: 'useDataSourceUsage' });
        setState({ loading: false, count: 0, error: error.message });
        return;
      }
      setState({ loading: false, count: typeof data === 'number' ? data : 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, buildingId]);
  return state;
}
