// Agentic config — building-admin controls for Merlin's persona + each agent.
//
// Storage shape (migration 138):
//   public.merlin_config rows scoped per (organization_id, section, location_id)
//   - location_id IS NULL    → org default (every section)
//   - location_id IS NOT NULL → per-building override (only 'merlin' and
//                                'agents' sections; CHECK constraint enforces)
//
// Read merge: building override layered onto org default per-key
//   merlin: shallow spread        ({...orgMerlin, ...buildingMerlin})
//   agents: per-agent replacement ({...orgAgents, ...buildingAgents})
//
// Write routing in persistAgenticConfig:
//   merlin / agents + buildingId → diff vs org, save sparse delta as
//                                   building row (or delete row if empty)
//   merlin / agents + no buildingId → org-default row
//   tick_settings / seed_settings / device_seed_settings  → org row, Owner-only
//   permissions / data_sources                             → org row
//
// Writes go through supabase.rpc('set_merlin_config' | 'delete_merlin_config')
// rather than direct upsert because partial unique indexes can't be cleanly
// targeted by supabase-js's onConflict shorthand.
import { useEffect, useState } from 'react';
import { AGENTS } from './data.js';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { getSession } from './auth.js';

// Per-org localStorage key. Including the org id prevents config
// from one workspace leaking into another when JB switches active
// org without signing out (auth-state listener below only fires on
// user-id change, not org-switch). 2026-05-19: PRO TEST was showing
// phantom "OVERRIDE" pills because the unscoped key carried a stale
// per-building overlay from a Meridian session.
const LEGACY_STORAGE_KEY = 'merlin-agentic-config';
function storageKeyFor(orgId) {
  return orgId ? `${LEGACY_STORAGE_KEY}:${orgId}` : LEGACY_STORAGE_KEY;
}
// One-time janitor: nuke the legacy un-scoped key on first module load
// so previously-cached cross-org state can't leak into the next load.
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {}
}
const SECTIONS = [
  'merlin',
  'agents',
  'data_sources',
  'permissions',
  'tick_settings',
  'seed_settings',
  'device_seed_settings',
];
// Subset of sections that can carry a per-building override. Matches the
// merlin_config CHECK constraint from migration 138.
const PER_BUILDING_SECTIONS = ['merlin', 'agents'];

// K-19: per-org cron tick frequency. The cron itself fires every minute;
// the handler skips orgs whose latest run is younger than this many
// minutes. Cost scales linearly: 1-min ≈ $2/org/day, 15-min ≈ $0.13.
export const TICK_SETTINGS_DEFAULTS = {
  frequency_min: 15,
};

export const TICK_FREQUENCY_OPTIONS = [
  { value: 0, label: 'Suspended', desc: 'Pause all agent ticks. No cost while paused.' },
  { value: 1, label: 'Every minute', desc: 'Real-time feel. Use only during demos.' },
  { value: 2, label: 'Every 2 minutes', desc: 'Near real-time.' },
  { value: 5, label: 'Every 5 minutes', desc: 'Snappy. Good for active demos.' },
  { value: 10, label: 'Every 10 minutes', desc: 'Balanced.' },
  { value: 15, label: 'Every 15 minutes', desc: 'Default. Cheap and realistic.' },
  { value: 30, label: 'Every 30 minutes', desc: 'Quiet. Suits stable workspaces.' },
  { value: 60, label: 'Hourly', desc: 'Minimal cost. Good for off-hours.' },
];

// Per-tick cost: 7 agents × ~$0.0002 Haiku call ≈ $0.0014.
const COST_PER_TICK_USD = 0.0014;
export function estimateDailyCostUsd(frequencyMin) {
  if (!frequencyMin || frequencyMin <= 0) return 0;
  const ticksPerDay = Math.round(1440 / frequencyMin);
  return +(ticksPerDay * COST_PER_TICK_USD).toFixed(2);
}

// K-20: per-org Data simulator (seed-signal) frequency. Mirrors the
// tick-frequency UX. Headline metric is events/day, since seed-signal
// has near-zero direct cost (just DB inserts) — the indirect cost
// comes from agents reacting on their next tick.
export const SEED_SETTINGS_DEFAULTS = {
  frequency_min: 10,
};

export const SEED_FREQUENCY_OPTIONS = [
  { value: 0, label: 'Suspended', desc: 'No synthetic events. Agents only see real signal.' },
  { value: 1, label: 'Every minute', desc: 'Firehose. Stress-test the agents.' },
  { value: 2, label: 'Every 2 minutes', desc: 'Very busy.' },
  { value: 5, label: 'Every 5 minutes', desc: 'Lively. Good for active demos.' },
  { value: 10, label: 'Every 10 minutes', desc: 'Default. Realistic background activity.' },
  { value: 15, label: 'Every 15 minutes', desc: 'Calm.' },
  { value: 30, label: 'Every 30 minutes', desc: 'Sparse signal.' },
  { value: 60, label: 'Hourly', desc: 'Minimal — agents will mostly skip.' },
];

// Each seed call writes 1-3 incident_actions rows, averaging 2 per call.
const EVENTS_PER_SEED = 2;
export function estimateDailyEvents(frequencyMin) {
  if (!frequencyMin || frequencyMin <= 0) return 0;
  return Math.round((1440 / frequencyMin) * EVENTS_PER_SEED);
}

// L-2.7 / L-3.1: device-event simulator settings. Mirrors SEED_* but
// runs on a different table (device_events, not incident_actions) and
// emits per device profile rather than per agent domain.
//
// SENSOR_CATEGORIES groups profiles in the Emulator UI's profile
// multi-select so the operator sees "Smart Displays / Occupancy
// Sensors / …" headers rather than a flat list. Order in this array
// is the render order.
export const SENSOR_CATEGORIES = [
  { id: 'smart_displays', label: 'Smart Displays' },
  { id: 'occupancy_sensors', label: 'Occupancy Sensors' },
  { id: 'activity_loggers', label: 'Activity Loggers' },
  { id: 'parking_sensors', label: 'Parking Sensors' },
];

// DEVICE_PROFILE_CATALOG is the client-facing mirror of the server-
// side registry in api/devices/profiles/index.js. Catalog stays
// declarative (id + label + category) — implementation lives server-side.
export const DEVICE_PROFILE_CATALOG = [
  { id: 'smart_display_classic', label: 'Smart Display Classic', category: 'smart_displays' },
  { id: 'people_counter_basic', label: 'People Counter Basic', category: 'occupancy_sensors' },
  { id: 'smart_logger_basic', label: 'Smart Logger Basic', category: 'activity_loggers' },
  { id: 'smart_logger_bank', label: 'Smart Logger (Bank)', category: 'activity_loggers' },
  // Parking (Phase 1 — registered in catalog so the Emulator UI shows
  // the category header. Server-side simulator profile lands in Phase 3.)
  { id: 'parking_spot_sensor', label: 'Parking Spot Sensor', category: 'parking_sensors' },
];

export const DEVICE_SEED_SETTINGS_DEFAULTS = {
  frequency_min: 5,
  // null means "all known profiles enabled" (legacy behaviour for
  // workspaces created before L-2.7). An empty array means "no
  // profiles enabled, simulator idle for active events" — heartbeats
  // still fire fleet-wide.
  profile_ids: null,
};

export const DEVICE_SEED_FREQUENCY_OPTIONS = [
  { value: 0, label: 'Suspended', desc: 'No active events. Heartbeats still fire daily.' },
  { value: 1, label: 'Every minute', desc: 'Firehose. Burns through the fleet fast.' },
  { value: 2, label: 'Every 2 minutes', desc: 'Very busy.' },
  { value: 5, label: 'Every 5 minutes', desc: 'Default. Realistic activity.' },
  { value: 10, label: 'Every 10 minutes', desc: 'Calm.' },
  { value: 15, label: 'Every 15 minutes', desc: 'Quiet.' },
  { value: 30, label: 'Every 30 minutes', desc: 'Sparse — long quiet stretches.' },
  { value: 60, label: 'Hourly', desc: 'Minimal — almost only heartbeats.' },
];

// Roughly 2 active events per cron call on average (mid of 1–3 in full
// regime, 1–2 in cleaner regime). Used for the headline preview.
const DEVICE_EVENTS_PER_TICK = 2;
export function estimateDailyDeviceEvents(frequencyMin) {
  if (!frequencyMin || frequencyMin <= 0) return 0;
  // Heuristic: only ~13h/day of the 24h are active (Mon-Fri 06:00–23:00
  // averaged across the week is ~12.1h; round up). Outside that window
  // active emit doesn't fire so a 5-min cadence doesn't actually run
  // 288 times per day.
  const activeHoursPerDay = 12;
  const ticksPerDay = Math.round((activeHoursPerDay * 60) / frequencyMin);
  return ticksPerDay * DEVICE_EVENTS_PER_TICK;
}

// ─────────────────────── defaults ───────────────────────

export const MERLIN_DEFAULTS = {
  persona: 'warm', // professional | warm | concise | enthusiastic
  proactivePings: 'normal', // off | light | normal | busy
  autonomyPolicy: 'approve-critical', // propose | auto-low-risk | approve-critical | full-auto
  language: 'en', // en | fr (workspace default)
  model: 'sonnet', // sonnet | opus | haiku
  approvalConfidence: 75, // require approval below this %
  approvalPriority: 'high', // require approval at or above this priority
  memoryEnabled: true, // Merlin recalls prior convos within the workspace
  citations: true, // link Merlin's claims to source signals
};

