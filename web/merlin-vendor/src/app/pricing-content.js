// Editable pricing-page content. Persisted in
// public.platform_settings (key='pricing_content'). Sub-PR A.1 of the
// 3-plan rollout — Pricing.jsx reads from here instead of hardcoded
// constants so platform admins can edit copy + prices + features
// from /platform/pricing without a code deploy.
//
// Pattern mirrors feature-flags.js + demo-email-overrides.js:
//   - module-level cache + hydrate-once + listener fan-out
//   - useState hook that subscribes to cache changes
//   - normalize() defends against partial / missing fields
//
// The row is publicly readable (anon SELECT carve-out in migration 116)
// because /pricing is a pre-auth marketing surface. Writes are gated to
// platform admins by RLS.
//
// Schema (a "TextSet" is { name, tagline, price, priceUnit, features[], ctaLabel }):
//   {
//     hero:   { en: {title, subtitle, footerText, footerLinkLabel, footerLinkUrl}, fr: {…} },
//     toggle: { en: {real_estate, contractor}, fr: {…} },
//     plans:  {
//       real_estate: [ {id, featured, ctaTarget, en: TextSet, fr: TextSet}, … ],
//       contractor:  [ same shape ]
//     }
//   }

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const PLATFORM_KEY = 'pricing_content';
const LANGS = ['en', 'fr'];
const AUDIENCES = ['real_estate', 'contractor'];

// Bundled fallback. Used when the platform_settings row is missing
// (e.g. fresh-clone dev environments before migration 116 lands). The
// migration seeds the same content into the DB; this is just the
// belt-and-braces for the edge case.
export const FALLBACK_PRICING_CONTENT = {
  hero: {
    en: {
      title: 'Pricing',
      subtitle: "Pick the plan that fits your portfolio. Start free, scale when you're ready.",
      footerText: 'Questions? ',
      footerLinkLabel: 'Talk to us.',
      footerLinkUrl: '/pricing/contact',
    },
    fr: {
      title: 'Tarifs',
      subtitle:
        'Choisissez le plan qui correspond à votre portefeuille. Commencez gratuitement, évoluez quand vous êtes prêt.',
      footerText: 'Des questions ? ',
      footerLinkLabel: 'Contactez-nous.',
      footerLinkUrl: '/pricing/contact',
    },
  },
  toggle: {
    en: { real_estate: 'For Property Managers', contractor: 'For Contractors' },
    fr: { real_estate: 'Pour les gestionnaires immobiliers', contractor: 'Pour les prestataires' },
  },
  plans: {
    real_estate: [],
    contractor: [],
  },
};

function emptyTextSet() {
  return { name: '', tagline: '', price: '', priceUnit: '', features: [], ctaLabel: '' };
}

function normalizeTextSet(value) {
  if (!value || typeof value !== 'object') return emptyTextSet();
  const out = emptyTextSet();
  for (const f of ['name', 'tagline', 'price', 'priceUnit', 'ctaLabel']) {
    if (typeof value[f] === 'string') out[f] = value[f];
  }
  if (Array.isArray(value.features)) {
    out.features = value.features.filter((s) => typeof s === 'string');
  }
  return out;
}

function normalizePlan(value, fallbackId) {
  const out = {
    id: typeof value?.id === 'string' ? value.id : fallbackId,
    featured: !!value?.featured,
    ctaTarget: typeof value?.ctaTarget === 'string' ? value.ctaTarget : '/',
    en: normalizeTextSet(value?.en),
    fr: normalizeTextSet(value?.fr),
  };
  return out;
}

function normalize(value) {
  const out = JSON.parse(JSON.stringify(FALLBACK_PRICING_CONTENT));
  if (!value || typeof value !== 'object') return out;

  for (const lang of LANGS) {
    if (value.hero?.[lang] && typeof value.hero[lang] === 'object') {
      for (const f of ['title', 'subtitle', 'footerText', 'footerLinkLabel', 'footerLinkUrl']) {
        if (typeof value.hero[lang][f] === 'string') out.hero[lang][f] = value.hero[lang][f];
      }
    }
    if (value.toggle?.[lang] && typeof value.toggle[lang] === 'object') {
      for (const aud of AUDIENCES) {
        if (typeof value.toggle[lang][aud] === 'string') out.toggle[lang][aud] = value.toggle[lang][aud];
      }
    }
  }
  for (const aud of AUDIENCES) {
    const arr = value.plans?.[aud];
    if (Array.isArray(arr)) {
      out.plans[aud] = arr.map((p, i) => normalizePlan(p, `plan-${i}`));
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

export async function savePricingContent(content) {
  const normalized = normalize(content);
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key: PLATFORM_KEY, value: normalized }, { onConflict: 'key' });
  if (error) throw error;
  cache = normalized;
  hydrated = true;
  emit();
  return normalized;
}

let cache = FALLBACK_PRICING_CONTENT;
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

export function usePricingContent() {
  const [value, setValue] = useState(cache);
  const [ready, setReady] = useState(hydrated);
  useEffect(() => {
    const fn = (next) => {
      setValue(next);
      setReady(true);
    };
    listeners.add(fn);
    hydrateOnce().then(() => setReady(true));
    return () => listeners.delete(fn);
  }, []);
  return { content: value, ready };
}
