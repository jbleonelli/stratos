// Client-side simulator — evolves incidents, fleet, rollouts, and satisfaction
// on a ~18s tick so the app feels alive for colleagues poking around.
//
// All user-visible strings flow through i18n.js. Each pool template
// declares an i18n key (`key`) plus a `paramsFn` that produces the
// values to interpolate; the renderer reads the active language at
// spawn time. Sim incidents carry a `_statusKey` so the status
// progression machine works regardless of language.

import { useEffect, useState } from 'react';
import { INCIDENTS, AGENTS } from './data.js';
import { FLEET } from './devices-data.js';
import { ROLLOUTS } from './deployments-data.js';
import { getPinnedIds } from './pins.js';
import {
  ECOSYSTEM_INCIDENTS,
  ECOSYSTEM_FLEET,
  ECOSYSTEM_FLEET_COUNTS,
  ECOSYSTEM_ROLLOUTS,
  ECOSYSTEM_SATISFACTION,
} from './ecosystem-data.js';
import { loadAgenticConfig } from './agentic-data.js';
import { getRoutes, routeRunsOn } from './routes-data.js';
import { createOverride, todayStr, overridesForRouteOnDate } from './route-overrides-data.js';
import { t } from './i18n.js';

// ────────────────────────── initial state ──────────────────────────

function initialFleetCounts(fleet) {
  const c = { total: fleet.length, online: 0, degraded: 0, offline: 0, updating: 0, provisioning: 0 };
  fleet.forEach((d) => {
    c[d.status] = (c[d.status] || 0) + 1;
  });
  return c;
}

let state = {
  tick: 0,
  incidents: [...INCIDENTS],
  fleet: FLEET.slice(),
  rollouts: ROLLOUTS.map((r) => ({ ...r, stages: { ...r.stages } })),
  satisfaction: {
    ratings: { 5: 1840, 4: 1120, 3: 380, 2: 142, 1: 68 },
    trend: [4.22, 4.25, 4.18, 4.28, 4.31, 4.35, 4.38],
  },
  fleetCounts: initialFleetCounts(FLEET),
  chatSuggestions: [], // proactive messages from Merlin for the chat panel
};

const listeners = new Set();
function emit() {
  for (const l of listeners) l(state);
}

// ────────────────────────── incident → agent mapping ──────────────────────────
// Incident icons map to agent ids so we can consult the agent's autonomy
// config when deciding whether to push an ask or auto-handle.
const INCIDENT_ICON_TO_AGENT = {
  air: 'cleaning', // TVOC / air quality → cleaning crew
  people: 'cleaning', // occupancy drives cleaning dispatch
  supply: 'supply',
  hvac: 'hvac',
  bolt: 'energy',
  shield: 'security',
  badge: 'security',
  room: 'space',
  sla: 'cleaning', // "Scheduled clean overdue" type
  // warn / building / check / light / etc. → no agent, default behavior
};

// Given an incident priority and the agent's autonomy setting, decide
// whether to auto-handle (no ask) or push an ask for human approval.
function autonomyAllowsAutoHandle(autonomy, priority) {
  if (autonomy === 'full-auto') return true;
  if (autonomy === 'auto-low-risk') return priority !== 'critical' && priority !== 'high';
  if (autonomy === 'approve-critical') return priority !== 'critical';
  if (autonomy === 'propose') return false;
  return false;
}

// Decide what to do with a freshly-spawned incident based on the
// agentic config. Returns:
//   { suppress: true }        — agent is disabled; don't alert on this one
//   { autoHandled: true, agentName } — auto-handle; don't alert
//   { alert: true }           — push the normal alert/ask (default)
function decideIncidentHandling(incident) {
  const config = loadAgenticConfig();
  const agentId = INCIDENT_ICON_TO_AGENT[incident.icon];
  if (!agentId) return { alert: true };
  const agentCfg = config.agents?.[agentId];
  if (!agentCfg) return { alert: true };
  if (agentCfg.enabled === false) return { suppress: true };
  const autonomy = agentCfg.autonomy || 'approve-critical';
  if (autonomyAllowsAutoHandle(autonomy, incident.priority)) {
    const agentName = AGENTS.find((a) => a.id === agentId)?.name || 'Merlin';
    return { autoHandled: true, agentName, agentId };
  }
  return { alert: true };
}

