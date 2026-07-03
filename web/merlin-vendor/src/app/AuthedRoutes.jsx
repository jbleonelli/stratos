// Customer view-routing, extracted from App.jsx's AuthedApp (2026-06-24). Owns
// the page lazy-imports + the big view-routing ternary + the MonitorPane layout
// wrapper. AuthedApp keeps all state/hooks and renders <AuthedRoutes {…}/> inside
// its Suspense boundary, threading the routing inputs as props. Byte-faithful
// move — no behaviour change.
import React, { lazy } from 'react';
import { Dashboard } from './Dashboard.jsx';
import { AgentsPanel } from './DashboardAgents.jsx';
import { AgentDetailView } from './AgentDetailView.jsx';
import { canAccessAgentic } from './auth.js';
const AdminPage = lazy(() => import('./Admin.jsx').then((m) => ({ default: m.AdminPage })));
const AgenticPage = lazy(() => import('./Agentic.jsx').then((m) => ({ default: m.AgenticPage })));
const ReportsPage = lazy(() => import('./Reports.jsx').then((m) => ({ default: m.ReportsPage })));
const InsightsPage = lazy(() => import('./Insights.jsx').then((m) => ({ default: m.InsightsPage })));
const ForecastPage = lazy(() => import('./ForecastPage.jsx').then((m) => ({ default: m.ForecastPage })));
const ContractorAnticipatePage = lazy(() =>
  import('./ContractorAnticipatePage.jsx').then((m) => ({ default: m.ContractorAnticipatePage })),
);
const ContractorSavingsPage = lazy(() =>
  import('./ContractorSavingsPage.jsx').then((m) => ({ default: m.ContractorSavingsPage })),
);
const ContractorQualityPage = lazy(() =>
  import('./ContractorQualityPage.jsx').then((m) => ({ default: m.ContractorQualityPage })),
);
const ContractorScorecardPage = lazy(() =>
  import('./ContractorScorecardPage.jsx').then((m) => ({ default: m.ContractorScorecardPage })),
);
const ContractorSlaTracker = lazy(() =>
  import('./ContractorSlaTracker.jsx').then((m) => ({ default: m.ContractorSlaTracker })),
);
const KpiCockpit = lazy(() => import('./KpiCockpit.jsx').then((m) => ({ default: m.KpiCockpit })));
const BuildingBenchmarkPage = lazy(() =>
  import('./BuildingBenchmarkPage.jsx').then((m) => ({ default: m.BuildingBenchmarkPage })),
);
const ContractorSuggestionsPage = lazy(() =>
  import('./ContractorSuggestionsPage.jsx').then((m) => ({ default: m.ContractorSuggestionsPage })),
);
const PredictMaintenancePage = lazy(() =>
  import('./PredictMaintenancePage.jsx').then((m) => ({ default: m.PredictMaintenancePage })),
);
const CompliancePage = lazy(() => import('./CompliancePage.jsx').then((m) => ({ default: m.CompliancePage })));
const InnovationsPage = lazy(() => import('./InnovationsPage.jsx').then((m) => ({ default: m.InnovationsPage })));
const InnovatePage = lazy(() => import('./Innovate.jsx').then((m) => ({ default: m.InnovatePage })));
const BriefingPage = lazy(() => import('./Briefing.jsx').then((m) => ({ default: m.BriefingPage })));
const NowBriefingPage = lazy(() => import('./NowBriefingPage.jsx').then((m) => ({ default: m.NowBriefingPage })));
const LocationsPage = lazy(() => import('./LocationsPage.jsx').then((m) => ({ default: m.LocationsPage })));
const OperationsPage = lazy(() => import('./Operations.jsx').then((m) => ({ default: m.OperationsPage })));
const IncidentView = lazy(() => import('./IncidentView.jsx').then((m) => ({ default: m.IncidentView })));
const SettingsPage = lazy(() => import('./Settings.jsx').then((m) => ({ default: m.SettingsPage })));
const DeviceDetailPage = lazy(() => import('./DeviceDetailPage.jsx').then((m) => ({ default: m.DeviceDetailPage })));

// MONITOR pane wrapper. Used to render an in-pane Briefing/Metrics/Agents
// sub-nav strip; that strip lifted to the TopBar (pillar-subnav.js + see
// TopBar.jsx), so MonitorPane is now a thin layout passthrough kept
// for the flex-row inner that Dashboard/BriefingPage's scroll model
// depends on (a flex-column inner breaks Metrics scroll).
function MonitorPane({ children }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{children}</div>
    </div>
  );
}

