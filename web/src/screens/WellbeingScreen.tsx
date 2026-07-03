import { useMemo } from 'react';
import { useBuilding } from '../context/BuildingContext';
import { payloadNumber } from '../lib/eventPayload';
import { useDevices, useEvents, useIncidents, useOrgMetrics } from '../queries/useData';
import { AdaptivLoader, Card, DataError, PanelHead, Pill, Ring, Sparkline } from '../ui/primitives';

function comfortScore(tempReadings: number[]): { score: number; tone: 'ok' | 'warn' | 'risk' } {
  if (tempReadings.length === 0) return { score: 82, tone: 'ok' };
  const avg = tempReadings.reduce((a, b) => a + b, 0) / tempReadings.length;
  if (avg >= 30) return { score: 42, tone: 'risk' };
  if (avg >= 26) return { score: 68, tone: 'warn' };
  if (avg >= 18 && avg <= 24) return { score: 94, tone: 'ok' };
  return { score: 78, tone: 'warn' };
}

export function WellbeingScreen() {
  const { selectedLocation } = useBuilding();
  const { data: metrics, isLoading: mLoading, isError: mError, refetch } = useOrgMetrics();
  const { data: events = [] } = useEvents(80);
  const { data: incidents = [] } = useIncidents(40);
  const { data: devices = [] } = useDevices(selectedLocation?.id);

  const scopedEvents = useMemo(
    () => (selectedLocation ? events.filter((e) => e.locationId === selectedLocation.id) : events),
    [events, selectedLocation],
  );

  const tempReadings = useMemo(
    () =>
      scopedEvents
        .map((e) => payloadNumber(e.payload, 'temp_c'))
        .filter((t): t is number => t != null),
    [scopedEvents],
  );

  const comfort = useMemo(() => comfortScore(tempReadings), [tempReadings]);

  const onlinePct = useMemo(() => {
    if (!devices.length) {
      if (!metrics) return 0;
      const total = metrics.devicesOnline + metrics.devicesOffline + metrics.devicesMaintenance;
      return Math.round((metrics.devicesOnline / Math.max(1, total)) * 100);
    }
    const on = devices.filter((d) => d.status === 'online').length;
    return Math.round((on / devices.length) * 100);
  }, [devices, metrics]);

  const trend = useMemo(() => {
    if (tempReadings.length >= 2) return tempReadings.slice(-7);
    return [20, 21, 22, 23, 22, 21, tempReadings[0] ?? 22];
  }, [tempReadings]);

  const comfortIncidents = useMemo(
    () => scopedEvents.filter((e) => e.kind === 'device_alert' || e.severity !== 'info').slice(0, 5),
    [scopedEvents],
  );

  if (mError) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <DataError message="Couldn't load wellbeing insights." onRetry={() => refetch()} />
      </div>
    );
  }

  if (mLoading || !metrics) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', placeItems: 'center', padding: 48 }}>
        <AdaptivLoader size="md" label="Loading wellbeing…" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)' }}>PREDICT</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>Wellbeing</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>
          Comfort and indoor environmental quality{selectedLocation ? ` · ${selectedLocation.name}` : ''}.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Card style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Ring pct={comfort.score} size={56} tone={comfort.tone} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Comfort index
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{comfort.score}%</div>
          </div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Sensor uptime
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{onlinePct}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>Devices reporting</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Open comfort alerts
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: comfortIncidents.length ? 'var(--warn)' : 'var(--text)' }}>
            {comfortIncidents.length}
          </div>
        </Card>
      </div>

      <Card style={{ padding: 16 }}>
        <PanelHead title="Temperature trend" />
        {tempReadings.length > 0 ? (
          <>
            <Sparkline data={trend} w={320} h={48} responsive stroke="var(--accent)" />
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              Latest readings from device events (°C).
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-faint)' }}>
            No temperature telemetry yet — connect HVAC or air-quality sensors to populate this chart.
          </p>
        )}
      </Card>

      <Card style={{ padding: 16 }}>
        <PanelHead title="Signals affecting occupant comfort" />
        {comfortIncidents.length === 0 && incidents.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-faint)' }}>No active comfort-related incidents.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(comfortIncidents.length ? comfortIncidents : incidents.slice(0, 5)).map((e) => {
              const temp = payloadNumber(e.payload, 'temp_c');
              return (
                <li key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{e.kind}</span>
                    <Pill tone={e.severity === 'critical' ? 'risk' : e.severity === 'warning' ? 'warn' : 'info'}>
                      {e.severity}
                    </Pill>
                  </div>
                  {temp != null && (
                    <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{temp.toFixed(1)}°C recorded</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
