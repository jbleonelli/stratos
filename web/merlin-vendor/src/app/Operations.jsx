// Operations — shell that groups Devices, Deployments, and Schedules under
// one top tab. Sub-nav is a horizontal pill strip below the topbar; the
// active sub-section persists to localStorage so refreshes land you back.
import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { DevicesPage } from './Devices.jsx';
import { DeploymentsPage } from './Deployments.jsx';
import { SchedulesPage } from './Schedules.jsx';
import { HypervisorPage } from './Hypervisor.jsx';
import { ContractsPage, ContractorBuildingsPage, ContractorHardwarePage } from './ContractorApp.jsx';
import { ContractorSlasPage } from './ContractorSlas.jsx';
import { ContractorSourcesPage } from './ContractorSources.jsx';
import { ManagerScorecard } from './ManagerScorecard.jsx';
import { ManagerProposalsInbox } from './ManagerProposalsInbox.jsx';
import { ManagerReportsInbox } from './ManagerReportsInbox.jsx';
import { ManagerInspectionsView } from './ManagerInspectionsView.jsx';
import { ManagerSuggestionsInbox } from './ManagerSuggestionsInbox.jsx';
import { ManagerPenaltiesView } from './ManagerPenaltiesView.jsx';
import { ActivityPage } from './Activity.jsx';
import { TicketsPage } from './Tickets.jsx';
import { RestroomBoard } from './RestroomBoard.jsx';
import { ServicingBoard } from './ServicingBoard.jsx';
import { ServicingOverview } from './ServicingOverview.jsx';
import { ServicesRollup } from './ServicesRollup.jsx';
import { AREA_BY_ID } from './servicing-areas.js';
import { useActiveOrg } from './org-data.js';
import { useT } from './i18n.js';
import { useSession, canAccessHypervisor } from './auth.js';

const SUB_NAV = [
  // Activity — unified feed of pending calls (asks awaiting human
  // decision) + detected incidents (auto-handled or open). Replaces
  // the former Calls-for-action and Incidents tabs. Leads the strip
  // since it's the highest-frequency surface for FM / crew personas.
  { id: 'activity', labelKey: 'tab.activity', fallback: 'Activity', icon: 'bolt' },
  // Tickets — the follow-able work-item layer over Merlin's human
  // dispatch (migrations 179-181). Sits next to Activity since it's the
  // FM's "did the thing Merlin sent actually get done" surface.
  { id: 'tickets', labelKey: 'tab.tickets', fallback: 'Tickets', icon: 'paper' },
  // Servicing — group for "what's being done in the building" (Restrooms /
  // Security / Hospitality / Maintenance; inner strip below). Real-estate only.
  { id: 'servicing', labelKey: 'tab.servicing', fallback: 'Servicing', icon: 'sparkle', requiresRealEstate: true },
  // Hypervisor is the admin surface for the location tree + devices
  // + SLAs. Gated to tenant super admin / FM / property manager /
  // platform admin (canAccessHypervisor in auth.js); hidden from
  // crew + observer personas.
  {
    id: 'hypervisor',
    labelKey: 'tab.hypervisor',
    fallback: 'Hypervisor',
    icon: 'hypervisor',
    requiresHypervisor: true,
  },
  // Contractors — parent group for the contractor↔FM business loop
  // (Contracts, Proposals, Reports). Visible whenever at least one
  // of its inner items is visible for the active org.
  {
    id: 'contractors',
    labelKey: 'tab.contractors',
    fallback: 'Contractors',
    icon: 'badge',
    requiresContractorChild: true,
  },
  // Agents previously sat here; moved to MONITOR (Briefing / Metrics /
  // Agents) since the per-agent runtime surface is observational —
  // watching what agents are doing — and reads more naturally under
  // the watching pillar than under the doing pillar.
  { id: 'schedules', labelKey: 'tab.schedules', fallback: 'Schedules', icon: 'people' },
  { id: 'deployments', labelKey: 'tab.deployments', fallback: 'Deployments', icon: 'ship' },
  { id: 'devices', labelKey: 'tab.devices', fallback: 'Devices', icon: 'grid' },
];