// ────────────────────────── incident evolution ──────────────────────────
//
// Each pool entry declares an i18n key (`key`) plus a `paramsFn` that
// produces the values to interpolate. Title/sub/sla/status are all
// translated at spawn time via t(); the active language is read once
// per call. The original status key is preserved on the incident as
// _statusKey so the progression machine below can advance it without
// having to regex-match the rendered text (which would break in any
// non-English language).

const INC_POOL = [
  {
    priority: 'high',
    icon: 'air',
    key: 'voc_drift',
    paramsFn: (fl, dir) => ({
      fl,
      dir,
      ppb: 500 + Math.floor(Math.random() * 700),
      n: Math.floor(Math.random() * 9) + 1,
    }),
    slaKey: 'sim.sla.hygiene_monitoring',
    statusKey: 'sim.status.watching_voc',
    action: 'ok',
  },
  {
    priority: 'medium',
    icon: 'people',
    key: 'occupancy_peak',
    paramsFn: (fl) => ({ fl, n: 9 + Math.floor(Math.random() * 8) }),
    slaKey: 'sim.sla.hygiene_ok',
    statusKey: 'sim.status.queued_sweep',
    action: 'ok',
  },
  {
    priority: 'critical',
    icon: 'warn',
    key: 'water_leak',
    paramsFn: (fl) => ({ fl }),
    slaKey: 'sim.sla.safety_immediate',
    statusKey: 'sim.status.notifying_facilities',
    action: 'approve',
  },
  {
    priority: 'high',
    icon: 'supply',
    key: 'paper_low',
    paramsFn: (fl) => ({ fl, pct: 7 + Math.floor(Math.random() * 10) }),
    slaKey: 'sim.sla.supply_ok',
    statusKey: 'sim.status.added_maria_route',
    action: 'ok',
  },
  {
    priority: 'medium',
    icon: 'hvac',
    key: 'setpoint_drift',
    paramsFn: (fl, dir) => ({ fl, dir, n: Math.floor(Math.random() * 9) }),
    slaKey: 'sim.sla.comfort_nominal',
    statusKey: 'sim.status.adjusting_damper',
    action: 'ok',
  },
  {
    priority: 'info',
    icon: 'bolt',
    key: 'energy_below',
    paramsFn: (fl, dir) => ({ dir, a: 3 + Math.floor(Math.random() * 6), b: Math.floor(Math.random() * 9) }),
    slaKey: 'sim.sla.energy_saving',
    statusKey: 'sim.status.logged',
    action: 'ok',
  },
  {
    priority: 'high',
    icon: 'shield',
    key: 'badge_deny',
    paramsFn: (fl) => ({ fl, n: 3 + Math.floor(Math.random() * 3) }),
    slaKey: 'sim.sla.security_investigate',
    statusKey: 'sim.status.routed_ivan',
    action: 'approve',
  },
  {
    priority: 'medium',
    icon: 'supply',
    key: 'soap_low',
    paramsFn: (fl) => ({ fl, pct: 10 + Math.floor(Math.random() * 20) }),
    slaKey: 'sim.sla.supply_ok',
    statusKey: 'sim.status.added_16_route',
    action: 'ok',
  },
  {
    priority: 'info',
    icon: 'check',
    key: 'positive_feedback',
    paramsFn: (fl) => ({ fl }),
    slaKey: 'sim.sla.none',
    statusKey: 'sim.status.logged_reinforcement',
    action: 'ok',
  },
  {
    priority: 'medium',
    icon: 'room',
    key: 'ghost_booking',
    paramsFn: (fl) => ({ fl, co2: 380 + Math.floor(Math.random() * 50) }),
    slaKey: 'sim.sla.space_util',
    statusKey: 'sim.status.auto_release_pending',
    action: 'approve',
  },
  {
    priority: 'medium',
    icon: 'building',
    key: 'elevator_variance',
    paramsFn: () => ({
      car: String.fromCharCode(65 + Math.floor(Math.random() * 4)),
      n: 1 + Math.floor(Math.random() * 4),
    }),
    slaKey: 'sim.sla.uptime_nominal',
    statusKey: 'sim.status.otis_notified',
    action: 'ok',
  },
  {
    priority: 'critical',
    icon: 'air',
    key: 'voc_spike',
    paramsFn: (fl, dir) => ({ fl, dir, ppb: 1100 + Math.floor(Math.random() * 600) }),
    slaKey: 'sim.sla.hygiene_breach_18m',
    statusKey: 'sim.status.dispatched_6m',
    action: 'approve',
  },
];

