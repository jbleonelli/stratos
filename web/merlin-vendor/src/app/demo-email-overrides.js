// Editable overrides for the demo-invite email + PDF copy. Persisted
// in public.platform_settings under key='demo_email_overrides'. Mirrors
// the feature-flags.js pattern: hydrate-once in-memory cache + listener
// fan-out + Supabase realtime when the value flips.
//
// Surface: /platform/marketing/demo — the "Email template" editor card.
// Server: api/demos/send.ts loads this row before render and merges
// each non-empty field over the in-code default copy from
// api/_lib/demo-templates.ts.
//
// Field semantics (each is an EN + FR pair; an empty string means
// "use the in-code default for that field, don't override"):
//   pitchLine      · the marketing intro paragraph below the greeting
//   guideBody      · the prose under "Full user guide" CTA
//   closing        · the closing block before the sign-off
//   signOff        · the sign-off line ("Adaptiv" / "L'équipe Adaptiv")
//   footerTagline  · the gray footer line
//   note           · the credentials-handling disclaimer

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const PLATFORM_KEY = 'demo_email_overrides';

const EDITABLE_FIELDS = ['pitchLine', 'guideBody', 'closing', 'signOff', 'footerTagline', 'note'];
const LANGS = ['en', 'fr'];

const EMPTY_OVERRIDES = LANGS.reduce((acc, lang) => {
  acc[lang] = EDITABLE_FIELDS.reduce((row, field) => {
    row[field] = '';
    return row;
  }, {});
  return acc;
}, {});

function normalize(value) {
  if (!value || typeof value !== 'object') return EMPTY_OVERRIDES;
  const out = { en: { ...EMPTY_OVERRIDES.en }, fr: { ...EMPTY_OVERRIDES.fr } };
  for (const lang of LANGS) {
    const row = value[lang];
    if (row && typeof row === 'object') {
      for (const f of EDITABLE_FIELDS) {
        if (typeof row[f] === 'string') out[lang][f] = row[f];
      }
    }
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

export async function saveDemoEmailOverrides(overrides) {
  const normalized = normalize(overrides);
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key: PLATFORM_KEY, value: normalized }, { onConflict: 'key' });
  if (error) throw error;
  cache = normalized;
  hydrated = true;
  emit();
  return normalized;
}

let cache = EMPTY_OVERRIDES;
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

export function useDemoEmailOverrides() {
  const [value, setValue] = useState(cache);
  const [ready, setReady] = useState(hydrated);
  useEffect(() => {
    const fn = (next) => {
      setValue({ en: { ...next.en }, fr: { ...next.fr } });
      setReady(true);
    };
    listeners.add(fn);
    hydrateOnce().then(() => setReady(true));
    return () => listeners.delete(fn);
  }, []);
  return { overrides: value, ready };
}
