// @ts-check
// Centralized per-pillar sub-nav definitions.
//
// The customer-app TopBar used to render two stacked rows:
//   Row 1 (TopBar):  5-pillar pills (MONITOR · OPERATE · REPORT · PREDICT · INNOVATE)
//   Row 2 (page):    pillar-specific sub-nav (Briefing/Metrics/Agents under
//                    MONITOR; Activity/Hypervisor/Devices/… under OPERATE)
// The left icon rail in Sidebar.jsx already carries the 5 pillars, so the
// top pill strip was redundant. We deleted it and lifted the per-pillar
// sub-nav UP one row into the TopBar. This module is the single source
// of truth for what items each pillar's sub-nav contains.
//
// Each item maps to a `view` value the TopBar can pass to setView().
// App.jsx already routes views to pages (`OperationsPage` mounts for
// activity / hypervisor / etc.; BriefingPage for briefing; etc.), so the
// sub-nav click just sets view and the page-mounting logic does the rest.
//
// Items can carry visibility predicates:
//   requiresHypervisor       — only for users with hypervisor access
//   requiresContractorChild  — only when the active org's kind exposes
//                              at least one Contractors inner item
//   requiresRealEstate       — only when the active org's kind is real_estate
// Callers (TopBar) pass in `{ hypervisorAccess, hasContractorsChild, isRealEstate }`
// to filterSubNav() to get the visible slice.
//
// Visibility predicates intentionally mirror Operations.jsx's SUB_NAV
// behavior — Operations.jsx still owns the Contractors group's inner
// sub-nav (Contracts / Proposals / Scorecard / Reports), which is too
// org-kind-specific to lift cleanly.

