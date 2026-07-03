import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { subscribe } from '../api/client';
import { ON_ASK_RAISED, ON_EVENT_INGESTED } from '../api/graphql';
import {
  isViewImplemented,
  LEGACY_PATH_REDIRECTS,
  parseRoute,
  pillarForView,
  placeholderTitle,
  viewPath,
  type PillarId,
  type ViewId,
} from '../app/pillar-subnav';
import { BuildingProvider, useBuilding } from '../context/BuildingContext';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useOrganization } from '../queries/useData';
import { useSession } from '../queries/useSession';
import { AppShell } from './AppShell';
import { CommandPalette } from './CommandPalette';
import { pillarLandingView } from './Sidebar';
import { BriefingScreen } from '../screens/BriefingScreen';
import { NowScreen } from '../screens/NowScreen';
import { MetricsScreen } from '../screens/MetricsScreen';
import { LocationsScreen } from '../screens/LocationsScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { IncidentsScreen } from '../screens/IncidentsScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { HypervisorScreen } from '../screens/HypervisorScreen';
import { ContractsScreen } from '../screens/ContractsScreen';
import { WorkOrdersScreen } from '../screens/WorkOrdersScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { AgentsScreen } from '../screens/AgentsScreen';
import { AgentDetailScreen } from '../screens/AgentDetailScreen';
import { WellbeingScreen } from '../screens/WellbeingScreen';
import { SlasScreen } from '../screens/SlasScreen';
import { InnovateScreen } from '../screens/InnovateScreen';
import { InnovateCatalogScreen } from '../screens/InnovateCatalogScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

const CHAT_OPEN_KEY = 'stratosChatOpen';

function LegacyRedirect({ from }: { from: string }) {
  const target = LEGACY_PATH_REDIRECTS[from];
  if (!target) return <Navigate to="/briefing" replace />;
  return <Navigate to={viewPath(target)} replace />;
}

function ScreenRouter({
  view,
  orgId,
  deviceLocation,
  openDevices,
}: {
  view: ViewId;
  orgId: string | null;
  deviceLocation: string | null;
  openDevices: (locationId: string) => void;
}) {
  if (!isViewImplemented(view)) {
    const pillar = pillarForView(view);
    return <PlaceholderScreen title={placeholderTitle(view)} pillar={pillar?.toUpperCase()} />;
  }

  switch (view) {
    case 'briefing':
      return <BriefingScreen />;
    case 'now':
      return <NowScreen orgId={orgId} />;
    case 'dashboard':
      return <MetricsScreen />;
    case 'insights':
      return <InsightsScreen />;
    case 'insights-wellbeing':
      return <WellbeingScreen />;
    case 'insights-slas':
      return <SlasScreen />;
    case 'innovate':
      return <InnovateScreen />;
    case 'innovate-catalog':
      return <InnovateCatalogScreen />;
    case 'agents':
      return <AgentsScreen />;
    case 'agent-detail':
      return <AgentDetailScreen />;
    case 'incidents':
      return <IncidentsScreen />;
    case 'activity':
      return <ActivityScreen orgId={orgId} />;
    case 'hypervisor':
      return <HypervisorScreen onOpenDevices={openDevices} />;
    case 'locations':
      return <LocationsScreen onOpenDevices={openDevices} />;
    case 'devices':
      return <DevicesScreen initialLocationId={deviceLocation} />;
    case 'tickets':
      return <WorkOrdersScreen />;
    case 'contracts':
      return <ContractsScreen />;
    case 'reports':
      return <ReportsScreen />;
    case 'admin':
      return <AdminScreen />;
    default:
      return <PlaceholderScreen title={placeholderTitle(view)} />;
  }
}

function WorkspaceInner({ signOut }: { signOut: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const orgId = session?.orgId ?? null;
  const { data: org } = useOrganization(!!orgId);
  const { setSelectedLocationId } = useBuilding();
  const { open: paletteOpen, closePalette, openPalette } = useCommandPalette();

  const { view } = parseRoute(location.pathname);
  const [deviceLocation, setDeviceLocation] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(() => {
    try {
      return localStorage.getItem(CHAT_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_OPEN_KEY, chatOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [chatOpen]);

  useEffect(() => {
    if (!orgId) return;
    const asks = subscribe(ON_ASK_RAISED, { organizationId: orgId }, () => {
      qc.invalidateQueries({ queryKey: ['asks'] });
      qc.invalidateQueries({ queryKey: ['orgMetrics'] });
    });
    const events = subscribe(ON_EVENT_INGESTED, { organizationId: orgId }, () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: ['orgMetrics'] });
    });
    return () => {
      asks.unsubscribe();
      events.unsubscribe();
    };
  }, [orgId, qc]);

  const goView = (next: ViewId, agentId?: string) => {
    if (next !== 'devices') setDeviceLocation(null);
    navigate(viewPath(next, agentId));
  };

  const goPillar = (pillar: PillarId) => {
    setDeviceLocation(null);
    navigate(viewPath(pillarLandingView(pillar)));
  };

  const openDevices = (locationId: string) => {
    setDeviceLocation(locationId);
    navigate(viewPath('devices'));
  };

  return (
    <>
      <AppShell
        view={view}
        org={org}
        session={session}
        signOut={signOut}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        onOpenPalette={openPalette}
        onView={goView}
        onPillar={goPillar}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/briefing" replace />} />
          {Object.keys(LEGACY_PATH_REDIRECTS).map((legacy) => (
            <Route key={legacy} path={`/${legacy}`} element={<LegacyRedirect from={legacy} />} />
          ))}
          <Route path="/agents/:agentId" element={<ScreenRouter view="agent-detail" orgId={orgId} deviceLocation={deviceLocation} openDevices={openDevices} />} />
          <Route path="/agents" element={<ScreenRouter view="agents" orgId={orgId} deviceLocation={deviceLocation} openDevices={openDevices} />} />
          <Route
            path="/*"
            element={
              <ScreenRouter
                view={view}
                orgId={orgId}
                deviceLocation={deviceLocation}
                openDevices={openDevices}
              />
            }
          />
        </Routes>
      </AppShell>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        onNavigate={goView}
        onSelectLocation={(id) => setSelectedLocationId(id)}
      />
    </>
  );
}

export function Workspace({ signOut }: { signOut: () => void }) {
  return (
    <BuildingProvider>
      <WorkspaceInner signOut={signOut} />
    </BuildingProvider>
  );
}