// Per-agent config seeds. Each agent gets enabled + autonomy + thresholds +
// a list of triggers (what wakes it up) and a list of data sources it can touch.
// The `playbook` sub-object carries the editable rules: steps (trigger →
// action), response templates, and guardrails.
export const AGENT_DEFAULTS = {
  cleaning: {
    enabled: true,
    autonomy: 'approve-critical',
    confidence: 80,
    maxActionsPerHour: 12,
    icon: 'droplet',
    triggers: ['Air quality threshold', 'NFC check-in overdue', 'Occupancy peak', 'Waste bin 95%'],
    dataSources: ['voc_sensors', 'nfc_tap_log', 'occupancy', 'work_orders'],
    description: 'Dispatches cleaners, reroutes routes, and verifies NFC completion.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Air quality threshold',
          condition: 'VOC >1000 ppb for 5m',
          action: 'dispatch_crew',
          autonomy: 'inherit',
          sources: ['voc_sensors', 'occupancy'],
        },
        {
          id: 's2',
          trigger: 'NFC check-in overdue',
          condition: 'Scheduled clean +10m',
          action: 'notify_host',
          autonomy: 'inherit',
          sources: ['nfc_tap_log', 'work_orders'],
        },
        {
          id: 's3',
          trigger: 'Waste bin 95%',
          condition: 'Peak hours only',
          action: 'dispatch_crew',
          autonomy: 'inherit',
          sources: [],
        },
      ],
      responses: {
        acting: 'Dispatching {crew} to {room} for {issue}. ETA {eta}.',
        proposing: 'I think we should dispatch to {room} for {issue} — confidence {confidence}%. Approve?',
        escalating: 'Cleaning SLA at risk in {room}. No crew available — escalating to {role}.',
      },
      guardrails: {
        quietHours: [22, 6],
        excludedZones: ['Executive suite floor 48'],
        maxActionsPerHour: 12,
      },
    },
  },
  hvac: {
    enabled: true,
    autonomy: 'auto-low-risk',
    confidence: 85,
    maxActionsPerHour: 24,
    icon: 'hvac',
    triggers: ['Temp drift ≥2°C', 'CO₂ over 900 ppm', 'Setback schedule window', 'Occupancy zero'],
    dataSources: ['zone_temp', 'co2_sensors', 'bacnet_setpoints', 'occupancy'],
    description: 'Balances HVAC zones and holds setbacks when spaces are empty.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Temp drift ≥2°C',
          condition: 'Deviation sustained 10m',
          action: 'adjust_setpoint',
          autonomy: 'inherit',
          sources: ['zone_temp', 'bacnet_setpoints'],
        },
        {
          id: 's2',
          trigger: 'CO₂ over 900 ppm',
          condition: 'Occupied zone only',
          action: 'adjust_setpoint',
          autonomy: 'inherit',
          sources: ['co2_sensors', 'occupancy', 'bacnet_setpoints'],
        },
        {
          id: 's3',
          trigger: 'Setback schedule window',
          condition: 'Occupancy = 0',
          action: 'adjust_setpoint',
          autonomy: 'inherit',
          sources: ['occupancy', 'bacnet_setpoints'],
        },
        {
          id: 's4',
          trigger: 'Temp drift ≥2°C',
          condition: 'Unit fault flagged',
          action: 'queue_maintenance',
          autonomy: 'propose',
          sources: ['zone_temp'],
        },
      ],
      responses: {
        acting: 'Adjusting {zone} by {delta} — confidence {confidence}%.',
        proposing: '{zone} is drifting {delta}. Want me to correct setpoint?',
        escalating: '{zone} setpoint change failed twice. Escalating to maintenance.',
      },
      guardrails: {
        quietHours: [23, 5],
        excludedZones: ['Server room 18'],
        maxActionsPerHour: 24,
      },
    },
  },
  space: {
    enabled: true,
    autonomy: 'auto-low-risk',
    confidence: 70,
    maxActionsPerHour: 30,
    icon: 'floor',
    triggers: ['Ghost booking (15m no-show)', 'Double-booked room', 'Low utilization zone'],
    dataSources: ['room_calendar', 'occupancy', 'badge_events'],
    description: 'Releases ghost bookings and suggests room consolidation.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Ghost booking (15m no-show)',
          condition: '0 badge swipes',
          action: 'release_booking',
          autonomy: 'inherit',
          sources: ['room_calendar', 'badge_events', 'occupancy'],
        },
        {
          id: 's2',
          trigger: 'Double-booked room',
          condition: 'Overlap >5m',
          action: 'notify_host',
          autonomy: 'inherit',
          sources: ['room_calendar'],
        },
        {
          id: 's3',
          trigger: 'Low utilization zone',
          condition: 'Weekly avg <25%',
          action: 'suggest_consolidation',
          autonomy: 'propose',
          sources: ['occupancy', 'room_calendar'],
        },
      ],
      responses: {
        acting: 'Released {room} — {duration} unused. Put it back on the book.',
        proposing: '{room} looks stuck on {host}\u2019s calendar but empty. Release?',
        escalating: 'Room conflict between {host1} and {host2} in {room} — needs human call.',
      },
      guardrails: {
        quietHours: [22, 7],
        excludedZones: ['Boardroom'],
        maxActionsPerHour: 30,
      },
    },
  },
  supply: {
    enabled: true,
    autonomy: 'approve-critical',
    confidence: 80,
    maxActionsPerHour: 6,
    icon: 'supply',
    triggers: ['Stock below reorder point', 'Consumption spike', 'Supplier catalog change'],
    dataSources: ['inventory_levels', 'supplier_api', 'audit_log'],
    description: 'Reorders consumables and flags supplier price changes.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Stock below reorder point',
          condition: 'All floors',
          action: 'place_order',
          autonomy: 'inherit',
          sources: ['inventory_levels', 'supplier_api'],
        },
        {
          id: 's2',
          trigger: 'Supplier catalog change',
          condition: 'Price delta >10%',
          action: 'flag_price_change',
          autonomy: 'propose',
          sources: ['supplier_api'],
        },
        {
          id: 's3',
          trigger: 'Consumption spike',
          condition: 'vs 30d baseline',
          action: 'request_quote',
          autonomy: 'propose',
          sources: ['inventory_levels', 'audit_log'],
        },
      ],
      responses: {
        acting: 'Reordering {sku} — {qty} units. ETA {eta}.',
        proposing: '{sku} will run out in {days}. Reorder {qty} units?',
        escalating: 'Supplier {vendor} raised prices {delta}% on {sku}. Needs review.',
      },
      guardrails: {
        quietHours: [20, 8],
        excludedZones: [],
        maxActionsPerHour: 6,
      },
    },
  },
  compliance: {
    enabled: true,
    autonomy: 'propose',
    confidence: 90,
    maxActionsPerHour: 2,
    icon: 'shield',
    triggers: ['Firmware drift', 'Audit evidence gap', 'NFC trail break', 'Certificate expiry'],
    dataSources: ['device_fleet', 'audit_log', 'nfc_tap_log', 'certs'],
    description: 'Surfaces audit gaps and queues evidence for compliance review.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Firmware drift',
          condition: '>30d behind stable',
          action: 'queue_evidence',
          autonomy: 'inherit',
          sources: ['device_fleet', 'audit_log'],
        },
        {
          id: 's2',
          trigger: 'NFC trail break',
          condition: 'Sequence gap >1h',
          action: 'flag_gap',
          autonomy: 'inherit',
          sources: ['nfc_tap_log', 'audit_log'],
        },
        {
          id: 's3',
          trigger: 'Certificate expiry',
          condition: '<14 days',
          action: 'notify_legal',
          autonomy: 'inherit',
          sources: ['certs'],
        },
      ],
      responses: {
        acting: 'Queued {artifact} to the audit log — {evidence}.',
        proposing: 'Compliance gap in {location}: {reason}. Queue evidence?',
        escalating: 'Compliance posture is slipping — {count} open gaps, escalating to legal.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 2,
      },
    },
  },
  energy: {
    enabled: true,
    autonomy: 'propose',
    confidence: 85,
    maxActionsPerHour: 4,
    icon: 'bolt',
    triggers: ['kWh deviation vs baseline', 'Peak demand window', 'Weather forecast change'],
    dataSources: ['utility_meter', 'weather_api', 'zone_temp'],
    description: 'Identifies energy savings and proposes setback schedules.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'kWh deviation vs baseline',
          condition: '>10% weather-adjusted',
          action: 'flag_spike',
          autonomy: 'inherit',
          sources: ['utility_meter', 'weather_api'],
        },
        {
          id: 's2',
          trigger: 'Peak demand window',
          condition: 'Utility peak flag',
          action: 'propose_setback',
          autonomy: 'inherit',
          sources: ['utility_meter'],
        },
        {
          id: 's3',
          trigger: 'Weather forecast change',
          condition: 'Heatwave >3d',
          action: 'request_audit',
          autonomy: 'propose',
          sources: ['weather_api', 'zone_temp'],
        },
      ],
      responses: {
        acting: 'Proposed setback for {zone}: {schedule}. Est. savings {savings}.',
        proposing: 'Energy spike in {zone} — {delta} above baseline. Investigate?',
        escalating: 'Sustained energy anomaly in {zone} — audit recommended.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: ['Hospital wing'],
        maxActionsPerHour: 4,
      },
    },
  },
  parking: {
    // Default flipped from false → true (2026-05-29) to match every
    // other agent in the catalog. Previously Parking was the only
    // agent defaulting OFF — a legacy quirk from when it was
    // Phase-1-only (schema + SLAs without a runner). With the
    // entitlement table granting access (Admin → Agents), users
    // expected toggling Parking ON in Admin to be reflected in
    // Agentic too; the asymmetric default broke that mental model.
    // NOTE: there is still no api/agents/parking.ts runner — flipping
    // enabled=true is currently a no-op at tick time. Ship the runner
    // before relying on this in production.
    enabled: true,
    autonomy: 'propose',
    confidence: 80,
    maxActionsPerHour: 6,
    icon: 'beacon',
    triggers: ['Deck nearing capacity', 'EV charger fault', 'Idle EV session', 'Accessible-spot dwell without permit'],
    dataSources: ['parking_spot_sensors', 'ev_chargers', 'anpr_cameras'],
    description:
      'Watches deck availability, EV charger uptime, and accessible-spot compliance. Phase 1: schema + SLAs only — runner ships in Phase 2.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Deck nearing capacity',
          condition: 'Available <20% during peak hours',
          action: 'reroute_entry',
          autonomy: 'inherit',
          sources: ['parking_spot_sensors'],
        },
        {
          id: 's2',
          trigger: 'EV charger fault',
          condition: 'Status fault >5m',
          action: 'page_maintenance',
          autonomy: 'inherit',
          sources: ['ev_chargers'],
        },
        {
          id: 's3',
          trigger: 'Idle EV session',
          condition: 'Plugged 100% SoC + 15m grace',
          action: 'notify_driver',
          autonomy: 'inherit',
          sources: ['ev_chargers'],
        },
        {
          id: 's4',
          trigger: 'Accessible-spot dwell without permit',
          condition: 'Dwell >10m + no permit on file',
          action: 'flag_compliance_breach',
          autonomy: 'propose',
          sources: ['parking_spot_sensors', 'anpr_cameras'],
        },
      ],
      responses: {
        acting: 'Deck {deck} at {pct}% — pushed reroute to {alt_deck}. Confidence {confidence}%.',
        proposing: '{event} at {location}. Want me to {action}?',
        escalating: 'Charger {charger} faulted {duration} ago — escalating to maintenance.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 6,
      },
    },
  },
  security: {
    enabled: true,
    autonomy: 'approve-critical',
    confidence: 88,
    maxActionsPerHour: 8,
    icon: 'badge',
    triggers: ['After-hours badge', 'Door held >5m', 'Tailgate detection', 'Badge deny burst'],
    dataSources: ['badge_events', 'cameras', 'door_contacts'],
    description: 'Escalates after-hours events and flags tailgate risk.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Tailgate detection',
          condition: 'Any entry point',
          action: 'escalate_incident',
          autonomy: 'inherit',
          sources: ['cameras', 'badge_events'],
        },
        {
          id: 's2',
          trigger: 'After-hours badge',
          condition: 'Non-allowlist',
          action: 'notify_on_shift',
          autonomy: 'inherit',
          sources: ['badge_events'],
        },
        {
          id: 's3',
          trigger: 'Door held >5m',
          condition: 'Loading dock / lobby',
          action: 'request_patrol',
          autonomy: 'inherit',
          sources: ['door_contacts', 'cameras'],
        },
        {
          id: 's4',
          trigger: 'Badge deny burst',
          condition: '>3 denies in 6m',
          action: 'lock_zone',
          autonomy: 'propose',
          sources: ['badge_events'],
        },
      ],
      responses: {
        acting: 'Escalated {event} at {location} to {role}. Clip saved.',
        proposing: 'Unusual {event} at {location}. Want me to notify on-shift?',
        escalating: 'Security posture flag — {incident} at {location}. Routing to supervisor.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 8,
      },
    },
  },
  // Watches every Servicing board (the 14 cleaning areas + security /
  // hospitality / maintenance). On demo orgs its activity is fixture-emitted
  // by demo_servicing_agent_tick (mig 197) — asks → My Day, acts → Activity,
  // breaches → ticket. No live Claude path yet (boards are fixture-backed).
  servicing: {
    enabled: true,
    autonomy: 'approve-critical',
    confidence: 82,
    maxActionsPerHour: 16,
    icon: 'sparkle',
    triggers: ['SLA past due', 'Open request aging', 'Critical breach (2× SLA)'],
    dataSources: ['servicing_boards', 'work_orders', 'sla_targets'],
    description: 'Watches every servicing board and dispatches, acts, or escalates against SLA.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'SLA past due',
          condition: 'hours_since > sla_hours',
          action: 'dispatch_crew',
          autonomy: 'inherit',
          sources: ['servicing_boards', 'work_orders'],
        },
        {
          id: 's2',
          trigger: 'Open request aging',
          condition: 'open_count > 0',
          action: 'dispatch_crew',
          autonomy: 'inherit',
          sources: ['servicing_boards'],
        },
        {
          id: 's3',
          trigger: 'Critical breach (2× SLA)',
          condition: 'open + hours_since > 2×sla',
          action: 'escalate_incident',
          autonomy: 'propose',
          sources: ['servicing_boards', 'sla_targets'],
        },
      ],
      responses: {
        acting: 'Dispatched crew to {item} at {location} — verified complete.',
        proposing: '{item} is past its {sla}h SLA at {location}. Approve a dispatch?',
        escalating: '{item} breached its SLA — escalating to the facilities lead.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 16,
      },
    },
  },
  // Added 2026-05-13 for warehouse vertical (Meridian Distribution Center
  // East). Was added to AGENTS but missing from AGENT_DEFAULTS until
  // now — the resulting `config.agents['cold-chain']` was undefined,
  // crashing AgentCard on cfg.icon for any superadmin opening Agentic.
  'cold-chain': {
    enabled: true,
    autonomy: 'approve-critical',
    confidence: 90,
    maxActionsPerHour: 6,
    icon: 'droplet',
    triggers: ['Compressor PM overdue', 'Temp drift ≥1°C', 'Door held ≥2m', 'Probe offline'],
    dataSources: ['zone_temp'],
    description:
      'Monitors cold-storage probes against the HACCP cold-chain spec and dispatches before breach windows close.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Temp drift ≥1°C',
          condition: 'Setpoint −18°C bay',
          action: 'dispatch_crew',
          autonomy: 'inherit',
          sources: ['zone_temp'],
        },
        {
          id: 's2',
          trigger: 'Compressor PM overdue',
          condition: 'Open work order',
          action: 'queue_maintenance',
          autonomy: 'inherit',
          sources: [],
        },
        {
          id: 's3',
          trigger: 'Door held ≥2m',
          condition: 'Cold bay',
          action: 'notify_host',
          autonomy: 'inherit',
          sources: [],
        },
      ],
      responses: {
        acting: 'Dispatching tech to {bay} — temp drift {delta}, HACCP breach window {window}.',
        proposing: 'Cold drift in {bay} — dispatch tech? (HACCP breach in {window})',
        escalating: 'HACCP cold-chain at risk in {bay}. No tech available — escalating to building contact.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 6,
      },
    },
  },
  // Added 2026-05-13 for healthcare vertical (Meridian Health Clinic).
  // Same fix-once-added story as cold-chain above.
  'pharmacy-temp': {
    enabled: true,
    autonomy: 'approve-critical',
    confidence: 92,
    maxActionsPerHour: 4,
    icon: 'shield',
    triggers: ['Fridge drift ≥0.5°C', 'Probe offline', 'Door held ≥1m', 'Power blip'],
    dataSources: ['zone_temp'],
    description: 'Monitors pharmacy + med-room probes against vaccine and controlled-drug storage spec.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Fridge drift ≥0.5°C',
          condition: 'Vaccine fridge',
          action: 'dispatch_crew',
          autonomy: 'inherit',
          sources: ['zone_temp'],
        },
        {
          id: 's2',
          trigger: 'Probe offline',
          condition: '>5m no telemetry',
          action: 'notify_on_shift',
          autonomy: 'inherit',
          sources: [],
        },
        {
          id: 's3',
          trigger: 'Power blip',
          condition: 'Fridge circuit',
          action: 'escalate_incident',
          autonomy: 'propose',
          sources: [],
        },
      ],
      responses: {
        acting: 'Dispatching to {room} — {fridge} drift {delta}°C past spec.',
        proposing: 'Pharmacy fridge drift in {room}. Notify on-shift pharmacist?',
        escalating: 'Pharmacy probe offline in {room} — escalating to clinic lead.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 4,
      },
    },
  },
  // Cross-vertical agent. Watches slow telemetry trends (vibration,
  // fault counts, runtime, current draw) on equipment across every
  // workspace and proposes proactive PM windows / part replacements
  // BEFORE the failure lands. Distinct from `hvac` (real-time comfort)
  // and `compliance` (audit-trail completeness).
  'predictive-maintenance': {
    enabled: true,
    autonomy: 'propose',
    confidence: 80,
    maxActionsPerHour: 3,
    icon: 'hvac',
    triggers: [
      'Fault count trend ↑',
      'Vibration RMS trend ↑',
      'Current-draw drift',
      'Runtime ≥ scheduled PM window',
      'Repeated VFD fault resets',
    ],
    dataSources: ['device_fleet', 'work_orders', 'bacnet_setpoints'],
    description:
      'Reads slow telemetry trends across the fleet and proposes proactive PM windows, part replacements, or vendor-warranty escalations before a failure lands.',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Fault count trend ↑',
          condition: '≥3 faults in 24h, no open PM',
          action: 'schedule_pm',
          autonomy: 'inherit',
          sources: ['device_fleet', 'work_orders'],
        },
        {
          id: 's2',
          trigger: 'Vibration RMS trend ↑',
          condition: 'Sustained ↑ across 4 reads',
          action: 'dispatch_tech',
          autonomy: 'inherit',
          sources: ['device_fleet'],
        },
        {
          id: 's3',
          trigger: 'Runtime ≥ scheduled PM window',
          condition: 'Bearing / belt class',
          action: 'schedule_pm',
          autonomy: 'inherit',
          sources: ['device_fleet'],
        },
        {
          id: 's4',
          trigger: 'Repeated VFD fault resets',
          condition: '>2 resets in 24h',
          action: 'vendor_warranty',
          autonomy: 'propose',
          sources: ['device_fleet'],
        },
      ],
      responses: {
        acting: 'Scheduled PM for {equipment} in {horizon}h — {reason}.',
        proposing: '{equipment} is trending toward failure ({reason}). Schedule PM in the next {horizon}h?',
        escalating: 'Sustained pre-failure signature on {equipment} — escalating to vendor warranty.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 3,
      },
    },
  },
  // Cross-vertical agent. Watches positions reported by Adaptiv Smart
  // Asset Trackers (5G/LTE + GPS + Wi-Fi + Bluetooth fused fix) and
  // surfaces stale beacons, geofence breaches, missing-asset patterns,
  // and high-value-asset dwell anomalies. Works in every vertical:
  // hospitals (wheelchairs / infusion pumps), warehouses (pallets /
  // forklifts), airports (ground-support equipment), offices (laptops).
  'asset-tracking': {
    enabled: true,
    autonomy: 'approve-critical',
    confidence: 85,
    maxActionsPerHour: 6,
    icon: 'beacon',
    triggers: ['Tracker stale ≥30m', 'Geofence breach', 'Unauthorized movement', 'Asset-class pattern'],
    dataSources: ['asset_trackers'],
    description:
      'Locates assets across a building, campus, airport, or warehouse via Adaptiv Smart Asset Trackers (multi-radio: 5G/LTE + GPS + Wi-Fi + Bluetooth).',
    playbook: {
      steps: [
        {
          id: 's1',
          trigger: 'Tracker stale ≥30m',
          condition: 'High-value asset',
          action: 'dispatch_locate',
          autonomy: 'inherit',
          sources: ['asset_trackers'],
        },
        {
          id: 's2',
          trigger: 'Geofence breach',
          condition: 'Asset class restricted',
          action: 'notify_security',
          autonomy: 'inherit',
          sources: ['asset_trackers'],
        },
        {
          id: 's3',
          trigger: 'Unauthorized movement',
          condition: 'Off-hours + restricted asset',
          action: 'notify_security',
          autonomy: 'inherit',
          sources: ['asset_trackers'],
        },
        {
          id: 's4',
          trigger: 'Asset-class pattern',
          condition: '≥2 incidents same class in 6h',
          action: 'inventory_audit',
          autonomy: 'propose',
          sources: ['asset_trackers'],
        },
      ],
      responses: {
        acting: 'Dispatched staff to locate {asset} — last known {last_known_zone}.',
        proposing: '{asset} hasn’t reported in {duration}. Dispatch to last known location {last_known_zone}?',
        escalating: 'Geofence breach on {asset} — escalating to security.',
      },
      guardrails: {
        quietHours: [0, 0],
        excludedZones: [],
        maxActionsPerHour: 6,
      },
    },
  },
};