export const PILLAR_SUBNAV = {
  monitor: [
    // Locations now also owns the per-building fact-sheet (the old Building tab
    // was merged in), so it always shows — single-location orgs land here too.
    { id: 'locations', view: 'locations', labelKey: 'tab.cat.locations', icon: 'campus' },
    { id: 'briefing', view: 'briefing', labelKey: 'tab.cat.briefing', icon: 'sparkle' },
    { id: 'now', view: 'now', labelKey: 'tab.cat.now', icon: 'bolt' },
    // Curated executive KPI cockpit — whole-building (FM) / contained (contractor)
    // command center assembled from existing data. KpiCockpit, FM master-dashboard
    // Phase 1 (docs/reference/fm-master-dashboard-analysis.md).
    { id: 'cockpit', view: 'kpi-cockpit', labelKey: 'tab.cockpit', icon: 'monitor' },
    // Org owner/admin cross-building benchmark — ranks every building in the org
    // by SLA / adherence / cost / incidents. Multi-building real-estate orgs only,
    // and only for org owners/admins (orgAdminOnly). BuildingBenchmarkPage.
    {
      id: 'benchmark',
      view: 'building-benchmark',
      labelKey: 'tab.benchmark',
      icon: 'scoreboard',
      requiresRealEstate: true,
      requiresMultiLocation: true,
      orgAdminOnly: true,
    },
    // Contractor-only "where I stand" scorecard (per-line adherence + trend +
    // forecast + last inspection). ContractorScorecardPage, feature #3.
    {
      id: 'scorecard',
      view: 'contractor-scorecard',
      labelKey: 'tab.my_scorecard',
      icon: 'scoreboard',
      contractorOnly: true,
    },
    // Contractor-only SLA TRACKER — follow every service agreement (live
    // adherence vs target, at-risk/breaching, trend, Ask-Merlin drill).
    // Read-only; propose/amend/accept stays in OPERATE → Contracts → SLAs.
    {
      id: 'sla-tracker',
      view: 'contractor-sla-tracker',
      labelKey: 'tab.contractor_slas',
      icon: 'agreement',
      contractorOnly: true,
    },
    // Hypervisor (3D building/floor view) lives under MONITOR — it's a way to SEE
    // the building, alongside the Now briefing (which can also switch into it
    // in-card). Gate hides it for non-FM roles. Moved here from OPERATE 2026-06-15.
    { id: 'hypervisor', view: 'hypervisor', labelKey: 'tab.hypervisor', icon: 'hypervisor', requiresHypervisor: true },
    { id: 'metrics', view: 'dashboard', labelKey: 'tab.cat.metrics', icon: 'metrics' },
    { id: 'agents', view: 'agents', labelKey: 'tab.agents', icon: 'agents' },
  ],
  operate: [
    { id: 'activity', view: 'activity', labelKey: 'tab.activity', icon: 'bolt' },
    { id: 'tickets', view: 'tickets', labelKey: 'tab.tickets', icon: 'paper' },
    // Quality control — contractor-only: the client's QC inspections of the
    // contractor's work + Merlin's "prep to pass" (mig 228 / ContractorQualityPage).
    { id: 'quality', view: 'quality', labelKey: 'tab.quality', icon: 'quality', contractorOnly: true },
    // Servicing — "what's being done in the building": a group whose inner
    // strip (Restrooms / Security / Hospitality / Maintenance, owned by
    // Operations.jsx) follows live servicing. Real-estate orgs only (via
    // filterSubNav's isRealEstate). Clicking it lands on Restrooms; all inner
    // views map back to operate. THIS module is the live source for the strip;
    // Operations.jsx SUB_NAV is vestigial — keep both in sync.
    {
      id: 'servicing',
      view: 'services',
      labelKey: 'tab.servicing',
      icon: 'sparkle',
      requiresRealEstate: true,
      servicingGroup: true,
    },
    // (Hypervisor moved to MONITOR — see the monitor[] list above.)
    // Contractors is a grouping: clicking it lands on the first inner
    // surface (contracts for contractor orgs, scorecard for real_estate).
    // The TopBar picks the right landing view via contractorsLandingView().
    {
      id: 'contractors',
      view: 'contracts',
      labelKey: 'tab.contractors',
      icon: 'people',
      requiresContractorChild: true,
      contractorsGroup: true,
    },
    { id: 'schedules', view: 'schedules', labelKey: 'tab.schedules', icon: 'schedule' },
    { id: 'deployments', view: 'deployments', labelKey: 'tab.deployments', icon: 'deployments' },
    { id: 'devices', view: 'devices', labelKey: 'tab.devices', icon: 'devices' },
  ],
  // PREDICT sub-nav — lifted from the in-page TrackToggle in
  // Insights.jsx. Three tracks: Savings (financial-v2), Wellbeing,
  // SLAs. Each maps to a distinct view value so the TopBar's view-
  // driven active highlight works. InsightsPage reads view via the
  // initialTrack prop App.jsx sets and syncs its internal track state.
  predict: [
    // forecast slot → ContractorAnticipatePage for contractor orgs (App.jsx),
    // the owner ForecastPage otherwise. The remaining tabs are owner-only
    // (building-wide savings/comfort/compliance/innovation); hidden for
    // contractors, who get the single service-line-tailored Anticipate view.
    { id: 'forecast', view: 'predict-forecast', labelKey: 'predict.tab.forecast', icon: 'beacon' },
    // Contractor-only Savings tab (margin/cost-to-serve + operational savings).
    // Owners get the energy/cost 'savings' track below instead.
    {
      id: 'contractor-savings',
      view: 'predict-contractor-savings',
      labelKey: 'insights.track.savings',
      icon: 'bolt',
      contractorOnly: true,
    },
    // Contractor-only: improvement & occupant-wellbeing suggestions sent up to
    // the client/FM (mig 229 / ContractorSuggestionsPage). Lives under
    // ANTICIPATE — it's forward-looking improvement work, alongside Forecast +
    // Savings (moved here from INNOVATE, JB 2026-06-17). View id kept as
    // 'innovate-suggestions' to avoid churn in App.jsx routing.
    {
      id: 'suggestions',
      view: 'innovate-suggestions',
      labelKey: 'innovate.tab.suggestions',
      icon: 'sparkle',
      contractorOnly: true,
    },
    { id: 'savings', view: 'insights', labelKey: 'insights.track.savings', icon: 'bolt', hideForContractor: true },
    {
      id: 'wellbeing',
      view: 'insights-wellbeing',
      labelKey: 'insights.track.wellbeing',
      icon: 'sparkle',
      hideForContractor: true,
    },
    { id: 'slas', view: 'insights-slas', labelKey: 'insights.track.slas', icon: 'shield', hideForContractor: true },
    {
      id: 'maintenance',
      view: 'predict-maintenance',
      labelKey: 'predict.tab.maintenance',
      icon: 'cog',
      hideForContractor: true,
    },
    {
      id: 'compliance',
      view: 'predict-compliance',
      labelKey: 'predict.tab.compliance',
      icon: 'badge',
      hideForContractor: true,
    },
    {
      id: 'innovations',
      view: 'predict-innovations',
      labelKey: 'predict.tab.innovations',
      icon: 'innovate',
      hideForContractor: true,
    },
  ],
  // INNOVATE sub-nav. Two tabs: the existing partner-ecosystem vendor
  // grid (default landing) + a customer-facing Adaptiv hardware
  // catalog. InnovatePage reads `initialTab` from App.jsx and syncs
  // its internal tab state via a useEffect.
  innovate: [
    { id: 'partners', view: 'innovate', labelKey: 'innovate.tab.partners', icon: 'grid' },
    { id: 'catalog', view: 'innovate-catalog', labelKey: 'innovate.tab.catalog', icon: 'cart' },
    // (Contractor "Suggestions" moved to the ANTICIPATE/predict pillar — JB 2026-06-17.)
  ],
  // report has no top-level sub-nav today — Reports is a single
  // surface (with internal pickers / segmented controls owned by the
  // page itself). The TopBar renders nothing for this pillar, which
  // keeps real estate clean.
  report: null,
};

