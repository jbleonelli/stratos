// On-read translation for free-form prose (Phase 3 i18n).
//
// useTranslatedText(text) returns the source string immediately, then
// re-renders with a translation when one is available. The cache lives
// in two layers:
//
//   1. localStorage — survives page reloads. Keyed by `${lang}|${text}`.
//      Bounded; oldest entries fall off when we cross the limit.
//   2. In-memory map — lives for the session, deduplicates concurrent
//      requests for the same string.
//
// Network calls are batched: every component that mounts within a
// FLUSH_DELAY_MS window contributes its requests to a single POST to
// /api/translate. That keeps Haiku calls cheap when a list of N rows
// renders simultaneously.

import { useEffect, useState } from 'react';
import { useLanguage } from './i18n.js';
import { supabase } from './supabase.js';

const STORAGE_KEY = 'merlin-translations';
const STORAGE_LIMIT = 500;
const FLUSH_DELAY_MS = 80;
const MAX_BATCH = 50;

// ────── persistent cache (localStorage)

function loadStorageCache() {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function persistStorageCache(map) {
  if (typeof window === 'undefined') return;
  try {
    // Trim to the most recent N entries.
    const entries = Array.from(map.entries());
    const trimmed = entries.slice(-STORAGE_LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {}
}

const cache = loadStorageCache();
const inFlight = new Map(); // cacheKey → Promise<string>

// Wipe both in-memory + localStorage caches. Used by the platform-admin
// translations editor (translations-data.js) so an admin who just fixed
// "Breach → brèche" doesn't keep seeing the stale value in their own
// session. Other open browsers still see their stale localStorage until
// they reload — acceptable for an admin-only surface.
export function clearLocalTranslationCache() {
  cache.clear();
  inFlight.clear();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

// ────── batch queue

let pendingByLang = new Map(); // lang → Map<text, Set<resolver>>
let flushTimer = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

async function flush() {
  flushTimer = null;
  const snapshot = pendingByLang;
  pendingByLang = new Map();

  for (const [lang, perText] of snapshot) {
    // Slice into MAX_BATCH chunks so a giant queue still fits the API limit.
    const texts = Array.from(perText.keys());
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      const chunk = texts.slice(i, i + MAX_BATCH);
      sendBatch(lang, chunk, perText).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[event-translations] batch failed:', err?.message);
        // Resolve every waiting caller with the original on failure.
        for (const t of chunk) {
          for (const resolve of perText.get(t) || []) resolve(t);
          perText.delete(t);
        }
      });
    }
  }
}

async function sendBatch(targetLang, texts, perText) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    // Not signed in — can't translate. Resolve to originals.
    for (const t of texts) {
      for (const resolve of perText.get(t) || []) resolve(t);
      perText.delete(t);
    }
    return;
  }
  // In dev, /api/* isn't served by Vite — point at the deployed origin
  // so the translate function still answers. Same pattern as
  // merlin-asks.js apply-ask.
  const apiBase =
    typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
      ? 'https://merlin.adaptiv.systems'
      : '';
  const res = await fetch(`${apiBase}/api/translate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ texts, target_lang: targetLang }),
  });
  if (!res.ok) {
    for (const t of texts) {
      for (const resolve of perText.get(t) || []) resolve(t);
      perText.delete(t);
    }
    return;
  }
  const { translations } = await res.json();
  texts.forEach((t, i) => {
    const tx = translations?.[i] || t;
    const cacheKey = `${targetLang}|${t}`;
    cache.set(cacheKey, tx);
    for (const resolve of perText.get(t) || []) resolve(tx);
    perText.delete(t);
  });
  persistStorageCache(cache);
}

function enqueue(text, targetLang) {
  return new Promise((resolve) => {
    let perText = pendingByLang.get(targetLang);
    if (!perText) {
      perText = new Map();
      pendingByLang.set(targetLang, perText);
    }
    let resolvers = perText.get(text);
    if (!resolvers) {
      resolvers = new Set();
      perText.set(text, resolvers);
    }
    resolvers.add(resolve);
    scheduleFlush();
  });
}

// ────── public API

export function translate(text, targetLang) {
  if (!text || typeof text !== 'string' || targetLang === 'en' || !targetLang) {
    return Promise.resolve(text);
  }
  const cacheKey = `${targetLang}|${text}`;
  if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey));
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
  const p = enqueue(text, targetLang);
  inFlight.set(cacheKey, p);
  p.finally(() => inFlight.delete(cacheKey));
  return p;
}

// React hook: returns `text` immediately, then re-renders with the
// translation when it lands. English short-circuits the network.
export function useTranslatedText(text) {
  const lang = useLanguage();
  const [out, setOut] = useState(text || '');

  useEffect(() => {
    if (!text || typeof text !== 'string' || lang === 'en') {
      setOut(text || '');
      return;
    }
    let cancelled = false;
    translate(text, lang).then((tx) => {
      if (!cancelled) setOut(tx || text);
    });
    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  return out;
}