// ─────────────────────── action catalog ───────────────────────
// Per-agent list of callable actions. Used by the playbook editor to
// populate the action dropdown on each step. Each action has an id
// (what gets persisted) and a human label.

export const ACTION_CATALOG = {
  cleaning: [
    { id: 'dispatch_crew', label: 'Dispatch crew' },
    { id: 'request_supplies', label: 'Request supplies' },
    { id: 'flag_sla_breach', label: 'Flag SLA breach' },
    { id: 'log_nfc_event', label: 'Log NFC event' },
    { id: 'notify_host', label: 'Notify host' },
  ],
  hvac: [
    { id: 'adjust_setpoint', label: 'Adjust setpoint' },
    { id: 'queue_maintenance', label: 'Queue maintenance' },
    { id: 'flag_zone_drift', label: 'Flag zone drift' },
    { id: 'rollback_change', label: 'Rollback change' },
  ],
  space: [
    { id: 'release_booking', label: 'Release booking' },
    { id: 'notify_host', label: 'Notify host' },
    { id: 'suggest_consolidation', label: 'Suggest consolidation' },
  ],
  supply: [
    { id: 'place_order', label: 'Place order' },
    { id: 'flag_price_change', label: 'Flag price change' },
    { id: 'request_quote', label: 'Request quote' },
  ],
  compliance: [
    { id: 'queue_evidence', label: 'Queue evidence' },
    { id: 'flag_gap', label: 'Flag gap' },
    { id: 'notify_legal', label: 'Notify legal' },
    { id: 'lock_device', label: 'Lock device' },
  ],
  energy: [
    { id: 'propose_setback', label: 'Propose setback' },
    { id: 'flag_spike', label: 'Flag spike' },
    { id: 'request_audit', label: 'Request audit' },
  ],
  security: [
    { id: 'escalate_incident', label: 'Escalate incident' },
    { id: 'lock_zone', label: 'Lock zone' },
    { id: 'notify_on_shift', label: 'Notify on-shift' },
    { id: 'request_patrol', label: 'Request patrol' },
  ],
  parking: [
    { id: 'reroute_entry', label: 'Reroute entry traffic' },
    { id: 'page_maintenance', label: 'Page maintenance' },
    { id: 'notify_driver', label: 'Notify driver' },
    { id: 'flag_compliance_breach', label: 'Flag compliance breach' },
    { id: 'start_idle_fee', label: 'Start idle fee' },
  ],
  'predictive-maintenance': [
    { id: 'schedule_pm', label: 'Schedule PM window' },
    { id: 'dispatch_tech', label: 'Dispatch technician' },
    { id: 'replace_part', label: 'Replace part proactively' },
    { id: 'vendor_warranty', label: 'Escalate to vendor warranty' },
    { id: 'audit_log', label: 'Log to audit trail' },
  ],
  'asset-tracking': [
    { id: 'dispatch_locate', label: 'Dispatch staff to locate' },
    { id: 'notify_security', label: 'Notify security' },
    { id: 'inventory_audit', label: 'Trigger inventory audit' },
    { id: 'lock_asset_class', label: 'Lock asset class' },
    { id: 'audit_log', label: 'Log to audit trail' },
  ],
};

