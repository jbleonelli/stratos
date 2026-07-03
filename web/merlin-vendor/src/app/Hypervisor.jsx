// Hypervisor — admin surface for the location tree + everything
// attached to each node (devices, SLAs, etc.).
//
// Phase 1 (admin rework): tree-only view. The previous floor-map
// pane (RichFloorPlan/FLOOR_PLANS) is gone — admins manage by
// node, not geometry. Devices show as leaves under their location,
// so the tree is the single canonical drilldown:
//   Building → Floor → Room → Device
//
// Ecosystems still toggle between tree + map (the map remains the
// natural surface for portfolio-level lat/lng exploration; the
// tree is where you actually edit). Phase 2 will add inline
// create/edit on tree nodes; Phase 3 layers per-building grant
// management. This phase ships the tree-with-devices, role gate,
// and detail pane only.
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
// PR #762: every Hypervisor data path reads events (PR #759 ctaRows,
// this PR sub-pickers). All agent_runs hooks dropped from this file.
import { useEventsForBuilding, resolveEvent } from './events.js';
import { useAssetTrackingRuns } from './agent-runs.js';
import { useSlaPerformance, useContractorBuildingSlas } from './slas-data.js';
import { useActiveOrg } from './org-data.js';
import { EcosystemMap } from './EcosystemMap.jsx';
import { ImfMap } from './ImfMap.jsx';
import { LocationTree, LocationDetail, RouteDetailCard } from './LocationTree.jsx';
import { useT } from './i18n.js';
import { useSession, canAccessHypervisor } from './auth.js';
import { bulkCreateChildLocations } from './custom-locations.js';
import { colorForAgent } from './agent-colors.js';
import { subscribeHypervisorControl, peekHypervisorControl } from './hypervisor-control.js';
import { useServicingRollup, useServicingOpenItems, useBuildingSensorReadings } from './servicing-data.js';
import { SERVICING_GROUP_DOMAINS, SERVICING_DOMAIN_META, domainAccent, domainSoft } from './servicing-areas.js';
import { useSL } from './servicing-i18n.js';

// 3D viewer is lazy-loaded so the three.js/r3f bundle (~600 KB
// gzipped) only ships when the operator opens the 3D tab.
const HypervisorViewer3D = lazy(() => import('./HypervisorViewer3D.jsx'));

// Mirror of Activity.jsx's ACTIVITY_AGENT_DISPLAY_NAME — used by the
// Merlin-mode sidebar to render the agent breakdown with friendly
// labels rather than slugs.
const MERLIN_AGENT_NAME = {
  cleaning: 'Cleaning & Hygiene',
  hvac: 'HVAC & Comfort',
  space: 'Space Management',
  supply: 'Supplies & Stock',
  compliance: 'Compliance',
  energy: 'Energy',
  security: 'Security & Safety',
  'cold-chain': 'Cold-Chain',
  'pharmacy-temp': 'Pharmacy Temperature',
  'predictive-maintenance': 'Predictive Maintenance',
  'asset-tracking': 'Asset Tracking',
  parking: 'Parking',
  'crowd-flow': 'Crowd Flow',
  'concession-demand': 'Concession Demand',
  'incident-choreography': 'Incident Choreography',
};