// ── Inner-strip views (owned by Operations.jsx) ──────────────────────────────
// The Contractors and Servicing groups in OPERATE expand into an inner strip
// rendered inside Operations.jsx, not as their own pillar sub-nav items. These
// Sets enumerate the `view` values those inner strips can land on, so (a) the
// parent group pill stays lit (activeSubNavId) and (b) the derived
// VIEW_TO_PILLAR below knows they belong to OPERATE. Each group's OWN landing
// view ('contracts' / 'services') is also a PILLAR_SUBNAV item; the Sets add the
// remaining inner siblings.
const CONTRACTORS_INNER_VIEWS = new Set([
  'contracts',
  'proposals',
  'contractor-reports',
  'scorecard',
  'fm-inspections',
  'fm-suggestions',
  // 'buildings' and 'hardware' are contractor-only inner items but don't map to
  // distinct view values yet — they live under Operations contractor section state.
]);

// Views that route to the Servicing INNER strip inside Operations.jsx.
const SERVICING_INNER_VIEWS = new Set(['services', 'cleaning', 'security', 'hospitality', 'maintenance']);

// Routable views with NO pillar sub-nav item of their own — the app routes them,
// but they're reached by drill-down / alias / generic landing rather than a pill:
//   • agent-detail — drill-down from the Agents grid (stays under MONITOR)
//   • operations   — the generic OPERATE landing (restores last section from LS)
//   • calls        — legacy alias that lands on OPERATE → Activity
//   • building     — legacy alias for the old MONITOR → Building tab, merged into
//                    Locations in #1051; AuthedRoutes still aliases view==='building'
//                    to the Locations surface so old deep-links keep working.
//   • reports      — the REPORT pillar's single surface (no sub-nav strip)
const EXTRA_VIEW_PILLARS = {
  'agent-detail': 'monitor',
  operations: 'operate',
  calls: 'operate',
  building: 'monitor',
  reports: 'report',
};

// Views App.jsx routes that are deliberately PILLARLESS — reached via the
// FloatingMenu, not a pillar, so they get no sub-nav highlight. Enumerated here
// only so the route-map drift test (tests/route-map.test.js) knows they're legal
// routes and doesn't flag them as orphans.
export const PILLARLESS_VIEWS = ['admin', 'agentic'];

// view-id → pillar lookup, DERIVED from the single sources of truth above
// (PILLAR_SUBNAV items + the inner-strip Sets + EXTRA_VIEW_PILLARS) instead of a
// hand-maintained parallel object that silently drifts when a route is added.
// tests/route-map.test.js pins the derived result against the previous literal
// map, so this stays behavior-identical.
const VIEW_TO_PILLAR = (() => {
  const map = {};
  for (const [pillar, items] of Object.entries(PILLAR_SUBNAV)) {
    for (const it of items || []) map[it.view] = pillar;
  }
  for (const v of SERVICING_INNER_VIEWS) map[v] = 'operate';
  for (const v of CONTRACTORS_INNER_VIEWS) map[v] = 'operate';
  Object.assign(map, EXTRA_VIEW_PILLARS);
  return map;
})();