// When a step's autonomy is 'inherit', it uses the agent's global autonomy.
// Otherwise the step override wins.
export const STEP_AUTONOMY = [
  { id: 'inherit', label: 'Use agent default' },
  { id: 'propose', label: 'Propose only' },
  { id: 'auto', label: 'Auto-act' },
  { id: 'approve', label: 'Require approval' },
];

export const AUTONOMY_LEVELS = [
  { id: 'propose', label: 'Propose only', desc: 'Merlin suggests, humans decide.' },
  { id: 'auto-low-risk', label: 'Auto low-risk', desc: 'Auto-act on reversible low-risk items.' },
  { id: 'approve-critical', label: 'Approve critical', desc: 'Auto-act except critical — those wait for approval.' },
  { id: 'full-auto', label: 'Full autonomy', desc: 'Merlin acts on everything and logs it.' },
];

export const PERSONAS = [
  { id: 'professional', label: 'Professional', sample: 'I have reviewed the 4 incidents flagged this morning.' },
  { id: 'warm', label: 'Warm', sample: 'Morning — caught 4 things worth your attention today.' },
  { id: 'concise', label: 'Concise', sample: '4 incidents · 2 critical · 2 queued for approval.' },
  { id: 'enthusiastic', label: 'Enthusiastic', sample: 'Good news — we knocked out 4 issues before 8am!' },
];

export const PROACTIVE_PINGS = [
  { id: 'off', label: 'Off', desc: 'Merlin only responds when asked.' },
  { id: 'light', label: 'Light', desc: 'About 1 ping per hour for critical items.' },
  { id: 'normal', label: 'Normal', desc: 'Every 15–35 min during active hours.' },
  { id: 'busy', label: 'Busy', desc: 'Every 5 min — firehose mode, demos only.' },
];

export const MODELS = [
  { id: 'sonnet', label: 'Claude Sonnet 4.6', desc: 'Balanced. Default for production.' },
  { id: 'opus', label: 'Claude Opus 4.6', desc: 'Highest reasoning. Slower, costs ~5x.' },
  { id: 'haiku', label: 'Claude Haiku 4.5', desc: 'Fastest + cheapest. Good for classifiers.' },
];

export const DATA_SOURCE_STATUSES = [
  { id: 'connected', label: 'Connected', tone: 'ok' },
  { id: 'degraded', label: 'Degraded', tone: 'warn' },
  { id: 'disconnected', label: 'Disconnected', tone: 'risk' },
  { id: 'pending', label: 'Pending', tone: 'info' },
];

