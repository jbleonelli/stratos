// vertical-recommendations.js
//
// Static map: which agents Merlin recommends as a starting kit for a
// new tenant, based on the vertical they pick during signup. Read by
// the new-tenant onboarding picker (PR 2) and the Dashboard "Get
// started" card (PR 3).
//
// Source of truth for the post-signup recommendation surface. Editable
// in code — small enough that a config table doesn't add value yet.
// When this grows past ~10 verticals or starts needing per-org
// overrides, migrate to platform_settings.
//
// Each vertical entry carries:
//   - label / description     for the picker card UI
//   - variant                 written to locations.variant on the
//                             default building (also drives per-
//                             building agent gating)
//   - recommended             ordered list of agent ids — order matters,
//                             the picker shows the first 3 as "Enable"
//                             chips and the rest as a hidden tail
//   - rationale               { agentId → one-line "why this agent"
//                             string the picker shows under each chip }
//   - minimum_signal          { agentId → device kind needed for the
//                             agent to produce real signal — drives
//                             the "Connect a data source" step's
//                             default selection }
//
// Three rules of thumb when adding/editing:
//
// 1. Don't recommend more than 7 agents per vertical. Beyond that we
//    overload the cognitive load on a new user, and most orgs won't
//    enable >5 in their first session anyway.
//
// 2. The first 3 should be no-brainers for the vertical. Anything
//    requiring deep integration work (e.g., cold-chain needs a probe
//    fleet) should be in the tail.
//
// 3. Don't recommend `predictive-maintenance` or `asset-tracking`
//    unless the vertical actually uses the equipment / asset categories
//    they're tuned for. The Smart Asset Tracker device class is real
//    hardware; suggesting an agent that has no signal is worse than
//    not suggesting it at all.