// `orgIdOverride` lets a contractor admin viewing a building they have
// a contract on look at the FM's location tree (the tree filter pins
// `organization_id` to a specific org, so without an override Lisa
// would query her own contractor org and see nothing). `editable` is
// hard-disabled when overriding because contractors can't write to
// `locations` rows owned by another org.
export function HypervisorPage({
  building,
  incidents = [],
  onOpenChat,
  onOpenIncident,
  onOpenAgent,
  onOpenServiceLine,
  orgIdOverride,
  editable: editableProp,
  view3d,
  viewerMode: viewerModeProp,
  onViewerModeChange,
}) {
  const t = useT();
  const session = useSession();
  const isEcosystem = building?.kind === 'ecosystem';
  const isImf = building?.variant === 'imf';
  const orgId = orgIdOverride ?? session?.organizationId;
  const editable = editableProp ?? !orgIdOverride;
  // The VIEWER's own org (independent of orgIdOverride, which pins the tree
  // to the building owner). A contractor viewing a customer building gets a
  // different SLA data source — see the slas tab below.
  const activeOrg = useActiveOrg();
  const isContractorViewer = activeOrg?.kind === 'contractor';
  // Ecosystems default to map; buildings default to tree. The 3D
  // viewer used to live behind an in-card Tree | 3D toggle here;
  // it now lives in the OPERATE sub-nav as the sibling `hypervisor3d`
  // tab, which mounts this component with `view3d` set. We still
  // keep the `buildingView` state for a moment of backward-compat,
  // but the prop wins.
  const [ecosystemView, setEcosystemView] = useState('map'); // 'map' | 'tree'
  const buildingView = view3d ? '3d' : 'tree';
  const [selected, setSelected] = useState(null);
  // PR #201 — clicking a route from the room/floor context bubbles a
  // route id up here; the right pane then swaps to RouteDetailCard.
  // Clears automatically when the user picks a different tree node or
  // switches building.
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  // Reset selection when the active building changes.
  useEffect(() => {
    setSelected(null);
    setSelectedRouteId(null);
  }, [building?.id]);
  // Clear the route detail any time the tree node changes — a tree
  // click is an unambiguous "I want to look at this node" signal.
  useEffect(() => {
    setSelectedRouteId(null);
  }, [selected?.id]);

  // Command-palette deep-link consumption. The palette stashes a
  // {buildingId, selectId, routeId, ts} blob in merlinHyperPending +
  // routes to Operations → Hypervisor. On mount we read it ONCE
  // (consume + clear) so back-navigations don't re-apply a stale
  // selection. selectId is looked up against the loaded tree node;
  // if the id is unknown (e.g. cross-tenant or zone-derived guess)
  // the building stays open + the right pane reads its detail.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('merlinHyperPending');
      if (!raw) return;
      const hint = JSON.parse(raw);
      // Stale-hint guard: ignore hints older than 30s so we don't
      // accidentally consume one set during a different navigation.
      if (!hint?.ts || Date.now() - hint.ts > 30_000) {
        localStorage.removeItem('merlinHyperPending');
        return;
      }
      // Only consume when the hint matches the currently-rendered
      // building. Otherwise we'd flash the wrong tree.
      if (hint.buildingId && hint.buildingId !== building?.id) return;
      if (hint.routeId) setSelectedRouteId(hint.routeId);
      if (hint.selectId) {
        // The LocationTree owns its own nodes map; we don't have a
        // direct read of it here. Setting selected with just an id
        // works because LocationTree's onSelect contract is "pass
        // the node back when you have one"; selecting with {id,
        // name: id} is enough for the right-pane render to kick in
        // and the tree highlights via selectedId matching.
        setSelected({ id: hint.selectId, name: hint.selectId, kind: 'unknown' });
      }
      localStorage.removeItem('merlinHyperPending');
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building?.id]);

  // Phase 4 — load-progress summary surfaced from the tree component.
  // { byKind: { floor: 50, restroom: 360, … }, deviceCount, totalNodes }
  const [summary, setSummary] = useState(null);
  // Phase 4 — bulk-load modal + a tick that bumps after a successful
  // import so the tree refetches.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTick, setBulkTick] = useState(0);
  const handleSummary = useCallback((s) => setSummary(s), []);

  // 3D-viewer header controls. State lives up here so the buttons in
  // the card header can drive the viewer below via props.
  //   - nowFilter: 'all' | 'today'  → narrows pill counts to today's
  //     pending asks only. Defaults to 'today' (PR #645): tenant orgs
  //     accumulate weeks of pending asks (Meridian HQ has ~1.8K open),
  //     so opening the viewer on "all" surfaces overwhelming counts
  //     that aren't actionable. TODAY is the sensible default; the
  //     operator can flip to all if they need historical context.
  //   - livePaused: bool            → freezes realtime updates so the
  //     viewer stops blinking when the operator wants to read.
  //   - testCounter: increments     → each click triggers one random
  //     synthetic flash in the viewer (demo / smoke-test affordance).
  const [nowFilter, setNowFilter] = useState('today');
  const [livePaused] = useState(false);
  const [testCounter] = useState(0);
  // Activity feed panel toggle — when on, a right-side panel shows
  // every event (pending + resolved) for the building with All / CTAs
  // / Open / Resolved tabs. Off by default so the canvas keeps full
  // width; the operator opts in when they want the work queue.
  const [activityOpen, setActivityOpen] = useState(false);

  // Replay slider state — PR #746. 0 = NOW (live), increasing = how
  // many ms back in time the canvas is showing. Filters ctaRows by
  // spawn time so the operator can scrub the last 6h of events.
  // Persisted in memory only (snaps back to live on reload).
  const [replayBackMs, setReplayBackMs] = useState(0);
  // Tick at 30s so the "Now" reference moves forward and the displayed
  // timestamp stays current even when the user isn't interacting.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const replayAt = nowTick - replayBackMs;

  // 3D viewer top-level mode: 'merlin' / 'agents' / 'slas' / 'sensing'.
  // PR #727: state lifted to the parent (Operations.jsx) so the
  // segmented toggle can live in the gradient sub-nav band. Fall back
  // to local state when the prop is absent (defensive — keeps this
  // component usable standalone). Persistence handled by the parent.
  const [localViewerMode, setLocalViewerMode] = useState(() => {
    try {
      return localStorage.getItem('hyperViewerMode') || 'merlin';
    } catch {
      return 'merlin';
    }
  });
  const viewerMode = viewerModeProp ?? localViewerMode;
  const setViewerMode = onViewerModeChange ?? setLocalViewerMode;
  const [agentsSubMode, setAgentsSubMode] = useState(() => {
    try {
      return localStorage.getItem('hyperAgentsSubMode') || 'live';
    } catch {
      return 'live';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('hyperAgentsSubMode', agentsSubMode);
    } catch {
      /* noop */
    }
  }, [agentsSubMode]);

  // PR #759 + #762: every Hypervisor data path reads events. The
  // simulator-events-bridge writes incidents to events; migration 168
  // backfilled every pending agent_run; writeAgentRun emits an event
  // on each new decision — so events is the unified source.
  const buildingEvents = useEventsForBuilding(orgId, building?.id, {
    includeResolved: false,
    limit: 200,
  });
  // Sidebar-driven agent filter for Merlin mode. null = "All agents".
  // Reset when the active building changes so a per-building filter
  // doesn't carry over.
  const [merlinAgentFilter, setMerlinAgentFilter] = useState(null);
  useEffect(() => {
    setMerlinAgentFilter(null);
  }, [building?.id]);
  // Per-agent breakdown of the unresolved events (= pending asks +
  // any unresolved non-ask events the agent emitted). Drives the
  // sidebar's filter list AND the 3D floor tints below.
  const merlinByAgent = useMemo(() => {
    const m = new Map();
    for (const e of buildingEvents) {
      const aid = e.processed_by_agent_id || e.kind || 'unknown';
      if (!m.has(aid)) m.set(aid, []);
      m.get(aid).push(e);
    }
    return Array.from(m.entries())
      .map(([agentId, items]) => ({
        agentId,
        items,
        count: items.length,
        color: colorForAgent(agentId),
      }))
      .sort((a, b) => b.count - a.count);
  }, [buildingEvents]);
  // Per-location_id bucket of the (agent-scoped) unresolved events.
  // SINGLE SOURCE OF TRUTH for Merlin mode's 3D surface: both the
  // floor TINT (merlinFloorHighlights, below) AND the floor-click
  // POPUP (passed to the viewer as merlinFloorActivity) derive from
  // THIS map, keyed by raw location_id exactly as the tint always
  // was. The viewer resolves location_id → floor identically for both
  // so a tinted floor can never disagree with its popup. PR #936-ish.
  // Rows are AlertRow-shaped (decision_reason / agent_id / created_at)
  // so the viewer's legacy ActivityPanel fallback path renders them.
  const merlinFloorActivity = useMemo(() => {
    const m = new Map();
    if (!buildingEvents.length) return m;
    const scoped = merlinAgentFilter
      ? buildingEvents.filter((e) => (e.processed_by_agent_id || e.kind) === merlinAgentFilter)
      : buildingEvents;
    for (const e of scoped) {
      if (!e.location_id) continue;
      const row = {
        id: e.id,
        location_id: e.location_id,
        agent_id: e.processed_by_agent_id || e.kind,
        decision: e.decision,
        decision_reason: e.decision_reason || e.payload?.title || `${e.kind} signal`,
        confidence: e.confidence ?? null,
        created_at: e.created_at,
        ask_resolution: e.ask_resolution || null,
      };
      const arr = m.get(e.location_id);
      if (arr) arr.push(row);
      else m.set(e.location_id, [row]);
    }
    return m;
  }, [buildingEvents, merlinAgentFilter]);
  // Floor-tint payload for HypervisorViewer3D — same shape SLAs use.
  // Derived FROM merlinFloorActivity so a floor is tinted iff the map
  // has rows for its location_id (guaranteeing tint/popup coherence).
  // Each floor's color is the active agent's colour (or a neutral
  // indigo when "All" is active so different agents don't create
  // stripey rainbows on the tower). Intensity scales gently with
  // count so floors with more activity read brighter.
  const merlinFloorHighlights = useMemo(() => {
    if (merlinFloorActivity.size === 0) return [];
    const maxCount = Array.from(merlinFloorActivity.values()).reduce((m, rows) => Math.max(m, rows.length), 0) || 1;
    const baseColor = merlinAgentFilter ? colorForAgent(merlinAgentFilter) : '#6366f1'; // indigo — neutral "any agent" tint
    return Array.from(merlinFloorActivity.entries()).map(([location_id, rows]) => ({
      location_id,
      color: baseColor,
      intensity: 0.35 + 0.55 * (rows.length / maxCount),
    }));
  }, [merlinFloorActivity, merlinAgentFilter]);
  useMemo(() => {
    const list = buildingEvents.map((e) => {
      const ts = e.created_at ? new Date(e.created_at).getTime() : 0;
      // Approve / Hold are only meaningful when the event has a
      // backing agent_run with decision='ask' awaiting human action.
      const canResolve = e.decision === 'ask' && !e.ask_resolution;
      return {
        id: e.id,
        location_id: e.location_id,
        color: '#ef4444',
        title: e.decision_reason || e.payload?.title || `${e.kind} signal`,
        body: e.payload?.sub || null,
        priority: e.severity === 'critical' ? 'critical' : 'attention',
        agentId: e.processed_by_agent_id || e.kind,
        ...(canResolve
          ? {
              onApprove: () => resolveEvent(e.id, 'approve'),
              onHold: () => resolveEvent(e.id, 'hold'),
            }
          : {}),
        // Drawer fields.
        agent_id: e.processed_by_agent_id || e.kind,
        decision: e.decision,
        decision_reason: e.decision_reason,
        confidence: e.confidence ?? null,
        created_at: e.created_at,
        ask_resolution: e.ask_resolution || null,
        raw: e,
        _ts: ts,
      };
    });
    const merged = list.filter((r) => r._ts <= replayAt);
    merged.sort((a, b) => b._ts - a._ts);
    return merged.slice(0, 6);
  }, [buildingEvents, replayAt]);

  // PR #762: Agents-mode sub-pickers (Live / Resolved / Pending) all
  // read the unified events table. buildingEvents holds the same
  // unresolved set buildingEvents above does; agentsEvents widens to
  // include resolved rows for the Resolved bucket.
  const agentsEvents = useEventsForBuilding(orgId, building?.id, {
    includeResolved: true,
    limit: 300,
  });
  const liveAgentRuns = useMemo(() => {
    // 15-min window (was 5): the replay emits floor-resolved agent activity in
    // batches ~5 min apart, so a tight 5-min window frequently fell in a gap
    // and read "No live agent activity" mid-demo. 15 min always spans 2-3
    // batches → the view stays alive without showing stale activity.
    const cutoff = Date.now() - 15 * 60 * 1000;
    return agentsEvents
      .filter((e) => {
        const ts = e.created_at ? new Date(e.created_at).getTime() : 0;
        return ts >= cutoff && (e.decision === 'act' || e.decision === 'ask' || !e.processed_at);
      })
      .slice(0, 60);
  }, [agentsEvents]);
  const resolvedAgentRuns = useMemo(() => agentsEvents.filter((e) => e.resolved).slice(0, 60), [agentsEvents]);
  // Pending asks MUST come from the UNRESOLVED set (buildingEvents), not the
  // includeResolved+capped agentsEvents: during active demo periods the 300
  // most-recent events fill with RESOLVED activity and push the (older but still
  // open) unresolved asks out of the window, so Agents → Pending falsely read
  // "No pending agent asks" even though usePendingAsksByLocation — uncapped and
  // unresolved-only — still listed the agents. buildingEvents is unresolved-only.
  const pendingAgentRuns = useMemo(
    () => buildingEvents.filter((e) => e.decision === 'ask' && !e.ask_resolution).slice(0, 80),
    [buildingEvents],
  );

  // SLA mode state — JB asked to surface SLAs on the 3D building.
  // useSlaPerformance returns { slas, perf, openAskBySlaId, loaded }.
  // We only fetch when the viewer is actually in 'slas' mode; the
  // hook itself is cheap but lets us skip the per-SLA computeXxx calls
  // until the operator actually picks the tab.
  // Owner/FM SLA path: live perf computed from public.slas scoped to the
  // building owner's org. Gated to NON-contractor viewers — a contractor's
  // own org has no slas rows, so this would just read empty.
  const slaPerf = useSlaPerformance(viewerMode === 'slas' && !isContractorViewer ? orgId : null);
  // Contractor SLA path: contract-scoped owner SLAs via the /performance
  // bridge (RLS lets the contractor read its counterparty SLAs, but not the
  // owner's source tables, so the live % must come from the server). Keyed on
  // the contractor's OWN org (session), not orgId — which may be overridden.
  const contractorSlas = useContractorBuildingSlas(
    viewerMode === 'slas' && isContractorViewer ? session?.organizationId : null,
    building?.id || null,
  );
  const slaBuildingId = building?.id || null;
  // Filter contributors to only the active building's locations
  // (dash-bounded prefix match, same shape as useEventsForBuilding).
  const filterContributorsForBuilding = useCallback(
    (contributors) => {
      if (!Array.isArray(contributors) || !slaBuildingId) return [];
      return contributors.filter((c) => {
        const loc = c?.location_id;
        if (!loc) return false;
        return loc === slaBuildingId || loc.startsWith(slaBuildingId + '-');
      });
    },
    [slaBuildingId],
  );
  // Per-SLA in-building breach count (drives the picker's secondary
  // text + the floor highlight intensity). Computed lazily once perf
  // is loaded.
  const slaRows = useMemo(() => {
    if (viewerMode !== 'slas') return [];
    let rows;
    if (isContractorViewer) {
      // Contractor view: rows are pre-mapped by useContractorBuildingSlas
      // (contract-scoped owner SLAs, no per-floor contributors).
      if (!contractorSlas.loaded) return [];
      rows = contractorSlas.rows;
    } else {
      if (!slaPerf.loaded) return [];
      rows = (slaPerf.slas || []).map((sla) => {
        const p = slaPerf.perf?.[sla.id] || {};
        const contributors = filterContributorsForBuilding(p.contributors);
        const localBreaches = contributors.reduce((s, c) => s + (c.count || 0), 0);
        return {
          sla,
          status: p.status || 'pending',
          current: p.current ?? null,
          target: p.target ?? Number(sla.target_pct),
          breachesMtd: p.breaches_mtd ?? null,
          contributors,
          localBreaches,
          openAsk: slaPerf.openAskBySlaId?.[sla.id] || null,
        };
      });
    }
    // Shared sort across both sources: breaching > at_risk > compliant >
    // pending, then by local breach count desc so the SLAs hitting THIS
    // building float up. (Contractor rows carry localBreaches=0, so they
    // fall back to status order alone — which is what we want.)
    return [...rows].sort((a, b) => {
      const rank = (s) => (s === 'breaching' ? 0 : s === 'at_risk' ? 1 : s === 'ok' ? 2 : 3);
      const dr = rank(a.status) - rank(b.status);
      if (dr !== 0) return dr;
      return (b.localBreaches || 0) - (a.localBreaches || 0);
    });
  }, [viewerMode, isContractorViewer, contractorSlas, slaPerf, filterContributorsForBuilding]);
  // Loaded flag for the picker/detail spinner — tracks whichever source is
  // active for this viewer.
  const slaLoaded = isContractorViewer ? contractorSlas.loaded : slaPerf.loaded;
  const [selectedSlaId, setSelectedSlaId] = useState(null);
  // Sensing tab — which sensor metric currently paints the floor
  // tints. null = no overlay (clean wireframe). 'airquality' is the
  // first metric shipped; future metrics (temperature, occupancy)
  // plug into the same picker without further state.
  const [sensingMetric, setSensingMetric] = useState(null);

  // Chat → viewer control bus (hypervisor-control.js). Merlin can switch the
  // viewer mode + pick a Sensing metric from chat. A request that fired before
  // this host mounted (chat triggered it from another page → App navigated
  // here) is latched and replayed on mount via peek. setViewerMode is the
  // canonical mode setter (onViewerModeChange when embedded, else internal).
  useEffect(() => {
    const apply = (req) => {
      if (!req) return;
      if (req.mode) setViewerMode(req.mode);
      if (req.metric !== undefined) setSensingMetric(req.metric);
    };
    apply(peekHypervisorControl());
    return subscribeHypervisorControl(apply);
  }, [setViewerMode]);
  // Default-select the first row when the picker hydrates, but only
  // if nothing's picked yet (preserve operator's manual pick across
  // re-renders from realtime updates).
  useEffect(() => {
    if (viewerMode !== 'slas') return;
    if (selectedSlaId) return;
    if (slaRows.length === 0) return;
    setSelectedSlaId(slaRows[0].sla.id);
  }, [viewerMode, slaRows, selectedSlaId]);
  // Clear picked SLA when leaving the tab so re-entry default-selects.
  useEffect(() => {
    if (viewerMode !== 'slas') setSelectedSlaId(null);
  }, [viewerMode]);
  const selectedSlaRow = useMemo(
    () => slaRows.find((r) => r.sla.id === selectedSlaId) || null,
    [slaRows, selectedSlaId],
  );
  // Floor highlights for the 3D viewer — derived from selected SLA's
  // contributors. Intensity = count / maxCount so the most-impacted
  // floor reads brightest. Color ramp from amber (at_risk) → red
  // (breaching) follows the SLA's overall status.
  const slaFloorHighlights = useMemo(() => {
    if (!selectedSlaRow) return null;
    const contributors = selectedSlaRow.contributors;
    if (contributors.length === 0) return [];
    const maxCount = contributors.reduce((m, c) => Math.max(m, c.count || 0), 0) || 1;
    const baseColor =
      selectedSlaRow.status === 'breaching' ? '#ef4444' : selectedSlaRow.status === 'at_risk' ? '#f59e0b' : '#3b82f6'; // ok / pending — neutral blue informational tint
    return contributors.map((c) => ({
      location_id: c.location_id,
      color: baseColor,
      intensity: 0.35 + 0.65 * ((c.count || 0) / maxCount),
    }));
  }, [selectedSlaRow]);
  // Group rows by SLA domain (hygiene / comfort / air / supplies / safety
  // / space / uptime / energy / security / compliance). Domains are
  // sorted by their worst row's status (breaching first), then by total
  // local breach count. Within a group, rows keep slaRows' inner sort.
  const slaGroups = useMemo(() => {
    if (slaRows.length === 0) return [];
    const STATUS_RANK = { breaching: 0, at_risk: 1, ok: 2, pending: 3 };
    const byDomain = new Map();
    for (const row of slaRows) {
      const key = row.sla.domain || 'other';
      if (!byDomain.has(key)) byDomain.set(key, []);
      byDomain.get(key).push(row);
    }
    const groups = Array.from(byDomain.entries()).map(([domain, rows]) => ({
      domain,
      rows,
      worstStatus: rows.reduce(
        (s, r) => ((STATUS_RANK[r.status] ?? 9) < (STATUS_RANK[s] ?? 9) ? r.status : s),
        'pending',
      ),
      totalLocalBreaches: rows.reduce((s, r) => s + (r.localBreaches || 0), 0),
    }));
    groups.sort((a, b) => {
      const dr = (STATUS_RANK[a.worstStatus] ?? 9) - (STATUS_RANK[b.worstStatus] ?? 9);
      if (dr !== 0) return dr;
      return (b.totalLocalBreaches || 0) - (a.totalLocalBreaches || 0);
    });
    return groups;
  }, [slaRows]);
  const agentRunsForView = useMemo(() => {
    if (viewerMode !== 'agents') return null;
    const src =
      agentsSubMode === 'live' ? liveAgentRuns : agentsSubMode === 'resolved' ? resolvedAgentRuns : pendingAgentRuns;
    return (src || []).map((e) => ({
      id: e.id,
      agent_id: e.processed_by_agent_id || e.kind,
      location_id: e.location_id || null,
      decision: e.decision || null,
      decision_reason: e.decision_reason || e.payload?.title || null,
      confidence: e.confidence ?? null,
      created_at: e.created_at || null,
      ask_resolution: e.ask_resolution || null,
      raw: e,
    }));
  }, [viewerMode, agentsSubMode, liveAgentRuns, resolvedAgentRuns, pendingAgentRuns]);

  // ── ASSETS tab — per-floor tracked-asset coverage + geofence status ──
  // Asset-tracking is mostly `skip` ("all assets within geofence"), which
  // emits no event — so unlike Merlin/Agents (events-based) we read
  // agent_runs directly (useAssetTrackingRuns, skips included). Tab-gated so
  // it only fetches when ASSETS is open. We reuse the SLA/Merlin
  // floorHighlights + per-floor popup shape, so the 3D viewer needs no
  // asset-specific code.
  const assetRuns = useAssetTrackingRuns(orgId, building?.id, viewerMode === 'assets');
  const assetFloorActivity = useMemo(() => {
    const m = new Map();
    for (const r of assetRuns) {
      if (!r.location_id) continue;
      const arr = m.get(r.location_id);
      if (arr) arr.push(r);
      else m.set(r.location_id, [r]);
    }
    return m;
  }, [assetRuns]);
  const assetFloorHighlights = useMemo(() => {
    if (assetFloorActivity.size === 0) return [];
    const maxCount = Array.from(assetFloorActivity.values()).reduce((mx, rows) => Math.max(mx, rows.length), 0) || 1;
    return Array.from(assetFloorActivity.entries()).map(([location_id, rows]) => {
      // Any unresolved breach/missing ask on the floor → amber; otherwise the
      // assets are tracked & within geofence (skip / acted) → green.
      const hasAlert = rows.some((r) => r.decision === 'ask' && !r.ask_resolution);
      return {
        location_id,
        color: hasAlert ? '#f59e0b' : '#10b981',
        intensity: 0.4 + 0.5 * (rows.length / maxCount),
      };
    });
  }, [assetFloorActivity]);

  // ── SENSING tab — REAL per-floor readings (mig 240). The 4 ambient metrics
  // come from the airq device fabric (one sensor/floor); occupancy from the live
  // people-counter count_report events. Viewer-scoped RPC, polled. Tab-gated.
  const { byFloor: sensorReadings } = useBuildingSensorReadings(
    building,
    orgId,
    viewerMode === 'sensing' ? sensingMetric : null,
  );

  // ── SERVICING tab — building tinted where the servicing agent fired +
  // a live service-line rollup on the right. Servicing is org/domain-level
  // (not floor-resolved), so the tint reuses the servicing agent's events
  // (which carry the building location_id) via the proven Merlin path, and
  // the rollup panel carries the real per-domain health. Tab-gated.
  // `viewer: true` → contained, viewer-aware roll-up: a contractor viewing a
  // client building sees only their contracted service lines; the owner sees
  // all (parity). Fixes the "No data" panel for contractors (mig 214).
  const servicingRollup = useServicingRollup(building, viewerMode === 'servicing' ? orgId : null, { viewer: true });
  // Live open-items for the location-aware 3D viewer (real floor tints +
  // off-floor anchors + the "By location" rail). Only fetched in servicing mode.
  const servicingOpenItems = useServicingOpenItems(building, viewerMode === 'servicing' ? orgId : null);
  const servicingFloorActivity = useMemo(() => {
    const m = new Map();
    if (viewerMode !== 'servicing') return m;
    for (const e of buildingEvents) {
      if ((e.processed_by_agent_id || e.kind) !== 'servicing') continue;
      if (!e.location_id) continue;
      const row = {
        id: e.id,
        location_id: e.location_id,
        agent_id: 'servicing',
        decision: e.decision,
        decision_reason: e.decision_reason || e.payload?.title || 'servicing signal',
        confidence: e.confidence ?? null,
        created_at: e.created_at,
        ask_resolution: e.ask_resolution || null,
      };
      const arr = m.get(e.location_id);
      if (arr) arr.push(row);
      else m.set(e.location_id, [row]);
    }
    return m;
  }, [buildingEvents, viewerMode]);
  const servicingFloorHighlights = useMemo(() => {
    if (servicingFloorActivity.size === 0) return [];
    const maxCount =
      Array.from(servicingFloorActivity.values()).reduce((mx, rows) => Math.max(mx, rows.length), 0) || 1;
    return Array.from(servicingFloorActivity.entries()).map(([location_id, rows]) => {
      const hasAsk = rows.some((r) => r.decision === 'ask' && !r.ask_resolution);
      return {
        location_id,
        color: hasAsk ? '#f59e0b' : '#14b8a6', // amber = pending ask, else servicing teal
        intensity: 0.4 + 0.5 * (rows.length / maxCount),
      };
    });
  }, [servicingFloorActivity]);

  // Belt-and-suspenders gate. Operations.jsx already hides the
  // sub-nav entry for crew/observer roles, but if someone deep-links
  // here with a non-admin profile they get a clean access-denied
  // pane instead of the surface.
  if (!canAccessHypervisor(session?.role, session?.isPlatformAdmin)) {
    return (
      <main style={{ flex: 1, padding: 'var(--pad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ maxWidth: 480, padding: 'calc(var(--pad) * 1.4)', textAlign: 'center' }}>
          <Icon.shield size={28} style={{ color: 'var(--text-faint)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{t('hyper.access.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
            {t('hyper.access.body')}
          </div>
        </Card>
      </main>
    );
  }

  // 3D viewer is per-building (operates on a single building's floor
  // stack). When the active workspace is an ecosystem, nudge the
  // operator to pick one of its buildings.
  if (view3d && isEcosystem) {
    return (
      <main style={{ flex: 1, padding: 'var(--pad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ maxWidth: 460, padding: 'calc(var(--pad) * 1.4)', textAlign: 'center' }}>
          <Icon.building size={26} style={{ color: 'var(--text-faint)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{t('hyper3d.ecosystem.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
            {t('hyper3d.ecosystem.body')}
          </div>
        </Card>
      </main>
    );
  }

  // Ecosystems: tree + map toggle. Tree shows devices alongside
  // location nodes (Phase 1).
  if (isEcosystem) {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: 'var(--pad)',
          gap: 'var(--pad)',
        }}
      >
        <Card
          pad={false}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <Icon.hypervisor size={14} style={{ color: 'var(--accent)' }} />
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{t('dashboard.hypervisor')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
              {isImf
                ? `· ${building.branches} ${t('ecosystem.buildings')} · Washington, DC`
                : `· ${building.branches} ${t('ecosystem.branches')} · NY State`}
            </div>
            <div style={{ flex: 1 }} />
            <ViewToggle value={ecosystemView} onChange={setEcosystemView} />
          </div>
          {ecosystemView === 'map' ? (
            <div style={{ flex: 1, minHeight: 0 }}>{isImf ? <ImfMap building={building} /> : <EcosystemMap />}</div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
                minHeight: 0,
              }}
            >
              <div style={{ overflow: 'auto', borderRight: '1px solid var(--border)' }}>
                <LocationTree
                  rootId={building.id}
                  orgId={orgId}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                  includeDevices
                  editable={editable}
                />
              </div>
              <div style={{ overflow: 'auto' }}>
                {selectedRouteId ? (
                  <RouteDetailCard routeId={selectedRouteId} onBack={() => setSelectedRouteId(null)} />
                ) : (
                  <LocationDetail
                    node={selected}
                    childrenCount={selected?._kidsCount ?? 0}
                    onAskMerlin={onOpenChat}
                    onSelectRoute={setSelectedRouteId}
                    editable={editable}
                  />
                )}
              </div>
            </div>
          )}
        </Card>
      </main>
    );
  }

  // Buildings: tree-only. Devices appear as leaves under their
  // location, so a Floor 32 expansion shows rooms, and each room
  // expansion shows the devices inside it. Selecting a device
  // surfaces its detail in the right pane.
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        padding: 'var(--pad)',
        gap: 'var(--pad)',
      }}
    >
      <Card pad={false} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <Icon.hypervisor size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{t('dashboard.hypervisor')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
            · {building?.name || t('hyper.fallback_workspace')}
          </div>
          {selected && selected.id !== building?.id && <Pill tone="accent">{selected.name}</Pill>}
          <SummaryStrip summary={summary} t={t} />
          <div style={{ flex: 1 }} />
          {/* Merlin/Agents/SLAs/Sensing toggle moved to the gradient
              sub-nav band in PR #727. Sub-mode pills (Live/Resolved/
              Pending) stay here since they only apply to Agents mode
              and read cleaner adjacent to the canvas controls. */}
          {buildingView === '3d' && viewerMode === 'agents' && (
            <>
              <HeaderToggle
                active={agentsSubMode === 'live'}
                onClick={() => setAgentsSubMode('live')}
                title="Runs created in the last 15 minutes"
              >
                LIVE
              </HeaderToggle>
              <HeaderToggle
                active={agentsSubMode === 'resolved'}
                onClick={() => setAgentsSubMode('resolved')}
                title="Recently-actioned runs (auto-acted or human-approved)"
              >
                RESOLVED
              </HeaderToggle>
              <HeaderToggle
                active={agentsSubMode === 'pending'}
                onClick={() => setAgentsSubMode('pending')}
                title="Asks awaiting human review"
              >
                PENDING
              </HeaderToggle>
            </>
          )}
          {/* Merlin-mode header toggles intentionally removed. The
              new sidebar layout (matches Agents/SLAs) puts agent
              filter + activity list on the right; legacy pill counts
              + time slider are gone, so TODAY/TEST/PAUSED/ACTIVITY
              no longer have anything to gate. Keep TEST as a back-
              office demo trigger only if we wire it into the sidebar
              later. */}
          {editable && buildingView === 'tree' && (
            <button
              onClick={() => setBulkOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon.ship size={11} />
              {t('hyper.bulk.cta')}
            </button>
          )}
        </div>
        {buildingView === '3d' ? (
          viewerMode === 'sensing' ? (
            // Sensing tab. Clean canvas (no chips/pills/slider) with a
            // metric-picker button strip overlay (top-left). Selecting a metric
            // paints per-floor tints from REAL readings (building_sensor_readings,
            // mig 240): the airq device fabric for ambient metrics, live
            // people-counter counts for occupancy.
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <Suspense
                fallback={
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AdaptivLoader size="md" />
                  </div>
                }
              >
                <HypervisorViewer3D
                  buildingId={building?.id}
                  orgId={orgId}
                  sensingMetric={sensingMetric}
                  onSelectSensingMetric={setSensingMetric}
                  sensorReadings={sensorReadings}
                />
              </Suspense>
            </div>
          ) : viewerMode === 'slas' ? (
            // SLA view: 3D viewer LEFT, picker MIDDLE, detail card RIGHT.
            // JB asked 2026-05-28: the building is the main canvas and
            // should always sit leftmost regardless of mode. Picker +
            // detail card stack to the right of it.
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 300px) minmax(280px, 340px)',
              }}
            >
              <div style={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
                <Suspense
                  fallback={
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AdaptivLoader size="md" />
                    </div>
                  }
                >
                  <HypervisorViewer3D buildingId={building?.id} orgId={orgId} floorHighlights={slaFloorHighlights} />
                </Suspense>
              </div>
              <SlaPicker
                groups={slaGroups}
                rowCount={slaRows.length}
                loaded={slaLoaded}
                selectedId={selectedSlaId}
                onSelect={setSelectedSlaId}
                t={t}
              />
              <SlaDetailCard row={selectedSlaRow} loaded={slaLoaded} t={t} />
            </div>
          ) : viewerMode === 'merlin' ? (
            // Merlin mode: same sandwich shape as SLAs (3D LEFT,
            // sidebar RIGHT). The legacy in-canvas chip bar, floor
            // pills, time slider, and CTA cards are all retired —
            // floorHighlights tints the 3D + the sidebar owns every
            // interaction. JB asked 2026-05-28: "drop the floor pills,
            // keep the canvas clean."
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
              }}
            >
              <div style={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
                <Suspense
                  fallback={
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AdaptivLoader size="md" />
                    </div>
                  }
                >
                  <HypervisorViewer3D
                    buildingId={building?.id}
                    orgId={orgId}
                    floorHighlights={merlinFloorHighlights}
                    merlinFloorActivity={merlinFloorActivity}
                  />
                </Suspense>
              </div>
              <MerlinSidePanel
                events={buildingEvents}
                byAgent={merlinByAgent}
                activeAgent={merlinAgentFilter}
                onSelectAgent={(agentId) => setMerlinAgentFilter((prev) => (prev === agentId ? null : agentId))}
                loaded={buildingEvents.loaded !== false}
                t={t}
              />
            </div>
          ) : viewerMode === 'servicing' ? (
            // SERVICING — 3D LEFT (tinted where the servicing agent fired),
            // service-line rollup RIGHT. Same sandwich as Merlin/SLAs.
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
              }}
            >
              <div style={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
                <Suspense
                  fallback={
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AdaptivLoader size="md" />
                    </div>
                  }
                >
                  <HypervisorViewer3D
                    buildingId={building?.id}
                    orgId={orgId}
                    floorHighlights={servicingFloorHighlights}
                    servicingHeatRows={servicingRollup?.rows || []}
                    servicingOpenItems={servicingOpenItems?.items || []}
                    merlinFloorActivity={servicingFloorActivity}
                    onOpenChat={onOpenChat}
                    onOpenIncident={onOpenIncident}
                    onOpenAgent={onOpenAgent}
                  />
                </Suspense>
              </div>
              <ServicingSidePanel rollup={servicingRollup} onOpenServiceLine={onOpenServiceLine} />
            </div>
          ) : viewerMode === 'assets' ? (
            // ASSETS — floors tinted by tracked-asset coverage (green = within
            // geofence, amber = geofence/missing alert). Floor-click drills
            // into the asset-tracking runs via the shared ActivityPanel.
            // Reuses the SLA/Merlin floorHighlights + popup path, so the 3D
            // viewer needs no asset-specific code.
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <Suspense
                fallback={
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AdaptivLoader size="md" />
                  </div>
                }
              >
                <HypervisorViewer3D
                  buildingId={building?.id}
                  orgId={orgId}
                  floorHighlights={assetFloorHighlights}
                  merlinFloorActivity={assetFloorActivity}
                  onOpenChat={onOpenChat}
                  onOpenIncident={onOpenIncident}
                  onOpenAgent={onOpenAgent}
                />
              </Suspense>
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '10px 12px',
                  background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  backdropFilter: 'blur(12px) saturate(180%)',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                  pointerEvents: 'none',
                  fontSize: 11.5,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('hyper.assets.legend_title')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: '#10b981', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-soft)' }}>{t('hyper.assets.ok')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-soft)' }}>{t('hyper.assets.alert')}</span>
                </div>
                {assetFloorHighlights.length === 0 && (
                  <div
                    style={{
                      color: 'var(--text-dim)',
                      fontSize: 10.5,
                      marginTop: 2,
                      maxWidth: 190,
                      lineHeight: 1.4,
                      whiteSpace: 'normal',
                    }}
                  >
                    {t('hyper.assets.empty')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <Suspense
                fallback={
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AdaptivLoader size="md" />
                  </div>
                }
              >
                <HypervisorViewer3D
                  buildingId={building?.id}
                  orgId={orgId}
                  nowFilter={nowFilter}
                  onSetNowFilter={setNowFilter}
                  livePaused={livePaused}
                  testCounter={testCounter}
                  activityOpen={activityOpen}
                  onCloseActivity={() => setActivityOpen(false)}
                  incidents={incidents}
                  onOpenChat={onOpenChat}
                  onOpenIncident={onOpenIncident}
                  onOpenAgent={onOpenAgent}
                  ctas={null}
                  agentRuns={agentRunsForView}
                  agentsMode={viewerMode === 'agents' ? agentsSubMode : null}
                  replayBackMs={replayBackMs}
                  onReplayBackMsChange={setReplayBackMs}
                  replayShowSlider={false}
                  replayCount={0}
                />
              </Suspense>
            </div>
          )
        ) : (
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)',
              minHeight: 0,
            }}
          >
            <div style={{ overflow: 'auto', borderRight: '1px solid var(--border)' }}>
              <LocationTree
                rootId={building?.id || 'hq'}
                orgId={orgId}
                selectedId={selected?.id}
                onSelect={setSelected}
                includeDevices
                editable={editable}
                onSummary={handleSummary}
                refreshSignal={bulkTick}
              />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {selectedRouteId ? (
                <RouteDetailCard routeId={selectedRouteId} onBack={() => setSelectedRouteId(null)} />
              ) : (
                <LocationDetail
                  node={selected}
                  childrenCount={selected?._kidsCount ?? 0}
                  onAskMerlin={onOpenChat}
                  onSelectRoute={setSelectedRouteId}
                  editable={editable}
                />
              )}
            </div>
          </div>
        )}
      </Card>
      {bulkOpen && (
        <BulkLoadModal
          rootId={building?.id || 'hq'}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setBulkOpen(false);
            setBulkTick((n) => n + 1);
          }}
        />
      )}
    </main>
  );
}