export const DATA_SOURCE_DEFAULTS = {
  voc_sensors: {
    id: 'voc_sensors',
    name: 'VOC sensors',
    kind: 'sensor',
    protocol: 'lte_m',
    scope: 'all',
    status: 'connected',
    description: 'Air quality sensors in restrooms, kitchens, conference rooms.',
    origin: 'adaptiv',
  },
  co2_sensors: {
    id: 'co2_sensors',
    name: 'CO\u2082 sensors',
    kind: 'sensor',
    protocol: 'lte_m',
    scope: 'all',
    status: 'connected',
    description: 'Rollup of zone CO\u2082 readings.',
    origin: 'adaptiv',
  },
  zone_temp: {
    id: 'zone_temp',
    name: 'Zone temperature',
    kind: 'sensor',
    protocol: 'bacnet',
    scope: 'hq',
    status: 'connected',
    description: 'HVAC zone thermostats via BACnet.',
    origin: 'third_party',
  },
  occupancy: {
    id: 'occupancy',
    name: 'Occupancy',
    kind: 'sensor',
    protocol: 'ble',
    scope: 'all',
    status: 'connected',
    description: 'PIR + mmWave rollup per room.',
    origin: 'adaptiv',
  },
  nfc_tap_log: {
    id: 'nfc_tap_log',
    name: 'NFC tap log',
    kind: 'api',
    protocol: 'rest',
    scope: 'all',
    status: 'connected',
    description: 'Cleaner NFC check-in / check-out events.',
    origin: 'adaptiv',
  },
  badge_events: {
    id: 'badge_events',
    name: 'Badge events',
    kind: 'api',
    protocol: 'webhook',
    scope: 'hq',
    status: 'connected',
    description: 'Access control swipes and denies.',
    origin: 'third_party',
  },
  cameras: {
    id: 'cameras',
    name: 'Cameras',
    kind: 'device_class',
    protocol: 'rtsp',
    scope: 'hq',
    status: 'connected',
    description: 'Door, lobby, garage, loading dock.',
    origin: 'third_party',
  },
  door_contacts: {
    id: 'door_contacts',
    name: 'Door contacts',
    kind: 'sensor',
    protocol: 'ble',
    scope: 'hq',
    status: 'connected',
    description: 'Magnetic door state sensors.',
    origin: 'adaptiv',
  },
  bacnet_setpoints: {
    id: 'bacnet_setpoints',
    name: 'BACnet setpoints',
    kind: 'device_class',
    protocol: 'bacnet',
    scope: 'hq',
    status: 'connected',
    description: 'Writable HVAC setpoints per zone.',
    origin: 'third_party',
  },
  smart_displays: {
    id: 'smart_displays',
    name: 'Smart displays',
    kind: 'device_class',
    protocol: 'lte_m',
    scope: 'imf',
    status: 'connected',
    description: 'SDG e-ink displays across the IMF campus.',
    origin: 'adaptiv',
  },
  people_counters: {
    id: 'people_counters',
    name: 'People counters',
    kind: 'device_class',
    protocol: 'lte_m',
    scope: 'imf',
    status: 'connected',
    description: 'PIR + mmWave counters at IMF entrances.',
    origin: 'adaptiv',
  },
  room_calendar: {
    id: 'room_calendar',
    name: 'Room calendar',
    kind: 'api',
    protocol: 'rest',
    scope: 'all',
    status: 'connected',
    description: 'MS Graph / Google Calendar for meeting rooms.',
    origin: 'third_party',
  },
  utility_meter: {
    id: 'utility_meter',
    name: 'Utility meter',
    kind: 'api',
    protocol: 'rest',
    scope: 'hq',
    status: 'connected',
    description: 'Real-time kWh pull from the utility.',
    origin: 'third_party',
  },
  weather_api: {
    id: 'weather_api',
    name: 'Weather API',
    kind: 'api',
    protocol: 'rest',
    scope: 'all',
    status: 'connected',
    description: 'Hourly forecast + historical normals.',
    origin: 'third_party',
  },
  inventory_levels: {
    id: 'inventory_levels',
    name: 'Inventory levels',
    kind: 'internal',
    protocol: 'internal',
    scope: 'all',
    status: 'connected',
    description: 'Stock counts per supply closet.',
    origin: 'adaptiv',
  },
  supplier_api: {
    id: 'supplier_api',
    name: 'Supplier API',
    kind: 'api',
    protocol: 'rest',
    scope: 'all',
    status: 'degraded',
    description: 'Pricing + lead time from Grainger and Cintas.',
    origin: 'third_party',
  },
  work_orders: {
    id: 'work_orders',
    name: 'Work orders',
    kind: 'ticketing',
    protocol: 'rest',
    scope: 'all',
    status: 'connected',
    description: 'Facility work ticket system.',
    origin: 'third_party',
  },
  audit_log: {
    id: 'audit_log',
    name: 'Audit log',
    kind: 'internal',
    protocol: 'internal',
    scope: 'all',
    status: 'connected',
    description: 'Append-only activity log for compliance.',
    origin: 'adaptiv',
  },
  device_fleet: {
    id: 'device_fleet',
    name: 'Device fleet',
    kind: 'internal',
    protocol: 'internal',
    scope: 'all',
    status: 'connected',
    description: 'All registered Adaptiv devices.',
    origin: 'adaptiv',
  },
  certs: {
    id: 'certs',
    name: 'Certificates',
    kind: 'api',
    protocol: 'rest',
    scope: 'all',
    status: 'pending',
    description: 'Firmware signing + device certs.',
    origin: 'third_party',
  },
  // ─── Parking (Phase 1 — registered as data sources for the agent
  // config; live status flips to 'connected' in Phase 3 when the
  // simulator profile + first sensor seed land) ───
  parking_spot_sensors: {
    id: 'parking_spot_sensors',
    name: 'Parking spot sensors',
    kind: 'device_class',
    protocol: 'ble',
    scope: 'hq',
    status: 'pending',
    description: 'Per-spot magnetometer pucks across the underground deck.',
    origin: 'adaptiv',
  },
  ev_chargers: {
    id: 'ev_chargers',
    name: 'EV chargers',
    kind: 'device_class',
    protocol: 'mqtt',
    scope: 'hq',
    status: 'pending',
    description: 'OCPP-compatible AC + DC fast chargers; session + fault state.',
    origin: 'third_party',
  },
  anpr_cameras: {
    id: 'anpr_cameras',
    name: 'ANPR cameras',
    kind: 'device_class',
    protocol: 'rtsp',
    scope: 'hq',
    status: 'pending',
    description: 'License-plate recognition at deck entry/exit + EV stalls.',
    origin: 'third_party',
  },
  // ─── Smart Asset Tracker (cross-vertical). Adaptiv-manufactured
  // multi-radio tracker (5G/LTE + GPS + Wi-Fi + Bluetooth) — used by
  // the asset-tracking agent in hospitals, warehouses, airports, and
  // office campuses. Status starts 'pending' until at least one
  // tracker is wired to the workspace.
  asset_trackers: {
    id: 'asset_trackers',
    name: 'Smart Asset Trackers',
    kind: 'device_class',
    protocol: 'lte_m',
    scope: 'all',
    status: 'pending',
    description: 'Adaptiv multi-radio asset trackers — 5G/LTE + GPS + Wi-Fi + Bluetooth fused position.',
    origin: 'adaptiv',
  },
};

// Resolve a reference (id or legacy free-text name) to a source record.
// Falls back to a synthetic "pending" stub so rendering never crashes.
export function resolveDataSource(config, ref) {
  if (!ref) return null;
  const byId = config.dataSources?.[ref];
  if (byId) return byId;
  const byName = Object.values(config.dataSources || {}).find((s) => s.name === ref);
  if (byName) return byName;
  return {
    id: ref,
    name: ref,
    kind: 'internal',
    protocol: 'internal',
    scope: 'all',
    status: 'pending',
    description: 'Unregistered source (legacy reference).',
  };
}

// ─────────────────────── permissions matrix ───────────────────────
// Rows = roles, cols = agent ids. Values: 'none' | 'view' | 'invoke' | 'admin'.

export const PERMISSIONS_DEFAULTS = {
  superadmin: {
    cleaning: 'admin',
    hvac: 'admin',
    space: 'admin',
    supply: 'admin',
    compliance: 'admin',
    energy: 'admin',
    security: 'admin',
    parking: 'admin',
    'predictive-maintenance': 'admin',
    'asset-tracking': 'admin',
  },
  facility: {
    cleaning: 'invoke',
    hvac: 'invoke',
    space: 'invoke',
    supply: 'invoke',
    compliance: 'invoke',
    energy: 'invoke',
    security: 'invoke',
    parking: 'invoke',
    'predictive-maintenance': 'invoke',
    'asset-tracking': 'invoke',
  },
  cleaning: {
    cleaning: 'invoke',
    hvac: 'view',
    space: 'view',
    supply: 'invoke',
    compliance: 'view',
    energy: 'none',
    security: 'none',
    parking: 'none',
    'predictive-maintenance': 'none',
    'asset-tracking': 'view',
  },
  maintenance: {
    cleaning: 'view',
    hvac: 'invoke',
    space: 'view',
    supply: 'view',
    compliance: 'view',
    energy: 'invoke',
    security: 'none',
    parking: 'invoke',
    'predictive-maintenance': 'invoke',
    'asset-tracking': 'view',
  },
  security: {
    cleaning: 'none',
    hvac: 'none',
    space: 'view',
    supply: 'none',
    compliance: 'view',
    energy: 'none',
    security: 'invoke',
    parking: 'view',
    'predictive-maintenance': 'view',
    'asset-tracking': 'invoke',
  },
};

export const PERMISSION_LEVELS = [
  { id: 'none', label: '\u2014', tone: 'off' },
  { id: 'view', label: 'View', tone: 'info' },
  { id: 'invoke', label: 'Invoke', tone: 'accent' },
  { id: 'admin', label: 'Admin', tone: 'ok' },
];

// ─────────────────────── audit log (mock) ───────────────────────

export const RECENT_AGENT_ACTIONS = [
  {
    id: 'a-001',
    ts: '2026-04-21T08:42:00',
    agent: 'cleaning',
    action: 'Dispatched Priya to Fl 18 W restroom',
    confidence: 92,
    outcome: 'auto',
    priority: 'high',
  },
  {
    id: 'a-002',
    ts: '2026-04-21T08:38:00',
    agent: 'hvac',
    action: 'Pushed +0.5°C to Zone 32-E',
    confidence: 88,
    outcome: 'auto',
    priority: 'medium',
  },
  {
    id: 'a-003',
    ts: '2026-04-21T08:21:00',
    agent: 'compliance',
    action: 'Flagged SDG00296 firmware holdout',
    confidence: 96,
    outcome: 'proposed',
    priority: 'high',
  },
  {
    id: 'a-004',
    ts: '2026-04-21T08:14:00',
    agent: 'space',
    action: 'Released ghost booking Conf Sycamore',
    confidence: 94,
    outcome: 'auto',
    priority: 'low',
  },
  {
    id: 'a-005',
    ts: '2026-04-21T07:58:00',
    agent: 'security',
    action: 'Flagged Loading Dock B held open 14m',
    confidence: 91,
    outcome: 'approved',
    priority: 'high',
  },
  {
    id: 'a-006',
    ts: '2026-04-21T07:42:00',
    agent: 'supply',
    action: 'Queued reorder: paper towels (Fl 24)',
    confidence: 84,
    outcome: 'approved',
    priority: 'medium',
  },
  {
    id: 'a-007',
    ts: '2026-04-21T07:31:00',
    agent: 'energy',
    action: 'Proposed weekend setback schedule',
    confidence: 79,
    outcome: 'proposed',
    priority: 'medium',
  },
  {
    id: 'a-008',
    ts: '2026-04-21T07:20:00',
    agent: 'cleaning',
    action: 'NFC trail reconciled · Fl 12 pantry',
    confidence: 98,
    outcome: 'auto',
    priority: 'low',
  },
  {
    id: 'a-009',
    ts: '2026-04-21T06:52:00',
    agent: 'hvac',
    action: 'Rolled back setpoint change — sensor drift',
    confidence: 72,
    outcome: 'rollback',
    priority: 'medium',
  },
  {
    id: 'a-010',
    ts: '2026-04-20T23:14:00',
    agent: 'security',
    action: 'Cross-checked after-hours badge · K. Okafor',
    confidence: 95,
    outcome: 'auto',
    priority: 'medium',
  },
];

