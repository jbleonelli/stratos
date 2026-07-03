// Platform-side data layer for device_keys CRUD. Mirrors the promo-codes
// shape: a hook that fetches via Supabase (RLS lets platform-admin see all
// orgs) + thin wrappers around POST /api/platform/device-keys for create
// and revoke. The full secret only comes back inside the create response —
// the listing endpoint never exposes it.

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

// ────── Listing
//
// `device_keys` RLS lets platform-admin SELECT everything, so we go
// straight through PostgREST. We embed organization name + (optional)
// device external_id for human-readable rendering. Listing does NOT
// expose `key_hash` because RLS gates `select` but not specific columns
// — pick fields explicitly.

// device_keys has exactly one FK to organizations and one to devices, so
// the embed names are unambiguous — no `!<constraint>` disambiguator
// needed (cf. memory: PostgREST multi-FK gotcha).
const SELECT = `
  id,
  organization_id,
  device_id,
  label,
  key_prefix,
  scope,
  last_seen_at,
  revoked_at,
  created_at,
  organization:organizations ( id, name, slug ),
  device:devices ( id, external_id, kind )
`;

export function useDeviceKeys() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('device_keys')
        .select(SELECT)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (err) throw err;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}

// ────── Create / revoke
//
// `create` returns the FULL secret inside the response — the caller is
// responsible for surfacing it via a one-shot modal and never logging
// it. Subsequent reads only see `key_prefix`.

export async function createDeviceKey(params) {
  return authedFetch('/api/platform/device-keys', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function revokeDeviceKey(id) {
  return authedFetch(`/api/platform/device-keys?revoke=${encodeURIComponent(id)}`, {
    method: 'POST',
  });
}