export const VERTICALS = {
  office: {
    label: 'Office / Corporate',
    description: 'Single tower, multi-tenant office, corporate HQ, co-working',
    variant: 'office',
    recommended: ['cleaning', 'hvac', 'space', 'supply', 'compliance', 'security', 'energy'],
    rationale: {
      cleaning: 'Daily restroom + meeting-room routines + NFC trail',
      hvac: 'Comfort drift during office hours, overnight setback proposals',
      space: 'Ghost bookings, double-booked rooms, after-hours occupancy',
      supply: 'Restock proposals before stockouts',
      compliance: 'NFC trail completeness + audit evidence',
      security: 'After-hours badge events, tailgate detection',
      energy: 'Setpoint optimization for SLA-tracked energy targets',
    },
    minimum_signal: {
      cleaning: 'occupancy or restroom-occupancy sensor',
      hvac: 'bacnet_thermostat',
      space: 'badge reader or occupancy sensor in meeting rooms',
      supply: 'NFC supply logger',
      compliance: 'NFC badge or smart-logger',
      security: 'hid_badge_reader',
      energy: 'bacnet_thermostat or smart-meter',
    },
  },

  warehouse: {
    label: 'Warehouse / Distribution',
    description: 'Distribution center, 3PL, fulfillment, cold-chain logistics',
    variant: 'warehouse',
    recommended: ['cold-chain', 'predictive-maintenance', 'asset-tracking', 'security', 'compliance', 'energy'],
    rationale: {
      'cold-chain': 'Cold-storage temperature compliance + probe freshness',
      'predictive-maintenance': 'Forklift, conveyor, dock-door, refrigeration uptime',
      'asset-tracking': 'Pallet / tooling / forklift location anomalies',
      security: 'Dock-door access, after-hours zone entries',
      compliance: 'HACCP audit trail for cold storage',
      energy: 'Refrigeration load balancing',
    },
    minimum_signal: {
      'cold-chain': 'cold-storage temperature probe (SLB or BACnet)',
      'predictive-maintenance': 'any equipment with telemetry showing degradation',
      'asset-tracking': 'Adaptiv Smart Asset Tracker',
      security: 'hid_badge_reader on dock-doors',
      compliance: 'NFC or smart-logger',
      energy: 'bacnet_thermostat or smart-meter',
    },
  },

  healthcare: {
    label: 'Healthcare / Clinic',
    description: 'Clinic, hospital wing, dental practice, dialysis center, lab',
    variant: 'healthcare',
    recommended: ['pharmacy-temp', 'cleaning', 'compliance', 'asset-tracking', 'security', 'hvac'],
    rationale: {
      'pharmacy-temp': 'Med-room + vaccine fridge temperature compliance',
      cleaning: 'Higher-frequency clinical-area routines',
      compliance: 'Joint-Commission / DOH audit trail',
      'asset-tracking': 'Wheelchair, infusion-pump, ventilator location',
      security: 'After-hours access to controlled areas',
      hvac: 'Operating-room + ICU comfort tolerance',
    },
    minimum_signal: {
      'pharmacy-temp': 'temperature probe on pharmacy / vaccine fridge',
      cleaning: 'occupancy or NFC logger',
      compliance: 'NFC or smart-logger',
      'asset-tracking': 'Adaptiv Smart Asset Tracker',
      security: 'hid_badge_reader',
      hvac: 'bacnet_thermostat',
    },
  },

  stadium: {
    label: 'Stadium / Arena',
    description: 'Multi-purpose arena, ballpark, concert venue, convention hall',
    variant: 'stadium',
    recommended: ['crowd-flow', 'concession-demand', 'incident-choreography', 'cleaning', 'security'],
    rationale: {
      'crowd-flow': 'Gate ingress + density + restroom pressure during events',
      'concession-demand': 'Queue + stockout + redirect during peak windows',
      'incident-choreography': 'Coordinator dispatch when multiple agents converge',
      cleaning: 'Pre-event + halftime + post-event routines',
      security: 'Bag-check, badge access, after-hours zones',
    },
    minimum_signal: {
      'crowd-flow': 'turnstile (pc_counter) + camera + restroom occupancy',
      'concession-demand': 'food-pos terminals (display_touch)',
      'incident-choreography': 'works once crowd-flow + concession-demand fire asks',
      cleaning: 'occupancy or NFC',
      security: 'hid_badge_reader',
    },
  },

  retail: {
    label: 'Retail / Shopping',
    description: 'Mall, big-box store, multi-storefront, single boutique',
    variant: 'retail',
    recommended: ['security', 'hvac', 'energy', 'cleaning', 'compliance'],
    rationale: {
      security: 'Loss-prevention badge events + after-hours access',
      hvac: 'Customer-area comfort + back-of-house setback',
      energy: 'Lighting + HVAC schedule optimization',
      cleaning: 'Restroom + storefront daily routines',
      compliance: 'OSHA / health-code audit trail',
    },
    minimum_signal: {
      security: 'hid_badge_reader',
      hvac: 'bacnet_thermostat',
      energy: 'bacnet_thermostat or smart-meter',
      cleaning: 'occupancy or NFC',
      compliance: 'NFC or smart-logger',
    },
  },

  other: {
    label: 'Other / Mixed-use',
    description: "Doesn't match the above — we'll start with the basics + you can add more later",
    variant: null, // no variant; agents that gate on variant will skip cleanly
    recommended: ['cleaning', 'hvac', 'security'],
    rationale: {
      cleaning: 'Daily routines + SLA tracking',
      hvac: 'Comfort drift correction',
      security: 'Access events + after-hours patrol',
    },
    minimum_signal: {
      cleaning: 'occupancy or NFC',
      hvac: 'bacnet_thermostat',
      security: 'hid_badge_reader',
    },
  },
};

// List all vertical keys + labels in display order for the picker.
// 'other' is always last.
export function listVerticals() {
  return ['office', 'warehouse', 'healthcare', 'stadium', 'retail', 'other'].map((k) => ({ key: k, ...VERTICALS[k] }));
}
