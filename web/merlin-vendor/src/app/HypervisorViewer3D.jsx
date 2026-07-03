// HypervisorViewer3D — wireframe 3D representation of a building's
// floor stack. Reads `locations` rows where kind='floor' and
// parent_id=buildingId, then renders one wireframe box per floor
// stacked on the Y axis. OrbitControls for drag/zoom; auto-fit camera
// on mount. Phase 1 = procedural geometry only (no per-building GLB).
//
// Lazy-loaded from Hypervisor.jsx so the three.js bundle (~600 KB
// gzipped) only ships when the operator opens the 3D tab.
import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Icon } from './icons.jsx';
import { useBuildingSubtree } from './queries/locations.ts';
import { subscribeHypervisorControl, peekHypervisorControl } from './hypervisor-control.js';
import { useT, useLanguage } from './i18n.js';
import { usePendingAsksByLocation, useAllAsksByLocation } from './agent-runs.js';
import { useMerlinAsks } from './merlin-asks.js';
import { evaluateHealth } from './sensor-simulator.js';
import { isMerlinHandled } from './DashboardIncidents.jsx';
import {
  hashString,
  compareFloors,
  walkToFloor,
  cssVar,
  computeServicingPlacement,
  SERVICING_ZONE_META,
  trLabel,
} from './hypervisor-3d-utils.js';
import { locationForItem } from './servicing-content.js';
import { AGENT_COLORS, colorForAgent } from './agent-colors.js';
import {
  Centered,
  CanvasControls,
  SensingMetricBar,
  AgentFilterBar,
  ReplaySlider,
  ActivityPanel,
  ServicingByLocationRail,
  ServicingColorControls,
} from './Hypervisor3DPanels.jsx';
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  FLOOR_DEPTH,
  FLASH_MS,
  CTA_BOUNDS_MARGIN,
  CTA_TOP_INSET_BAR,
} from './hypervisor-3d-constants.js';
import {
  FloorBox,
  FloorPillRow,
  FloorLabel,
  FloorAlertNumber,
  GLBBuilding,
  FitController,
  CTAAutoLayout,
  AlertNumberAutoLayout,
  CTACard,
  AlertToast,
  ActivityConnector,
  ServicingOffFloorMarkers,
} from './Hypervisor3DScene.jsx';
import { AREA_BY_DOMAIN, SERVICING_DOMAIN_META, topDomainOf } from './servicing-areas.js';

export default function HypervisorViewer3D(props) {
  // Gate component: runs only the data-load hooks + the loading/
  // error/empty early-returns, then hands a guaranteed-non-null
  // subtree to the body. This split makes the early-return-above-
  // hooks trap (3 prior blank-surface regressions) structurally
  // impossible — the body has NO early return above its hooks.
  const { buildingId, orgId } = props;
  const t = useT();
  // `subtree` holds every location under this building (floors + the
  // deeper rows we walk through to attribute an alert to its floor).
  // null = loading, [] = empty. Backed by a React Query read keyed on
  // (buildingId, orgId); the query returns { rows, error } so we can map
  // both the subtree and a read-error message below. MUST stay above the
  // early returns (along with every other hook) — changing the hook
  // count between loading/hydrated renders blanks the 3D surface.
  const subtreeQuery = useBuildingSubtree(buildingId, orgId);
  const subtree = subtreeQuery.isSuccess ? subtreeQuery.data.rows : null;
  const error = subtreeQuery.data?.error ?? null;
  // Phase 3 originally had `selectedFloorId` driving both the camera
  // zoom and the FloorBox dim/highlight. JB's later feedback was "no
  // zoom at all when I click a pill" — so click handlers no longer
  // move the camera. The dim/highlight visual now follows panelTarget
  // (open-panel floor pops, others dim) so the operator still sees
  // which floor the panel is talking about, but the model holds its
  // pose. The only thing that moves the camera is the user (orbit /
  // pan / zoom) and the explicit ⛶ fit button.
  //
  // The subtree read (building's OWNER org → org-wide rows → dash-bounded
  // prefix filter) now lives in useBuildingSubtree (queries/locations.ts);
  // see subtreeQuery above. The owner-org resolution + RLS rationale is
  // preserved there verbatim.

  // Derive the floors list + a parent_id/kind lookup for the subtree
  // so we can attribute a deep location_id (restroom, zone, position)
  // up to the floor it sits on.
  const { floors, parentOf, kindOf } = useMemo(() => {
    const parentOfL = new Map();
    const kindOfL = new Map();
    const floorRows = [];
    for (const r of subtree || []) {
      parentOfL.set(r.id, r.parent_id);
      kindOfL.set(r.id, r.kind);
      if (r.kind === 'floor' && r.parent_id === buildingId) floorRows.push(r);
    }
    floorRows.sort(compareFloors);
    return { floors: floorRows, parentOf: parentOfL, kindOf: kindOfL };
  }, [subtree, buildingId]);
  if (subtree === null) {
    return (
      <Centered>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('hyper3d.loading')}</div>
      </Centered>
    );
  }
  if (error) {
    return (
      <Centered>
        <div style={{ fontSize: 12, color: 'var(--warn)' }}>{error}</div>
      </Centered>
    );
  }
  if (floors.length === 0) {
    return (
      <Centered>
        <Icon.floor size={22} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('hyper3d.empty.title')}</div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            maxWidth: 320,
            textAlign: 'center',
            lineHeight: 1.5,
            marginTop: 6,
          }}
        >
          {t('hyper3d.empty.body')}
        </div>
      </Centered>
    );
  }

  return <HypervisorViewer3DBody {...props} subtree={subtree} floors={floors} parentOf={parentOf} kindOf={kindOf} />;
}

