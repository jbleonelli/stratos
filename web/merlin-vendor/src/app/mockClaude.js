// @ts-check
// Mock Claude backend — canned role-aware responses, with a short "thinking" delay.

import { ECOSYSTEM_RESPONSES } from './ecosystem-data.js';

const RESPONSES_BY_ROLE = {
  facility: [
    "Floor 32 East restroom VOC is now **980 ppb**, trending down. Maria's crew is 4m away. Once TVOC drops under **500 ppb** I'll mark the Hygiene SLA preserved.",
    "I'd release Sycamore — **0 occupants, 410 ppm CO₂** for 22 minutes, holding a 14:00 booking. Releases **$312** of billable space this quarter. Approve?",
    "Running the numbers: HVAC setbacks saved **–12% load** vs yesterday. Combined with the supply pre-order, you're on track to beat the month's energy budget by $420.",
  ],
  cleaning: [
    "Priya just tapped NFC in at Floor 18 Women's Restroom. Her last five cleans averaged **5m 40s**; threshold here is 6m. You should see the panel update to 'freshly cleaned' at :48.",
    "Floor 24 Men's has 3 'dirty' flags in 12 minutes — that's above the 2-flag threshold. I'm pulling Maria off Fl 28 (no SLA risk) and routing her east. ETA 7m.",
    'Soap on Fl 18 at 14%, paper towels on Fl 07 at 8%. Both ordered with Adaptiv — ETA Thu 10am. No stockout risk.',
  ],
  maintenance: [
    'AHU-7 pressure drop is **+28%** and runtime hit **2,840h** — filter swap window is open. Work order **#W-1182** is already drafted; want me to file it with your vendor of record?',
    'Chiller-2 short-cycled 6× in the last 20 minutes. Suction pressure is low — likely refrigerant charge. Trane tech ETA 2h. I can throttle back Zone C while we wait to protect comfort SLA.',
    "Elevator B3 service booked with OTIS for **Sat 06:00**. A2 is also showing +180ms door close drift; I'd add it to the same visit to save the call-out fee.",
  ],
  security: [
    'Two incidents to review: Loading Dock B held open **14m** (setpoint drift 3.4°C), and an after-hours visit by K. Okafor (IT) to Server Room 32 — badge authorized, 14m on-site.',
    'Tailgate detected at turnstile 2 at 03:14 — clip saved to audit trail. Ivan is reviewing. Want me to lock zone 1B until confirmation?',
    'Camera G3-07 frame variance is −92% for 6m — likely physically blocked. Flagged for walk-by check at the next patrol.',
  ],
};

const GENERIC = [
  "Got it. Sensor readings are within nominal band; I'll keep watching and flag you if anything drifts outside SLA.",
  "On it. I'll handle the dispatch and log the NFC-verified outcome for your audit trail.",
];

// Simple hash → pick from list, so same prompt gets same reply in a session.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export async function mockClaudeComplete({ text, role, building }) {
  // Ecosystem selected → swap to the right ecosystem-specific list.
  // IMF is a live pilot — no canned IMF responses; use the generic/role pool.
  const list = building?.kind === 'ecosystem' ? ECOSYSTEM_RESPONSES : RESPONSES_BY_ROLE[role?.id] || GENERIC;
  const idx = hash(text) % list.length;
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 700));
  return list[idx];
}
