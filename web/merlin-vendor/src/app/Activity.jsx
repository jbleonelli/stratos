// Operations → Activity. Consolidates the former Calls-for-action and
// Incidents tabs into one mixed feed.
//
// Two underlying data sources:
//   - merlin_asks → calls (decisions awaiting Approve / Hold)
//   - incidents → events (some auto-handled by Merlin, some still open)
//
// Filter pills:
//   All  · Needs action  · Open  · Resolved
// Plus the existing CallRow and IncidentRow renderers, kept intact —
// we just sort + interleave them.
//
// Sort order: pending calls first (priority then recency), then open
// incidents (priority then recency), then resolved/auto-handled
// incidents at the bottom.

import React, { useMemo, useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Card, AdaptivLoader } from './primitives.jsx';
import { useMerlinAsks, answerAsk } from './merlin-asks.js';
import { CallRow } from './CallsForAction.jsx';
import { IncidentRow, isMerlinHandled } from './DashboardIncidents.jsx';
import { usePinned } from './pins.js';
import { useT } from './i18n.js';
import { useActiveOrg } from './org-data.js';
import { useReplayIncidents } from './replay-incidents.js';
import { useEventsForBuilding, resolveEvent } from './events.js';

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, info: 3, low: 3 };

// PR #760: events → CallRow / IncidentRow adapters. Keeps the visual
// shape of Activity rows identical while the underlying data source
// switches from useMerlinAsks + incidents to useEventsForBuilding.
//
// Two-line layout so long decision_reason strings don't blow out the
// row width:
//   title: "Cleaning agent · needs approval"   (agent label + verb)
//   body:  the full decision_reason            (wraps in CallRow)
// This also avoids the pre-fix duplication where title and body were
// both rendering the same long sentence with slightly different
// truncation points (looked like the row was repeating itself).
const ACTIVITY_AGENT_DISPLAY_NAME = {
  cleaning: 'Cleaning & Hygiene',
  hvac: 'HVAC & Comfort',
  space: 'Space Management',
  supply: 'Supplies & Stock',
  compliance: 'Compliance',
  energy: 'Energy',
  security: 'Security & Safety',
  servicing: 'Servicing & SLAs',
  'cold-chain': 'Cold-Chain',
  'pharmacy-temp': 'Pharmacy Temperature',
  'predictive-maintenance': 'Predictive Maintenance',
  'asset-tracking': 'Asset Tracking',
  parking: 'Parking',
  'crowd-flow': 'Crowd Flow',
  'concession-demand': 'Concession Demand',
  'incident-choreography': 'Incident Choreography',
  biosecurity: 'Biosecurity & Player Health',
};
function eventToCallShape(e) {
  const agentId = e.processed_by_agent_id || e.kind;
  const agentLabel = ACTIVITY_AGENT_DISPLAY_NAME[agentId] || (agentId ? agentId.replace(/-/g, ' ') : 'Agent');
  // Prefer the structured ask `title` writer agents stash in
  // eventPayloadExtras (PR #766). Fall back to the agent-label header
  // so the title never just repeats the body.
  const title =
    e.payload?.title && e.payload.title !== e.decision_reason ? e.payload.title : `${agentLabel} · needs approval`;
  // Body is the decision-ready line — the live signal + the proposed action
  // ("Last serviced 6.7h ago vs your 6h SLA. Approve a dispatch?"). Prefer the
  // agent's rich `body` over the terse decision_reason ("X needs attention at Y"),
  // which is too vague to approve on; fall back to it only when no body exists.
  // (Mirrors merlin-asks.js's eventToAsk — the My Day asks already do this.)
  const body = e.payload?.body || e.decision_reason || null;
  return {
    id: 'evt-' + e.id, // CallRow → handleAnswer uses this
    title,
    body,
    sub: e.payload?.sub || null,
    priority: e.severity || 'medium',
    agentId,
    createdAt: e.created_at ? new Date(e.created_at).getTime() : 0,
    actions: [
      { id: 'approve', label: 'Approve', tone: 'accent' },
      { id: 'hold', label: 'Hold', tone: 'default' },
    ],
    rawEvent: e,
  };
}
function eventToIncidentShape(e) {
  return {
    id: 'evt-' + e.id,
    title: e.payload?.title || e.decision_reason || `${e.kind} signal`,
    sub: e.payload?.sub || e.decision_reason || '',
    priority: e.severity || 'medium',
    icon: e.payload?.icon || 'sparkle',
    status: e.resolved
      ? e.resolved_reason === 'agent_acted'
        ? 'Auto-handled by agent'
        : 'Resolved'
      : e.processed_at
        ? 'Open'
        : 'Detected',
    _spawnedAt: e.created_at ? new Date(e.created_at).getTime() : 0,
    _autoHandled: e.resolved_reason === 'agent_acted',
    _autoHandledBy: e.processed_by_agent_id,
    _sim: e.source_kind === 'simulator',
    rawEvent: e,
  };
}