// ─────────────────────── persistence ───────────────────────

function mergeConfig(raw) {
  return {
    merlin: { ...MERLIN_DEFAULTS, ...(raw.merlin || {}) },
    agents: mergeAgents(raw.agents || {}),
    dataSources: mergeSources(raw.dataSources || {}),
    permissions: mergePermissions(raw.permissions || {}),
    tickSettings: mergeTickSettings(raw.tickSettings || {}),
    seedSettings: mergeSeedSettings(raw.seedSettings || {}),
    deviceSeedSettings: mergeDeviceSeedSettings(raw.deviceSeedSettings || {}),
  };
}

// Overlay a building's sparse override on top of the org-default config.
// `org` is the full mergeConfig() result; `overlay` is the per-building
// store entry, e.g. { merlin?: partial, agents?: partial }. Building
// values shadow org values per-key (or per-agent for the agents section).
function applyBuildingOverlay(org, overlay) {
  if (!overlay) return org;
  return {
    ...org,
    merlin: { ...org.merlin, ...(overlay.merlin || {}) },
    agents: { ...org.agents, ...(overlay.agents || {}) },
    // dataSources / permissions / tickSettings / seedSettings /
    // deviceSeedSettings stay org-only by design (and by the CHECK
    // constraint on merlin_config.location_id from migration 138).
  };
}

// Shallow per-key diff for the 'merlin' section. Returns the keys
// where `next` differs from `base` — used to write a sparse override
// row at the building level. If the returned object is empty, the
// building row should be deleted (caller's responsibility).
function shallowDiff(next, base) {
  const out = {};
  for (const k of Object.keys(next || {})) {
    if (!deepEqual(next[k], (base || {})[k])) out[k] = next[k];
  }
  return out;
}

// Per-agent diff for the 'agents' section. Each agent is the unit of
// override — if `next.cleaning` differs from `base.cleaning` in any
// way, the entire `cleaning` config goes into the override. Cheap to
// reason about; small overhead since a building usually overrides a
// handful of agents, not all 9.
function perAgentDiff(nextAgents, baseAgents) {
  const out = {};
  for (const agentId of Object.keys(nextAgents || {})) {
    if (!deepEqual(nextAgents[agentId], (baseAgents || {})[agentId])) {
      out[agentId] = nextAgents[agentId];
    }
  }
  return out;
}

// Cheap recursive equality. Handles JSON-shaped objects (the only
// values we ever stash in merlin_config). Avoids pulling lodash for
// one function.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

function mergeTickSettings(saved) {
  const freq = saved.frequency_min;
  const isValid = Number.isInteger(freq) && TICK_FREQUENCY_OPTIONS.some((o) => o.value === freq);
  return {
    ...TICK_SETTINGS_DEFAULTS,
    ...(isValid ? { frequency_min: freq } : {}),
  };
}

function mergeSeedSettings(saved) {
  const freq = saved.frequency_min;
  const isValid = Number.isInteger(freq) && SEED_FREQUENCY_OPTIONS.some((o) => o.value === freq);
  return {
    ...SEED_SETTINGS_DEFAULTS,
    ...(isValid ? { frequency_min: freq } : {}),
  };
}

function mergeDeviceSeedSettings(saved) {
  const freq = saved.frequency_min;
  const freqValid = Number.isInteger(freq) && DEVICE_SEED_FREQUENCY_OPTIONS.some((o) => o.value === freq);
  // profile_ids: null → all enabled. Array → filter to known profile IDs.
  const known = new Set(DEVICE_PROFILE_CATALOG.map((p) => p.id));
  let profileIds = DEVICE_SEED_SETTINGS_DEFAULTS.profile_ids;
  if (Array.isArray(saved.profile_ids)) {
    profileIds = saved.profile_ids.filter((id) => known.has(id));
  }
  return {
    ...DEVICE_SEED_SETTINGS_DEFAULTS,
    ...(freqValid ? { frequency_min: freq } : {}),
    profile_ids: profileIds,
  };
}

export function loadAgenticConfig(buildingId = null) {
  if (typeof window === 'undefined') return mergeConfig({});
  // Fire-and-forget hydration so every caller, not just useAgenticConfig,
  // kicks off the Postgres fetch on first use. Subsequent calls are
  // no-ops because hydrateOnce is idempotent.
  hydrateOnce();
  // Org-default cache lives in localStorage so the UI renders before
  // the network round-trip; the per-building overlay is read from the
  // in-memory cache (small, sparse, refreshed each hydrate).
  let orgConfig;
  try {
    const orgId = getSession()?.organizationId || null;
    const raw = JSON.parse(localStorage.getItem(storageKeyFor(orgId)) || '{}');
    orgConfig = mergeConfig(raw);
  } catch {
    orgConfig = mergeConfig({});
  }
  if (!buildingId) return orgConfig;
  return applyBuildingOverlay(orgConfig, buildingOverlays.get(buildingId));
}

// ────── Postgres hydration (one-way: DB → cache + listeners)

let hydrated = false;
let hydratingPromise = null;
// In-memory per-building override cache. Map<buildingId, { merlin?, agents? }>
// Sparse — only sections / agents the building has actually overridden.
let buildingOverlays = new Map();

async function hydrateOnce() {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    // CRITICAL: filter by the active org id explicitly. The merlin_config
    // RLS read policy is `(organization_id = current_user_org()) OR
    // is_platform_admin()` — for platform admins (jb@adaptiv.systems),
    // that returns EVERY org's rows. Without an explicit filter the
    // section-keyed projection below collapses cross-org rows and the
    // last one wins (typically SparkleCo's 3-agent config clobbering
    // Meridian's 7-agent config). JB caught this 2026-05-09.
    //
    // Bail out (and DON'T set hydrated=true) when orgId is missing so
    // a later mount with a ready session can re-trigger the hydrate.
    const orgId = getSession()?.organizationId || null;
    if (!orgId) {
      hydratingPromise = null;
      return;
    }
    const { data, error } = await supabase
      .from('merlin_config')
      .select('section, value, location_id')
      .eq('organization_id', orgId);
    hydrated = true;
    hydratingPromise = null;
    if (error) captureException(error, { where: 'hydrateOnce' });
    if (error || !data) return;
    // Split rows: org-default (location_id IS NULL) vs per-building
    // overrides (location_id IS NOT NULL). The latter are only allowed
    // for 'merlin' and 'agents' sections per the migration 138 CHECK
    // constraint, but we don't trust the DB to enforce that here —
    // filter defensively.
    const orgRows = data.filter((r) => r.location_id === null);
    const buildingRows = data.filter((r) => r.location_id !== null && PER_BUILDING_SECTIONS.includes(r.section));
    const byId = Object.fromEntries(orgRows.map((r) => [r.section, r.value]));
    const orgConfig = mergeConfig({
      merlin: byId.merlin,
      agents: byId.agents,
      dataSources: byId.data_sources,
      permissions: byId.permissions,
      tickSettings: byId.tick_settings,
      seedSettings: byId.seed_settings,
      deviceSeedSettings: byId.device_seed_settings,
    });
    try {
      localStorage.setItem(storageKeyFor(orgId), JSON.stringify(orgConfig));
    } catch {}

    // Build the per-building overlay cache from scratch. Sections map
    // 1:1 to keys: 'merlin' → overlay.merlin; 'agents' → overlay.agents.
    buildingOverlays = new Map();
    for (const r of buildingRows) {
      if (!buildingOverlays.has(r.location_id)) buildingOverlays.set(r.location_id, {});
      buildingOverlays.get(r.location_id)[r.section] = r.value;
    }

    // Notify all listeners — each one re-resolves against its own
    // buildingId via the listener payload (callers stash buildingId
    // when they subscribe).
    notifyListeners();
  })();
  return hydratingPromise;
}

// Reset the hydrate-once latch and force a fresh DB read. Called on
// auth-state changes so Lisa-after-JB doesn't read JB's cached config.
// Per-tab module state used to stay sticky across sign-in/out, which
// meant the localStorage cache from a previous user shadowed the
// current user's RLS-narrowed view. JB caught this 2026-05-06.
function resetHydrate() {
  hydrated = false;
  hydratingPromise = null;
  buildingOverlays = new Map();
}

// Subscribe to Supabase auth events. Different `event` types arrive
// in different orders depending on whether the user explicitly logs
// in/out vs. the session was restored from storage; we re-key on
// the user id so we only invalidate when the actual identity flips.
if (typeof window !== 'undefined') {
  let lastUserId = null;
  supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id || null;
    if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !userId)) {
      // Drop ALL per-org caches so the next sign-in starts clean.
      try {
        const prefix = `${LEGACY_STORAGE_KEY}:`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k === LEGACY_STORAGE_KEY || (k && k.startsWith(prefix))) {
            localStorage.removeItem(k);
          }
        }
      } catch {}
      resetHydrate();
      // Emit seed defaults so any subscribed component clears its
      // current-user state immediately, not when hydrate finishes.
      notifyListeners();
      lastUserId = null;
      return;
    }
    if (userId && userId !== lastUserId) {
      // SIGNED_IN, USER_UPDATED, or first restored TOKEN_REFRESHED with
      // a new identity. Force fresh hydrate; localStorage gets
      // overwritten with the right-org values when it lands.
      resetHydrate();
      hydrateOnce();
      lastUserId = userId;
    }
  });
}

