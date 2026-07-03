// @ts-check
// Shared PREDICT → Forecast signals — single source of truth for the demo's
// environmental forecast cards. Two consumers read this so the card on
// screen and the facts Merlin knows can't drift apart (the same class of
// bug as the Maintenance fleet: a card said "Conference Zone B" but the chat
// backend had never heard of it, so Merlin refused to discuss it):
//
//   1. ForecastPage.jsx — renders the env-forecast cards. Display prose
//      (the `note`) is rendered from i18n via noteKey for EN/FR; the English
//      `note` here mirrors that en-value and is what Merlin is grounded on.
//      Keep the two in sync (they're demo copy).
//   2. chatBackend.js serializeBuilding() → api/chat.ts buildingSummary()
//      — forecastDirectory() feeds a compact fact block into the system
//      prompt so Merlin can speak to any signal the user sees, grounded.
//
// label/where/now/peak/when are the card data; noteKey resolves to prose at
// render; note is the plain-English mirror for the chat prompt.
export const ENV_FORECAST = [
  {
    key: 'voc',
    label: 'VOC',
    where: 'Restroom F32 East',
    now: '717 ppb',
    peak: '980 ppb',
    when: '~14:00',
    risk: true,
    noteKey: 'predict.forecast.env.voc.note',
    note: 'Crosses the 800 ppb hygiene threshold mid-afternoon — Merlin will pre-stage an extra cleaning pass.',
  },
  {
    key: 'co2',
    label: 'CO₂',
    where: 'Conference Zone B',
    now: '740 ppm',
    peak: '1,120 ppm',
    when: '~11:30',
    noteKey: 'predict.forecast.env.co2.note',
    note: 'Back-to-back bookings push CO₂ over comfort target during the morning block.',
  },
  {
    key: 'load',
    label: 'BUILDING LOAD',
    where: 'Building-wide',
    now: '70 kW',
    peak: '92 kW',
    when: '~13:00',
    noteKey: 'predict.forecast.env.load.note',
    note: 'Solar dip + HVAC ramp coincide with lunch-return occupancy — within budget.',
  },
  {
    key: 'occ',
    label: 'FLOOR 4 OCCUPANCY',
    where: 'Floor 4 Open Plan',
    now: '60 %',
    peak: '85 %',
    when: '~11:00',
    noteKey: 'predict.forecast.env.occ.note',
    note: 'Peak density approaches rated capacity for ~90 minutes.',
  },
];

// Compact fact list for the chat system prompt. Plain English (Merlin
// translates on reply). Each entry gives the signal, its location, the
// now→predicted-peak trajectory, and the one-line driver, so Merlin can
// answer "what's driving the CO₂ forecast at X" without fabricating.
export function forecastDirectory() {
  return ENV_FORECAST.map((f) => ({
    label: f.label,
    where: f.where,
    status: `now ${f.now}, predicted peak ${f.peak} at ${f.when}${f.risk ? ' (breach risk)' : ''} — ${f.note}`,
  }));
}
