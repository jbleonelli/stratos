import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribe } from '../api/client';
import { ON_ASK_RAISED, ON_EVENT_INGESTED } from '../api/graphql';
import { useOrganization } from '../queries/useData';
import { useSession } from '../queries/useSession';
import { AppShell, type NavItem } from './AppShell';
import { Icon } from '../ui/icons';
import { OverviewScreen } from '../screens/OverviewScreen';
import { LocationsScreen } from '../screens/LocationsScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { IncidentsScreen } from '../screens/IncidentsScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { AdminScreen } from '../screens/AdminScreen';

type ViewId = 'overview' | 'insights' | 'incidents' | 'activity' | 'locations' | 'devices' | 'admin';

const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Icon.overview },
  { id: 'insights', label: 'Insights', icon: Icon.insights },
  { id: 'incidents', label: 'Incidents', icon: Icon.incident },
  { id: 'activity', label: 'Activity', icon: Icon.activity },
  { id: 'locations', label: 'Locations', icon: Icon.building },
  { id: 'devices', label: 'Devices', icon: Icon.device },
  { id: 'admin', label: 'Admin', icon: Icon.admin },
];

export function Workspace({ signOut }: { signOut: () => void }) {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  const { data: session } = useSession();
  const orgId = session?.orgId ?? null;

  const [view, setView] = useState<ViewId>('overview');
  const [deviceLocation, setDeviceLocation] = useState<string | null>(null);

  // Live updates: AppSync publishes on raiseAsk / ingestEvent for our org.
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

  const onNavigate = (id: string) => {
    setDeviceLocation(null);
    setView(id as ViewId);
  };

  const openDevices = (locationId: string) => {
    setDeviceLocation(locationId);
    setView('devices');
  };

  const title = NAV.find((n) => n.id === view)?.label ?? 'Stratos';

  return (
    <AppShell nav={NAV} active={view} onNavigate={onNavigate} title={title} org={org} session={session} signOut={signOut}>
      {view === 'overview' && <OverviewScreen />}
      {view === 'insights' && <InsightsScreen />}
      {view === 'incidents' && <IncidentsScreen />}
      {view === 'activity' && <ActivityScreen orgId={orgId} />}
      {view === 'locations' && <LocationsScreen onOpenDevices={openDevices} />}
      {view === 'devices' && <DevicesScreen initialLocationId={deviceLocation} />}
      {view === 'admin' && <AdminScreen />}
    </AppShell>
  );
}
