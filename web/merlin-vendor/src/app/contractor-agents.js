// @ts-check
// Contractor agent roster — the specialized AI co-workers a CONTRACTOR runs to
// service the building, one per service line on its active contracts.
//
// Why this exists: a contractor's Merlin files ALL its work under a single
// agent_id='servicing' (demo_contractor_agent_tick, mig 213), but every run is
// tagged with inputs.domain (cleaning_*, security_*, hospitality_*,
// maintenance_*). The owner-side AGENTS catalog (energy/hvac/space/…) isn't what
// a facilities contractor operates. So for contractors we present one agent per
// contracted service line, and derive each one's live runtime by bucketing the
// 'servicing' runs by their domain. Roster = the lines on active contracts
// (useContractorServiceLines), so it grows/shrinks with the contracts.
//
// Owner orgs never use any of this — their agents come from AGENTS + per-agent
// agent_runs as before.

import { useMemo } from 'react';
import { useSL } from './servicing-i18n.js';
import { useContractorServiceLines } from './service-line.js';
import { useAgentRuntimeStats } from './agent-runs.js';

// One specialized agent per service line. `cfg` mirrors the shape of a
// DEFAULT_AGENTIC config entry (icon / autonomy / confidence / cap /
// dataSources) so the existing AgentRuntimeCard + AgentDetailView render it
// unchanged. All four read the live servicing program (boards + work orders +
// SLA targets) — that IS the contractor's signal.
const SVC_SOURCES = ['servicing_boards', 'work_orders', 'sla_targets'];
export const CONTRACTOR_LINE_AGENTS = {
  cleaning: {
    name: ['Cleaning & Hygiene', 'Propreté & Hygiène'],
    tag: ['Cleaning routes, restroom hygiene + SLA recovery', 'Tournées de nettoyage, hygiène sanitaire + SLA'],
    cfg: {
      enabled: true,
      autonomy: 'approve-critical',
      confidence: 80,
      maxActionsPerHour: 12,
      icon: 'cleaning',
      dataSources: SVC_SOURCES,
    },
  },
  security: {
    name: ['Security & Safety', 'Sécurité & Sûreté'],
    tag: ['Patrol rounds, access events + incident response', 'Rondes, contrôle d’accès + réponse incidents'],
    cfg: {
      enabled: true,
      autonomy: 'approve-critical',
      confidence: 88,
      maxActionsPerHour: 8,
      icon: 'security',
      dataSources: SVC_SOURCES,
    },
  },
  hospitality: {
    name: ['Hospitality', 'Hôtellerie'],
    tag: ['Reception, guest requests, mail + amenities', 'Accueil, demandes clients, courrier + services'],
    cfg: {
      enabled: true,
      autonomy: 'approve-critical',
      confidence: 82,
      maxActionsPerHour: 10,
      icon: 'hospitality',
      dataSources: SVC_SOURCES,
    },
  },
  maintenance: {
    name: ['Maintenance', 'Maintenance'],
    tag: ['Preventive tasks, fault response + asset uptime', 'Préventif, réponse aux pannes + disponibilité'],
    cfg: {
      enabled: true,
      autonomy: 'auto-low-risk',
      confidence: 85,
      maxActionsPerHour: 16,
      icon: 'cog',
      dataSources: SVC_SOURCES,
    },
  },
};

// 'cleaning_disinfection' → 'cleaning'. Matches demo_contractor_agent_tick's
// split_part(domain,'_',1); 'other' service_kind is already emitted as
// hospitality_* there, so no special-case needed here.
export function lineOfDomain(domain) {
  return String(domain || '').split('_')[0];
}

// Bucket a contractor's 'servicing' runtime (runs[] already desc-sorted) into
// per-line runtime objects shaped exactly like useAgentRuntimeStats entries
// ({ runs, actionsToday, pendingAsks, lastRun }) so the card + detail consume
// them unchanged.
export function bucketServicingByLine(servicingLive) {
  const out = {};
  for (const r of servicingLive?.runs || []) {
    const line = lineOfDomain(r.inputs?.domain);
    if (!CONTRACTOR_LINE_AGENTS[line]) continue;
    let b = out[line];
    if (!b) {
      b = out[line] = { runs: [], actionsToday: 0, pendingAsks: 0, lastRun: null };
    }
    b.runs.push(r);
    if (!b.lastRun) b.lastRun = r;
    if (r.decision === 'act' || r.ask_resolution === 'approved') b.actionsToday += 1;
    if (r.decision === 'ask' && !r.ask_resolution) b.pendingAsks += 1;
  }
  return out;
}

// Contractor agent roster + derived runtime + synthetic per-agent config.
// Returns:
//   roster:  [{ id, line, name, tag, status, actions }]  (card-ready agents)
//   byLine:  { [line]: { runs, actionsToday, pendingAsks, lastRun } }
//   cfgById: { [line]: <synthetic agentic-config entry> }
export function useContractorAgents(orgId, kind) {
  const sl = useSL();
  const lines = useContractorServiceLines(orgId, kind);
  const runtime = useAgentRuntimeStats(orgId);
  return useMemo(() => {
    const byLine = bucketServicingByLine(runtime.servicing);
    const roster = [];
    const cfgById = {};
    for (const line of lines) {
      const meta = CONTRACTOR_LINE_AGENTS[line];
      if (!meta) continue;
      roster.push({
        id: line,
        line,
        status: 'active',
        actions: 0,
        name: sl(meta.name[0], meta.name[1]),
        tag: sl(meta.tag[0], meta.tag[1]),
      });
      cfgById[line] = meta.cfg;
    }
    return { roster, byLine, cfgById };
  }, [lines, runtime, sl]);
}