let incIdCounter = 500;
function newIncident() {
  const tpl = INC_POOL[Math.floor(Math.random() * INC_POOL.length)];
  const fl = 2 + Math.floor(Math.random() * 48);
  const dirIdx = Math.floor(Math.random() * 4);
  const dirKey = ['north', 'south', 'east', 'west'][dirIdx];
  // Translate the cardinal direction first so it's already localized
  // when interpolated into title/sub strings.
  const dir = t(`sim.dir.${dirKey}`);
  const params = tpl.paramsFn(fl, dir);
  return {
    id: `i-sim-${++incIdCounter}`,
    priority: tpl.priority,
    title: t(`sim.inc.${tpl.key}.title`, params),
    sub: t(`sim.inc.${tpl.key}.sub`, params),
    sla: t(tpl.slaKey),
    status: t(tpl.statusKey),
    action: tpl.action,
    icon: tpl.icon,
    _sim: true,
    _statusKey: tpl.statusKey,
    _spawnedAt: Date.now(),
  };
}

// Status progression: each tick, 25% chance a sim incident's status
// advances. The map is keyed by i18n key (not text) so the machine
// works regardless of active language. Non-sim incidents (static seed
// data without a _statusKey) fall back to the legacy text regex below.
const STATUS_PROGRESSION_KEYS = {
  'sim.status.auto_release_pending': 'sim.status.auto_released',
  'sim.status.queued_sweep': 'sim.status.dispatched_5m',
  'sim.status.watching_voc': 'sim.status.dispatched_6m',
  'sim.status.dispatched_6m': 'sim.status.on_site_working',
  'sim.status.routed_ivan': 'sim.status.reviewing_footage',
  'sim.status.reviewing_footage': 'sim.status.resolved_false_alarm',
  'sim.status.on_site_working': 'sim.status.completing_2m',
  'sim.status.completing_2m': 'sim.status.resolved_logged',
  'sim.status.adjusting_damper': 'sim.status.damper_adjusted',
  'sim.status.damper_adjusted': 'sim.status.resolved_temp_recovering',
  'sim.status.notifying_facilities': 'sim.status.facilities_ticket_opened',
};

const RESOLVED_STATUS_KEYS = new Set([
  'sim.status.auto_released',
  'sim.status.resolved_false_alarm',
  'sim.status.resolved_logged',
  'sim.status.resolved_temp_recovering',
  'sim.status.facilities_ticket_opened',
]);

// Legacy text regex for non-sim seed-data incidents (static rows in
// data.js / ecosystem-data.js / imf-data.js). Their statuses are
// English literals; we keep this fallback so they still progress on a
// browser running in English. French users see those static seeds in
// English until the data overlay in localized-data.js advances them
// (planned in Phase 2 — see docs/operations/100-tenants-readiness.md).
const STATUS_PROGRESSION_LEGACY = [
  [/auto-release pending/i, 'Auto-released · recovered'],
  [/pending your approval/i, 'Approved · handled'],
  [/queued/i, 'Dispatched · eta 5m'],
  [/watching|monitoring|will dispatch/i, 'Dispatched · eta 6m'],
  [/dispatched|eta/i, 'On-site · working'],
  [/routed to ivan/i, 'Ivan reviewing footage'],
  [/reviewing footage/i, 'Resolved · false alarm'],
  [/on-site|working/i, 'Completing · 2m'],
  [/completing/i, 'Resolved · logged'],
  [/adjusting damper/i, 'Damper adjusted · monitoring'],
  [/damper adjusted/i, 'Resolved · temp recovering'],
];

