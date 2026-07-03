// @ts-check
// Locale-aware formatting helpers (Phase 5 i18n).
//
// Wraps the platform's Intl APIs with a thin layer that:
//   - Reads the active language from i18n.js (no per-call lang arg)
//   - Maps app-language → BCP 47 tag with sensible regional defaults
//     (en → en-US, fr → fr-FR; trivial to widen)
//   - Returns hooks that re-render when language changes
//
// What's in scope:
//   formatNumber     — counts, percentages, decimals
//   formatCurrency   — money values; defaults to USD; locale formats the symbol position
//   formatDate       — full or short dates
//   formatTime       — clock time (24h in fr-FR, 12h in en-US by default)
//   formatRelative   — "2 days ago", "il y a 2 jours"
//
// What's out of scope:
//   Currency conversion. We always render the source currency. A French
//   user looking at a US tenant's $-denominated SLA still sees $; we only
//   localize formatting, not exchange rates.

import { useLanguage } from './i18n.js';

const LOCALE_FOR = {
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
};

function tagFor(lang) {
  return LOCALE_FOR[lang] || lang || 'en-US';
}

export function formatNumberIn(lang, n, opts = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(tagFor(lang), opts).format(n);
}

export function useFormatNumber() {
  const lang = useLanguage();
  return (n, opts) => formatNumberIn(lang, n, opts);
}

// ─── currency ────────────────────────────────────────────────────────
//
// Always source-currency (USD by default). The locale only changes how
// the symbol/grouping render, not the value. Pass `currency: 'EUR'` for
// a EUR-priced tenant; today every paying tenant is USD-denominated.

export function formatCurrencyIn(lang, n, currency = 'USD', opts = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(tagFor(lang), {
    style: 'currency',
    currency,
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
    ...opts,
  }).format(n);
}

export function useFormatCurrency() {
  const lang = useLanguage();
  return (n, currency = 'USD', opts) => formatCurrencyIn(lang, n, currency, opts);
}

// Convenience for sites that build money strings via template literals
// (`$${n}` etc.) and just want the symbol flipped by language. fr/de → €,
// everything else → $. Doesn't convert amounts — symbol-only.
export function currencySymbolFor(lang) {
  return lang === 'fr' || lang === 'de' ? '€' : '$';
}

export function useCurrencySymbol() {
  const lang = useLanguage();
  return currencySymbolFor(lang);
}
const TIME_PRESETS = {
  short: { timeStyle: 'short' }, // 2:32 PM  ·  14:32
  medium: { timeStyle: 'medium' }, // 2:32:00 PM  ·  14:32:00
};

export function formatTimeIn(lang, date, preset = 'short') {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const opts = TIME_PRESETS[preset] || TIME_PRESETS.short;
  return new Intl.DateTimeFormat(tagFor(lang), opts).format(d);
}

export function useFormatTime() {
  const lang = useLanguage();
  return (date, preset) => formatTimeIn(lang, date, preset);
}

// ─── relative time ───────────────────────────────────────────────────
//
// "2 days ago" / "il y a 2 jours". Picks the largest non-zero unit.

const REL_UNITS = [
  { unit: 'year', ms: 365 * 24 * 3600 * 1000 },
  { unit: 'month', ms: 30 * 24 * 3600 * 1000 },
  { unit: 'week', ms: 7 * 24 * 3600 * 1000 },
  { unit: 'day', ms: 24 * 3600 * 1000 },
  { unit: 'hour', ms: 3600 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

export function formatRelativeIn(lang, date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  for (const { unit, ms } of REL_UNITS) {
    if (abs >= ms || unit === 'second') {
      const value = Math.round(diffMs / ms);
      return new Intl.RelativeTimeFormat(tagFor(lang), { numeric: 'auto' }).format(
        value,
        /** @type {Intl.RelativeTimeFormatUnit} */ (unit),
      );
    }
  }
  return '—';
}

export function useFormatRelative() {
  const lang = useLanguage();
  return (date) => formatRelativeIn(lang, date);
}