// Phase 4 — load-progress strip in the Hypervisor header. Reads a
// `{byKind, deviceCount, totalNodes}` summary from LocationTree and
// renders a compact set of "N floors · M rooms · K devices" pills.
// Only shows the kinds with non-zero counts so brand-new orgs don't
// see a row of zeros. Hides entirely when summary is null (initial
// render before the tree's first hydrate).
function SummaryStrip({ summary, t }) {
  if (!summary) return null;
  const { byKind, deviceCount, totalNodes } = summary;
  if (!totalNodes) return null;
  // Group kinds into a few headline rollups + spread the rest as a count.
  const floors = byKind.floor || 0;
  const rooms =
    (byKind.restroom || 0) +
    (byKind.meeting_room || 0) +
    (byKind.conference_room || 0) +
    (byKind.training_room || 0) +
    (byKind.boardroom || 0) +
    (byKind.lounge || 0) +
    (byKind.lobby || 0) +
    (byKind.cafeteria || 0) +
    (byKind.amenity || 0) +
    (byKind.auditorium || 0) +
    (byKind.server_room || 0) +
    (byKind.mailroom || 0) +
    (byKind.dock || 0);
  const zones = byKind.zone || 0;
  const positions = byKind.position || 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 4 }}>
      {floors > 0 && <SummaryPill label={t('hyper.summary.floors')} value={floors} />}
      {rooms > 0 && <SummaryPill label={t('hyper.summary.rooms')} value={rooms} />}
      {zones > 0 && <SummaryPill label={t('hyper.summary.zones')} value={zones} />}
      {positions > 0 && <SummaryPill label={t('hyper.summary.positions')} value={positions} />}
      {deviceCount > 0 && <SummaryPill label={t('hyper.summary.devices')} value={deviceCount} tone="accent" />}
    </div>
  );
}