function advanceIncident(inc) {
  // Sim path: drive the machine off the stable key.
  if (inc._statusKey) {
    const nextKey = STATUS_PROGRESSION_KEYS[inc._statusKey];
    if (!nextKey) return inc;
    const params =
      nextKey === 'sim.status.facilities_ticket_opened'
        ? { ticket: 2100 + Math.floor(Math.random() * 200) }
        : undefined;
    return { ...inc, _statusKey: nextKey, status: t(nextKey, params) };
  }
  // Legacy path: regex over the rendered text. Only matches English.
  for (const [rx, next] of STATUS_PROGRESSION_LEGACY) {
    if (rx.test(inc.status || '')) return { ...inc, status: next };
  }
  return inc;
}

function isResolvedIncident(inc) {
  if (inc._statusKey) return RESOLVED_STATUS_KEYS.has(inc._statusKey);
  return /resolved|recovered|handled|false alarm|ticket #/i.test(inc.status || '');
}

// ────────────────────────── device evolution ──────────────────────────

function nextDeviceStatus(cur) {
  const r = Math.random();
  if (cur === 'online') return r < 0.03 ? 'degraded' : r < 0.05 ? 'updating' : 'online';
  if (cur === 'degraded') return r < 0.4 ? 'online' : r < 0.5 ? 'offline' : 'degraded';
  if (cur === 'offline') return r < 0.3 ? 'online' : r < 0.35 ? 'degraded' : 'offline';
  if (cur === 'updating') return r < 0.5 ? 'online' : 'updating';
  if (cur === 'provisioning') return r < 0.3 ? 'online' : 'provisioning';
  return cur;
}

// ────────────────────────── proactive chat suggestions ──────────────────────────

let suggestionIdCounter = 1;
let lastSuggestionAt = 0;
const MIN_SUGGESTION_INTERVAL_MS = 45_000;

const AMBIENT_TIP_COUNT = 8;

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildChatSuggestion(newlySpawned, resolvedInc) {
  // Priority 1: new critical/approve-required incident
  if (newlySpawned && (newlySpawned.priority === 'critical' || newlySpawned.action === 'approve')) {
    const tag = newlySpawned.priority === 'critical' ? t('sim.chat.tag_critical') : t('sim.chat.tag_heads_up');
    return {
      text: t('sim.chat.alert', {
        tag,
        title: newlySpawned.title,
        sub: newlySpawned.sub,
        status: newlySpawned.status,
      }),
      meta: { kind: 'alert', incidentId: newlySpawned.id },
    };
  }
  // Priority 2: resolved incident
  if (resolvedInc) {
    return {
      text: t('sim.chat.resolution', {
        title: resolvedInc.title,
        status: resolvedInc.status,
      }),
      meta: { kind: 'resolution', incidentId: resolvedInc.id },
    };
  }
  // Priority 3: ambient tip — picked from the per-language pool.
  const ambientIdx = Math.floor(Math.random() * AMBIENT_TIP_COUNT);
  return {
    text: t(`sim.ambient.${ambientIdx}`),
    meta: { kind: 'ambient' },
  };
}

function maybePushSuggestion(list, newlySpawned, resolvedInc) {
  const now = Date.now();
  if (now - lastSuggestionAt < MIN_SUGGESTION_INTERVAL_MS) return list;
  const hasTrigger = !!newlySpawned || !!resolvedInc;
  const rollAmbient = !hasTrigger && Math.random() < 0.35;
  if (!hasTrigger && !rollAmbient) return list;
  const s = buildChatSuggestion(newlySpawned, resolvedInc);
  lastSuggestionAt = now;
  const next = [...list, { id: suggestionIdCounter++, time: nowTimeStr(), ...s }];
  return next.length > 40 ? next.slice(-40) : next;
}

// ────────────────────────── tick ──────────────────────────

