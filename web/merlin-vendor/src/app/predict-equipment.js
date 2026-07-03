// @ts-check
// Shared PREDICT equipment fleet — the single source of truth for the
// demo's predictive-maintenance assets. Two consumers read this so the
// card on screen and the facts Merlin knows can never drift apart (the
// drift was the bug: a card said "LED Driver Bank · Floor 22" but the chat
// backend had never heard of it, so Merlin refused to discuss it):
//
//   1. PredictMaintenancePage.jsx — renders the cards. Display strings
//      (signal / ttf / action) come from i18n via predict.maint.eq.<key>.*
//      for EN/FR; the English here mirrors those en-values and is what
//      Merlin is grounded on. Keep the two in sync (they're demo copy).
//   2. chatBackend.js serializeBuilding() → api/chat.ts buildingSummary()
//      — equipmentDirectory() feeds a compact fact block into the system
//      prompt so Merlin can speak to any asset the user sees, grounded.
//
// health: 0-100 baseline. trend: 7-pt health history for the sparkline.
// cat: 'lighting' flags the lighting predictive-maintenance assets.
export const PREDICT_EQUIPMENT = [
  {
    key: 'pump',
    name: 'Pump P-204',
    system: 'Chilled-water · Mech Room 2',
    health: 62,
    tone: 'risk',
    trend: [78, 75, 73, 70, 68, 65, 62],
    signal: 'Vibration trend 6σ above baseline',
    ttf: '~72h to failure',
    action: 'Bearing replacement scheduled Mon 06:00',
  },
  {
    key: 'driver',
    name: 'LED Driver Bank · Floor 22',
    system: 'Lighting · Floor 22 ceiling grid',
    health: 67,
    tone: 'risk',
    cat: 'lighting',
    trend: [84, 82, 80, 77, 74, 70, 67],
    signal: 'Driver case temp +12°C over baseline · lumen output drifting toward L70',
    ttf: '~3w to L70 threshold',
    action: 'Bank swap bundled into the Floor 22 evening PM',
  },
  {
    key: 'emerg',
    name: 'Emergency Lighting',
    system: 'Life-safety · building-wide',
    health: 71,
    tone: 'warn',
    cat: 'lighting',
    trend: [95, 94, 94, 93, 80, 74, 71],
    signal: 'Monthly discharge test: 1 of 18 battery packs held < 90 min',
    ttf: 'test fail — fix before inspection',
    action: 'Failed pack flagged · replacement ordered',
  },
  {
    key: 'chiller',
    name: 'Chiller 1',
    system: 'Cooling · Mech Room 2',
    health: 78,
    tone: 'warn',
    trend: [86, 85, 83, 82, 81, 79, 78],
    signal: 'Compressor amperage spike · holding load',
    ttf: '~14d to service',
    action: 'Tech dispatched · inspection booked',
  },
  {
    key: 'elevator',
    name: 'Elevator 2',
    system: 'Vertical transport · Core',
    health: 85,
    tone: 'ok',
    trend: [90, 89, 89, 88, 87, 86, 85],
    signal: 'Door-cycle latency creeping (+8%)',
    ttf: 'watch',
    action: 'Merlin monitoring · no action yet',
  },
  {
    key: 'daylight',
    name: 'Daylight-Harvesting Ballast',
    system: 'Lighting · South façade zones',
    health: 94,
    tone: 'ok',
    cat: 'lighting',
    trend: [93, 94, 93, 94, 94, 95, 94],
    signal: 'Photocell tracking nominal · flicker within spec',
    ttf: 'next PM in 6w',
    action: 'On schedule',
  },
  {
    key: 'boiler',
    name: 'Boiler B-1',
    system: 'Heating · Basement',
    health: 88,
    tone: 'ok',
    trend: [89, 88, 88, 89, 88, 88, 88],
    signal: 'Flue temp + efficiency nominal',
    ttf: 'next PM in 3w',
    action: 'On schedule',
  },
  {
    key: 'tower',
    name: 'Cooling Tower',
    system: 'Heat rejection · Roof',
    health: 74,
    tone: 'warn',
    trend: [82, 81, 80, 78, 77, 75, 74],
    signal: 'Fan motor current rising · scale suspected',
    ttf: '~21d',
    action: 'Water-treatment review queued',
  },
];

// Compact fact list for the chat system prompt. Plain English (Merlin
// translates on reply). Each entry: name, system, and a one-line status so
// Merlin can answer "what's the story on X" without fabricating.
export function equipmentDirectory() {
  return PREDICT_EQUIPMENT.map((e) => ({
    name: e.name,
    system: e.system,
    tone: e.tone,
    status: `${e.signal} — ${e.ttf}; ${e.action}`,
  }));
}