function HypervisorViewer3DBody({
  buildingId,
  orgId,
  nowFilter = 'all',
  livePaused = false,
  testCounter = 0,
  activityOpen = false,
  onCloseActivity,
  // Callback to flip nowFilter ('today' → 'all'). Used by the calm
  // empty-state's "Show all-time" CTA when TODAY = 0 activity.
  onSetNowFilter,
  // PR #647: incidents + chat handlers come down from the parent so
  // the Activity panel can be the SAME data as OPERATE/Activity
  // (merlin_asks calls + incidents). Pills + agent buttons also
  // derive from calls so counts match across surfaces.
  incidents = [],
  onOpenChat,
  onOpenIncident,
  onOpenAgent,
  // CTA mode: when an array is supplied, the viewer runs in
  // "focused 3 actions" mode used by My Day. Hides agent filter,
  // activity panel, flash logic. Each CTA carries:
  //   { id, floorId, color, title, body, priority }
  // Floors get highlighted in the CTA's colour (red by default
  // from the caller) and a richer card replaces the pill row.
  ctas = null,
  // Agents-mode props (PR-pending). When `agentRuns` is an array, the
  // viewer hides pill mode + CTA mode and renders one small colored
  // dot per run on the floor it fired against. `agentsMode` is the
  // sub-mode ('live'|'resolved'|'pending') — only 'live' pulses.
  agentRuns = null,
  agentsMode = null,
  // Replay slider — PR #746. Parent owns the state; the viewer just
  // renders the slider and reports drag deltas. 0 = NOW (live);
  // positive = how many ms back from now.
  replayBackMs = 0,
  onReplayBackMsChange,
  replayShowSlider = false,
  replayCount = 0,
  // SLA-mode floor coloring. Array of { location_id, color, intensity? }.
  // Pure floor paint — no anchored card, no card layout, no flash. Used
  // by the Hypervisor 3D SLAs tab to light up floors that contribute to
  // the currently-selected SLA's breaches. Resolves to a floor by exact
  // id match, then by walking up parents, then by parsing `…-fl-NN`.
  // `intensity` is 0..1 — multiplied into the floor's highlight opacity
  // so higher-contributing floors read brighter than lighter ones.
  floorHighlights = null,
  // SERVICING heatmap input: per-area rollup rows (domain, adherence_pct,
  // overdue_now, open_now). Servicing has no floor dimension, so synthServicing-
  // Highlights distributes areas across floors to tint the tower by health.
  servicingHeatRows = null,
  // Richer servicing viewer: the live open-items [{ line, item, hours_over,
  // open_count }] from servicing_open_items_for_viewer. Each item's catalog
  // location (servicing-content.js) resolves to a real floor/band OR a
  // synthetic off-stack anchor (roof / basement / perimeter / building-wide),
  // so the tower lights the CORRECT floors and off-floor items get a marker +
  // a never-blank "By location" rail. Supersedes the servicingHeatRows
  // hash-scatter when present.
  servicingOpenItems = null,
  // Merlin-mode single-source map: Map<location_id, events[]> (rows
  // already AlertRow-shaped). When present, the floor-click ActivityPanel
  // popup is fed from THIS (resolved to floors with the same logic the
  // floorHighlights tint uses) instead of the agent_runs alertsByFloor
  // fallback — so a tinted floor's popup always shows that floor's events
  // and a non-tinted floor shows the empty state. Set only by the MERLIN
  // tab; null everywhere else (SLA / Sensing paths are unchanged).
  merlinFloorActivity = null,
  // Sensing mode (Hypervisor → Sensing tab). When set to a known
  // metric ('airquality' for now; more later), the viewer auto-
  // computes per-floor tints from a deterministic hash of the floor
  // id — placeholder until real sensor readings flow into here from
  // device_events. Treated identically to floorHighlights for canvas
  // gating (no chips, no pills, no slider — clean sensing surface).
  sensingMetric = null,
  // Sensing button strip handler. Hypervisor.jsx owns the active
  // metric state; the viewer just renders the button bar overlay.
  onSelectSensingMetric = null,
  // REAL per-floor sensor readings: Map<floorLocationId, {value, unit}> for the
  // active metric (building_sensor_readings RPC, mig 240). Null when off.
  sensorReadings = null,
  subtree,
  floors,
  parentOf,
  kindOf,
}) {
  // PR #671: empty array means "CTA mode, no cards yet" (e.g. My Day
  // mounted before usePendingAsksByLocation hydrated). The viewer's
  // "all quiet today" empty state covers the visual; we don't want
  // pills + agent bar flashing in for a frame. NULL still means
  // pill mode (Hypervisor's no-ctas fallback path).
  const ctaMode = Array.isArray(ctas);
  const agentsModeActive = Array.isArray(agentRuns);
  const t = useT();
  // Stable language token for memo deps — useT() returns a fresh closure each
  // render, so memos that build i18n strings depend on `lang` (changes only on
  // language flip) instead of `t` to avoid recomputing on every render.
  const lang = useLanguage();

  // Pending-ask counts keyed by location_id, live-updated. Empty Map
  // while the agent_runs cache hydrates — falls back to no highlights.
  const asksByLocation = usePendingAsksByLocation(orgId, buildingId, { livePaused });
  // Activity panel data — fetched ONLY when ACTIVITY is toggled on.
  // Pill-driven drilldowns (panelTarget without activityOpen) reuse
  // the cheaper pending-only `asksByLocation`. The hook short-
  // circuits and returns [] when `enabled=false`.
  const activityRowsAll = useAllAsksByLocation(orgId, buildingId, activityOpen);

  // PR #647: unified activity feed for the Activity panel — same data
  // as OPERATE/Activity (Activity.jsx). Combines:
  //   - merlin_asks calls (pending Approve/Hold queue) → status='cta'
  //   - incidents (open or merlin-handled) → status='open' or 'resolved'
  // Tab counts on the panel derive from this combined pool so they
  // match the OPERATE/Activity tab counts exactly. The agent_runs
  // data above is kept for the per-floor pill density visualization
  // (different concept: "where are agents firing" vs "what needs
  // human attention").
  const calls = useMerlinAsks(buildingId);
  const unifiedActivityFeed = useMemo(() => {
    const out = [];
    for (const c of calls || []) {
      out.push({
        kind: 'call',
        id: `call-${c.id}`,
        priority: c.priority || 'medium',
        ts: c.createdAt || 0,
        agentId: c.agentId || null,
        locationId: c.locationId || null,
        status: 'cta', // pending calls always need action
        data: c,
      });
    }
    for (const i of incidents || []) {
      const resolved = isMerlinHandled(i);
      out.push({
        kind: 'incident',
        id: `inc-${i.id}`,
        priority: i.priority || 'medium',
        ts: i._spawnedAt || 0,
        agentId: i.agentId || null,
        locationId: null, // simulator incidents don't carry floor id
        status: resolved ? 'resolved' : 'open',
        data: i,
      });
    }
    out.sort((a, b) => {
      // CTAs first, then open, then resolved; within each by recency
      const bucket = (r) => (r.status === 'cta' ? 0 : r.status === 'open' ? 1 : 2);
      const db = bucket(a) - bucket(b);
      if (db !== 0) return db;
      return (b.ts || 0) - (a.ts || 0);
    });
    return out;
  }, [calls, incidents]);
  // Per-row TODAY filter. Applied at viewer level (not in the hook)
  // so the agent button list + raw cache stay stable when TODAY is
  // active — only the per-floor pills + flashes react to the toggle.
  const todayCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [nowFilter]);
  const passesFilter = (row) => nowFilter !== 'today' || row.created_at >= todayCutoff;

  // Per-floor per-agent ROWS: Map<floorId, Map<agentId, Row[]>>.
  //
  // Reality check: in the demo data (and in many real tenants) the
  // agent runtime tags `location_id = building_id` on every ask
  // without picking a floor. To keep the viewer informative, we
  // distribute building-level ROWS per-AGENT across deterministic
  // subsets of floors. Each agent picks ~4 alerting floors via
  // hash(agentId + buildingId), then each individual ROW gets
  // assigned to one of those floors via hash(row.id) — so counts
  // (rows.length) and the clickable alerts list (the rows themselves)
  // always agree. Purely a visualization decision; the underlying
  // DB rows are untouched.
  const FLOORS_PER_AGENT = 4;
  const alertsByFloor = useMemo(() => {
    const out = new Map();
    if (!subtree || asksByLocation.size === 0) return out;
    // Helper to grow an agent's row list under a given floor.
    const append = (floorId, agentId, rows) => {
      let m = out.get(floorId);
      if (!m) {
        m = new Map();
        out.set(floorId, m);
      }
      const arr = m.get(agentId) || [];
      for (const r of rows) arr.push(r);
      m.set(agentId, arr);
    };
    // 1. Real per-floor rows: roll up by walking parent_id.
    //    `passesFilter` enforces the TODAY toggle row-by-row.
    for (const [locId, byAgent] of asksByLocation) {
      if (locId === buildingId) continue;
      const floorId = walkToFloor(locId, parentOf, kindOf);
      if (!floorId) continue;
      for (const [agentId, rows] of byAgent) {
        const kept = rows.filter(passesFilter);
        if (kept.length) append(floorId, agentId, kept);
      }
    }
    // 2. Building-level rows: per agent, distribute its rows across
    // a deterministic set of FLOORS_PER_AGENT floors.
    const buildingByAgent = asksByLocation.get(buildingId);
    if (buildingByAgent && floors.length > 0) {
      for (const [agentId, rows] of buildingByAgent) {
        const kept = (rows || []).filter(passesFilter);
        if (kept.length === 0) continue;
        const seed = hashString(agentId + ':' + buildingId);
        const scored = floors
          .map((f, idx) => ({
            idx,
            id: f.id,
            score: (seed + idx * 41) % 997,
          }))
          .sort((a, b) => a.score - b.score)
          .slice(0, FLOORS_PER_AGENT);
        const picked = scored.map((s) => s.id);
        for (const r of kept) {
          const h = hashString(r.id || '');
          const targetFloor = picked[h % picked.length];
          append(targetFloor, agentId, [r]);
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtree, asksByLocation, parentOf, kindOf, floors, buildingId, nowFilter, todayCutoff]);

  // Total per floor — sums row counts across all agents for the
  // floor. Drives the legend badge and the floor-name pill content.
  const totalByFloor = useMemo(() => {
    const out = new Map();
    for (const [floorId, byAgent] of alertsByFloor) {
      let s = 0;
      for (const rows of byAgent.values()) s += rows.length;
      out.set(floorId, s);
    }
    return out;
  }, [alertsByFloor]);

  // List of agents that have at least one pending ask in THIS
  // building. Derived from the RAW asksByLocation (all-time) so the
  // button list stays stable when TODAY is toggled — only the count
  // on each button reacts to the filter (passesFilter applied inline).
  // Sorted by filtered count desc so the busiest agent sits first.
  const agentsInBuilding = useMemo(() => {
    const totals = new Map();
    for (const inner of asksByLocation.values()) {
      for (const [agentId, rows] of inner) {
        if (!totals.has(agentId)) totals.set(agentId, 0);
        for (const r of rows) {
          if (passesFilter(r)) totals.set(agentId, totals.get(agentId) + 1);
        }
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([agentId, count]) => ({ agentId, count, color: colorForAgent(agentId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asksByLocation, nowFilter, todayCutoff]);

  const lineColor = useMemo(() => cssVar('--accent-indigo', '#20286D'), []);

  // Phase 4 — the building row itself carries the optional GLB model
  // pointer + scale/offset hints. When `model_url` is set we swap the
  // procedural floor stack for the loaded model.
  const buildingRow = useMemo(() => (subtree || []).find((r) => r.id === buildingId) || null, [subtree, buildingId]);
  const modelUrl = buildingRow?.model_url || null;
  const modelScale = buildingRow?.model_scale != null ? Number(buildingRow.model_scale) : 1;
  const modelOffsetY = buildingRow?.model_offset_y != null ? Number(buildingRow.model_offset_y) : 0;

  // Build per-floor pill rows. Every alerting floor gets a row; each
  // row is up to MAX_PILLS_PER_FLOOR agent pills (sorted by count
  // desc), preceded by a floor-name pill that's clickable to open
  // "all alerts on this floor". MIN_GAP keeps adjacent floors from
  // visually merging.
  const MAX_PILLS_PER_FLOOR = 3;
  const PILL_MIN_GAP = 2;
  const pillRowsByFloorId = useMemo(() => {
    if (alertsByFloor.size === 0 || floors.length === 0) return new Map();
    const candidates = floors
      .map((f, idx) => ({
        id: f.id,
        idx,
        name: f.name,
        total: totalByFloor.get(f.id) || 0,
        byAgent: alertsByFloor.get(f.id) || new Map(),
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total || a.idx - b.idx);
    const picked = [];
    for (const c of candidates) {
      if (picked.every((p) => Math.abs(p.idx - c.idx) >= PILL_MIN_GAP)) {
        picked.push(c);
      }
    }
    const map = new Map();
    for (const p of picked) {
      const pills = Array.from(p.byAgent.entries())
        .filter(([, rows]) => rows.length > 0)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, MAX_PILLS_PER_FLOOR)
        .map(([agentId, rows]) => ({
          agentId,
          count: rows.length,
          color: colorForAgent(agentId),
        }));
      if (pills.length > 0) map.set(p.id, pills);
    }
    return map;
  }, [alertsByFloor, totalByFloor, floors]);

  // CTA mode: resolve each CTA to a floor and key by floor for O(1)
  // lookup in the render loop.
  // - If the CTA's location_id walks up to a specific floor, use it.
  // - Otherwise (building-level rows), spread the CTAs at quartile
  //   positions across the building (~25%, 50%, 75% for 3 CTAs) so
  //   the cards don't visually collide vertically. Hash distribution
  //   would clump random pairs adjacent and the cards would overlap.
  // - Minimum-gap enforcement: each card is ~CTA_CARD_MIN_FLOORS
  //   floors tall in screen space (card height ÷ floor pixel-height).
  //   Two CTAs landing within that range cause the cards to overlap,
  //   so we step the second one outward until the gap clears. Without
  //   this, two real building-level rows that both walk to nearby
  //   floors stack on top of each other and merge into the building.
  const ctaByFloorId = useMemo(() => {
    const m = new Map();
    if (!Array.isArray(ctas) || floors.length === 0) return m;
    const N = ctas.length;
    const total = floors.length;
    const taken = []; // indexes already used, kept sorted-ish for gap check
    // Card screen height ÷ floor screen height at typical My Day
    // canvas (520px, ~50 floors). Compact card is ~95px tall; floor
    // is ~10px at that zoom; need ≥10 floors gap to fully clear.
    // 14 leaves comfortable breathing room.
    //
    // Cap math: with N cards we need (N-1) gaps to fit between top
    // and bottom of the building, so max usable gap is (total-1)/(N-1).
    // The old cap total/(N+1) was wrong — for 50 floors / 3 cards it
    // gave 12 (forcing gap=12 even when 14 was requested), but real
    // headroom is (50-1)/(3-1) = 24. So 14 is now actually honored.
    const maxUsable = Math.floor((total - 1) / Math.max(N - 1, 1));
    const MIN_GAP = Math.min(14, maxUsable);
    const isFar = (idx) => taken.every((t) => Math.abs(t - idx) >= MIN_GAP);
    const findFreeNear = (target) => {
      let probe = target;
      let step = 0;
      while (step < total) {
        if (probe >= 0 && probe < total && !m.has(floors[probe]?.id) && isFar(probe)) {
          return probe;
        }
        step += 1;
        const dir = step % 2 === 0 ? step / 2 : -Math.ceil(step / 2);
        probe = target + dir;
        if (probe < 0 || probe >= total) {
          // out of range — keep stepping; eventually we'll wrap back in
          probe = (((target + dir) % total) + total) % total;
        }
      }
      // Fallback: nothing satisfies MIN_GAP — just take any free slot.
      for (let k = 0; k < total; k += 1) {
        if (!m.has(floors[k]?.id)) return k;
      }
      return 0;
    };
    for (let i = 0; i < N; i += 1) {
      const c = ctas[i];
      if (!c) continue;
      const walkedId = walkToFloor(c.location_id, parentOf, kindOf);
      let idx = -1;
      if (walkedId) {
        idx = floors.findIndex((f) => f.id === walkedId);
        // Walked floor is taken or too close to a sibling card — step
        // outward to the nearest acceptable slot.
        if (idx < 0 || m.has(walkedId) || !isFar(idx)) {
          idx = findFreeNear(idx >= 0 ? idx : Math.floor((total * (i + 1)) / (N + 1)));
        }
      } else {
        // Building-level CTA (location_id doesn't walk to a floor — e.g.
        // Meridian's pending asks are all tagged 'hq'). Seed the target by
        // a HASH of the CTA id, not the list index: index-based seeding
        // (i+1)/(N+1) sent any 3 building-level CTAs to the same 3 floors
        // (41/27/13), so the canvas looked frozen as near-identical asks
        // rotated through on approve. Hashing by id makes distinct events
        // land on distinct, stable floors; findFreeNear still enforces the
        // min-gap + collision spacing.
        idx = findFreeNear(hashString(String(c.id ?? i)) % total);
      }
      const floorId = floors[idx]?.id;
      if (floorId && !m.has(floorId)) {
        // Stash the floor's index temporarily; we re-derive cardIndex
        // by floor order (top→bottom) once placement is done.
        m.set(floorId, { ...c, floorId, _floorIdx: idx });
        taken.push(idx);
      }
    }
    // PR #663: cardIndex must reflect TOP-TO-BOTTOM floor position
    // (not CTA recency), or the staircase layout puts the "above-
    // anchor" card on whichever floor fired most recently — which can
    // be the bottom floor, and the card ends up above its anchor in
    // empty space. Sort by floor index descending (higher idx = higher
    // up the building = top of screen) and assign cardIndex 0/1/2.
    const ordered = Array.from(m.values()).sort((a, b) => b._floorIdx - a._floorIdx);
    ordered.forEach((entry, rank) => {
      entry.cardIndex = rank;
      delete entry._floorIdx;
    });
    return m;
  }, [ctas, floors, parentOf, kindOf]);

  // Agent-filter buttons at the top of the viewer. When set, every
  // floor that has at least one pending ask from this agent fills
  // with the agent's colour — a quick "where is security firing?"
  // bulk-highlight that complements the per-floor pill click.
  // Must sit ABOVE agentRunsByFloorId — that memo references
  // agentFilter, and the original useState position (post-memo) hit a
  // TDZ on cold-load (Sentry JAVASCRIPT-REACT-1T, 2026-05-26).
  const [agentFilter, setAgentFilter] = useState(null);
  useEffect(() => {
    setAgentFilter(null);
  }, [buildingId]);

  // floorHighlights → per-floor color map (SLA mode). Resolution order
  // for each highlight's location_id: exact floor match → walk up
  // parents until we find a floor → parse `…-fl-NN` from the string
  // → fall back to whole-building (no floor). Intensity (0..1) scales
  // alpha — top contributors read brighter than minor ones.
  // Live refresh is driven by the sensorReadings prop: Hypervisor.jsx polls the
  // building_sensor_readings RPC (~30s) and a new Map reference re-runs the memos
  // below, so the canvas updates as the real readings drift.

  // Manually pinned floors (click any floor in Sensing mode to pin a
  // reading card + badge; click again to unpin). Independent of the
  // auto-surfaced alert floors — lets an operator inspect a green/in-range
  // floor too. Cleared when the metric or building changes (a pinned
  // floor's reading is metric-specific).
  const [pinnedSensingFloors, setPinnedSensingFloors] = useState(() => new Set());
  const toggleSensingFloor = (floorId) => {
    setPinnedSensingFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId);
      else next.add(floorId);
      return next;
    });
  };
  useEffect(() => {
    setPinnedSensingFloors(new Set());
  }, [sensingMetric, buildingId]);

  // Sensing mode paints each floor THAT HAS A READING by health (green = in
  // range, fading to pale near a limit; red = out of range, deeper with severity)
  // — one semantic across all metrics, owned by evaluateHealth(). Readings are
  // REAL (building_sensor_readings, mig 240); floors with no sensor get no tint.
  // Emits a `floorHighlights`-shaped array so the downstream resolver is unchanged.
  const synthSensingHighlights = useMemo(() => {
    if (!sensingMetric || !sensorReadings || sensorReadings.size === 0 || floors.length === 0) return null;
    const out = [];
    for (const f of floors) {
      const reading = sensorReadings.get(f.id);
      if (!reading || reading.value == null || Number.isNaN(reading.value)) continue;
      const health = evaluateHealth(sensingMetric, reading.value);
      out.push({
        location_id: f.id,
        color: health.color,
        intensity: health.state === 'alert' ? 1 : 0.85,
      });
    }
    return out.length ? out : null;
  }, [sensingMetric, floors, sensorReadings]);

  // SERVICING heatmap. Servicing is tracked by area/line, not floor (every item's
  // location IS the building), so we distribute each service AREA to a
  // deterministic floor (stable FNV-1a hash of the domain → stable per render) and
  // tint that floor by the area's health: red = SLA-breached/overdue, amber = open
  // backlog, teal = healthy/covered. Severity is conveyed by HUE (the renderer
  // paints every highlighted floor at one alpha; intensity rides along for the
  // shared shape but isn't a separate visual tier today).
  //
  // Returns BOTH the tint highlights AND a popup map built from the SAME
  // assignment — so a tinted floor's click panel shows exactly the areas hashed to
  // it (keeps the codebase's tint ⇔ popup-rows invariant; without this the tint
  // and the old event-derived popup decoupled → a red floor opened an empty panel).
  const servicingHeat = useMemo(() => {
    if (!servicingHeatRows || servicingHeatRows.length === 0 || floors.length === 0) return null;
    const SLA = 90;
    // Human, i18n-aware label for a domain key: "Maintenance · Preventive
    // Maintenance" rather than the prefix-stripped, acronym-mangling
    // prettyDomain() (which rendered 'maintenance_pm' → "Pm", 'security_cctv' →
    // "Cctv"). The real labels live on the area config; prettyDomain is only the
    // fallback for keys with no area entry (e.g. the folded-in cleaning_restrooms).
    const tx = (k) => {
      const v = t(k);
      return v && v !== k ? v : '';
    };
    const prettyDomain = (d) => {
      const parts = String(d || '').split('_');
      const s = parts.slice(1).join(' ') || parts[0] || String(d || '');
      return s.replace(/\b\w/g, (c) => c.toUpperCase());
    };
    const labelFor = (d) => {
      const area = AREA_BY_DOMAIN[d];
      const meta = SERVICING_DOMAIN_META[topDomainOf(d)];
      const top = meta ? tx(meta.labelKey) || meta.fallback : '';
      const leaf = area ? tx(area.labelKey) || area.fallback : prettyDomain(d);
      return top && leaf ? `${top} · ${leaf}` : leaf || top || String(d);
    };
    const perFloor = new Map(); // floorId → { overdue, open, breached, rows: [] }
    for (const r of servicingHeatRows) {
      const key = String(r.domain || r.item || r.id || '');
      let h = 2166136261;
      for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const f = floors[(h >>> 0) % floors.length];
      if (!f) continue;
      const b = perFloor.get(f.id) || { overdue: 0, open: 0, minAdh: 100, rows: [] };
      b.overdue += r.overdue_now || 0;
      b.open += r.open_now || 0;
      // Severity is ADHERENCE-primary (mirrors the bubble view's SLA-target bands).
      // NOT "any overdue → red": most areas carry some overdue, which would paint
      // the whole tower red and kill the heatmap's signal. Worst area sets the floor.
      b.minAdh = Math.min(b.minAdh, r.adherence_pct ?? 100);
      b.rows.push(r);
      perFloor.set(f.id, b);
    }
    const highlights = [];
    const byFloor = new Map(); // floorId → Map<agentId, rows[]> (ActivityPanel fallback shape)
    for (const [floorId, b] of perFloor) {
      const sev = b.minAdh < SLA ? 'red' : b.minAdh < 95 ? 'amber' : 'ok';
      const color = sev === 'red' ? '#ef4444' : sev === 'amber' ? '#f59e0b' : '#14b8a6';
      const intensity = sev === 'red' ? 1 : sev === 'amber' ? 0.8 : 0.45;
      highlights.push({ location_id: floorId, color, intensity });
      const rows = b.rows.map((r, i) => {
        const adh = Math.round(r.adherence_pct ?? 0);
        const od = r.overdue_now || 0;
        const op = r.open_now || 0;
        return {
          id: `svc-${floorId}-${r.domain}-${i}`,
          location_id: floorId, // pin to the floor so ActivityPanel's scope check passes
          agent_id: 'servicing',
          decision_reason: `${labelFor(r.domain)} — ${adh}% SLA${od ? `, ${od} overdue` : ''}${op ? `, ${op} open` : ''}`,
        };
      });
      byFloor.set(floorId, new Map([['servicing', rows]]));
    }
    return { highlights, byFloor };
    // `t` is used for labels but intentionally excluded — `lang` covers locale
    // changes and is stable across unrelated re-renders (see note at its decl).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicingHeatRows, floors, lang]);

  // LOCATION-AWARE servicing placement (richer viewer). Buckets the live
  // open-items by their catalog location into spatial zones, then derives:
  //   - real floor tints (location_id `${buildingId}-fl-N`, severity by
  //     hours-over) so the tower lights the ACTUAL floors/bands — replacing the
  //     servicingHeat hash-scatter above when open-items are present;
  //   - a per-floor popup map (same shape ActivityPanel consumes) so clicking a
  //     lit floor shows the real items on it;
  //   - the off-stack buckets (roof / basement / perimeter) for the 3D anchors;
  //   - all buckets for the never-blank "By location" rail.
  const servicingPlacement = useMemo(() => {
    if (floors.length === 0) return null;
    // floors are named/ordered 1..N → floors.length is the top floor.
    return computeServicingPlacement(servicingOpenItems, locationForItem, {
      buildingId,
      topFloor: floors.length,
      // Pass the ordered floor rows so named-floor buildings (PSG, Hemisphere —
      // ids like `psg-pro-aquatics`, no `-fl-N` rows) route items to real floors
      // via the per-building catalog. Meridian (`hq-fl-N`) is unaffected.
      floors,
    });
  }, [servicingOpenItems, floors, buildingId]);

  // Sensing callouts — a card per surfaced floor showing its reading.
  // Two sources, merged + de-duped:
  //   1. Auto: the most severe out-of-range (red) floors, capped so a
  //      building full of red doesn't bury the canvas. In-range floors
  //      aren't auto-surfaced — the green tint already says "ok".
  //   2. Pinned: any floor the operator clicked (green or red) — always
  //      shown so they can inspect a specific floor's reading.
  // Card colour + title come from the same health verdict (alert → bad
  // copy in red; in-range → "In range" in green). Drift re-ranks the auto
  // set as readings move.
  const sensingCallouts = useMemo(() => {
    const m = new Map();
    if (!sensingMetric || !sensorReadings || sensorReadings.size === 0 || floors.length === 0) return m;
    const ALERT_COPY = {
      temperature: { high: t('hyper3d.sensing.too_hot'), low: t('hyper3d.sensing.too_cold') },
      airquality: { high: t('hyper3d.sensing.poor_air'), low: t('hyper3d.sensing.poor_air') },
      occupancy: { high: t('hyper3d.sensing.overcrowded'), low: t('hyper3d.sensing.underused') },
      humidity: { high: t('hyper3d.sensing.too_humid'), low: t('hyper3d.sensing.too_dry') },
      noise: { high: t('hyper3d.sensing.too_loud'), low: t('hyper3d.sensing.too_quiet') },
    };
    const outOfRange = t('hyper3d.sensing.out_of_range');
    const inRange = t('hyper3d.sensing.in_range');
    const copy = ALERT_COPY[sensingMetric] || { high: outOfRange, low: outOfRange };
    const calloutFor = (f) => {
      const reading = sensorReadings.get(f.id);
      if (!reading || reading.value == null) return null;
      const health = evaluateHealth(sensingMetric, reading.value);
      const title = health.state === 'alert' ? (health.direction === 'low' ? copy.low : copy.high) : inRange;
      const label = `${Math.round(reading.value * 10) / 10} ${reading.unit || ''}`.trim();
      return { health, title, body: label, color: health.color };
    };
    const scored = floors.map((f) => ({ f, c: calloutFor(f) })).filter((x) => x.c);
    const MAX_AUTO = 6;
    const auto = scored
      .filter((x) => x.c.health.state === 'alert')
      .sort((a, b) => b.c.health.severity - a.c.health.severity)
      .slice(0, MAX_AUTO);
    const pinned = scored.filter((x) => pinnedSensingFloors.has(x.f.id));
    // Pinned first so an operator's explicit picks keep a stable slot,
    // then the auto alerts. De-dup by floor id.
    let idx = 0;
    for (const { f, c } of [...pinned, ...auto]) {
      if (m.has(f.id)) continue;
      // `reading` = the raw sensor value (e.g. "850 ppb TVOC") shown on
      // the card face to back the qualitative title with a number.
      m.set(f.id, { title: c.title, body: c.body, reading: c.body, color: c.color, cardIndex: idx++ });
    }
    return m;
  }, [sensingMetric, floors, sensorReadings, pinnedSensingFloors, t]);

  // slaMode is the canonical "clean canvas" mode (no chips, no pills,
  // no slider, no activity-panel slide-in) that the SLA tab + Sensing
  // tab + Merlin mode in the SLAs-style layout all pivot on. Turned on
  // by any of:
  //   - explicit floorHighlights array prop (SLA mode, Merlin sidebar)
  //   - generated sensing-metric array (Sensing tab, metric selected)
  //   - Sensing tab itself (handler passed) even before a metric is
  //     picked, so the canvas reads clean from the moment the tab opens
  const effectiveFloorHighlights =
    synthSensingHighlights || servicingPlacement?.highlights || servicingHeat?.highlights || floorHighlights;
  const sensingTabActive = !!onSelectSensingMetric;
  const slaMode = Array.isArray(effectiveFloorHighlights) || sensingTabActive;
  const floorHighlightByFloorId = useMemo(() => {
    const m = new Map();
    if (!slaMode || floors.length === 0) return m;
    // Sensing tab can flip slaMode on without an effectiveFloorHighlights
    // array (clean canvas, no metric picked yet). Empty map is correct.
    if (!Array.isArray(effectiveFloorHighlights)) return m;
    const floorIds = new Set(floors.map((f) => f.id));
    const FL_NN_RE = /-(fl|floor)-(\d+)\b/i;
    for (const h of effectiveFloorHighlights) {
      if (!h?.location_id || !h?.color) continue;
      const locId = String(h.location_id);
      let floorId = null;
      if (floorIds.has(locId)) {
        floorId = locId;
      } else {
        // Walk up parents (room → wing → floor).
        let cur = parentOf?.get(locId);
        while (cur && !floorIds.has(cur)) cur = parentOf?.get(cur);
        if (cur && floorIds.has(cur)) floorId = cur;
      }
      if (!floorId) {
        const match = locId.match(FL_NN_RE);
        if (match) {
          const candidate = `${buildingId}-fl-${match[2]}`;
          if (floorIds.has(candidate)) floorId = candidate;
        }
      }
      if (!floorId) continue;
      // Keep the brightest hit per floor (max intensity wins).
      const cur = m.get(floorId);
      const intensity = Math.max(0, Math.min(1, h.intensity ?? 1));
      if (!cur || intensity > (cur.intensity ?? 0)) {
        // `line` (servicing only) lets the render swap to service-line colour.
        m.set(floorId, { color: h.color, intensity, line: h.line });
      }
    }
    return m;
  }, [slaMode, effectiveFloorHighlights, floors, parentOf, buildingId]);

  // Merlin-mode floor-click popup source. Resolves merlinFloorActivity's
  // raw location_id keys to floors with the SAME logic floorHighlightByFloorId
  // uses (exact floor → walk up parents → parse `…-fl-NN`), producing the
  // alertsByFloor shape ActivityPanel's legacy fallback expects:
  // Map<floorId, Map<agentId, rows[]>>. Rows carry location_id = floorId so
  // ActivityPanel's locationOnFloor() scope check passes. Building-level
  // rows that resolve to no floor are dropped — exactly mirroring the tint,
  // so a tinted floor ⇔ map has rows ⇔ popup shows rows. null = not Merlin
  // mode → caller falls back to alertsByFloor (SLA/sensing paths untouched).
  const merlinFallbackByFloor = useMemo(() => {
    if (!merlinFloorActivity || floors.length === 0) return null;
    const out = new Map();
    const floorIds = new Set(floors.map((f) => f.id));
    const FL_NN_RE = /-(fl|floor)-(\d+)\b/i;
    const resolveFloor = (locId) => {
      const s = String(locId);
      if (floorIds.has(s)) return s;
      let cur = parentOf?.get(s);
      while (cur && !floorIds.has(cur)) cur = parentOf?.get(cur);
      if (cur && floorIds.has(cur)) return cur;
      const match = s.match(FL_NN_RE);
      if (match) {
        const candidate = `${buildingId}-fl-${match[2]}`;
        if (floorIds.has(candidate)) return candidate;
      }
      return null;
    };
    for (const [locId, rows] of merlinFloorActivity) {
      const floorId = resolveFloor(locId);
      if (!floorId) continue; // building-level / unattributable → no floor
      let byAgent = out.get(floorId);
      if (!byAgent) {
        byAgent = new Map();
        out.set(floorId, byAgent);
      }
      for (const r of rows) {
        const agentId = r.agent_id || 'unknown';
        const arr = byAgent.get(agentId) || [];
        // Pin location_id to the resolved floor so ActivityPanel's
        // locationOnFloor(r.location_id, floorId) scope check passes.
        arr.push({ ...r, location_id: floorId });
        byAgent.set(agentId, arr);
      }
    }
    return out;
  }, [merlinFloorActivity, floors, parentOf, buildingId]);

  // Per-floor CTA-shaped entries for Agents mode. PR #739: now uses
  // the exact same CTACard component as Merlin mode — drag, double-
  // click expand, Details button, drawer click — so the canvas
  // experience is uniform across modes. walkToFloor first; building-
  // level runs hash-spread deterministically across floors. Honors
  // agentFilter. Capped at MAX_AGENT_FLOORS distinct floors.
  const agentCtaByFloorId = useMemo(() => {
    const m = new Map();
    if (!agentsModeActive || floors.length === 0) return m;
    const total = floors.length;
    const filterId = agentFilter && agentFilter !== 'all' ? agentFilter : null;
    const MAX_AGENT_FLOORS = 6;
    const byFloor = new Map();
    for (const r of agentRuns) {
      if (!r) continue;
      if (filterId && r.agent_id !== filterId) continue;
      const walkedId = walkToFloor(r.location_id, parentOf, kindOf);
      let floorId = walkedId;
      if (!floorId) {
        const key = String(r.id || r.agent_id || '');
        let h = 0;
        for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) | 0;
        const idx = ((h % total) + total) % total;
        floorId = floors[idx]?.id;
      }
      if (!floorId) continue;
      const existing = byFloor.get(floorId);
      if (existing) {
        existing.push(r);
      } else if (byFloor.size < MAX_AGENT_FLOORS) {
        byFloor.set(floorId, [r]);
      }
    }
    // Convert to CTA-shaped entries + assign top-to-bottom cardIndex.
    const entries = [];
    for (const [floorId, runs] of byFloor) {
      const floorIdx = floors.findIndex((f) => f.id === floorId);
      const run = runs[0];
      const color = colorForAgent(run.agent_id);
      entries.push({
        id: run.id,
        location_id: run.location_id,
        color,
        title: run.decision_reason || `${run.agent_id} action`,
        priority: agentsMode || 'event',
        agentId: run.agent_id,
        // Drawer payload (full agent_run shape).
        agent_id: run.agent_id,
        decision: run.decision,
        decision_reason: run.decision_reason,
        confidence: run.confidence ?? null,
        created_at: run.created_at,
        ask_resolution: run.ask_resolution || null,
        raw: run.raw || run,
        _floorId: floorId,
        _floorIdx: floorIdx,
      });
    }
    entries.sort((a, b) => b._floorIdx - a._floorIdx);
    entries.forEach((e, rank) => {
      e.cardIndex = rank;
      m.set(e._floorId, e);
      delete e._floorIdx;
      delete e._floorId;
    });
    return m;
  }, [agentsModeActive, agentRuns, agentFilter, floors, parentOf, kindOf, agentsMode]);

  // Agent list for the filter bar in Agents mode. Counts come from
  // the active sub-mode (live / resolved / pending). Per JB
  // 2026-05-26: always render every agent that has ever appeared in
  // this building (union with agentsInBuilding), even when the
  // current sub-mode has 0 runs for that agent — gives the operator
  // a stable, complete filter row instead of buttons appearing /
  // disappearing as data churns.
  const agentsInRuns = useMemo(() => {
    if (!agentsModeActive) return null;
    const totals = new Map();
    for (const r of agentRuns) {
      if (!r?.agent_id) continue;
      totals.set(r.agent_id, (totals.get(r.agent_id) || 0) + 1);
    }
    for (const a of agentsInBuilding) {
      if (a?.agentId && !totals.has(a.agentId)) totals.set(a.agentId, 0);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([agentId, count]) => ({ agentId, count, color: colorForAgent(agentId) }));
  }, [agentsModeActive, agentRuns, agentsInBuilding]);

  // Same rule for the OrbitControls ref — must live ABOVE the early
  // returns so the hook count is stable across loading → hydrated
  // renders. Phase-5 controls bug regressed this; keep it pinned up
  // here.
  const controlsRef = useRef(null);
  // `contentRef` wraps the procedural floor stack OR the GLB model.
  // FitController measures its bounding box to frame the camera.
  const contentRef = useRef(null);
  // Refs shared between the ActivityConnector projector (inside <Canvas>)
  // and the SVG line/dot + the ActivityPanel root (both outside <Canvas>),
  // so the projector can read the panel's screen rect and mutate the line
  // each frame without a React re-render.
  const actConnLineRef = useRef(null);
  const actConnDotRef = useRef(null);
  const actConnGroupRef = useRef(null);
  const activityPanelElRef = useRef(null);
  // Monotonically-increasing trigger that fires the FitController
  // once per change. `mode` decides between centred fit (⛶) and
  // left-aligned default isometric (⌂). Init: `default` so the
  // building lands on the left of the canvas on first mount.
  const [viewState, setViewState] = useState({ trigger: 1, mode: 'default' });
  const requestFit = () => {
    setPanelTarget(null);
    setViewState((s) => ({ trigger: s.trigger + 1, mode: 'centered' }));
  };
  const requestDefaultView = () => {
    setPanelTarget(null);
    setViewState((s) => ({ trigger: s.trigger + 1, mode: 'default' }));
  };
  // Auto-fit when the canvas container's width settles/changes. The mount-time
  // fit (trigger:1) runs before the grid layout narrows the column (SERVICING/
  // MERLIN reserve a right-hand panel via `minmax(0,1fr) minmax(280px,360px)`),
  // so the building was framed for the full width and only snapped in after a
  // manual ⛶. A ResizeObserver re-fires the default fit once the real laid-out
  // width is known, and again if the column later resizes (panel open/close).
  const fitContainerRef = useRef(null);
  useEffect(() => {
    const el = fitContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let lastW = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.offsetWidth;
      if (Math.abs(w - lastW) < 4) return; // ignore sub-pixel thrash
      lastW = w;
      setViewState((s) => ({ trigger: s.trigger + 1, mode: 'default' }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Re-frame when the active building changes. The ResizeObserver above only
  // fires on a width change, so switching buildings (e.g. from the Locations
  // picker or the workspace switcher) would leave the new building framed for
  // the previous one's geometry until a manual ⛶. Re-fire the default fit once
  // the new building's floors have loaded. Keyed on buildingId + floor count so
  // it fires per building (not on user orbit within a building).
  useEffect(() => {
    if (floors.length === 0) return;
    setViewState((s) => ({ trigger: s.trigger + 1, mode: 'default' }));
  }, [buildingId, floors.length]);
  // Floor name labels on the canvas. Default off so the wireframe
  // stays clean; operators can flip them on from the controls
  // cluster. When on, EVERY floor gets a label — the screen-space
  // connector approach means each floor's label sits at its own
  // floor-altitude in screen, so 50 labels fit cleanly stacked.
  const [showLabels, setShowLabels] = useState(false);
  // (agentFilter useState moved up above agentRunsByFloorId — see TDZ
  // note there. PR #714.)
  // Live-flash on new alerts. When a fresh agent_runs row arrives
  // via realtime, we light its floor up in the agent's colour for a
  // few seconds — the operator sees the building "blink" as agents
  // fire in real time. FLASH_MS is module-level so FloorBox can
  // animate the pulse over the same window.
  // `recentArrival` drives the floating toast that shows alert
  // details next to the flashing floor. One toast at a time; the
  // most recent arrival wins.
  const TOAST_MS = 5000;
  const seenRowIdsRef = useRef(null);
  const hasHydratedRef = useRef(false);
  const [flashing, setFlashing] = useState(new Map());
  const [recentArrival, setRecentArrival] = useState(null);
  useEffect(() => {
    // Build the current set of row ids from asksByLocation (the RAW
    // hook output, not the filtered alertsByFloor). Filter changes
    // shouldn't cause flashes — only genuine new arrivals from
    // realtime should.
    const currentIds = new Set();
    for (const inner of asksByLocation.values()) {
      for (const rows of inner.values()) {
        for (const r of rows) currentIds.add(r.id);
      }
    }
    // First call after mount: record the baseline and DO NOT flash.
    // Without this guard, initial render goes empty-Map → full-Map
    // and every row reads as "new" because the ref's empty Set has
    // none of them — the building does the rainbow flash JB hit.
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      seenRowIdsRef.current = currentIds;
      return;
    }
    // Subsequent calls: anything in currentIds not in the ref is
    // a fresh row that arrived since the last render → flash its
    // floor (looked up via alertsByFloor's distribution).
    const newRowIds = new Set();
    for (const id of currentIds) {
      if (!seenRowIdsRef.current.has(id)) newRowIds.add(id);
    }
    if (newRowIds.size > 0) {
      const until = Date.now() + FLASH_MS;
      const updates = new Map(); // floorId → {color, until}
      let latest = null; // for the toast: pick the most recent new row
      for (const [floorId, byAgent] of alertsByFloor) {
        for (const [agentId, rows] of byAgent) {
          for (const r of rows) {
            if (newRowIds.has(r.id)) {
              const color = colorForAgent(agentId);
              updates.set(floorId, { color, until });
              if (!latest || (r.created_at || '') > (latest.row.created_at || '')) {
                latest = { floorId, agentId, color, row: r };
              }
            }
          }
        }
      }
      if (updates.size > 0) {
        setFlashing((prev) => {
          const next = new Map(prev);
          for (const [k, v] of updates) next.set(k, v);
          return next;
        });
      }
      if (latest) {
        setRecentArrival({
          ...latest,
          until: Date.now() + TOAST_MS,
        });
      }
    }
    seenRowIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asksByLocation]);
  // Tick: clear expired flashes. A single timer per active flash
  // set; recreated whenever `flashing` changes.
  useEffect(() => {
    if (flashing.size === 0) return undefined;
    const nextExpiry = Math.min(...Array.from(flashing.values()).map((f) => f.until));
    const delay = Math.max(50, nextExpiry - Date.now());
    const id = setTimeout(() => {
      setFlashing((prev) => {
        const now = Date.now();
        const next = new Map();
        for (const [k, v] of prev) if (v.until > now) next.set(k, v);
        return next;
      });
    }, delay);
    return () => clearTimeout(id);
  }, [flashing]);
  // Reset flash state on building switch — old building's "new
  // arrivals" shouldn't bleed into the new building.
  useEffect(() => {
    seenRowIdsRef.current = null;
    hasHydratedRef.current = false;
    setFlashing(new Map());
    setRecentArrival(null);
  }, [buildingId]);
  // Auto-dismiss the toast after its `until` timestamp.
  useEffect(() => {
    if (!recentArrival) return undefined;
    const delay = Math.max(50, recentArrival.until - Date.now());
    const id = setTimeout(() => setRecentArrival(null), delay);
    return () => clearTimeout(id);
  }, [recentArrival]);
  // TEST button: parent (Hypervisor.jsx) bumps `testCounter` on every
  // click. We pick a random floor + random agent colour and flash it
  // for FLASH_MS — same code path as a real realtime arrival, so the
  // operator can verify the live-flash visual is working without
  // waiting for a real agent to fire.
  const lastTestRef = useRef(0);
  useEffect(() => {
    if (testCounter <= lastTestRef.current) return;
    lastTestRef.current = testCounter;
    if (floors.length === 0) return;
    const f = floors[Math.floor(Math.random() * floors.length)];
    const palette = Object.keys(AGENT_COLORS);
    const agentId = palette[Math.floor(Math.random() * palette.length)];
    const color = colorForAgent(agentId);
    setFlashing((prev) => {
      const next = new Map(prev);
      next.set(f.id, { color, until: Date.now() + FLASH_MS });
      return next;
    });
    // Synthesise a row for the toast so the demo shows the same UI a
    // real arrival would. Reason text is hand-picked per agent so it
    // reads plausibly, not like Lorem Ipsum.
    const TEST_REASONS = {
      cleaning: 'Restroom hygiene SLA in breach — 32m response window exceeded',
      compliance: 'Certificate expiring in <72h — escalation needed',
      security: 'Loading-dock door held open 9m past threshold',
      'pharmacy-temp': 'Cold-chain probe stale >15m, last reading 4.7°C',
      supply: 'Stockout risk on consumables — 3 SKUs at zero',
      space: 'Floor occupancy 132% of target during peak window',
      energy: 'HVAC setpoint deviation +4.2°C overnight',
      'cold-chain': 'Freezer compressor cycling abnormally',
      hvac: 'Air-handler vibration above maintenance threshold',
      'crowd-flow': 'Gate B queue >18m, redirect recommended',
      'concession-demand': 'Section 304 popcorn restock at 0%',
    };
    setRecentArrival({
      floorId: f.id,
      agentId,
      color,
      row: {
        id: `test-${Date.now()}`,
        agent_id: agentId,
        location_id: f.id,
        decision_reason: TEST_REASONS[agentId] || 'Synthetic test alert',
        created_at: new Date().toISOString(),
      },
      until: Date.now() + TOAST_MS,
    });
  }, [testCounter, floors]);
  // Click target for the floating alerts panel. `agentId === null`
  // means "all alerts on this floor" (floor-name pill clicked);
  // otherwise it's a single-category drilldown.
  const [panelTarget, setPanelTarget] = useState(null);
  // Servicing canvas colour mode: 'severity' (teal/amber/red by hours-over) or
  // 'line' (recolour the lit floors + off-floor markers by service line).
  const [servicingColorMode, setServicingColorMode] = useState('severity');
  // ESC closes the panel — must live with the other hooks above the
  // early returns.
  useEffect(() => {
    if (!panelTarget) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPanelTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelTarget]);
  // Auto-clear panel when the user navigates to a different building
  // (otherwise the panel sits there with a stale floor id).
  useEffect(() => {
    setPanelTarget(null);
  }, [buildingId]);

  // Chat → "Show Floor N on the 3D viewer": control_hypervisor carries a
  // floor_id on the control bus. HypervisorPage applies the mode from the same
  // request; we own the floor focus — pop that floor's panel so the operator
  // actually lands on the floor Merlin named (the dim/highlight follows
  // panelTarget). Peek on mount so a request latched before this viewer mounted
  // (chat fired it from another page, then App navigated here) still lands.
  // Skipped in ctaMode — My Day's embedded viewer has its own focused-CTA flow.
  useEffect(() => {
    if (ctaMode) return undefined;
    const apply = (req) => {
      if (req?.floorId) setPanelTarget({ floorId: String(req.floorId), agentId: null });
    };
    apply(peekHypervisorControl());
    return subscribeHypervisorControl(apply);
  }, [ctaMode]);

  // Floor 1 sits at y = FLOOR_HEIGHT/2 (its box centre); floor N sits
  // at y = (N - 0.5) * FLOOR_HEIGHT. The viewer is purely visual —
  // floor names are shown in a side legend rather than on the canvas.
  // FloorBox visual state is now driven by the open panel (if any),
  // not by a separate camera-focus selection. `selectedFloorId` is
  // just a renamed alias of `panelTarget?.floorId` so the render
  // loop below stays readable.
  const selectedFloorId = panelTarget?.floorId ?? null;

  // World-Y of the floor the Activity panel is scoped to, used to draw a
  // connector from the building's right edge to the panel. Null whenever the
  // panel isn't a single-floor drilldown (org-wide ACTIVITY toggle, GLB,
  // CTA/agents modes) or the floor can't be located — the connector + its
  // SVG/projector are gated off in those cases.
  const activityConnectorFloorY = (() => {
    if (!selectedFloorId || modelUrl || ctaMode || agentsModeActive) return null;
    const idx = floors.findIndex((f) => f.id === selectedFloorId);
    return idx >= 0 ? (idx + 0.5) * FLOOR_HEIGHT : null;
  })();

  // In GLB mode the per-floor click-to-focus is suppressed (the model
  // has its own geometry — procedural floor positions wouldn't match)
  // but the right-side legend stays visible as an informational alert
  // overlay so operators still see "Floor 12 · 3 alerts" alongside
  // the model. controlsRef declared above the early returns so the
  // hook count stays stable across loading → hydrated renders.

  return (
    <div ref={fitContainerRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Canvas
        orthographic
        camera={{ position: [40, 30, 40], zoom: 5, near: 0.1, far: 4000 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        onPointerMissed={() => setPanelTarget(null)}
      >
        <group ref={contentRef}>
          {modelUrl ? (
            <Suspense fallback={null}>
              <GLBBuilding url={modelUrl} scale={modelScale} offsetY={modelOffsetY} lineColor={lineColor} />
            </Suspense>
          ) : (
            floors.map((f, i) => {
              const isSelected = f.id === selectedFloorId;
              const y = (i + 0.5) * FLOOR_HEIGHT;
              const pills = pillRowsByFloorId.get(f.id) || null;
              // Per-floor highlight colour. CTA mode short-circuits
              // everything else: only the supplied CTA floors light
              // up in the CTA's colour (red by default from My Day).
              // Outside CTA mode, priority (top wins):
              //   1) Flashing (just-arrived realtime alert).
              //   2) Panel-selected floor (brand pink).
              //   3) Agent filter colour:
              //      - 'all'   → floor's TOP agent colour (rainbow view)
              //      - agentId → floor highlighted only if that agent
              //        is in its visible pill row
              const cta = ctaMode ? ctaByFloorId.get(f.id) : null;
              const agentCta = agentsModeActive ? agentCtaByFloorId.get(f.id) || null : null;
              // Flash + AlertToast still fire in CTA/Merlin mode so the
              // TEST button keeps highlighting a floor and drawing the
              // connector to it. ctaMode no longer suppresses flash —
              // CTA-anchored floors win highlightColor anyway (cta?.color
              // takes priority below), so non-CTA floors are free to
              // flash without conflict. Agents mode still suppresses
              // (dots own the highlighting there).
              const flash = agentsModeActive ? null : flashing.get(f.id);
              let filterColor = null;
              if (!ctaMode && !agentsModeActive && !slaMode && agentFilter && pills && pills.length > 0) {
                if (agentFilter === 'all') {
                  filterColor = pills[0].color;
                } else if (pills.some((p) => p.agentId === agentFilter)) {
                  filterColor = colorForAgent(agentFilter);
                }
              }
              const agentsFloorColor = agentCta ? agentCta.color : null;
              // SLA mode: tint floors that contribute to the selected
              // SLA's breaches. Color comes from the parent (red ramp
              // by default). No card, no flash — just floor paint.
              const slaHit = slaMode ? floorHighlightByFloorId.get(f.id) : null;
              // Servicing "Service line" colour mode recolours the lit floor by
              // its worst item's discipline; otherwise the severity colour.
              const slaColor =
                servicingColorMode === 'line' && slaHit?.line
                  ? SERVICING_DOMAIN_META[slaHit.line]?.color || slaHit.color
                  : slaHit?.color;
              const highlightColor =
                cta?.color || agentsFloorColor || slaColor || flash?.color || (isSelected ? '#FF00B2' : filterColor);
              return (
                <React.Fragment key={f.id}>
                  <FloorBox
                    y={y}
                    width={FLOOR_WIDTH}
                    depth={FLOOR_DEPTH}
                    height={FLOOR_HEIGHT}
                    color={lineColor}
                    highlightColor={highlightColor}
                    flashUntil={flash?.until || null}
                    onSelect={() =>
                      sensingMetric ? toggleSensingFloor(f.id) : setPanelTarget({ floorId: f.id, agentId: null })
                    }
                  />
                  {(() => {
                    const sensingCallout = sensingCallouts.get(f.id);
                    if (cta) return <CTACard y={y} cta={cta} floorName={f.name} cardIndex={cta.cardIndex} />;
                    if (agentCta)
                      return <CTACard y={y} cta={agentCta} floorName={f.name} cardIndex={agentCta.cardIndex} />;
                    if (sensingCallout) {
                      // Synthetic CTA-shaped payload so CTACard renders
                      // the sensing callout with the same drag /
                      // double-click / connector chrome the Agents tab
                      // uses. Keyed by floor id so React can recycle.
                      // title/body come straight from sensingCallouts
                      // so each metric (temperature, air quality, …)
                      // owns its own copy.
                      const cardCta = {
                        id: `sensing-${f.id}`,
                        color: sensingCallout.color,
                        title: sensingCallout.title,
                        body: sensingCallout.body,
                        priority: 'attention',
                        agentId: null,
                        // Structured sensing fields so the Details drawer can
                        // render a real sensor reading instead of an empty
                        // agent-run shell. drawerKind routes to SensingBody.
                        drawerKind: 'sensing',
                        metric: sensingMetric,
                        reading: sensingCallout.body,
                        status: sensingCallout.title,
                        floorName: f.name,
                        floorId: f.id,
                      };
                      return <CTACard y={y} cta={cardCta} floorName={f.name} cardIndex={sensingCallout.cardIndex} />;
                    }
                    if (!ctaMode && !agentsModeActive && !slaMode && pills) {
                      return (
                        <FloorPillRow
                          y={y}
                          name={f.name}
                          pills={pills}
                          highlightColor={highlightColor}
                          onFloorClick={() => setPanelTarget({ floorId: f.id, agentId: null })}
                          onAgentClick={(agentId) => setPanelTarget({ floorId: f.id, agentId })}
                        />
                      );
                    }
                    return null;
                  })()}
                  {showLabels && <FloorLabel y={y} name={f.name} index={i} />}
                  {/* Left-edge floor number. Shows for any floor that has a
                      callout card (CTA / agent run / sensing callout), a TEST
                      flash, or is the selected floor — so a card always has
                      its number even with labels off. NOT for every tinted
                      sensing floor (slaHit would put a pill on all 50 →
                      overlap); the T-toggle ladder handles "all floors". */}
                  {(cta || agentCta || flash || sensingCallouts.get(f.id) || isSelected) && (
                    <FloorAlertNumber
                      y={y}
                      name={f.name}
                      floorId={f.id}
                      color={sensingCallouts.get(f.id)?.color || highlightColor || '#ef4444'}
                    />
                  )}
                </React.Fragment>
              );
            })
          )}
          {/* Top + bottom caps — solid grey rectangles closing the
              wireframe stack so it doesn't look like an open box.
              Skipped when a custom GLB model is loaded (the model
              already has its own roof / slab). PR #730. */}
          {!modelUrl && floors.length > 0 && (
            <>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[FLOOR_WIDTH, 0.12, FLOOR_DEPTH]} />
                <meshBasicMaterial color="#20286D" />
              </mesh>
              <mesh position={[0, floors.length * FLOOR_HEIGHT, 0]}>
                <boxGeometry args={[FLOOR_WIDTH, 0.12, FLOOR_DEPTH]} />
                <meshBasicMaterial color="#20286D" />
              </mesh>
            </>
          )}
          {/* Servicing off-floor markers: roof cap / basement-dock plinth /
              perimeter ring (real geometry) for open items that don't sit on
              the floor stack. Clicking one drills into that zone's items. */}
          {!modelUrl && servicingPlacement?.offStack && (
            <ServicingOffFloorMarkers
              offStack={servicingPlacement.offStack}
              topY={floors.length * FLOOR_HEIGHT}
              colorMode={servicingColorMode}
              t={t}
              onZoneClick={(zone) =>
                setPanelTarget({
                  floorId: `${buildingId}-zone-${zone}`,
                  agentId: null,
                  label: trLabel(t, SERVICING_ZONE_META[zone]?.labelKey, SERVICING_ZONE_META[zone]?.label || zone),
                })
              }
            />
          )}
        </group>
        <OrbitControls
          ref={controlsRef}
          enablePan
          enableRotate={false}
          enableDamping
          dampingFactor={0.08}
          minZoom={0.5}
          maxZoom={500}
          maxPolarAngle={Math.PI / 2.05}
          screenSpacePanning
        />
        <FitController
          contentRef={contentRef}
          trigger={viewState.trigger}
          mode={viewState.mode}
          controlsRef={controlsRef}
        />
        {/* PR #662: per-frame layout pass that prevents CTA cards
            from overlapping each other. Reads camera + canvas size
            via useThree, projects each registered card's anchor to
            screen, and nudges later cards down when their boxes
            would collide. Skips cards the user has manually
            dragged. No-op when fewer than 2 cards are registered. */}
        {/* CTAAutoLayout re-enabled in PR #808 with a minimal-displacement
            (PAVA) solver: unconflicted cards keep their exact level-with-
            anchor pose (so the #743 connector-flattening regression can't
            recur), and only overlapping clusters get pushed apart. Covers
            CTA mode (My Day), agents mode, and Sensing callouts — anywhere
            CTACards register. */}
        {(ctaMode || agentsModeActive || !!sensingMetric) && (
          <>
            {/* Reserve clearance under the top button bar in the modes
                that render one (Sensing → SensingMetricBar, agents →
                AgentFilterBar). My Day CTA mode has no top bar. */}
            <CTAAutoLayout topInset={!!sensingMetric || agentsModeActive ? CTA_TOP_INSET_BAR : CTA_BOUNDS_MARGIN} />
            {/* Same de-overlap for the left-edge floor-number badges. */}
            <AlertNumberAutoLayout
              topInset={!!sensingMetric || agentsModeActive ? CTA_TOP_INSET_BAR : CTA_BOUNDS_MARGIN}
            />
          </>
        )}
        {/* Per-frame projector that draws the connector from the selected
            floor's right edge to the floating Activity panel. Mutates the
            SVG line/dot rendered below (outside the Canvas) via shared refs. */}
        {activityConnectorFloorY != null && (
          <ActivityConnector
            floorY={activityConnectorFloorY}
            lineRef={actConnLineRef}
            dotRef={actConnDotRef}
            groupRef={actConnGroupRef}
            panelElRef={activityPanelElRef}
          />
        )}
        {/* Agents-mode empty state used to render here as an
            <Html> overlay anchored to the building centre — which put
            the message ON the tower. JB asked 2026-05-28 to move it
            into the empty right half of the canvas. Now rendered as
            a 2D overlay below (outside the <Canvas>) so it sits at a
            fixed screen position regardless of camera state. */}
        {recentArrival &&
          (() => {
            const idx = floors.findIndex((ff) => ff.id === recentArrival.floorId);
            if (idx < 0) return null;
            const yToast = (idx + 0.5) * FLOOR_HEIGHT;
            const floorRow = floors[idx];
            return (
              <AlertToast
                y={yToast}
                floor={floorRow}
                row={recentArrival.row}
                agentId={recentArrival.agentId}
                color={recentArrival.color}
                onDismiss={() => setRecentArrival(null)}
              />
            );
          })()}
      </Canvas>
      {/* Servicing "By location" rail — the never-blank WHAT. Lives outside the
          canvas at a fixed screen position; lists open items grouped by zone so
          the view is meaningful even when nothing localises to a floor. Hidden
          while a floor's Activity panel is open — both dock top-right, so this
          is master (rail) → detail (floor panel): clicking a floor swaps the
          overview for that floor's items; clicking away brings the rail back. */}
      {servicingPlacement?.buckets?.length > 0 && !panelTarget && (
        <ServicingByLocationRail buckets={servicingPlacement.buckets} t={t} />
      )}
      {/* Servicing colour-mode toggle (bottom-left) — Severity vs Service line.
          Shown whenever there's servicing placement; doesn't conflict with the
          top-docked rail/panel. */}
      {servicingPlacement && (
        <ServicingColorControls mode={servicingColorMode} onChange={setServicingColorMode} t={t} />
      )}
      {/* Agents-mode empty state. Lives outside the 3D canvas so it
          sits at a fixed screen position regardless of camera state.
          The building's ortho-camera framing leaves the right half of
          the canvas empty, so we centre the message inside that right
          half — vertically centred in the full canvas, horizontally
          centred in the right ~half (left: 60%, translated -50%).
          JB asked 2026-05-28: "I would prefer it on the right of the
          canvas, centered between the building edge and the right
          edge of the canvas." */}
      {agentsModeActive && agentRuns.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '70%',
            transform: 'translate(-50%, -50%)',
            padding: '10px 14px',
            background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            backdropFilter: 'blur(10px) saturate(180%)',
            WebkitBackdropFilter: 'blur(10px) saturate(180%)',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {agentsMode === 'live'
            ? 'No live agent activity in the last 15 minutes'
            : agentsMode === 'resolved'
              ? 'No recent resolved agent actions'
              : 'No pending agent asks for this building'}
        </div>
      )}
      <CanvasControls
        controlsRef={controlsRef}
        onFit={requestFit}
        onDefaultView={requestDefaultView}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((s) => !s)}
        t={t}
      />
      {!modelUrl && !ctaMode && !agentsModeActive && !slaMode && agentsInBuilding.length > 0 && (
        <AgentFilterBar
          agents={agentsInBuilding}
          active={agentFilter}
          /* Reserve 504px on the right whenever the Activity panel is
             rendered — either via the ACTIVITY toggle (activityOpen)
             OR a floor click (panelTarget). 504 = panel width 480 +
             right gutter 12 + clearance 12. */
          rightOffset={activityOpen || panelTarget ? 504 : 12}
          onSelect={(agentId) => setAgentFilter((prev) => (prev === agentId ? null : agentId))}
        />
      )}
      {!modelUrl && agentsModeActive && agentsInRuns && agentsInRuns.length > 0 && (
        <AgentFilterBar
          agents={agentsInRuns}
          active={agentFilter}
          rightOffset={12}
          onSelect={(agentId) => setAgentFilter((prev) => (prev === agentId ? null : agentId))}
        />
      )}
      {/* Sensing-mode button strip. Toggles which sensor metric paints
          per-floor tints. Only rendered when Hypervisor.jsx passes an
          onSelectSensingMetric handler (i.e. on the Sensing tab). */}
      {onSelectSensingMetric && <SensingMetricBar active={sensingMetric} onSelect={onSelectSensingMetric} />}
      {replayShowSlider && (
        <ReplaySlider
          backMs={replayBackMs}
          onChange={onReplayBackMsChange}
          rangeMs={6 * 60 * 60 * 1000}
          count={replayCount}
        />
      )}
      {/* Friendly empty state when TODAY = 0 activity. Without this
          the operator sees a blank wireframe and wonders if the page
          is broken vs genuinely calm. Floats over the canvas in the
          middle-left so the building stays visible behind it. */}
      {!modelUrl &&
        !ctaMode &&
        !agentsModeActive &&
        !slaMode &&
        nowFilter === 'today' &&
        pillRowsByFloorId.size === 0 &&
        agentsInBuilding.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '16px 22px',
              background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              backdropFilter: 'blur(12px) saturate(180%)',
              boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              maxWidth: 280,
              textAlign: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('hyper3d.calm.title')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>{t('hyper3d.calm.body')}</div>
            <button
              type="button"
              onClick={() => onSetNowFilter?.('all')}
              style={{
                marginTop: 4,
                padding: '5px 12px',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('hyper3d.calm.show_all')}
            </button>
          </div>
        )}
      {/* Floor detail panel. Opens on ACTIVITY toggle or an explicit floor
          click (panelTarget). A clicked floor opens the panel even in
          slaMode (Merlin tab passes floorHighlights → slaMode=true) so
          you can drill into any floor's activity; the ACTIVITY-toggle path
          still excludes slaMode. ctaMode/agentsMode have their own card UX. */}
      {/* Connector line from the building to the Activity panel. The line +
          dot geometry is written every frame by ActivityConnector (inside
          the Canvas). Rendered before the panel so it tucks under it; it
          also stops a few px short of the panel edge so stacking is moot.
          zIndex 1 lifts it above the canvas. */}
      {activityConnectorFloorY != null && (
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 1,
          }}
        >
          <g ref={actConnGroupRef} style={{ display: 'none' }}>
            <line ref={actConnLineRef} stroke="#cbd5e1" strokeWidth={1.5} strokeOpacity={0.75} strokeLinecap="round" />
            <circle ref={actConnDotRef} r={4} fill="#cbd5e1" stroke="#cbd5e1" strokeOpacity={0.3} strokeWidth={3} />
          </g>
        </svg>
      )}
      {((activityOpen && !slaMode) || panelTarget) && !modelUrl && !ctaMode && !agentsModeActive && (
        <ActivityPanel
          rootRef={activityPanelElRef}
          unifiedFeed={unifiedActivityFeed}
          rows={activityRowsAll}
          fallbackByFloor={
            servicingPlacement?.byFloor || servicingHeat?.byFloor || merlinFallbackByFloor || alertsByFloor
          }
          activityEnabled={activityOpen}
          panelTarget={panelTarget}
          floors={floors}
          agentFilter={agentFilter}
          nowFilter={nowFilter}
          onOpenChat={onOpenChat}
          onOpenIncident={onOpenIncident}
          onOpenAgent={onOpenAgent}
          onClose={() => {
            // When the panel is closed, clear BOTH the toggle (if on)
            // and any pill-driven drilldown. If the operator wanted
            // to keep ACTIVITY on, they can re-toggle it.
            setPanelTarget(null);
            if (activityOpen && onCloseActivity) onCloseActivity();
          }}
          t={t}
        />
      )}
    </div>
  );
}