function mergeSources(saved) {
  const out = {};
  // Seed defaults first, then overlay saved values on matching ids.
  for (const id of Object.keys(DATA_SOURCE_DEFAULTS)) {
    out[id] = { ...DATA_SOURCE_DEFAULTS[id], ...(saved[id] || {}) };
  }
  // Include user-created sources not in defaults.
  for (const id of Object.keys(saved)) {
    if (!out[id]) out[id] = saved[id];
  }
  return out;
}

function mergeAgents(saved) {
  const out = {};
  for (const id of Object.keys(AGENT_DEFAULTS)) {
    const def = AGENT_DEFAULTS[id];
    const s = saved[id] || {};
    out[id] = {
      ...def,
      ...s,
      playbook: {
        steps: s.playbook?.steps ?? def.playbook.steps,
        responses: { ...def.playbook.responses, ...(s.playbook?.responses || {}) },
        guardrails: { ...def.playbook.guardrails, ...(s.playbook?.guardrails || {}) },
      },
    };
  }
  return out;
}

function mergePermissions(saved) {
  const out = {};
  for (const role of Object.keys(PERMISSIONS_DEFAULTS)) {
    out[role] = { ...PERMISSIONS_DEFAULTS[role], ...(saved[role] || {}) };
  }
  return out;
}

// Listener Set — each entry is a (re-resolve, buildingId) tuple wrapped
// in one closure. We don't pre-compute the config blob and broadcast
// it; we just signal listeners to re-resolve themselves, since each
// listener is scoped to its own building.
const LISTENERS = new Set();
function notifyListeners() {
  LISTENERS.forEach((fn) => {
    try {
      fn();
    } catch {
      /* don't let one listener kill the others */
    }
  });
}

// Read the current org-default cache from localStorage. Used by the
// write path to compute building-row diffs without re-running the
// full mergeConfig defaults.
function readOrgCache() {
  if (typeof window === 'undefined') return mergeConfig({});
  try {
    const orgId = getSession()?.organizationId || null;
    const raw = JSON.parse(localStorage.getItem(storageKeyFor(orgId)) || '{}');
    return mergeConfig(raw);
  } catch {
    return mergeConfig({});
  }
}

// Persist a config change. Routes per-section: 'merlin' and 'agents'
// at a building scope save as sparse building rows; everything else
// saves to org-default. Cost-sensitive sections (tick/seed/device_seed)
// still require Merlin Owner — enforced server-side by migration 137's
// is_owner_only_config_section check inside set_merlin_config.
//
// `buildingId` may be null/undefined — in that case, all writes go to
// org-default rows (admin editing the org-wide defaults directly).
export async function persistAgenticConfig(next, buildingId = null) {
  if (typeof window === 'undefined') return;

  const orgId = getSession()?.organizationId || null;
  if (!orgId) return;

  const orgCache = readOrgCache();

  // Optimistic UI update — push the merged next-state into localStorage
  // and notify listeners. If the DB write fails we roll back.
  const prevOrgCache = orgCache;
  const prevBuildingOverlays = new Map(buildingOverlays);

  // ── Compute target writes per section ──────────────────────────────
  // Each entry is `{ section, locationId, value }` or
  // `{ delete: true, section, locationId }`.
  const writes = [];

  // Per-building sections: diff against org cache when buildingId is set.
  for (const section of PER_BUILDING_SECTIONS) {
    const nextValue = section === 'merlin' ? next.merlin : next.agents;
    const baseValue = section === 'merlin' ? orgCache.merlin : orgCache.agents;

    if (buildingId) {
      const delta = section === 'merlin' ? shallowDiff(nextValue, baseValue) : perAgentDiff(nextValue, baseValue);
      const hasDelta = Object.keys(delta).length > 0;
      if (hasDelta) {
        writes.push({ section, locationId: buildingId, value: delta });
      } else {
        // No diff — collapse to "no override" by deleting the building row
        // (if one exists). Idempotent if it doesn't.
        writes.push({ delete: true, section, locationId: buildingId });
      }
    } else {
      // No building scope — write the full section as org default.
      writes.push({ section, locationId: null, value: nextValue || {} });
    }
  }

  // Org-only sections: always written to org-default rows. Cost-sensitive
  // sections (tick/seed/device_seed) are Owner-only at the RPC layer.
  writes.push({ section: 'data_sources', locationId: null, value: next.dataSources || {} });
  writes.push({ section: 'permissions', locationId: null, value: next.permissions || {} });
  writes.push({ section: 'tick_settings', locationId: null, value: next.tickSettings || {} });
  writes.push({ section: 'seed_settings', locationId: null, value: next.seedSettings || {} });
  writes.push({ section: 'device_seed_settings', locationId: null, value: next.deviceSeedSettings || {} });

  // Apply optimistic update to our caches before firing the RPCs.
  if (buildingId) {
    const overlay = { ...(buildingOverlays.get(buildingId) || {}) };
    for (const w of writes) {
      if (w.locationId !== buildingId) continue;
      if (w.delete) delete overlay[w.section];
      else overlay[w.section] = w.value;
    }
    if (Object.keys(overlay).length === 0) buildingOverlays.delete(buildingId);
    else buildingOverlays.set(buildingId, overlay);
  }
  // Org-default localStorage cache: store the writes whose target is org
  // (locationId === null) into the cached org config.
  const orgWrites = writes.filter((w) => w.locationId === null && !w.delete);
  if (orgWrites.length > 0) {
    const orgNext = { ...orgCache };
    for (const w of orgWrites) {
      switch (w.section) {
        case 'merlin':
          orgNext.merlin = next.merlin;
          break;
        case 'agents':
          orgNext.agents = next.agents;
          break;
        case 'data_sources':
          orgNext.dataSources = next.dataSources;
          break;
        case 'permissions':
          orgNext.permissions = next.permissions;
          break;
        case 'tick_settings':
          orgNext.tickSettings = next.tickSettings;
          break;
        case 'seed_settings':
          orgNext.seedSettings = next.seedSettings;
          break;
        case 'device_seed_settings':
          orgNext.deviceSeedSettings = next.deviceSeedSettings;
          break;
      }
    }
    try {
      localStorage.setItem(storageKeyFor(orgId), JSON.stringify(orgNext));
    } catch {}
  }
  notifyListeners();

  // ── Fire the RPCs sequentially. Bail on first failure and roll back. ─
  try {
    for (const w of writes) {
      if (w.delete) {
        const { error } = await supabase.rpc('delete_merlin_config', {
          p_org_id: orgId,
          p_location_id: w.locationId,
          p_section: w.section,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc('set_merlin_config', {
          p_org_id: orgId,
          p_location_id: w.locationId,
          p_section: w.section,
          p_value: w.value,
        });
        if (error) throw new Error(error.message);
      }
    }
  } catch (e) {
    // Roll back optimistic state.
    try {
      localStorage.setItem(storageKeyFor(orgId), JSON.stringify(prevOrgCache));
    } catch {}
    buildingOverlays = prevBuildingOverlays;
    notifyListeners();
    throw e;
  }
}

// Reset config. When `buildingId` is set, only the per-building rows
// for that building are deleted — org defaults stay. When null, the
// whole org's config is wiped (back to seed defaults).
export async function resetAgenticConfig(buildingId = null) {
  if (typeof window === 'undefined') return;
  const orgId = getSession()?.organizationId || null;
  if (!orgId) return;

  if (buildingId) {
    // Per-building reset: delete just this building's rows for
    // 'merlin' and 'agents'. Org defaults stay intact; the next
    // render shows org values everywhere on this building.
    for (const section of PER_BUILDING_SECTIONS) {
      const { error } = await supabase.rpc('delete_merlin_config', {
        p_org_id: orgId,
        p_location_id: buildingId,
        p_section: section,
      });
      if (error) throw new Error(error.message);
    }
    buildingOverlays.delete(buildingId);
    notifyListeners();
    return;
  }

  // Org-wide reset: wipe THIS org's cache (other orgs' keys stay).
  try {
    localStorage.removeItem(storageKeyFor(orgId));
  } catch {}
  // Build-overlay rows cascade with org rows? No — they're not linked
  // by FK. Drop them explicitly via the RPC for each (building, section).
  for (const [bId, overlay] of buildingOverlays.entries()) {
    for (const section of Object.keys(overlay)) {
      try {
        await supabase.rpc('delete_merlin_config', {
          p_org_id: orgId,
          p_location_id: bId,
          p_section: section,
        });
      } catch (e) {
        captureException(e, { where: 'resetAgenticConfig' }); /* fall through; org-row delete below is the main goal */
      }
    }
  }
  buildingOverlays = new Map();

  // Drop the org-default rows. Direct DELETE is fine here because the
  // org-row write RLS path covers admins + platform admins. For
  // cost-sensitive sections (tick/seed/device_seed) RLS will reject if
  // the caller isn't Merlin Owner — surface the error.
  let q = supabase.from('merlin_config').delete().in('section', SECTIONS).is('location_id', null);
  q = q.eq('organization_id', orgId);
  const { error } = await q;
  if (error) throw new Error(error.message);

  notifyListeners();
}

// Reset one agent's per-building override. The 'agents' building row
// is a map of agentId → agentConfig — to reset one entry we either
// drop that key and re-write the rest, or delete the row entirely if
// nothing remains.
async function resetAgent(buildingId, agentId) {
  if (!buildingId || !agentId) return;
  const orgId = getSession()?.organizationId || null;
  if (!orgId) return;
  const overlay = buildingOverlays.get(buildingId);
  const currentAgents = overlay?.agents;
  if (!currentAgents || !currentAgents[agentId]) return;

  const next = { ...currentAgents };
  delete next[agentId];

  if (Object.keys(next).length === 0) {
    // No agents left in the override — delete the building row.
    const { error } = await supabase.rpc('delete_merlin_config', {
      p_org_id: orgId,
      p_location_id: buildingId,
      p_section: 'agents',
    });
    if (error) throw new Error(error.message);
    delete overlay.agents;
    if (Object.keys(overlay).length === 0) buildingOverlays.delete(buildingId);
  } else {
    // Rewrite the building row with the remaining agent overrides.
    const { error } = await supabase.rpc('set_merlin_config', {
      p_org_id: orgId,
      p_location_id: buildingId,
      p_section: 'agents',
      p_value: next,
    });
    if (error) throw new Error(error.message);
    overlay.agents = next;
  }
  notifyListeners();
}

// Reset just one section's per-building overlay. Used by the per-section
// "Reset to org default" buttons on the Merlin and Agents tabs. After the
// RPC succeeds, the listener pump re-resolves all consumers.
async function resetSection(buildingId, section) {
  if (!buildingId) return;
  const orgId = getSession()?.organizationId || null;
  if (!orgId) return;
  const { error } = await supabase.rpc('delete_merlin_config', {
    p_org_id: orgId,
    p_location_id: buildingId,
    p_section: section,
  });
  if (error) throw new Error(error.message);
  const overlay = buildingOverlays.get(buildingId);
  if (overlay) {
    delete overlay[section];
    if (Object.keys(overlay).length === 0) buildingOverlays.delete(buildingId);
  }
  notifyListeners();
}

// Hook — accepts an optional buildingId so each consumer can scope
// itself to the building the user is currently viewing. Building
// changes re-resolve from the cached overlay map without re-fetching.
//
// Returns `[config, commit, ctx]`:
//   config         — merged config (org defaults + building overlay)
//   commit(next)   — write the new state; routes per-section via RPC
//   ctx.orgDefaults    — the org-default config alone (no overlay).
//                        Used by the UI to detect per-control overrides.
//   ctx.buildingOverlay — the sparse override stash for THIS building
//                        ({ merlin?, agents? } or null).
//   ctx.hasOverride(section) — true iff the building has any keys
//                              overridden for that section.
//   ctx.resetSection(section) — async; deletes just that section's
//                               per-building row. Used by the per-tab
//                               "Reset to org default" button.
export function useAgenticConfig(buildingId = null) {
  const [config, setConfig] = useState(() => loadAgenticConfig(buildingId));
  // orgDefaults is the pre-overlay config — used by the UI to show
  // "(building override)" badges and to wire the per-section reset
  // button visibility.
  const [orgDefaults, setOrgDefaults] = useState(() => loadAgenticConfig(null));
  useEffect(() => {
    const onUpdate = () => {
      setConfig(loadAgenticConfig(buildingId));
      setOrgDefaults(loadAgenticConfig(null));
    };
    LISTENERS.add(onUpdate);
    hydrateOnce();
    // Re-resolve immediately for the (possibly new) buildingId.
    setConfig(loadAgenticConfig(buildingId));
    setOrgDefaults(loadAgenticConfig(null));
    return () => LISTENERS.delete(onUpdate);
  }, [buildingId]);
  const commit = (next) => {
    // Optimistic sync update; the async write may reject (non-admin, RLS)
    // in which case persistAgenticConfig itself rolls us back.
    setConfig(next);
    persistAgenticConfig(next, buildingId).catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[agentic-config] save failed:', e.message);
    });
  };

  const buildingOverlay = buildingId ? buildingOverlays.get(buildingId) || null : null;
  const ctx = {
    orgDefaults,
    buildingOverlay,
    hasOverride: (section) => {
      if (!buildingId || !buildingOverlay) return false;
      const v = buildingOverlay[section];
      return !!v && Object.keys(v).length > 0;
    },
    resetSection: (section) => resetSection(buildingId, section),
    resetAgent: (agentId) => resetAgent(buildingId, agentId),
  };
  return [config, commit, ctx];
}

