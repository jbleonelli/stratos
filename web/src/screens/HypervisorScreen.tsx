import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useDevices, useIncidents, useLocations } from '../queries/useData';
import type { Device, Location } from '../api/types';
import { Card, DataError, Dot, PanelHead, Pill } from '../ui/primitives';
import { HypervisorFloor3D } from './HypervisorFloor3D';

type Tab = 'schematic' | 'map' | 'plan' | '3d';

const deviceTone = (status: Device['status']) =>
  status === 'online' ? 'ok' : status === 'maintenance' ? 'warn' : 'risk';

function worstSeverity(locationId: string, incidents: { locationId?: string | null; severity: string }[]) {
  const mine = incidents.filter((i) => i.locationId === locationId);
  if (mine.some((i) => i.severity === 'critical')) return 'critical';
  if (mine.some((i) => i.severity === 'warning')) return 'warning';
  return null;
}

function SchematicView({
  locations,
  devices,
  incidents,
  selectedId,
  onSelect,
}: {
  locations: Location[];
  devices: Device[];
  incidents: ReturnType<typeof useIncidents>['data'];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}
    >
      {locations.map((loc) => {
        const locDevices = devices.filter((d) => d.locationId === loc.id);
        const sev = worstSeverity(loc.id, incidents ?? []);
        const active = selectedId === loc.id;
        return (
          <button
            key={loc.id}
            type="button"
            onClick={() => onSelect(loc.id)}
            style={{
              textAlign: 'left',
              padding: 14,
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${active ? 'var(--accent)' : sev ? 'var(--warn)' : 'var(--border)'}`,
              background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{loc.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {locDevices.map((d) => (
                <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  <Dot tone={deviceTone(d.status)} />
                  {d.name}
                </span>
              ))}
              {locDevices.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>No devices</span>
              )}
            </div>
            {sev && (
              <div style={{ marginTop: 10 }}>
                <Pill tone={sev === 'critical' ? 'risk' : 'warn'}>{sev} incident</Pill>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlanView({
  location,
  devices,
}: {
  location: Location;
  devices: Device[];
}) {
  const locDevices = devices.filter((d) => d.locationId === location.id);
  if (!location.floorPlanUrl) {
    return <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: 20 }}>No floor plan for this location.</div>;
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 420,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}
    >
      <img
        src={location.floorPlanUrl}
        alt={`${location.name} floor plan`}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      {locDevices.map((d) => {
        if (d.positionX == null || d.positionY == null) return null;
        return (
          <span
            key={d.id}
            title={d.name}
            style={{
              position: 'absolute',
              left: `${d.positionX * 100}%`,
              top: `${d.positionY * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: d.status === 'online' ? 'var(--accent)' : d.status === 'maintenance' ? 'var(--warn)' : 'var(--text-faint)',
              border: '2px solid var(--surface)',
              boxShadow: '0 0 0 1px var(--border)',
            }}
          />
        );
      })}
    </div>
  );
}

function MapView({
  locations,
  incidents,
  selectedId,
  onSelect,
}: {
  locations: Location[];
  incidents: ReturnType<typeof useIncidents>['data'];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const geoLocs = locations.filter((l) => l.latitude != null && l.longitude != null);
  const center: [number, number] =
    geoLocs[0] != null ? [geoLocs[0].latitude!, geoLocs[0].longitude!] : [48.8566, 2.3522];

  if (geoLocs.length === 0) {
    return <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: 20 }}>No geo coordinates for locations.</div>;
  }

  return (
    <div style={{ height: 420, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoLocs.map((loc) => {
          const sev = worstSeverity(loc.id, incidents ?? []);
          const color = sev === 'critical' ? '#ef4444' : sev === 'warning' ? '#f59e0b' : '#ff00b2';
          return (
            <CircleMarker
              key={loc.id}
              center={[loc.latitude!, loc.longitude!]}
              radius={selectedId === loc.id ? 14 : 10}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: selectedId === loc.id ? 3 : 1 }}
              eventHandlers={{ click: () => onSelect(loc.id) }}
            >
              <Popup>{loc.name}</Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export function HypervisorScreen({ onOpenDevices }: { onOpenDevices: (locationId: string) => void }) {
  const { data: locations = [], isLoading, isError, refetch } = useLocations();
  const { data: devices = [] } = useDevices();
  const { data: incidents = [] } = useIncidents();
  const [tab, setTab] = useState<Tab>('schematic');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tabs: Tab[] = ['schematic', 'map', 'plan', '3d'];
  const tabLabel = (t: Tab) => (t === '3d' ? '3D' : t);

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  );
  const selectedDevices = useMemo(
    () => devices.filter((d) => d.locationId === selectedId),
    [devices, selectedId],
  );

  if (isError) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <DataError message="Couldn’t load hypervisor." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
      <Card style={{ minHeight: 480 }}>
        <PanelHead
          title="Hypervisor"
          right={
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: tab === t ? 'var(--accent-soft)' : 'transparent',
                    color: tab === t ? 'var(--accent)' : 'var(--text-soft)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textTransform: 'capitalize',
                  }}
                >
                  {tabLabel(t)}
                </button>
              ))}
            </span>
          }
        />
        {isLoading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        ) : tab === 'schematic' ? (
          <SchematicView
            locations={locations}
            devices={devices}
            incidents={incidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : tab === 'map' ? (
          <MapView
            locations={locations}
            incidents={incidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : tab === 'plan' ? (
          selected?.floorPlanUrl ? (
            <PlanView location={selected} devices={devices} />
          ) : (
            <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: 20 }}>
              {selected ? 'No floor plan for this location.' : 'Select a location to view its floor plan.'}
            </div>
          )
        ) : selected ? (
          <HypervisorFloor3D devices={selectedDevices} elevation={selected.floorElevation ?? 0} />
        ) : (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: 20 }}>Select a location for the 3D view.</div>
        )}
      </Card>

      <Card>
        <PanelHead title="Selection" />
        {!selected ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Select a location to inspect devices.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{selected.name}</div>
            <Pill tone="neutral">{selected.deviceCount} devices</Pill>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedDevices.map((d) => (
                <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <Dot tone={deviceTone(d.status)} />
                  {d.name}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="ds-nav-row"
              onClick={() => onOpenDevices(selected.id)}
              style={{
                marginTop: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-soft)',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              View devices
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
