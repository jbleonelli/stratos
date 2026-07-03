// @ts-check
// Lightweight localization helper for the Servicing surface. The boards were
// built as English string-literals (not the central DICT); rather than mint
// ~400 DICT keys, the servicing components use this reactive `sl(en, fr)` picker
// for inline chrome strings, and a locale-selected config map for the per-area
// board copy (ServicingBoard's DOMAIN / DOMAIN_FR). Reactive via useLanguage so
// the UI re-renders on language toggle.
import { useLanguage } from './i18n.js';

export function useSL() {
  const lang = useLanguage();
  // 3-arg: sl(en, fr, de). German falls back to English when no `de` is given,
  // so the ~600 existing 2-arg call sites keep working unchanged (de undefined).
  return (en, fr, de) => (lang === 'de' ? (de ?? en) : lang === 'fr' ? fr : en);
}
