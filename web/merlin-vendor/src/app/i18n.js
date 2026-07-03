// Minimal i18n — English + French, localStorage-backed.
//
// Two consumers:
//   - useT()    — React hook; rerenders components on language change.
//   - t(key, …) — plain function for non-React call sites (simulator,
//                 helpers, anything outside the component tree). Reads
//                 the active language at call time; the caller is on
//                 the hook for re-running when language flips.
//
// Coverage today: UI chrome (tabs, buttons, section titles, settings),
// the client simulator's incident pool + ambient tips, and the data
// overlay in localized-data.js for static demo content.
//
// Server-side strings written by agents (merlin_asks, agent_runs,
// route_overrides) remain in their write-time language; localizing
// those happens via merlin_asks.kind + params (migration 069) and an
// on-read translation table coming in Phase 2.

import { useState, useEffect } from 'react';
import { DE } from './de-translations.js';
import { ES } from './es-translations.js';
import { PT } from './pt-translations.js';
import { DICT } from './en-fr-translations.js';

const LANG_KEY = 'merlin-language';
// Languages a user can SELECT (and have restored). German is being rolled out:
// it's selectable and falls back to English for any key without a `de:` value.
// ES/PT are scoped to the Merlin Mobile worker surface (its pickers expose them;
// desktop stays EN/FR/DE) — their DICT coverage is the sign-in chrome subset,
// everything else falls back to English (see es/pt-translations.js).
const SUPPORTED = new Set(['en', 'fr', 'de', 'es', 'pt']);
// Languages the app will AUTO-pick from the browser on first load. German is NOT
// auto-detected yet — a de-* browser shouldn't land on a still-mostly-English
// app. Promote 'de' here once UI coverage is high.
const AUTO_DETECT = new Set(['en', 'fr']);
const listeners = new Set();

// First-load preference: localStorage > navigator.language > 'en'.
// Browser detection only fires when no localStorage entry exists, so a
// user who has explicitly chosen a language never gets overridden.
function load() {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && SUPPORTED.has(stored)) return stored;
    const nav = (navigator?.language || '').slice(0, 2).toLowerCase();
    if (AUTO_DETECT.has(nav)) return nav;
    return 'en';
  } catch { return 'en'; }
}

let currentLang = load();

// Whether the user actively chose a language via a UI picker (login page or
// Settings) during THIS page-load — as opposed to the value being a default
// (navigator/localStorage leftover). Lets the app apply a saved per-user
// language preference on login without an active on-screen choice clobbering
// it. Resets on full page reload, which is the correct scope: a fresh load
// with no picker interaction should defer to the saved profile preference.
let userChoseLanguage = false;
export function didUserChooseLanguage() { return userChoseLanguage; }

function persist() {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LANG_KEY, currentLang); } catch {}
}

// Mirror the active language onto the document root for screen readers
// and search engines, plus the document title so the browser tab
// reflects the user's choice.
function syncDocument() {
  if (typeof document === 'undefined') return;
  try {
    document.documentElement.lang = currentLang;
    const titleKey = 'doc.title';
    const localized = DICT?.[titleKey]?.[currentLang];
    if (localized) document.title = localized;
  } catch {}
}

function emit() { listeners.forEach((fn) => fn(currentLang)); }

// fromUser=true (default) marks an explicit UI choice — used by the login and
// Settings pickers. Applying a saved profile preference on login passes
// { fromUser: false } so it doesn't masquerade as an on-screen choice.
export function setLanguage(lang, { fromUser = true } = {}) {
  if (fromUser) userChoseLanguage = true;
  if (currentLang === lang) return;
  currentLang = lang;
  persist();
  syncDocument();
  emit();
}

export function getLanguage() { return currentLang; }

export function useLanguage() {
  const [lang, setLang] = useState(currentLang);
  useEffect(() => {
    const fn = (next) => setLang(next);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return lang;
}


// Merge the generated German layer (de-translations.js, Phase 2) into the DICT.
// An entry that already carries a hand-curated `de` (e.g. the nav pillars seeded
// in Phase 1) WINS; the machine overlay fills every other key. de-translations.js
// is the single editable source for German — correct a string there, not here.
for (const [deKey, deVal] of Object.entries(DE)) {
  const e = DICT[deKey];
  if (e && e.de === undefined) e.de = deVal;
}

// Spanish + Portuguese layers (es/pt-translations.js) — scoped to the mobile
// worker sign-in chrome; same fill-if-missing rule. Untranslated keys fall back
// to English via format() below.
for (const [esKey, esVal] of Object.entries(ES)) {
  const e = DICT[esKey];
  if (e && e.es === undefined) e.es = esVal;
}
for (const [ptKey, ptVal] of Object.entries(PT)) {
  const e = DICT[ptKey];
  if (e && e.pt === undefined) e.pt = ptVal;
}

function format(key, lang, vars) {
  const entry = DICT[key];
  if (!entry) return key;
  let str = entry[lang] || entry.en || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

export function useT() {
  const lang = useLanguage();
  return (key, vars) => format(key, lang, vars);
}

// Plain function for non-React call sites — reads the current language
// at call time. Used by the simulator, which runs outside the component
// tree. Callers are responsible for re-running when language flips
// (via subscribing to useLanguage at a higher level).
export function t(key, vars) {
  return format(key, currentLang, vars);
}

// Initial document sync — runs after DICT is defined so the title/
// lang reflect the loaded preference before the first React render.
syncDocument();
