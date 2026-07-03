// @ts-check
// Editable translation glossary — feeds the SYSTEM_PROMPT vocab line in
// api/translate.ts. Stored as a single platform_settings row keyed by
// 'translation_glossary', value shape:
//   { glossary_line: string }
//
// One free-form sentence is intentional: Haiku reads it verbatim as
// natural-language guidance, so platform admins can phrase it however
// they want ("Use 'non-conformité' for breach in cold-chain context, but
// 'rupture' for security contexts"). Mirroring the feature-flags.js
// hydrate-once + emit pattern so any change here triggers a re-render
// across listeners.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const PLATFORM_KEY = 'translation_glossary';

// Kept in sync with DEFAULT_GLOSSARY_LINE in api/translate.ts. UI shows
// this as the placeholder/reset value so admins know what they're
// overriding.
export const DEFAULT_GLOSSARY_LINE = `Use natural French operations vocabulary: "SLA Hygiène" not "SLA d'Hygiène"; "non-conformité" for breach; "dépêche/dépêché" for dispatch; "consigne" for setpoint; "tournée" for cleaning route.`;

function normalize(value) {
  if (!value || typeof value !== 'object') return { glossary_line: '' };
  return { glossary_line: typeof value.glossary_line === 'string' ? value.glossary_line : '' };
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

export async function saveGlossary(glossaryLine) {
  const next = { glossary_line: typeof glossaryLine === 'string' ? glossaryLine : '' };
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key: PLATFORM_KEY, value: next }, { onConflict: 'key' });
  if (error) throw error;
  cache = next;
  hydrated = true;
  emit();
  return next;
}

let cache = { glossary_line: '' };
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

export function useGlossary() {
  const [value, setValue] = useState(cache);
  const [ready, setReady] = useState(hydrated);
  useEffect(() => {
    const fn = (next) => {
      setValue({ ...next });
      setReady(true);
    };
    listeners.add(fn);
    hydrateOnce().then(() => setReady(true));
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { glossary: value, ready };
}
