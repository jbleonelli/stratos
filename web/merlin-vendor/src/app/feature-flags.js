// @ts-check
// Platform-wide experimental feature flags — flipped centrally by an
// Adaptiv platform admin from /platform/experimental. Persisted in
// public.platform_settings under key='feature_flags' (the same table
// the ads kill switch lives in, migration 076). Reads default to the
// in-code DEFAULT_FEATURE_FLAGS so the UI renders sensibly before the
// DB has been hydrated.
//
// Until 2026-05-12 these flags were per-tenant (merlin_config rows
// keyed by organization_id), exposed via Admin → Features for org
// admins. We pulled the customer-side surface and moved governance
// to the platform: a feature is either gating-out for everyone or
// available to everyone, decided by Adaptiv. The legacy merlin_config
// rows still exist but are no longer read.
//
// Add a new flag by:
//   1. Adding a default to DEFAULT_FEATURE_FLAGS below.
//   2. Reading it via useFeatureFlags().<flag>.
//   3. Surfacing a toggle in PlatformExperimental.jsx.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const PLATFORM_KEY = 'feature_flags';

export const DEFAULT_FEATURE_FLAGS = {
  // Hide/show the "Create a new account" path from the login page.
  // Defaults visible. When OFF the LoginPage hides the OR divider +
  // signup CTA, and the SignupPage route redirects back to login.
  // Read pre-auth via the anon SELECT policy on platform_settings
  // (migration 102).
  signupEnabled: true,
};

// ─────────── load / save ───────────

function normalize(value) {
  if (!value || typeof value !== 'object') return null;
  const out = { ...DEFAULT_FEATURE_FLAGS };
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
    if (key in value) out[key] = !!value[key];
  }
  return out;
}

async function loadFromDb() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', PLATFORM_KEY)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data.value);
}

async function saveToDb(flags) {
  const row = { key: PLATFORM_KEY, value: flags };
  const { error } = await supabase.from('platform_settings').upsert(row, { onConflict: 'key' });
  if (error) throw error;
}

// In-memory cache + listener pattern — same shape as product-ads,
// agentic-data, etc. First render returns the in-memory cache; the
// DB value lands a tick later and re-renders.
let cache = { ...DEFAULT_FEATURE_FLAGS };
let hydrated = false;
let hydratingPromise = null;
const listeners = new Set();
function emit() {
  for (const fn of listeners) fn(cache);
}

async function hydrateOnce() {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    const fromDb = await loadFromDb();
    if (fromDb) cache = fromDb;
    hydrated = true;
    emit();
  })();
  return hydratingPromise;
}

// React hook — returns the current flags object. Stable defaults
// always present so callers can read flags.* without guards.
export function useFeatureFlags() {
  const [flags, setFlags] = useState(cache);
  useEffect(() => {
    const fn = (next) => setFlags({ ...next });
    listeners.add(fn);
    hydrateOnce();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return flags;
}

// Patch one or more flags. Unknown keys are ignored (defended
// against typos at the call site). Throws if no active org.
export async function saveFeatureFlags(patch) {
  if (!patch || typeof patch !== 'object') return;
  const next = { ...cache };
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
    if (key in patch) next[key] = !!patch[key];
  }
  await saveToDb(next);
  cache = next;
  emit();
}