function tick() {
  const t_ = state.tick + 1;

  // 1. incidents: advance statuses — skip human-handled + auto-handled
  //    ones so the "Handled by Robin" / "Auto-handled by Cleaning" lines
  //    don't get overwritten by the simulator's canned progression.
  let incidents = state.incidents.map((inc) => {
    if (inc._humanHandled || inc._autoHandled) return inc;
    if (Math.random() < 0.25) return advanceIncident(inc);
    return inc;
  });

  // 2. incidents: resolve one that's finished (skipping pinned, human-
  //    handled, and auto-handled ones — all three are "decisions" the
  //    demo should keep visible instead of sweeping away).
  let resolvedInc = null;
  const pinnedIds = getPinnedIds();
  const resolvedIdx = incidents.findIndex(
    (i) => !pinnedIds.has(i.id) && !i._humanHandled && !i._autoHandled && isResolvedIncident(i),
  );
  if (resolvedIdx >= 0 && Math.random() < 0.6) {
    resolvedInc = incidents[resolvedIdx];
    incidents = [...incidents.slice(0, resolvedIdx), ...incidents.slice(resolvedIdx + 1)];
  }

  // 3. incidents: spawn a new one — then consult the agentic config to
  //    decide whether it pushes an ask, auto-handles silently, or gets
  //    suppressed because the agent is disabled. `spawnedInc` is what we
  //    forward to maybePushSuggestion as an alert trigger; null means no
  //    chat alert this tick.
  let spawnedInc = null;
  if (Math.random() < 0.45 && incidents.length < 60) {
    const fresh = newIncident();
    incidents = [fresh, ...incidents];
    const decision = decideIncidentHandling(fresh);
    if (decision.autoHandled) {
      const idx = incidents.findIndex((i) => i.id === fresh.id);
      if (idx >= 0) {
        incidents[idx] = {
          ...incidents[idx],
          status: t('sim.status.auto_handled_by', { agent: decision.agentName }),
          action: 'ok',
          _autoHandled: true,
          _autoHandledBy: decision.agentId,
          _statusKey: undefined, // no further progression after auto-handle
        };
      }
      // Phase 8e: log a Merlin-sourced route override so the auto-handle
      // decision is visible on Today's plan. Fire-and-forget with dedupe.
      maybeLogMerlinReroute(fresh, decision.agentId);
    } else if (decision.alert) {
      spawnedInc = fresh; // normal path: alert + ask
    }
    // decision.suppress → agent disabled: incident exists, no alert.
  }

  // 4. fleet: flip 1-3 device states
  const fleet = state.fleet.slice();
  const nFlip = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < nFlip; i++) {
    const idx = Math.floor(Math.random() * fleet.length);
    const d = fleet[idx];
    const next = nextDeviceStatus(d.status);
    if (next !== d.status) fleet[idx] = { ...d, status: next };
  }

  // 5. fleet: rarely nudge a battery down. With 3-5 year chemistries, 1% = ~11 days
  //    of real life, so visible drain in a demo session is intentionally subtle.
  if (Math.random() < 0.12) {
    const idx = Math.floor(Math.random() * fleet.length);
    const d = fleet[idx];
    if (d.battery != null && d.battery > 0) {
      fleet[idx] = { ...d, battery: Math.max(0, d.battery - 1) };
    }
  }

  const fleetCounts = initialFleetCounts(fleet);

  // 6. satisfaction: add 1-3 new ratings, weighted positive
  const ratings = { ...state.satisfaction.ratings };
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    const rating = r < 0.52 ? 5 : r < 0.82 ? 4 : r < 0.93 ? 3 : r < 0.98 ? 2 : 1;
    ratings[rating] = (ratings[rating] || 0) + 1;
  }
  const total = Object.values(ratings).reduce((a, b) => a + b, 0);
  const avg = (5 * ratings[5] + 4 * ratings[4] + 3 * ratings[3] + 2 * ratings[2] + 1 * ratings[1]) / total;
  const trend = [...state.satisfaction.trend];
  trend[trend.length - 1] = +avg.toFixed(2);
  const satisfaction = { ratings, trend };

  // 7. rollouts: advance one by one device-slot
  const rollouts = state.rollouts.map((r) => ({ ...r, stages: { ...r.stages } }));
  const roll = rollouts[Math.floor(Math.random() * rollouts.length)];
  const stageMap = { installed: 'live', provisioned: 'installed', arrived: 'provisioned', ordered: 'arrived' };
  for (const stageFrom of ['installed', 'provisioned', 'arrived', 'ordered']) {
    if ((roll.stages[stageFrom] || 0) > 0) {
      const stageTo = stageMap[stageFrom];
      roll.stages[stageFrom] -= 1;
      roll.stages[stageTo] = (roll.stages[stageTo] || 0) + 1;
      break;
    }
  }

  // 8. chat: maybe add a proactive Merlin suggestion
  const chatSuggestions = maybePushSuggestion(state.chatSuggestions, spawnedInc, resolvedInc);

  state = { tick: t_, incidents, fleet, rollouts, satisfaction, fleetCounts, chatSuggestions };
  emit();
}

