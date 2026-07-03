// @ts-check
// Client wrapper for the Stripe promotion-codes admin API. Unlike
// feature-flags.js / demo-email-overrides.js (which mirror a
// platform_settings row via Supabase), Stripe is the source of truth
// for promo codes — we don't shadow them in Postgres. So this module
// is a thin fetch-based hook, not a realtime-subscribed cache. The
// admin page calls `refresh()` after each mutation; nothing else
// invalidates the data.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

async function authedFetch(path, init = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}

export function usePromoCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { codes: next } = await authedFetch('/api/promo-codes/list');
      setCodes(Array.isArray(next) ? next : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { codes, loading, error, refresh };
}

export async function createPromoCode(params) {
  return authedFetch('/api/promo-codes/create', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function disablePromoCode(id) {
  return authedFetch('/api/promo-codes/disable', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// Public — used by Pricing.jsx to validate the `?promo=` URL param.
// No auth required; the endpoint always returns 200 (with valid:false
// for unknown codes) so we can use a simple fetch here.
export async function checkPromoCode(code) {
  if (!code) return { valid: false };
  try {
    const res = await fetch(`/api/promo-codes/check?code=${encodeURIComponent(code)}`);
    if (!res.ok) return { valid: false };
    return await res.json();
  } catch {
    return { valid: false };
  }
}
