// myday-content.js — overridable copy for the My Day (Briefing) hero
// card ("3 things need your attention, Jamie." etc). Stored cross-tenant
// in public.platform_settings, key='myday_content', editable from
// /platform/content (founder-gated UI; RLS still enforces platform-admin
// write). Any authenticated user can READ platform_settings (using(true),
// migration 076), so every tenant's My Day picks up the override with no
// migration and no anon-read policy needed — My Day is post-signin.
//
// Shape of platform_settings.myday_content.value — all fields optional.
// An absent or empty field falls back to the built-in i18n string, so a
// fresh install (no row) behaves exactly as before:
//   { eyebrow, attention_title_one, attention_title_many,
//     attention_sub, calm_title, calm_sub }
//
// Placeholders the consumer (Briefing.jsx) interpolates:
//   {n}    → count of attention items (title_many)
//   {name} → signed-in user's first name (any title)
//
// Same module-scope-cache + single-realtime-channel fanout pattern as
// platform-settings.js maintenance mode (avoids the "cannot add
// postgres_changes callbacks" trap with multiple consumers). The cache
// is global platform copy (identical for every user) so it deliberately
// does NOT registerAuthAwareCache — there's nothing user-scoped to leak.

import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';

export const MYDAY_CONTENT_KEY = 'myday_content';

// The editable fields, each paired with the i18n key it overrides. Drives
// both the consumer fallback (Briefing.jsx) and the editor form
// (PlatformContent.jsx) so the two never drift.
export const MYDAY_CONTENT_FIELDS = [
  {
    id: 'eyebrow',
    i18nKey: 'briefing.label',
    label: 'Eyebrow label',
    hint: 'The small uppercase label above the headline (building name + role are appended automatically).',
  },
  {
    id: 'attention_title_one',
    i18nKey: 'briefing.attention.title_one',
    label: 'Headline — 1 item pending',
    hint: 'Shown when exactly one thing needs attention. Use {name} for the first name.',
  },
  {
    id: 'attention_title_many',
    i18nKey: 'briefing.attention.title_many',
    label: 'Headline — multiple pending',
    hint: 'Shown when 2+ things need attention. Use {n} for the count and {name} for the first name.',
  },
  {
    id: 'attention_sub',
    i18nKey: 'briefing.attention.sub',
    label: 'Subtitle — items pending',
    hint: 'The paragraph under the headline when something needs attention.',
  },
  {
    id: 'calm_title',
    i18nKey: 'briefing.calm.title',
    label: 'Headline — nothing pending',
    hint: 'Shown when nothing needs attention. Use {name} for the first name.',
  },
  {
    id: 'calm_sub',
    i18nKey: 'briefing.calm.sub',
    label: 'Subtitle — nothing pending',
    hint: 'The paragraph under the headline when all is calm.',
  },
];

let contentState = { value: {}, ready: false };
const listeners = new Set();
let hydrated = false;
let channel = null;

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

async function hydrate() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', MYDAY_CONTENT_KEY)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[myday-content] fetch failed:', error.message);
    contentState = { value: {}, ready: true };
  } else {
    const v = data?.value;
    contentState = { value: v && typeof v === 'object' && !Array.isArray(v) ? v : {}, ready: true };
  }
  notify();
}

function ensureChannel() {
  if (channel) return;
  channel = supabase
    .channel('myday-content')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'platform_settings', filter: `key=eq.${MYDAY_CONTENT_KEY}` },
      () => {
        hydrate();
      },
    )
    .subscribe();
}

// Returns { value: { field → string }, ready }. value fields may be
// absent; the consumer falls back to its i18n default per field.
export function useMyDayContent() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (!hydrated) {
      hydrated = true;
      hydrate();
      ensureChannel();
    }
    return () => {
      listeners.delete(l);
    };
  }, []);
  return contentState;
}

// Write (platform admin only — RLS-enforced server-side). Persists only
// non-empty trimmed fields so a cleared field reverts to the i18n default.
export async function saveMyDayContent(fields) {
  const value = {};
  for (const { id } of MYDAY_CONTENT_FIELDS) {
    const v = String(fields?.[id] ?? '').trim();
    if (v) value[id] = v;
  }
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key: MYDAY_CONTENT_KEY, value }, { onConflict: 'key' });
  if (error) throw error;

  // Optimistic update so the editor reflects instantly; realtime echo
  // re-sets the same values a tick later (idempotent).
  contentState = { value, ready: true };
  notify();
}