export function ActivityPage({
  building,
  incidents,
  onOpenChat,
  onOpenIncident,
  onOpenAgent,
  initialAgentId,
  initialFilter,
}) {
  const t = useT();
  const allCalls = useMerlinAsks(building?.id);
  const pinned = usePinned();
  const [filter, setFilter] = useState(initialFilter || (initialAgentId ? 'needs' : 'all'));
  const [busyId, setBusyId] = useState(null);

  // Re-fire when the host pushes a new initialAgentId (e.g. the user
  // clicks the bell in the icon rail a second time while already on
  // Activity). Without this, useState's mount-only init meant repeat
  // bell clicks were silent no-ops. JB hit this 2026-05-23.
  useEffect(() => {
    if (initialAgentId) setFilter('needs');
  }, [initialAgentId]);

  // Replay-mode orgs source the Activity feed from public.incident_actions
  // (which migration 140 keeps fresh every cron tick) instead of the
  // simulator's in-memory pool. The simulator's pool carried backdated
  // seed data that read as "7-18 days ago" forever — see replay-incidents.js
  // for the rationale + shape mapping. PRO TEST / Meridian smoke-test
  // 2026-05-18.
  const activeOrg = useActiveOrg();
  const isReplayMode = activeOrg?.replay_mode === true;
  const dbIncidents = useReplayIncidents(isReplayMode ? activeOrg?.id : null);
  const effectiveIncidents = isReplayMode ? dbIncidents : incidents;

  const handleAnswer = async (callId, actionId) => {
    if (busyId) return;
    setBusyId(callId);
    try {
      // Event-backed rows have id 'evt-<uuid>' → resolve via the events
      // helper which updates both events.resolved and the linked
      // agent_run.ask_resolution in lockstep. Legacy 'call-<id>' rows
      // (still possible during the transition) keep the answerAsk path.
      if (typeof callId === 'string' && callId.startsWith('evt-')) {
        await resolveEvent(callId.slice(4), actionId);
      } else {
        await answerAsk(callId, actionId);
      }
    } finally {
      setBusyId(null);
    }
  };

  // Phase 3 cutover: read the unified events table. Backfill migration
  // 168 means existing pending agent_runs already have backing events,
  // and the simulator-events-bridge writes new sim incidents directly.
  // So events is now the single source for the Activity feed.
  const orgId = activeOrg?.id;
  const allEvents = useEventsForBuilding(orgId, building?.id, {
    includeResolved: true,
    limit: 200,
  });
  // Replay-mode BUILDING owners (Meridian / FEB) still use the demo-fixtures
  // incident stream — scripted historical events that don't flow through the
  // events table. Replay CONTRACTORS, by contrast, have a fully events-backed
  // lifecycle (demo_contractor_agent_tick emits ask→dispatch→complete events),
  // so they read the unified feed — that's what surfaces their In-progress /
  // Resolved pools (the legacy path only reads the asks adapter + the building
  // incident stream, which is empty for a contractor).
  const useLegacyIncidents = isReplayMode && activeOrg?.kind !== 'contractor';

  // Merge into a single sorted list. In normal mode it's just events.
  // In replay mode we keep the old merge of calls + replay incidents.
  const rows = useMemo(() => {
    if (!useLegacyIncidents) {
      return allEvents
        .map((e) => {
          const isCall = e.decision === 'ask' && !e.ask_resolution;
          const ts = e.created_at ? new Date(e.created_at).getTime() : 0;
          const bucket = e.resolved ? 'resolved' : isCall ? 'needs' : 'open';
          if (isCall) {
            return {
              kind: 'call',
              id: 'evt-' + e.id,
              priority: e.severity || 'medium',
              ts,
              bucket,
              data: eventToCallShape(e),
            };
          }
          return {
            kind: 'incident',
            id: 'evt-' + e.id,
            priority: e.severity || 'medium',
            ts,
            bucket,
            data: eventToIncidentShape(e),
          };
        })
        .sort((a, b) => {
          const bucketRank = { needs: 0, open: 1, resolved: 2 };
          const ba = bucketRank[a.bucket] ?? 9;
          const bb = bucketRank[b.bucket] ?? 9;
          if (ba !== bb) return ba - bb;
          const pra = PRIORITY_RANK[a.priority] ?? 9;
          const prb = PRIORITY_RANK[b.priority] ?? 9;
          if (pra !== prb) return pra - prb;
          return (b.ts || 0) - (a.ts || 0);
        });
    }
    // Legacy path (replay-mode tenants) — unchanged.
    const callRows = allCalls.map((c) => ({
      kind: 'call',
      id: 'call-' + c.id,
      priority: c.priority || 'medium',
      ts: c.createdAt || 0,
      bucket: 'needs',
      data: c,
    }));
    const incidentRows = effectiveIncidents.map((i) => ({
      kind: 'incident',
      id: 'inc-' + i.id,
      priority: i.priority || 'medium',
      ts: i._spawnedAt || 0,
      bucket: isMerlinHandled(i) ? 'resolved' : 'open',
      data: i,
    }));
    const all = [...callRows, ...incidentRows];
    // Pinned > pending calls > open incidents > resolved; within bucket: priority then recency.
    const bucketRank = { needs: 0, open: 1, resolved: 2 };
    return all.sort((a, b) => {
      const pa = a.kind === 'incident' && pinned.has(a.data.id) ? 0 : 1;
      const pb = b.kind === 'incident' && pinned.has(b.data.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ba = bucketRank[a.bucket] ?? 9;
      const bb = bucketRank[b.bucket] ?? 9;
      if (ba !== bb) return ba - bb;
      const pra = PRIORITY_RANK[a.priority] ?? 9;
      const prb = PRIORITY_RANK[b.priority] ?? 9;
      if (pra !== prb) return pra - prb;
      return (b.ts || 0) - (a.ts || 0);
    });
  }, [allCalls, effectiveIncidents, pinned]);

  const counts = useMemo(() => {
    const c = { all: rows.length, needs: 0, open: 0, resolved: 0 };
    for (const r of rows) c[r.bucket]++;
    return c;
  }, [rows]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.bucket === filter);

  // Sub-tab strip — same visual treatment as the OPERATE → Contractors
  // inner strip so the navigation pattern reads consistently across the
  // OPERATE pillar. CTAs == the 'needs' bucket (calls awaiting human
  // decision); kept that internal id since it's used by initialAgentId
  // routing too.
  const TABS = [
    { id: 'all', label: t('activity.filter.all'), icon: 'grid' },
    { id: 'needs', label: t('activity.filter.needs'), icon: 'bell' },
    { id: 'open', label: t('activity.filter.open'), icon: 'warn' },
    { id: 'resolved', label: t('activity.filter.resolved'), icon: 'check' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Sub-tab strip — PR #734: brand pink → indigo gradient
          matching the Hypervisor sub-nav band. White-on-gradient
          label, semi-transparent white chevron. */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 20px',
          background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-indigo))',
        }}
      >
        <span
          style={{ fontSize: 10.5, letterSpacing: 0.15, textTransform: 'uppercase', color: '#fff', fontWeight: 700 }}
        >
          {t('tab.activity')}
        </span>
        <Icon.chevR size={9} style={{ color: 'rgba(255,255,255,0.7)' }} />
        <div
          style={{
            display: 'flex',
            gap: 2,
            background: 'var(--surface)',
            padding: 2,
            borderRadius: 7,
            border: '1px solid var(--border)',
          }}
        >
          {TABS.map((tab) => {
            const IconC = Icon[tab.icon] || Icon.grid;
            const active = filter === tab.id;
            const n = counts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 9px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
              >
                <IconC size={11} />
                {tab.label}
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: active ? 'var(--accent)' : 'var(--text-faint)',
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          // Symmetric padding on all sides — rows are centered with
          // matching left/right gaps from the card border (JB asked
          // 2026-05-23 to restore this and bring the central card
          // border back).
          padding: 'var(--pad)',
          overflow: 'auto',
          minWidth: 0,
        }}
      >
        {/* Inner column — the central card wrapper in App.jsx now
            provides the outer visual constraint, so the old
            maxWidth:1240 cap here just added redundant horizontal
            whitespace inside the card (JB called this out 2026-05-22).
            Activity rows are short single-line entries; the card's
            own padding is enough breathing room. */}
        <div>
          {/* Loading state: the events fetch can take a beat on tenants
              with hundreds of pending asks (Meridian's ~200 cap). Show
              the AdaptivLoader instead of flashing the empty-state copy
              and then snapping in the rows. The useEventsForBuilding
              hook attaches a `loaded` flag on its returned array (see
              events.js) — false until the first fetch completes. */}
          {!allEvents.loaded && filtered.length === 0 && !useLegacyIncidents ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
              <AdaptivLoader size="md" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <div style={{ padding: 32, textAlign: 'center' }}>
                <Icon.sparkle size={20} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>
                  {t('activity.empty.title')}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>
                  {t('activity.empty.body')}
                </div>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((row, _i) =>
                row.kind === 'call' ? (
                  <CallRow
                    key={row.id}
                    call={row.data}
                    busy={busyId === row.data.id}
                    onAnswer={(actionId) => handleAnswer(row.data.id, actionId)}
                    onOpenAgent={onOpenAgent}
                  />
                ) : (
                  <Card key={row.id} pad={false}>
                    <IncidentRow
                      inc={row.data}
                      last={true}
                      onAskAbout={onOpenChat}
                      onOpenIncident={onOpenIncident}
                      expandable
                    />
                  </Card>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