// ────────────────────────── Merlin reroute overrides ──────────────────────────

// When the simulator auto-handles a critical/high cleaning or supply
// incident and there's a route for that service type running today,
// write a route_override row with source='merlin'. Dedupes on reason
// so a burst of similar incidents doesn't flood the log.
function maybeLogMerlinReroute(incident, agentId) {
  // Only worth logging if the incident actually implies a reroute.
  if (incident.priority !== 'critical' && incident.priority !== 'high') return;

  // Map agent → route service_type so we pick the right route to reroute.
  const SERVICE_BY_AGENT = { cleaning: 'surface_clean', supply: 'restock' };
  const serviceType = SERVICE_BY_AGENT[agentId];
  if (!serviceType) return;

  const today = todayStr();
  const dow = new Date(today + 'T00:00:00').getDay();
  const { routes } = getRoutes();
  const candidates = routes.filter((r) => r.service_type === serviceType && r.active !== false && routeRunsOn(r, dow));
  if (candidates.length === 0) return;
  const route = candidates[0]; // pick the first active match; good enough for the demo

  // Dedupe: if we already have a merlin override today for this route
  // with the same reason, skip. The reason text is in the active
  // language because incident.title was translated at spawn time.
  const reason = t('sim.reroute.reason', { title: incident.title });
  const existing = overridesForRouteOnDate(route.id, today);
  if (existing.some((o) => o.source === 'merlin' && o.reason === reason)) return;

  createOverride({
    route_id: route.id,
    date: today,
    permanent: false,
    action: 'extra',
    reason,
    source: 'merlin',
  }).catch(() => {}); // best-effort
}

// ────────────────────────── human-handled ──────────────────────────

// Called when a user answers an ask via the Merlin chat bar. Flips the
// source incident's status to reflect the human action, stamps who did
// it, and marks `_humanHandled` so the tick loop doesn't overwrite it
// or auto-resolve it away.
const ACTION_VERB_KEY = {
  approve: 'sim.action.dispatched',
  dispatch: 'sim.action.dispatched',
  hold: 'sim.action.held',
  escalate: 'sim.action.escalated',
  reassign: 'sim.action.reassigned',
  dismiss: 'sim.action.dismissed',
};

export function handleIncident(incidentId, actionId, actorName) {
  if (!incidentId) return;
  const idx = state.incidents.findIndex((i) => i.id === incidentId);
  if (idx < 0) return;
  const verb = t(ACTION_VERB_KEY[actionId] || 'sim.action.handled');
  const who = actorName || t('sim.actor.teammate');
  const when = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const next = {
    ...state.incidents[idx],
    status: t('sim.status.actor_action', { verb, who, when }),
    action: 'ok', // no more "approve" pill — the decision's been made
    _humanHandled: true,
    _statusKey: undefined,
    _handledBy: { name: who, action: actionId, at: Date.now() },
  };
  state = { ...state, incidents: [...state.incidents.slice(0, idx), next, ...state.incidents.slice(idx + 1)] };
  emit();
}

// ────────────────────────── hook + start ──────────────────────────

let started = false;
export function startSimulator(intervalMs = 18000) {
  if (started || typeof window === 'undefined') return;
  started = true;
  setInterval(tick, intervalMs);
  window.__MERLIN_TICK__ = tick; // exposed for debug: run window.__MERLIN_TICK__()
}