// Every `view` the customer shell legally routes: the pillar-mapped views plus
// the pillarless (FloatingMenu) ones. The route-map test asserts this set is
// EXACTLY the set of `view === '…'` branches across App.jsx + AuthedRoutes.jsx —
// so adding a render branch without registering it here fails CI rather than
// silently de-syncing the nav.
export const ROUTABLE_VIEWS = new Set([...Object.keys(VIEW_TO_PILLAR), ...PILLARLESS_VIEWS]);

export function pillarForView(view) {
  return VIEW_TO_PILLAR[view] || null;
}

// Returns the active item id for a given view + sub-nav items.
// Used by TopBar to highlight the right pill.
export function activeSubNavId(view, items) {
  if (!items) return null;
  for (const it of items) {
    if (it.view === view) return it.id;
    if (it.contractorsGroup && CONTRACTORS_INNER_VIEWS.has(view)) return it.id;
    if (it.servicingGroup && SERVICING_INNER_VIEWS.has(view)) return it.id;
  }
  return null;
}

// Filter a sub-nav array by the caller's visibility context. Mirrors
// the gating logic that used to live inline in Operations.jsx.
/**
 * @param {Array<Record<string, any>> | null} items
 * @param {{ hypervisorAccess?: boolean, hasContractorsChild?: boolean, myDayHidden?: boolean,
 *           isRealEstate?: boolean, orgKind?: string, multiLocation?: boolean }} [ctx]
 */
export function filterSubNav(
  items,
  { hypervisorAccess, hasContractorsChild, myDayHidden, isRealEstate, orgKind, multiLocation, isOrgAdmin } = {},
) {
  if (!items) return null;
  return items
    .filter((s) => {
      if (s.requiresHypervisor && !hypervisorAccess) return false;
      if (s.requiresContractorChild && !hasContractorsChild) return false;
      // Owner/admin-only tabs (e.g. the cross-building benchmark) hidden for
      // plain members. The page also self-gates (defense-in-depth).
      if (s.orgAdminOnly && !isOrgAdmin) return false;
      // The Locations picker only makes sense with more than one building/
      // ecosystem in the workspace — hide the tab for single-location orgs.
      if (s.requiresMultiLocation && !multiLocation) return false;
      // Servicing is for building owners AND contractors (the latter get a
      // viewer-scoped overview of their contracted lines). Mirrors the un-gated
      // requiresRealEstate check in Operations.jsx.
      if (s.requiresRealEstate && !isRealEstate && orgKind !== 'contractor') return false;
      // Owner-only tabs (e.g. the building-wide ANTICIPATE tracks) are hidden
      // for contractor orgs, which get a single service-line-tailored view.
      if (s.hideForContractor && orgKind === 'contractor') return false;
      // Contractor-only tabs (e.g. the contractor Savings view) are hidden for
      // everyone else.
      if (s.contractorOnly && orgKind !== 'contractor') return false;
      // Founder kill switch (platform_settings 'myday_hidden') hides the
      // My day / Briefing tab for everyone. See PlatformExperimental.
      if (myDayHidden && s.id === 'briefing') return false;
      return true;
    })
    .map((s) =>
      // A contractor's "Contractors" group is really THEIR contracts (it lands on
      // the contracts view via contractorsLandingView) — relabel it so the nav
      // reads from the contractor's point of view. New object; never mutate the
      // shared PILLAR_SUBNAV entry.
      s.id === 'contractors' && orgKind === 'contractor' ? { ...s, labelKey: 'tab.contracts' } : s,
    );
}

// Contractors group's landing view depends on org kind — contractor orgs
// land on their own portfolio (contracts), real_estate orgs land on the
// scorecard (their cross-contractor comparison). The TopBar uses this to
// pick the right `view` to setView() when the Contractors pill is clicked.
export function contractorsLandingView(orgKind) {
  return orgKind === 'real_estate' ? 'scorecard' : 'contracts';
}