// Inner sub-nav rendered when the user is on the Contractors group.
// Visibility per org-kind mirrors the original top-level entries.
const CONTRACTORS_SUB_NAV = [
  // Contracts — contractor's own portfolio. Only on contractor-kind
  // orgs (real_estate / adaptiv have no contractor-side contracts to
  // surface here).
  { id: 'contracts', labelKey: 'tab.contracts', fallback: 'Contracts', icon: 'shield', orgKind: 'contractor' },
  // SLAs — contractor's cross-customer roll-up of service agreements
  // they're a party to. Authors new agreements scoped to a contract +
  // location. Customer sees the same row in their Admin → SLAs →
  // Agreements tab with a Pending pill until they accept (PR 4).
  { id: 'slas', labelKey: 'tab.contractor_slas', fallback: 'SLAs', icon: 'shield', orgKind: 'contractor' },
  // Sources — contractor's cross-customer roll-up of catalog entries
  // they provide. Each entry is a kind of data signal (e.g. NFC trails
  // from their crew). Customer sees the same row in Agentic → Sources
  // → Catalog with a Pending pill until they accept (PR 5 RPC).
  { id: 'sources', labelKey: 'tab.contractor_sources', fallback: 'Sources', icon: 'gateway', orgKind: 'contractor' },
  // Buildings — contractor's contracted + self-owned buildings.
  // Opens the Hypervisor scoped to the chosen building. contractor only.
  {
    id: 'buildings',
    labelKey: 'tab.contractor_buildings',
    fallback: 'Buildings',
    icon: 'building',
    orgKind: 'contractor',
  },
  // Hardware — Adaptiv catalog, cart, orders, inventory + install
  // flow. contractor only (real_estate orgs will get their own
  // procurement surface in a later phase).
  { id: 'hardware', labelKey: 'tab.contractor_hardware', fallback: 'Hardware', icon: 'cart', orgKind: 'contractor' },
  // Scorecard — manager-side multi-contractor comparison (Phase 8.12).
  // Leads the real_estate sub-strip since it's the strategic-overview
  // surface; Proposals + Reports are the decision queue + deliverables.
  { id: 'scorecard', labelKey: 'tab.scorecard', fallback: 'Scorecard', icon: 'shield', orgKind: 'real_estate' },
  // Proposals — manager-side inbox of proposals from every contractor
  // covering this org's portfolio. real_estate only.
  { id: 'proposals', labelKey: 'tab.proposals', fallback: 'Proposals', icon: 'sparkle', orgKind: 'real_estate' },
  // Reports — manager-side reports inbox (Phase 8.3). real_estate only.
  {
    id: 'contractor-reports',
    labelKey: 'tab.contractor_reports',
    fallback: 'Reports',
    icon: 'panel',
    orgKind: 'real_estate',
  },
  // Inspections — manager-side QC inspections across contractors (#2). real_estate only.
  {
    id: 'fm-inspections',
    labelKey: 'tab.inspections',
    fallback: 'Inspections',
    icon: 'shield',
    orgKind: 'real_estate',
  },
  // Suggestions — manager-side inbox of contractor improvement/wellbeing ideas (#2). real_estate only.
  {
    id: 'fm-suggestions',
    labelKey: 'tab.fm_suggestions',
    fallback: 'Suggestions',
    icon: 'sparkle',
    orgKind: 'real_estate',
  },
  // SLA penalties — manager sets the penalty terms each contractor faces. real_estate only.
  { id: 'fm-penalties', labelKey: 'tab.fm_penalties', fallback: 'SLA penalties', icon: 'bolt', orgKind: 'real_estate' },
];

// Used by the Contractors gate above + by the initialSection routing
// logic so view='proposals' / view='contracts' etc. land on the
// Contractors group with the right inner section selected.
const CONTRACTORS_INNER_IDS = new Set(CONTRACTORS_SUB_NAV.map((s) => s.id));

// Inner sub-nav for the Servicing group — the live "what's being done in the
// building" surfaces. Restrooms uses RestroomBoard (IMF-live aware); the other
// three use the generic ServicingBoard (demo_servicing fixture). No per-item
// gating — the whole group is real_estate-gated at the SUB_NAV level.
const SERVICING_SUB_NAV = [
  { id: 'services', labelKey: 'tab.services', fallback: 'Overview', icon: 'panel' },
  { id: 'cleaning', labelKey: 'tab.cleaning', fallback: 'Cleaning', icon: 'droplet' },
  { id: 'security', labelKey: 'tab.security', fallback: 'Security', icon: 'shield' },
  { id: 'hospitality', labelKey: 'tab.hospitality', fallback: 'Hospitality', icon: 'people' },
  { id: 'maintenance', labelKey: 'tab.maintenance', fallback: 'Maintenance', icon: 'cog' },
];
const SERVICING_INNER_IDS = new Set(SERVICING_SUB_NAV.map((s) => s.id));