export function useLiveState() {
  const [s, setS] = useState(state);
  useEffect(() => {
    const fn = (next) => setS({ ...next });
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return s;
}

// Static snapshot used when an "ecosystem" building (e.g. First Empire Bank) is
// selected. The simulator doesn't tick this; the data is large and fixed.
const ECOSYSTEM_SNAPSHOT = {
  tick: 0,
  incidents: ECOSYSTEM_INCIDENTS,
  fleet: ECOSYSTEM_FLEET,
  rollouts: ECOSYSTEM_ROLLOUTS,
  satisfaction: ECOSYSTEM_SATISFACTION,
  fleetCounts: ECOSYSTEM_FLEET_COUNTS,
  chatSuggestions: [],
};

// Empty snapshot for non-HQ buildings under the same org that don't yet
// have static demo content. Used as a fallback so HQ-flavored mock
// incidents never leak into a sibling building shell.
const EMPTY_BUILDING_SNAPSHOT = {
  tick: 0,
  incidents: [],
  fleet: [],
  rollouts: [],
  satisfaction: { score: null, breakdown: [] },
  fleetCounts: { total: 0, online: 0, degraded: 0, offline: 0 },
  chatSuggestions: [],
};

// Healthcare-flavored static snapshot for Meridian Health Clinic.
// Mirrors HQ's INCIDENTS shape so AttentionCard renders without changes.
// Each incident points at a real MHC location_id from migration 107 so a
// future location_id-aware routing path can deep-link straight into the
// Hypervisor.
const MHC_INCIDENTS = [
  {
    id: 'i-mhc-001',
    priority: 'critical',
    title: 'Pressure cascade reversal — OR 02',
    sub: 'OR 02 differential dropped to +0.8 Pa (target ≥ 2.5) · sustained 14 min',
    sla: 'Pressure cascade · breach',
    status: 'Merlin paused OR 02 turnover · facilities paged',
    action: 'approve',
    icon: 'air',
  },
  {
    id: 'i-mhc-002',
    priority: 'high',
    title: 'Terminal clean overdue — Ward Room 03',
    sub: 'Discharge 13:42 · spec ≤ 30 min · +18 min over',
    sla: 'Terminal clean · at risk',
    status: 'Pulled ahead of EVS 14:30 route',
    action: 'approve',
    icon: 'sla',
  },
  {
    id: 'i-mhc-003',
    priority: 'high',
    title: 'Pharmacy refrigerator drift — main pharmacy',
    sub: 'Setpoint 4 °C · current 6.8 °C · rising 0.4 °C/h',
    sla: 'Cold-chain · vaccine integrity',
    status: 'Pharmacist paged · stock hold pending',
    action: 'approve',
    icon: 'warn',
  },
  {
    id: 'i-mhc-004',
    priority: 'medium',
    title: 'Sterile processing humidity high',
    sub: 'RH 65% · spec 30–60% · last 38 min',
    sla: 'Sterile-zone HVAC · at risk',
    status: 'Merlin nudged AHU-2 fresh-air dampers',
    action: 'ok',
    icon: 'hvac',
  },
  {
    id: 'i-mhc-005',
    priority: 'medium',
    title: 'Hand-hygiene compliance dip — overnight shift',
    sub: '74% events per opportunity (target 80%) · last 4h',
    sla: 'Joint Commission · at risk',
    status: 'Infection-control lead notified',
    action: 'ok',
    icon: 'shield',
  },
  {
    id: 'i-mhc-006',
    priority: 'info',
    title: 'HEPA filter pressure drop — OR 01',
    sub: 'Drop +12% vs baseline · 1,840h runtime · service due in 60h',
    sla: 'Filter life · nominal',
    status: 'Work order #W-3081 scheduled',
    action: 'ok',
    icon: 'air',
  },
];

const MHC_SATISFACTION = {
  score: 4.2,
  breakdown: [
    { label: 'Patients', score: 4.4 },
    { label: 'Staff', score: 3.9 },
  ],
};
const MHC_FLEET_COUNTS = { total: 30, online: 29, degraded: 1, offline: 0 };

const MHC_SNAPSHOT = {
  tick: 0,
  incidents: MHC_INCIDENTS,
  fleet: [],
  rollouts: [],
  satisfaction: MHC_SATISFACTION,
  fleetCounts: MHC_FLEET_COUNTS,
  chatSuggestions: [],
};

// Warehouse-flavored static snapshot for Meridian Distribution Center East.
const MDE_INCIDENTS = [
  {
    id: 'i-mde-001',
    priority: 'critical',
    title: 'Cold storage temp drift — Bay A',
    sub: 'Setpoint −18 °C · current −15 °C · rising 0.3 °C/h · cold-chain stock at risk',
    sla: 'HACCP cold-chain · breach in 22m',
    status: 'Compressor PM tech dispatched',
    action: 'approve',
    icon: 'warn',
  },
  {
    id: 'i-mde-002',
    priority: 'high',
    title: 'Trailer creep flagged — Loading Dock A',
    sub: 'Restraint sensor lost grip · trailer drift 4 cm in 8 min',
    sla: 'Dock safety · auto-lockout active',
    status: 'Dock A inactive in schedule · driver paged',
    action: 'approve',
    icon: 'warn',
  },
  {
    id: 'i-mde-003',
    priority: 'high',
    title: 'Forklift impact event — Aisle 09',
    sub: 'Impact sensor +3.8g · upright B7 · operator A. Vega',
    sla: 'Racking safety · inspection required',
    status: 'Aisle 09 frozen pending engineering',
    action: 'approve',
    icon: 'shield',
  },
  {
    id: 'i-mde-004',
    priority: 'medium',
    title: 'Restroom feedback flag — Mezzanine',
    sub: '3 "dirty" presses in 18 min · last clean 06:30',
    sla: 'Hygiene SLA · at risk',
    status: 'Pulled ahead of Maria’s 14:30 sweep',
    action: 'approve',
    icon: 'people',
  },
  {
    id: 'i-mde-005',
    priority: 'medium',
    title: 'QC Station counter — degraded uplink',
    sub: 'MDE-PCB-0005 · last beacon 37 min ago · battery 43%',
    sla: 'Fleet health · ok',
    status: 'Field-tech ticket #F-3019 opened',
    action: 'ok',
    icon: 'warn',
  },
  {
    id: 'i-mde-006',
    priority: 'info',
    title: 'Aisle sweep — Ground floor complete',
    sub: 'All 15 aisles · 88 min · zero exceptions',
    sla: 'EVS daily cadence · on schedule',
    status: 'Logged to audit trail',
    action: 'ok',
    icon: 'check',
  },
];

const MDE_SATISFACTION = {
  score: 4.0,
  breakdown: [
    { label: 'Operators', score: 4.1 },
    { label: 'Drivers', score: 3.8 },
  ],
};
const MDE_FLEET_COUNTS = { total: 30, online: 29, degraded: 1, offline: 0 };

const MDE_SNAPSHOT = {
  tick: 0,
  incidents: MDE_INCIDENTS,
  fleet: [],
  rollouts: [],
  satisfaction: MDE_SATISFACTION,
  fleetCounts: MDE_FLEET_COUNTS,
  chatSuggestions: [],
};

// Routes every component that reads "live" data through the right snapshot.
// For a regular building it subscribes to the simulator; for an ecosystem it
// returns the static ecosystem-wide snapshot. For variant-flagged buildings
// (warehouse / healthcare) it returns a per-vertical static snapshot so the
// Briefing's attention cards read in-character instead of leaking HQ data.
export function useAppData(building) {
  const live = useLiveState();
  // IMF is a live device pilot — no demo fixtures. Real signal comes from the
  // events/devices hooks; the snapshot stays empty so no mock incidents/fleet
  // leak into the briefing.
  if (building?.variant === 'imf') return EMPTY_BUILDING_SNAPSHOT;
  if (building?.kind === 'ecosystem') return ECOSYSTEM_SNAPSHOT;
  if (building?.variant === 'healthcare') return MHC_SNAPSHOT;
  if (building?.variant === 'warehouse') return MDE_SNAPSHOT;
  // The simulator's live state is implicitly HQ-scoped (its incident pool
  // names HQ rooms, its fleet is HQ devices). For any other non-HQ
  // building, return the empty snapshot rather than leak HQ content.
  if (building?.id && building.id !== 'hq') return EMPTY_BUILDING_SNAPSHOT;
  return live;
}