export function AuthedRoutes({
  view,
  role,
  building,
  session,
  activeOrg,
  isOrgAdmin,
  tweaks,
  settingsOpen,
  setSettingsOpen,
  routedDeviceExternalId,
  routedIncident,
  setRoutedIncidentId,
  navigateTo,
  setView,
  adminSection,
  setAdminSection,
  agenticRequest,
  setAgenticRequest,
  agentDetailId,
  setAgentDetailId,
  dashRequest,
  setDashRequest,
  callsRequest,
  setCallsRequest,
  localIncidents,
  localSlas,
  openChat,
}) {
  return settingsOpen ? (
    <SettingsPage tweaks={tweaks} onClose={() => setSettingsOpen(false)} />
  ) : routedDeviceExternalId ? (
    // Route check fires BEFORE view checks so navigating to
    // /device/<id> always reaches the detail page, even when
    // the user was on the Operations → Devices subnav (which
    // also matches view==='devices').
    <DeviceDetailPage
      externalId={routedDeviceExternalId}
      onBack={() => {
        // Prefer real browser back so the user returns to wherever
        // they came from (Operations → Devices keeps view state).
        // Fallback to home + dashboard for direct URL-bar landings
        // where there's no in-app history to pop back to.
        if (window.history.length > 1) {
          window.history.back();
        } else {
          navigateTo('/');
          setView('dashboard');
        }
      }}
    />
  ) : view === 'admin' && (role.id === 'facility' || role.id === 'superadmin') ? (
    <AdminPage building={building} initialSection={adminSection} onSectionConsumed={() => setAdminSection(null)} />
  ) : view === 'agentic' && canAccessAgentic(role?.id, isOrgAdmin, session?.isPlatformAdmin) ? (
    <AgenticPage
      building={building}
      initialSection={agenticRequest?.section}
      initialAgentId={agenticRequest?.agentId}
      onEnableAgents={() => {
        setAdminSection('agents');
        setView('admin');
      }}
    />
  ) : view === 'operations' ||
    view === 'hypervisor' ||
    view === 'devices' ||
    view === 'deployments' ||
    view === 'schedules' ||
    view === 'activity' ||
    view === 'tickets' ||
    view === 'services' ||
    view === 'cleaning' ||
    view === 'security' ||
    view === 'hospitality' ||
    view === 'maintenance' ||
    view === 'calls' ||
    view === 'proposals' ||
    view === 'contracts' ||
    view === 'contractor-reports' ||
    view === 'scorecard' ||
    view === 'fm-inspections' ||
    view === 'fm-suggestions' ? (
    <OperationsPage
      tweaks={tweaks}
      role={role}
      building={building}
      incidents={localIncidents}
      initialSection={view === 'operations' ? null : view === 'calls' ? 'activity' : view}
      // Keep `view` in sync with the section OperationsPage
      // actually shows, so the TopBar sub-nav highlight is
      // correct even on the generic 'operations' landing (where
      // the section is restored from localStorage). Identical-
      // value setView calls are no-ops, so no render loop.
      onSectionChange={(v) => setView(v)}
      initialCallsAgentId={view === 'activity' || view === 'calls' ? callsRequest?.agentId : undefined}
      onOpenChat={openChat}
      onAskMerlin={openChat}
      onOpenIncident={(id) => {
        // setRoutedIncidentId alone won't navigate — the
        // OperationsPage branch above keeps matching while
        // view stays at 'activity' / 'hypervisor' / etc.
        // Force view to 'dashboard' (not in that match
        // list) so the routedIncident branch can win and
        // render IncidentView. Same trick the Sidebar's
        // incident-jump uses (K-23 comment in App.jsx).
        setRoutedIncidentId(id);
        setView('dashboard');
      }}
      onOpenAgent={(agentId) => {
        setDashRequest({ section: 'agents', agentId, at: Date.now() });
        setView('agents');
      }}
      onOpenCalls={(agentId) => {
        setCallsRequest({ agentId: agentId || null, at: Date.now() });
        setView('activity');
      }}
    />
  ) : view === 'reports' ? (
    <ReportsPage building={building} role={role} onOpenChat={openChat} />
  ) : view === 'insights' || view === 'insights-wellbeing' || view === 'insights-slas' ? (
    <InsightsPage
      building={building}
      role={role}
      onOpenChat={openChat}
      initialTrack={view === 'insights-wellbeing' ? 'wellbeing' : view === 'insights-slas' ? 'slas' : 'financial-v2'}
    />
  ) : view === 'predict-contractor-savings' && activeOrg?.kind === 'contractor' ? (
    <ContractorSavingsPage onOpenChat={openChat} />
  ) : view === 'predict-forecast' && activeOrg?.kind === 'contractor' ? (
    <ContractorAnticipatePage building={building} onOpenChat={openChat} />
  ) : view === 'predict-forecast' ? (
    <ForecastPage building={building} role={role} onOpenChat={openChat} />
  ) : view === 'predict-maintenance' ? (
    <PredictMaintenancePage building={building} role={role} onOpenChat={openChat} />
  ) : view === 'predict-compliance' ? (
    <CompliancePage building={building} role={role} onOpenChat={openChat} />
  ) : view === 'predict-innovations' ? (
    <InnovationsPage building={building} role={role} onOpenChat={openChat} onView={setView} />
  ) : view === 'contractor-scorecard' && activeOrg?.kind === 'contractor' ? (
    <ContractorScorecardPage building={building} onOpenChat={openChat} />
  ) : view === 'contractor-sla-tracker' && activeOrg?.kind === 'contractor' ? (
    <ContractorSlaTracker onOpenChat={openChat} onView={setView} />
  ) : view === 'kpi-cockpit' ? (
    <KpiCockpit building={building} onOpenChat={openChat} onView={setView} />
  ) : view === 'building-benchmark' ? (
    <BuildingBenchmarkPage onOpenChat={openChat} />
  ) : view === 'quality' && activeOrg?.kind === 'contractor' ? (
    <ContractorQualityPage building={building} onOpenChat={openChat} />
  ) : view === 'innovate-suggestions' && activeOrg?.kind === 'contractor' ? (
    <ContractorSuggestionsPage onOpenChat={openChat} />
  ) : view === 'innovate' || view === 'innovate-catalog' ? (
    <InnovatePage building={building} initialTab={view === 'innovate-catalog' ? 'catalog' : 'partners'} />
  ) : routedIncident ? (
    <IncidentView
      incident={routedIncident}
      building={building}
      onBack={() => setRoutedIncidentId(null)}
      onAskMerlin={openChat}
    />
  ) : view === 'agent-detail' && agentDetailId ? (
    <AgentDetailView
      building={building}
      agentId={agentDetailId}
      onBack={() => {
        setAgentDetailId(null);
        setView('agents');
      }}
      onOpenAgentic={(agentId) => {
        if (role.id !== 'superadmin') return;
        setAgenticRequest({ section: 'agents', agentId, at: Date.now() });
        setView('agentic');
      }}
      onOpenCalls={(agentId) => {
        setCallsRequest({ agentId: agentId || null, at: Date.now() });
        setView('activity');
      }}
    />
  ) : view === 'briefing' ||
    view === 'now' ||
    view === 'locations' ||
    view === 'building' ||
    view === 'dashboard' ||
    view === 'agents' ? (
    <MonitorPane>
      {view === 'locations' || view === 'building' ? (
        // 'building' is the old Building tab — merged into Locations; alias here
        // so any saved view / deep-link still resolves.
        <LocationsPage building={building} onView={setView} />
      ) : view === 'now' ? (
        <NowBriefingPage building={building} incidents={localIncidents} onView={setView} onOpenChat={openChat} />
      ) : view === 'dashboard' ? (
        <Dashboard
          building={building}
          role={role}
          onAddDataSource={() => {
            setAgenticRequest({ section: 'sources', at: Date.now() });
            setView('agentic');
          }}
          incidents={localIncidents}
          slas={localSlas}
          onOpenChat={openChat}
          onView={setView}
        />
      ) : view === 'agents' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--pad)' }}>
          <AgentsPanel
            building={building}
            role={role}
            onAskMerlin={openChat}
            request={dashRequest}
            onOpenCalls={(agentId) => {
              setCallsRequest({ agentId: agentId || null, at: Date.now() });
              setView('activity');
            }}
            onOpenAgentic={(agentId) => {
              if (role.id !== 'superadmin') return;
              setAgenticRequest({ section: 'agents', agentId: agentId || null, at: Date.now() });
              setView('agentic');
            }}
            onOpenAgentDetail={(agentId) => {
              setAgentDetailId(agentId);
              setView('agent-detail');
            }}
          />
        </div>
      ) : (
        <BriefingPage
          building={building}
          role={role}
          incidents={localIncidents}
          onOpenChat={openChat}
          onOpenIncident={(id) => setRoutedIncidentId(id)}
          onGoDashboard={() => setView('dashboard')}
          onView={setView}
        />
      )}
    </MonitorPane>
  ) : (
    <BriefingPage
      building={building}
      role={role}
      incidents={localIncidents}
      onOpenChat={openChat}
      onOpenIncident={(id) => setRoutedIncidentId(id)}
      onGoDashboard={() => setView('dashboard')}
      onView={setView}
    />
  );
}