function SummaryPill({ label, value, tone }) {
  const isAccent = tone === 'accent';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: isAccent ? 'var(--accent-soft)' : 'var(--surface-2)',
        border: '1px solid ' + (isAccent ? 'var(--accent-line)' : 'var(--border)'),
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        color: isAccent ? 'var(--accent)' : 'var(--text-soft)',
        fontFamily: 'inherit',
      }}
    >
      <strong style={{ fontWeight: 800 }}>{value}</strong>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </span>
  );
}

// Small accent-pink pill button used in the 3D viewer card header
// for the TODAY / TEST / LIVE controls. Outlined when inactive,
// filled when active. `active` is undefined for one-shot buttons
// like TEST (no toggle state).
function HeaderToggle({ active, onClick, title, children }) {
  const isActive = !!active;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 11px',
        minWidth: 56,
        background: isActive ? 'var(--accent)' : 'transparent',
        color: isActive ? '#fff' : 'var(--accent)',
        border: '1.5px solid var(--accent)',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '0.04em',
        fontFamily: 'inherit',
        cursor: 'pointer',
        textTransform: 'uppercase',
        userSelect: 'none',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {children}
    </button>
  );
}

// Phase 4 — CSV bulk-load. Admins paste a `parent_id,kind,name` CSV
// (header optional; commas-only, no quoting needed for the simple
// shape). We parse it client-side, validate, show a preview, then
// run bulkCreateChildLocations on confirm. Failures get reported
// per-row so the admin can fix and re-paste.
function BulkLoadModal({ rootId, onClose, onDone }) {
  const t = useT();
  const [text, setText] = useState('parent_id,kind,name\n' + (rootId ? `${rootId},floor,Floor 1\n` : ''));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, failed }

  // Parse CSV into [{ parentId, kind, name }, …]. Tolerates a header
  // row, trims whitespace, ignores blank lines + lines starting with #.
  function parse() {
    const out = [];
    const lines = (text || '').split(/\r?\n/);
    let sawHeader = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const cells = line.split(',').map((c) => c.trim());
      // Detect a header row by checking if the first cell is literally
      // "parent_id" — only on the first non-blank line.
      if (!sawHeader && cells[0]?.toLowerCase() === 'parent_id') {
        sawHeader = true;
        continue;
      }
      sawHeader = true;
      const [parentId, kind, ...nameParts] = cells;
      if (!parentId || !kind || nameParts.length === 0) continue;
      const name = nameParts.join(',').trim();
      if (!name) continue;
      out.push({ parentId, kind, name });
    }
    return out;
  }

  async function submit() {
    const rows = parse();
    if (rows.length === 0) {
      setResult({ ok: 0, failed: [{ index: 0, error: t('hyper.bulk.empty_error'), row: null }] });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await bulkCreateChildLocations(rows);
      setResult(res);
      if (res.ok > 0 && res.failed.length === 0) {
        // Auto-close on full success — small grace period so the
        // admin sees the green count flash by.
        setTimeout(onDone, 600);
      } else {
        // Re-open the tree but keep the modal so admin can read
        // failures.
        // (Don't auto-call onDone — modal stays.)
      }
    } catch (e) {
      setResult({ ok: 0, failed: [{ index: -1, error: e?.message || String(e), row: null }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.ship size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{t('hyper.bulk.title')}</div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
          >
            <Icon.close size={14} />
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.55 }}>{t('hyper.bulk.body')}</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 200,
              boxSizing: 'border-box',
              padding: 10,
              fontFamily: 'var(--mono)',
              fontSize: 12,
              lineHeight: 1.5,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              resize: 'vertical',
            }}
          />
          {result && (
            <div
              style={{
                padding: 10,
                borderRadius: 6,
                background:
                  result.failed.length === 0
                    ? 'color-mix(in oklch, var(--ok) 10%, transparent)'
                    : 'color-mix(in oklch, var(--warn) 10%, transparent)',
                border:
                  '1px solid ' +
                  (result.failed.length === 0
                    ? 'color-mix(in oklch, var(--ok) 30%, transparent)'
                    : 'color-mix(in oklch, var(--warn) 30%, transparent)'),
                fontSize: 12,
                color: 'var(--text)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {result.ok} created · {result.failed.length} failed
              </div>
              {result.failed.length > 0 && (
                <div
                  style={{ fontSize: 11, color: 'var(--text-soft)', display: 'flex', flexDirection: 'column', gap: 2 }}
                >
                  {result.failed.slice(0, 6).map((f, i) => (
                    <div key={i} style={{ fontFamily: 'var(--mono)' }}>
                      row {f.index + 1}: {f.error}
                    </div>
                  ))}
                  {result.failed.length > 6 && (
                    <div style={{ fontStyle: 'italic' }}>…{result.failed.length - 6} more</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {result?.ok > 0 ? t('hyper.bulk.close') : t('hyper.bulk.cancel')}
          </button>
          {(!result || result.failed.length > 0) && (
            <button
              onClick={submit}
              disabled={busy}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {busy ? t('hyper.bulk.loading') : t('hyper.bulk.submit')}
            </button>
          )}
          {result?.ok > 0 && result.failed.length === 0 && (
            <button
              onClick={onDone}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                background: 'var(--ok)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('hyper.bulk.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewToggle({ value, onChange, options }) {
  const tT = useT();
  // Default to the ecosystem map/tree pair so existing callers don't change.
  const opts = options || [
    { id: 'map', label: tT('hyper.view_map'), icon: 'building' },
    { id: 'tree', label: tT('hyper.view_tree'), icon: 'sidebar' },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface-3)', padding: 2, borderRadius: 7 }}>
      {opts.map((opt) => {
        const IconC = Icon[opt.icon] || Icon.building;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-dim)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            <IconC size={11} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ────── SLA mode (3D Hypervisor → SLAs tab) ──────────────────────
//
// SlaPicker: left rail. One row per SLA, status pill + local-breach
// count. Selecting a row drives the 3D viewer's floor highlights.
// SlaDetailCard: right rail. Current/target/breaches MTD + top
// contributors + open-ask badge when present.

const SLA_STATUS_TONE = {
  ok: { label: 'Compliant', tone: 'ok', color: '#10b981' },
  at_risk: { label: 'At risk', tone: 'warn', color: '#f59e0b' },
  breaching: { label: 'Breaching', tone: 'risk', color: '#ef4444' },
  pending: { label: 'Pending', tone: 'neutral', color: '#94a3b8' },
};

// Domain → icon glyph (mirrors Insights.jsx's SLA_DOMAIN_ICON so the
// visual language stays consistent across SLA surfaces). Fallback to
// sparkle when a new domain ships before this map catches up.
const SLA_DOMAIN_ICON = {
  hygiene: 'people',
  comfort: 'hvac',
  air: 'air',
  supplies: 'supply',
  security: 'shield',
  compliance: 'shield',
  safety: 'warn',
  space: 'room',
  uptime: 'bolt',
  energy: 'bolt',
};

// Right-rail sidebar for Hypervisor → Merlin mode. Mirrors the
// SlaPicker / SlaDetailCard shell: section title, scrollable body,
// filtered detail. Replaces the old in-canvas chip bar + floor pills
// + time slider so the 3D building reads as a clean architectural
// view. Selecting an agent in the top section filters both the floor
// tints (via merlinFloorHighlights upstream) AND the events list
// below to that agent.
// SERVICING-mode side panel — live service-line rollup (the same numbers as
// OPERATE → Services), shown beside the tinted building.
function ServicingSidePanel({ rollup, onOpenServiceLine }) {
  const sl = useSL();
  const t = useT();
  const lbl = (m) => {
    const v = t(m?.labelKey);
    return v && v !== m?.labelKey ? v : m?.fallback;
  };
  const { byTop, overall } = rollup;
  const tone = (a) => (a == null ? 'var(--text)' : a >= 90 ? '#10b981' : a >= 75 ? '#f59e0b' : '#ef4444');
  return (
    <div
      style={{
        borderLeft: '1px solid var(--border)',
        overflow: 'auto',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          {sl('Servicing', 'Services')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: tone(overall.adh) }}>
            {overall.adh != null ? `${overall.adh}%` : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{sl('overall adherence', 'adhérence globale')}</div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>
          {overall.total} {sl('items', 'élém.')} · {overall.overdue} {sl('overdue', 'en retard')} · {overall.open}{' '}
          {sl('open', 'ouv.')}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SERVICING_GROUP_DOMAINS.map((k) => {
          const s = byTop[k];
          const meta = SERVICING_DOMAIN_META[k];
          const DIcon = Icon[meta?.icon] || Icon.sparkle;
          const accent = domainAccent(k);
          // Each line deep-links to its own board in OPERATE → Services (the
          // domain key IS the view key: 'cleaning'/'security'/…). Optional —
          // host views that can't navigate (e.g. the contractor building drill-in)
          // simply pass no callback and the cards render inert.
          const clickable = !!onOpenServiceLine;
          const go = clickable ? () => onOpenServiceLine(k) : undefined;
          return (
            <div
              key={k}
              onClick={go}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        go();
                      }
                    }
                  : undefined
              }
              title={clickable ? `${sl('Open', 'Ouvrir')} ${lbl(meta)} →` : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: domainSoft(k),
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DIcon size={14} style={{ color: accent }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{lbl(meta)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {s
                    ? `${s.overdue} ${sl('overdue', 'en retard')}${s.open ? ` · ${s.open} ${sl('open', 'ouv.')}` : ''}`
                    : sl('No data', 'Aucune donnée')}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: tone(s?.adh) }}>
                {s?.adh != null ? `${s.adh}%` : '—'}
              </div>
              {clickable && (
                <span aria-hidden style={{ fontSize: 15, color: 'var(--text-faint)', marginLeft: 1 }}>
                  ›
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
        {sl(
          'Floors tint by SLA health — teal = on target, amber = at risk, red = breached. Full boards in OPERATE → Services.',
          'Les étages se teintent selon la santé SLA — turquoise = conforme, ambre = à risque, rouge = hors SLA. Tableaux complets dans OPERATE → Services.',
        )}
      </div>
    </div>
  );
}

function MerlinSidePanel({ events, byAgent, activeAgent, onSelectAgent, loaded, t }) {
  const filtered = useMemo(() => {
    if (!activeAgent) return events;
    return events.filter((e) => (e.processed_by_agent_id || e.kind) === activeAgent);
  }, [events, activeAgent]);
  // Optimistic removal of resolved asks (#issue-3). resolveEvent()
  // persists immediately but the card otherwise lingers until the
  // realtime round-trip re-fetches events — feels dead. We track the
  // ids being resolved and filter them out of the list now; on error
  // we drop the id back so the card returns.
  const [resolvingIds, setResolvingIds] = useState(() => new Set());
  const resolveAsk = useCallback(async (id, action) => {
    setResolvingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await resolveEvent(id, action);
    } catch {
      // Resolve failed → return the card so the operator can retry.
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);
  const pendingAsks = useMemo(
    () => filtered.filter((e) => e.decision === 'ask' && !e.ask_resolution && !resolvingIds.has(e.id)),
    [filtered, resolvingIds],
  );
  const totalCount = events.length;
  return (
    <div
      style={{
        // Picker sits to the right of the 3D canvas. Mirrors the SLA
        // detail card's chrome so the two modes feel like siblings.
        borderLeft: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 96%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          flexShrink: 0,
        }}
      >
        <Icon.sparkle size={11} style={{ color: 'var(--accent)' }} />
        {t('hyper.merlin.side.title') === 'hyper.merlin.side.title' ? 'Agent activity' : t('hyper.merlin.side.title')}
        {/* Count is total unresolved signals across all agents (capped
            200), NOT a number of agents — the per-agent breakdown lives
            in the list below. Title relabeled (#issue-2) to match. */}
        <span
          style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', color: 'var(--text-faint)' }}
          title={`${totalCount} signals`}
        >
          {totalCount}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!loaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <AdaptivLoader size="sm" />
          </div>
        ) : byAgent.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('hyper.merlin.side.empty') === 'hyper.merlin.side.empty'
              ? 'No agent activity on this building.'
              : t('hyper.merlin.side.empty')}
          </div>
        ) : (
          <>
            {/* Agent filter list — click to toggle filter. The selected
                agent drives both the 3D floor tints (upstream) and the
                events list below. */}
            <div style={{ padding: 8 }}>
              <MerlinAgentRow
                label={
                  t('hyper.merlin.side.all_agents') === 'hyper.merlin.side.all_agents'
                    ? 'All agents'
                    : t('hyper.merlin.side.all_agents')
                }
                color="#6366f1"
                count={totalCount}
                isSelected={!activeAgent}
                onClick={() => onSelectAgent(null)}
              />
              {byAgent.map((row) => (
                <MerlinAgentRow
                  key={row.agentId}
                  label={MERLIN_AGENT_NAME[row.agentId] || row.agentId.replace(/-/g, ' ')}
                  color={row.color}
                  count={row.count}
                  isSelected={activeAgent === row.agentId}
                  onClick={() => onSelectAgent(row.agentId)}
                />
              ))}
            </div>
            {/* Pending asks for the active agent (or all). Surfaces
                the same items the old in-canvas CTA cards did but as
                a quiet scroll list — no overlay on the building. */}
            {pendingAsks.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  padding: '10px 14px',
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}
                >
                  {t('hyper.merlin.side.pending') === 'hyper.merlin.side.pending'
                    ? `Pending · ${pendingAsks.length}`
                    : t('hyper.merlin.side.pending', { n: pendingAsks.length })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingAsks.slice(0, 12).map((e) => (
                    <MerlinAskRow key={e.id} event={e} onResolve={resolveAsk} t={t} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MerlinAgentRow({ label, color, count, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        marginBottom: 4,
        background: isSelected ? 'var(--accent-soft)' : 'transparent',
        border: `1px solid ${isSelected ? 'var(--accent-line)' : 'transparent'}`,
        borderRadius: 7,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'inherit',
        transition: 'background .12s, border-color .12s',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          flexShrink: 0,
          background: color,
        }}
      />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: isSelected ? 'var(--accent)' : 'var(--text-faint)',
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function MerlinAskRow({ event, onResolve, t }) {
  const title = event.decision_reason || event.payload?.title || `${event.kind} signal`;
  // Local busy flag so the buttons disable + dim the instant they're
  // clicked (#issue-3). The parent removes the card optimistically once
  // resolveEvent resolves, so busy is mostly a single-frame courtesy —
  // but it also prevents a double-click firing two resolves.
  const [busy, setBusy] = useState(false);
  const resolve = (action) => {
    if (busy) return;
    setBusy(true);
    Promise.resolve(onResolve(event.id, action)).catch(() => {});
  };
  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        opacity: busy ? 0.5 : 1,
        transition: 'opacity .12s',
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--text)',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          onClick={() => resolve('approve')}
          disabled={busy}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('action.approve') === 'action.approve' ? 'Approve' : t('action.approve')}
        </button>
        <button
          onClick={() => resolve('hold')}
          disabled={busy}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('action.hold') === 'action.hold' ? 'Hold' : t('action.hold')}
        </button>
      </div>
    </div>
  );
}

function SlaPicker({ groups, rowCount, loaded, selectedId, onSelect, t }) {
  return (
    <div
      style={{
        // Picker sits between the 3D canvas (left) and the detail card
        // (right), so it carries borders on both sides for visual
        // separation. The 3D viewer has no outer chrome of its own.
        borderLeft: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 96%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {t('hyper.sla.picker.title')}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8 }}>
        {!loaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <AdaptivLoader size="sm" />
          </div>
        ) : rowCount === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('hyper.sla.picker.empty')}
          </div>
        ) : (
          groups.map((group) => (
            <SlaGroup key={group.domain} group={group} selectedId={selectedId} onSelect={onSelect} t={t} />
          ))
        )}
      </div>
    </div>
  );
}

// One domain bucket inside the picker. Header carries the domain
// label + icon + a status pill of the WORST row in the group + the
// total local breach count, so the operator scans group-level health
// before drilling into a specific row. Collapsible — defaults to
// open. State is local since group expansion preferences are
// ephemeral (and persisting per-domain across sessions would just
// hide things the operator already wants to see).
function SlaGroup({ group, selectedId, onSelect, t }) {
  // Default open if anything is breaching or at-risk; otherwise
  // collapsed to keep the picker scannable on demos with lots of
  // compliant SLAs.
  const defaultOpen = group.worstStatus === 'breaching' || group.worstStatus === 'at_risk';
  const [open, setOpen] = useState(defaultOpen);
  const tone = SLA_STATUS_TONE[group.worstStatus] || SLA_STATUS_TONE.pending;
  const IconC = Icon[SLA_DOMAIN_ICON[group.domain] || 'sparkle'] || Icon.sparkle;
  // Per-domain label key — falls back to humanised raw value (e.g.
  // 'uptime' → 'Uptime') if the i18n string isn't registered yet.
  const labelKey = `admin.sla.domain.${group.domain}`;
  const labelTx = t(labelKey);
  const label = labelTx === labelKey ? group.domain.charAt(0).toUpperCase() + group.domain.slice(1) : labelTx;
  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
        }}
      >
        <Icon.chevD
          size={10}
          style={{
            color: 'var(--text-faint)',
            transform: open ? 'none' : 'rotate(-90deg)',
            transition: 'transform .15s',
          }}
        />
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            flexShrink: 0,
            background: `color-mix(in oklch, ${tone.color} 14%, transparent)`,
            color: tone.color,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconC size={11} />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text)',
          }}
        >
          {label}
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>
          {group.rows.length}
        </span>
        {group.totalLocalBreaches > 0 && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: tone.color, fontWeight: 700 }}>
            · {group.totalLocalBreaches} {t('hyper.sla.picker.breaches_suffix')}
          </span>
        )}
      </button>
      {open && (
        <div style={{ paddingLeft: 6 }}>
          {group.rows.map((row) => (
            <SlaPickerRow
              key={row.sla.id}
              row={row}
              isSelected={row.sla.id === selectedId}
              onSelect={() => onSelect(row.sla.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlaPickerRow({ row, isSelected, onSelect, t }) {
  const tone = SLA_STATUS_TONE[row.status] || SLA_STATUS_TONE.pending;
  const hasOpenAsk = !!row.openAsk;
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 12px',
        marginBottom: 6,
        background: isSelected ? 'var(--accent-soft)' : 'var(--surface-2)',
        border: `1px solid ${isSelected ? 'var(--accent-line)' : 'var(--border)'}`,
        borderLeft: `3px solid ${tone.color}`,
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'inherit',
        transition: 'background .12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0 }}>
          {row.sla.name}
        </div>
        {hasOpenAsk && (
          <Pill tone="accent">
            <Icon.sparkle size={9} />
            {t('hyper.sla.picker.open_ask')}
          </Pill>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
        <Pill tone={tone.tone}>{tone.label}</Pill>
        {row.current != null && row.target != null && (
          <span style={{ fontFamily: 'var(--mono)' }}>
            {Math.round(row.current)}% / {Math.round(row.target)}%
          </span>
        )}
        {row.localBreaches > 0 && (
          <span style={{ fontFamily: 'var(--mono)', color: tone.color, fontWeight: 700 }}>
            {row.localBreaches} {t('hyper.sla.picker.breaches_suffix')}
          </span>
        )}
      </div>
    </button>
  );
}

function SlaDetailCard({ row, loaded, t }) {
  return (
    <div
      style={{
        borderLeft: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 96%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {t('hyper.sla.detail.title')}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
        {!loaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <AdaptivLoader size="sm" />
          </div>
        ) : !row ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{t('hyper.sla.detail.empty')}</div>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>
              {row.sla.name}
            </div>
            {row.sla.description && (
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 14 }}>
                {row.sla.description}
              </div>
            )}
            {/* Headline metric row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <MetricRow
                label={t('hyper.sla.detail.current')}
                value={row.current != null ? `${Math.round(row.current)}%` : '—'}
                tone={SLA_STATUS_TONE[row.status]?.tone || 'neutral'}
              />
              <MetricRow
                label={t('hyper.sla.detail.target')}
                value={row.target != null ? `${Math.round(row.target)}%` : '—'}
                tone="neutral"
              />
              <MetricRow
                label={t('hyper.sla.detail.breaches_mtd')}
                value={row.breachesMtd != null ? String(row.breachesMtd) : '—'}
                tone={row.breachesMtd > 0 ? 'risk' : 'neutral'}
              />
            </div>
            {/* Open ask badge — links the SLA back to the agent
                proposing to act on the breach (if any). */}
            {row.openAsk && (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 8,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <Icon.sparkle size={11} />
                  {t('hyper.sla.detail.open_ask')}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.5 }}>
                  {row.openAsk.title || row.openAsk.agent_id || ''}
                </div>
              </div>
            )}
            {/* Top contributors — what floors / rooms inside THIS
                building drive most of the breaches. Mirrors the
                highlight intensity on the 3D viewer. */}
            {row.contributors.length > 0 ? (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    marginBottom: 8,
                  }}
                >
                  {t('hyper.sla.detail.contributors')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {row.contributors.slice(0, 8).map((c) => (
                    <div
                      key={c.location_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                        {c.name || c.location_id}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{c.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              row.status !== 'pending' && (
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5, fontStyle: 'italic' }}>
                  {t('hyper.sla.detail.no_contributors')}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value, tone }) {
  const toneColor =
    tone === 'risk' ? 'var(--risk)' : tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : 'var(--text)';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: toneColor, fontFamily: 'var(--mono)' }}>{value}</div>
    </div>
  );
}
