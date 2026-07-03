// @ts-check
// Client wrapper for the dynamic translation-cache admin API. Mirrors
// promo-codes.js — Supabase doesn't own writes (the cache flows through
// /api/translate's service-role path), so we go through fetch with an
// auth header instead of direct table writes.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { clearLocalTranslationCache } from './event-translations.js';

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

export function useTranslationsCache({ q = '', lang = 'fr', limit = 50, offset = 0 } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        lang,
        limit: String(limit),
        offset: String(offset),
      });
      if (q) params.set('q', q);
      const { rows: next, total: t } = await authedFetch(`/api/translations/list?${params}`);
      setRows(Array.isArray(next) ? next : []);
      setTotal(Number(t) || 0);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [q, lang, limit, offset]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, total, loading, error, refresh };
}

export async function upsertTranslation(source_text, translated, target_lang = 'fr') {
  const result = await authedFetch('/api/translations/upsert', {
    method: 'POST',
    body: JSON.stringify({ source_text, translated, target_lang }),
  });
  // Bust the caller's localStorage cache so the new translation is
  // fetched fresh on next render. Other browsers still hit their stale
  // localStorage until they reload — documented in PlatformTranslations.
  clearLocalTranslationCache();
  return result;
}

export async function deleteTranslation(text_hash, target_lang = 'fr') {
  const result = await authedFetch('/api/translations/delete', {
    method: 'POST',
    body: JSON.stringify({ text_hash, target_lang }),
  });
  clearLocalTranslationCache();
  return result;
}