// Agent display order should mirror the Agent bar ordering.
export const AGENT_ORDER = AGENTS.map((a) => a.id);

// ─────────────────────── Agent categories (2026-05-17) ───────────────────────
// Group agents by deployment behavior. Three buckets that scale with the
// catalog as we add more:
//
//   general   — universal building-ops agents. Every workspace gets them;
//               they all produce work day-one in any real_estate org.
//   industry  — vertical-specific. Only produce work when an org has the
//               matching signals (cold-storage zones, pharmacy probes,
//               parking decks). Silent skip on every tick in orgs that
//               don't have that vertical.
//   specialized — cross-vertical, signal-specific. Run everywhere but
//                 only fire on their dedicated data class (fault trends,
//                 asset-tracker fixes). Hidden until those signals appear.
//
// Drift safety: any agent in AGENT_ORDER not assigned to a category falls
// through to a synthetic 'uncategorized' bucket in the UI so new agents
// don't silently disappear from the page.
export const AGENT_CATEGORIES = [
  {
    id: 'general',
    labelKey: 'agentic.cat.general.label',
    descKey: 'agentic.cat.general.desc',
    icon: 'sparkle',
    agents: ['cleaning', 'hvac', 'space', 'supply', 'compliance', 'energy', 'security', 'servicing'],
  },
  {
    id: 'industry',
    labelKey: 'agentic.cat.industry.label',
    descKey: 'agentic.cat.industry.desc',
    icon: 'building',
    agents: ['cold-chain', 'pharmacy-temp', 'parking', 'biosecurity'],
  },
  {
    id: 'specialized',
    labelKey: 'agentic.cat.specialized.label',
    descKey: 'agentic.cat.specialized.desc',
    icon: 'beacon',
    agents: ['predictive-maintenance', 'asset-tracking'],
  },
];

// Reverse-lookup for one-shot category resolution per agent. Useful for
// places that have an agent id and need to know which bucket it sits in.
export const AGENT_CATEGORY_BY_ID = (() => {
  const out = {};
  for (const cat of AGENT_CATEGORIES) {
    for (const id of cat.agents) out[id] = cat.id;
  }
  return out;
})();

// ── Two-bucket presentation grouping (2026-06-04) ───────────────────────────
// JB asked the agent surfaces (MONITOR/AI Agents + Admin/Agents) to read as
// just two groups: General vs Specialized. We keep the richer 3-category model
// above — it encodes real deployment behavior + the drift safety net — and
// DERIVE the two presentation buckets from it so there's still one source of
// truth. 'general' stays General; 'industry' + 'specialized' fold into
// Specialized; anything uncategorized also falls into Specialized so a new
// agent never silently disappears (the drift warning below still fires).
const CATEGORY_TO_GROUP = { general: 'general', industry: 'specialized', specialized: 'specialized' };

export const AGENT_GROUPS = [
  { id: 'general', labelKey: 'agentic.cat.general.label', descKey: 'agentic.cat.general.desc', icon: 'sparkle' },
  {
    id: 'specialized',
    labelKey: 'agentic.cat.specialized.label',
    descKey: 'agentic.cat.specialized.desc',
    icon: 'beacon',
  },
];

// agent id → presentation group id ('general' | 'specialized').
export const AGENT_GROUP_BY_ID = (() => {
  const out = {};
  for (const id of AGENT_ORDER) {
    const cat = AGENT_CATEGORY_BY_ID[id];
    out[id] = (cat && CATEGORY_TO_GROUP[cat]) || 'specialized';
  }
  return out;
})();

// Ordered agent ids in a presentation group (preserves AGENT_ORDER). Pass an
// optional predicate to additionally filter (e.g. building entitlement).
export function agentIdsForGroup(groupId, filterFn) {
  return AGENT_ORDER.filter((id) => AGENT_GROUP_BY_ID[id] === groupId && (!filterFn || filterFn(id)));
}

// ── Service-line → agent set (contractor tailoring) ─────────────────────────
// When a CONTRACTOR org is the active workspace, the agent grid is scoped to
// the contractor's CURRENT service line instead of building_agent_entitlements
// (which is empty for contractors — they own no buildings). Keyed by the
// canonical service line (contracts.service_kind, 'other' → 'hospitality').
// Every id here exists in AGENT_ORDER; the grid still groups them General vs
// Specialized via AGENT_GROUP_BY_ID, so a maintenance contractor sees
// predictive-maintenance under Specialized and hvac/energy/compliance/servicing
// under General.
export const SERVICE_KIND_AGENTS = {
  cleaning: ['cleaning', 'supply', 'compliance', 'servicing'],
  security: ['security', 'compliance', 'servicing'],
  maintenance: ['predictive-maintenance', 'hvac', 'energy', 'compliance', 'servicing'],
  hospitality: ['servicing', 'supply', 'space'],
};

// Relevant agent ids for a canonical service line. Unknown / null line → [].
export function agentsForServiceLine(line) {
  return SERVICE_KIND_AGENTS[line] || [];
}

// Belt-and-suspenders: surface AGENTS / AGENT_DEFAULTS drift the moment
// it lands instead of waiting for the Agentic page to crash on the next
// superadmin visit. Fixes the 2026-05-15 Sentry JAVASCRIPT-REACT-18
// pattern (cold-chain + pharmacy-temp added to AGENTS without entries
// here) so future drift gets caught at module load.
//
// Also warn when an agent is missing from AGENT_CATEGORIES so the
// Agentic page's grouping stays honest. Uncategorized agents fall
// into a synthetic bucket at render time; warning catches it early.
if (typeof window !== 'undefined') {
  const missingDefaults = AGENT_ORDER.filter((id) => !AGENT_DEFAULTS[id]);
  if (missingDefaults.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[agentic-data] AGENTS / AGENT_DEFAULTS drift — missing AGENT_DEFAULTS for: ${missingDefaults.join(', ')}. Add entries in agentic-data.js next to the existing 'security' block.`,
    );
  }
  const missingCategory = AGENT_ORDER.filter((id) => !AGENT_CATEGORY_BY_ID[id]);
  if (missingCategory.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[agentic-data] AGENTS / AGENT_CATEGORIES drift — missing category for: ${missingCategory.join(', ')}. Assign in AGENT_CATEGORIES (general / industry / specialized).`,
    );
  }
}