// Third level: every Servicing domain (Cleaning / Security / Hospitality /
// Maintenance) is a sub-group landing on a grouped overview (ServicingOverview);
// drilling a card shows that area's board. Areas + grouping live in
// ./servicing-areas.js (SERVICING_DOMAINS).
// Contractors inner-section ids that are also real App `view` values — used
// when reporting the active section up so the TopBar highlight tracks it.
const CONTRACTOR_INNER_VIEWS = new Set([
  'contracts',
  'proposals',
  'contractor-reports',
  'scorecard',
  'fm-inspections',
  'fm-suggestions',
  'fm-penalties',
]);

export function OperationsPage({
  building,
  role,
  tweaks,
  incidents,
  onOpenChat,
  onAskMerlin,
  onOpenAgent,
  onOpenIncident,
  onSectionChange,
  initialSection,
  initialCallsAgentId,
}) {
  const t = useT();
  const activeOrg = useActiveOrg();
  const session = useSession();
  const hypervisorAccess = canAccessHypervisor(session?.role, session?.isPlatformAdmin);
  // Hide sub-nav items whose orgKind doesn't match the active org
  // (Contracts) AND items gated to hypervisor-access roles when the
  // current user lacks those permissions.
  const visibleContractorsInner = CONTRACTORS_SUB_NAV.filter((s) => !s.orgKind || s.orgKind === activeOrg?.kind);
  const hasContractorsChild = visibleContractorsInner.length > 0;
  const visibleNav = SUB_NAV.filter((s) => {
    if (s.orgKind && s.orgKind !== activeOrg?.kind) return false;
    if (s.requiresHypervisor && !hypervisorAccess) return false;
    if (s.requiresContractorChild && !hasContractorsChild) return false;
    // Servicing is for building owners AND contractors (the latter see a
    // viewer-scoped roll-up of just their contracted lines at the client building).
    if (s.requiresRealEstate && activeOrg?.kind !== 'real_estate' && activeOrg?.kind !== 'contractor') return false;
    return true;
  });

  // initialSection coming in as a contractors-inner id ('contracts' /
  // 'proposals' / 'contractor-reports') routes the OPERATE pane to
  // the Contractors group with that inner item selected. Same idea for the
  // Servicing group (restrooms / security / hospitality / maintenance).
  const initialIsContractorsInner = initialSection && CONTRACTORS_INNER_IDS.has(initialSection);
  const initialIsServicingInner = initialSection && SERVICING_INNER_IDS.has(initialSection);

  const [section, setSection] = useState(() => {
    if (initialIsContractorsInner) return 'contractors';
    if (initialIsServicingInner) return 'servicing';
    if (initialSection && visibleNav.some((s) => s.id === initialSection)) return initialSection;
    const stored = localStorage.getItem('merlinOpSection');
    if (stored && visibleNav.some((s) => s.id === stored)) return stored;
    return visibleNav[0]?.id || 'devices';
  });
  useEffect(() => {
    localStorage.setItem('merlinOpSection', section);
  }, [section]);

  // Inner Contractors sub-section state. Persists separately so going
  // OPERATE → Contractors → Reports, leaving, and coming back lands
  // on Reports rather than the first inner item.
  const [contractorsSection, setContractorsSection] = useState(() => {
    if (initialIsContractorsInner) return initialSection;
    const stored = localStorage.getItem('merlinOpContractorsSection');
    if (stored && visibleContractorsInner.some((s) => s.id === stored)) return stored;
    return visibleContractorsInner[0]?.id || null;
  });
  useEffect(() => {
    if (contractorsSection) localStorage.setItem('merlinOpContractorsSection', contractorsSection);
  }, [contractorsSection]);

  // Inner Servicing sub-section state. Mirrors the Contractors pattern.
  const [servicingSection, setServicingSection] = useState(() => {
    if (initialIsServicingInner) return initialSection;
    const stored = localStorage.getItem('merlinOpServicingSection');
    if (stored && SERVICING_INNER_IDS.has(stored)) return stored;
    return SERVICING_SUB_NAV[0].id; // 'services' (cross-domain roll-up landing)
  });
  useEffect(() => {
    if (servicingSection) localStorage.setItem('merlinOpServicingSection', servicingSection);
  }, [servicingSection]);

  // Third-level area state for the active Servicing sub-group: 'overview' (the
  // grouped landing) or a drilled area id. Local + not persisted — switching or
  // re-entering a sub-group always starts on its overview.
  const [areaSection, setAreaSection] = useState('overview');

  // Inner Hypervisor sub-section: '3d' (the viewer) vs 'tree'. The tree is
  // the configuration/admin surface ("settings") — opened on demand via the
  // cog in the gradient band, NOT the default landing. So the Hypervisor
  // always opens on the 3D viewer; the tree is a per-need overlay (no longer
  // persisted as a landing — it would otherwise stick as the default).
  const [hypervisorSection, setHypervisorSection] = useState('3d');

  // Hypervisor 3D viewer mode (Merlin | Agents | SLAs | Sensing).
  // Lifted out of Hypervisor.jsx to here in PR #727 so the segmented
  // toggle can live in the gradient sub-nav band. Persisted in the
  // same localStorage key Hypervisor.jsx used, so the user's existing
  // choice carries over.
  const [hyperViewerMode, setHyperViewerMode] = useState(() => {
    try {
      return localStorage.getItem('hyperViewerMode') || 'merlin';
    } catch {
      return 'merlin';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('hyperViewerMode', hyperViewerMode);
    } catch {
      /* noop */
    }
  }, [hyperViewerMode]);
  // Report the resolved section UP so the parent's `view` (and thus the
  // TopBar sub-nav highlight) always tracks what's actually shown. Without
  // this, landing on the generic 'operations' view — where `section` is
  // restored from localStorage — left `view` stuck at 'operations', which
  // matches no sub-nav item, so nothing highlighted (the Hypervisor bug).
  // The section is already validated against role/org here, so the
  // reported view is safe. Identical-value setView calls in the parent are
  // no-ops, so this can't loop.
  useEffect(() => {
    if (!onSectionChange) return;
    let v;
    if (section === 'contractors') {
      // Map the inner contractors tab to its view value when it has one,
      // else the org's natural Contractors landing — either way the
      // Contractors group lights up in the TopBar.
      v = CONTRACTOR_INNER_VIEWS.has(contractorsSection)
        ? contractorsSection
        : activeOrg?.kind === 'real_estate'
          ? 'scorecard'
          : 'contracts';
    } else if (section === 'servicing') {
      // Inner servicing tab id IS the view value (restrooms/security/…),
      // which maps to operate → the Servicing pill lights up.
      v = servicingSection;
    } else {
      v = section; // activity / hypervisor / devices / deployments / schedules
    }
    onSectionChange(v);
  }, [section, contractorsSection, servicingSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync internal section when the parent passes a new initialSection.
  // Without this, the user clicking the bell icon (which sets
  // view='activity' in App.jsx) while already on OPERATE/Agents would
  // see the bell highlight but the sub-nav stay stuck on Agents —
  // OperationsPage was reading initialSection only at mount.
  useEffect(() => {
    if (initialIsContractorsInner) {
      setSection('contractors');
      setContractorsSection(initialSection);
      return;
    }
    if (initialIsServicingInner) {
      setSection('servicing');
      setServicingSection(initialSection);
      setAreaSection('overview');
      return;
    }
    if (initialSection && visibleNav.some((s) => s.id === initialSection)) {
      setSection(initialSection);
    }
  }, [initialSection]); // eslint-disable-line react-hooks/exhaustive-deps
  // Bounce out of a hidden sub-nav item if the active org changed
  // (e.g. user switched workspace from contractor to real_estate while
  // on the Contracts tab).
  useEffect(() => {
    if (!visibleNav.some((s) => s.id === section)) {
      setSection(visibleNav[0]?.id || 'devices');
    }
    if (contractorsSection && !visibleContractorsInner.some((s) => s.id === contractorsSection)) {
      setContractorsSection(visibleContractorsInner[0]?.id || null);
    }
  }, [activeOrg?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const labelFor = (item) => {
    const v = t(item.labelKey);
    return v && v !== item.labelKey ? v : item.fallback;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* OPERATE's main sub-nav (activity / hypervisor / contractors /
          schedules / deployments / devices) lifted to the TopBar in
          pillar-subnav.js — clicking one of those pills in the TopBar
          drives App.jsx's view, which feeds back here via
          initialSection. The Contractors INNER strip stays here
          because its visibility + items are org-kind-specific and
          don't fit cleanly into the centralized TopBar definition. */}

      {/* Inner Contractors strip — second-level pill row, only when
          the Contractors group is active. Visually nested under the
          OPERATE strip with the same surface tint so the hierarchy
          reads as a drill-in rather than a parallel nav. */}
      {section === 'contractors' && hasContractorsChild && (
        <div
          style={{
            height: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            background: 'color-mix(in oklch, var(--surface-2) 60%, transparent)',
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {labelFor(SUB_NAV.find((s) => s.id === 'contractors'))}
          </span>
          <Icon.chevR size={9} style={{ color: 'var(--text-faint)' }} />
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
            {visibleContractorsInner.map((s) => {
              const IconC = Icon[s.icon] || Icon.grid;
              const active = contractorsSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setContractorsSection(s.id)}
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
                  {labelFor(s)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Inner Servicing strip — Restrooms / Security / Hospitality /
          Maintenance. Mirrors the Contractors inner strip: the live
          "what's being done in the building" surfaces. */}
      {section === 'servicing' && (
        <div
          style={{
            height: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            background: 'color-mix(in oklch, var(--surface-2) 60%, transparent)',
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {labelFor(SUB_NAV.find((s) => s.id === 'servicing'))}
          </span>
          <Icon.chevR size={9} style={{ color: 'var(--text-faint)' }} />
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
            {SERVICING_SUB_NAV.map((s) => {
              const IconS = Icon[s.icon] || Icon.grid;
              const active = servicingSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setServicingSection(s.id);
                    setAreaSection('overview');
                  }}
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
                  <IconS size={11} />
                  {labelFor(s)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* A Servicing sub-group's third level is its grouped ServicingOverview
          landing (rendered in the sub-page below), not a flat strip. */}

      {/* Inner Hypervisor strip — gradient band. PR #727: lifted the
          Merlin/Agents/SLAs/Sensing toggle into this bar (centered).
          Cogwheel on the right toggles the tree overlay. */}
      {section === 'hypervisor' && (
        <div
          style={{
            height: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px 0 20px',
            background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-indigo))',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: 'rgba(255,255,255,0.95)',
              padding: 2,
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.6)',
              marginLeft: 100,
            }}
          >
            {[
              { id: 'merlin', label: 'MERLIN', title: 'Show pending CTA cards Merlin needs you to action' },
              { id: 'agents', label: 'AGENTS', title: 'Show agent activity on the floors they fired against' },
              { id: 'slas', label: 'SLAs', title: 'SLA view — coming soon' },
              {
                id: 'sensing',
                label: 'SENSING',
                title:
                  'Sensing — per-floor environmental readings (air quality, temperature, humidity, noise) from the building sensors + live occupancy from the people-counters',
              },
              {
                id: 'assets',
                label: 'ASSETS',
                title: 'Asset tracking — floors tinted by tracked-asset coverage + geofence status',
              },
              {
                id: 'servicing',
                label: 'SERVICING',
                title:
                  'Servicing — live service-line health (Cleaning/Security/Hospitality/Maintenance) + where the servicing agent fired',
              },
            ].map((s) => {
              const active = hyperViewerMode === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setHyperViewerMode(s.id)}
                  title={s.title}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 12px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '0.04em',
                    userSelect: 'none',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setHypervisorSection((s) => (s === 'tree' ? '3d' : 'tree'))}
            title={hypervisorSection === 'tree' ? 'Close tree (return to 3D)' : 'Open tree'}
            aria-label="Toggle tree view"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: hypervisorSection === 'tree' ? 'rgba(255,255,255,0.28)' : 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icon.cog size={14} />
          </button>
        </div>
      )}

      {/* Sub-page. `minWidth: 0` is critical here: without it, a
          sub-page that renders long unwrapped text (Activity rows
          with multi-hundred-char decision_reason strings) widens the
          flex container past the central card's width, which in
          turn pushes the App-level ChatPanel sibling off-screen.
          With `minWidth: 0` this row can shrink to fit the card. */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
        {section === 'activity' && (
          <ActivityPage
            building={building}
            incidents={incidents}
            onOpenChat={onOpenChat}
            onOpenIncident={onOpenIncident}
            onOpenAgent={onOpenAgent}
            initialAgentId={initialCallsAgentId}
          />
        )}
        {section === 'tickets' && <TicketsPage building={building} />}
        {section === 'servicing' && servicingSection === 'services' && (
          <ServicesRollup
            building={building}
            orgId={activeOrg?.id}
            viewer={activeOrg?.kind === 'contractor'}
            onSelectDomain={(d) => {
              setServicingSection(d);
              setAreaSection('overview');
            }}
          />
        )}
        {section === 'servicing' && servicingSection !== 'services' && areaSection === 'overview' && (
          // Contractors get a viewer-scoped overview AND drill-in board (their
          // lines at the client building, read-only) via the contained RPCs. The
          // restrooms board (demo_restroom_state) has no viewer RPC yet, so that
          // one card stays non-drillable for contractors (handled in the overview).
          <ServicingOverview
            domain={servicingSection}
            building={building}
            orgId={activeOrg?.id}
            viewer={activeOrg?.kind === 'contractor'}
            onSelect={setAreaSection}
          />
        )}
        {section === 'servicing' && servicingSection !== 'services' && areaSection !== 'overview' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <button
              onClick={() => setAreaSection('overview')}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                margin: '10px 0 0 var(--pad)',
                padding: '4px 10px',
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
              <Icon.chevR size={10} style={{ transform: 'rotate(180deg)' }} />
              {labelFor(SERVICING_SUB_NAV.find((s) => s.id === servicingSection))}
            </button>
            {areaSection === 'bathrooms' ? (
              <RestroomBoard building={building} />
            ) : (
              <ServicingBoard domain={AREA_BY_ID[areaSection]?.domain} building={building} />
            )}
          </div>
        )}
        {section === 'hypervisor' && hypervisorSection === 'tree' && (
          <HypervisorPage
            building={building}
            incidents={incidents}
            onOpenChat={onOpenChat}
            onOpenIncident={onOpenIncident}
            onOpenAgent={onOpenAgent}
          />
        )}
        {section === 'hypervisor' && hypervisorSection === '3d' && (
          <HypervisorPage
            building={building}
            incidents={incidents}
            onOpenChat={onOpenChat}
            onOpenIncident={onOpenIncident}
            onOpenAgent={onOpenAgent}
            onOpenServiceLine={(k) => {
              setSection('servicing');
              setServicingSection(k);
              setAreaSection('overview');
            }}
            view3d
            viewerMode={hyperViewerMode}
            onViewerModeChange={setHyperViewerMode}
          />
        )}
        {section === 'devices' && (
          <DevicesPage
            tweaks={tweaks}
            role={role}
            building={building}
            onOpenChat={onOpenChat}
            onAskMerlin={onAskMerlin || onOpenChat}
          />
        )}
        {section === 'deployments' && <DeploymentsPage building={building} onOpenChat={onOpenChat} />}
        {section === 'schedules' && <SchedulesPage building={building} role={role} onOpenChat={onOpenChat} />}
        {section === 'contractors' && contractorsSection === 'contracts' && <ContractsPage />}
        {section === 'contractors' && contractorsSection === 'slas' && <ContractorSlasPage />}
        {section === 'contractors' && contractorsSection === 'sources' && <ContractorSourcesPage />}
        {section === 'contractors' && contractorsSection === 'buildings' && <ContractorBuildingsPage />}
        {section === 'contractors' && contractorsSection === 'hardware' && <ContractorHardwarePage />}
        {section === 'contractors' && contractorsSection === 'scorecard' && <ManagerScorecard />}
        {section === 'contractors' && contractorsSection === 'proposals' && <ManagerProposalsInbox />}
        {section === 'contractors' && contractorsSection === 'contractor-reports' && <ManagerReportsInbox />}
        {section === 'contractors' && contractorsSection === 'fm-inspections' && <ManagerInspectionsView />}
        {section === 'contractors' && contractorsSection === 'fm-suggestions' && <ManagerSuggestionsInbox />}
        {section === 'contractors' && contractorsSection === 'fm-penalties' && <ManagerPenaltiesView />}
      </div>
    </div>
  );
}
