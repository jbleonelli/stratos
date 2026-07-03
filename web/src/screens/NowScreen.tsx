import { useMemo } from 'react';
import { useBuilding } from '../context/BuildingContext';
import { payloadNumber } from '../lib/eventPayload';
import { useAsks, useDevices, useEvents, useIncidents, useOrgMetrics, useAgentRuns } from '../queries/useData';
import { useAgentActivity } from '../queries/useAgentActivity';
import { AgentActivityPanel } from '../components/AgentActivityPanel';
import { timeAgo } from '../components/format';
import { AdaptivLoader, Card, DataError, Dot, PanelHead, Pill, Sparkline } from '../ui/primitives';

function padTrend7d(trend: Array<{ day: string; count: number }>): number[] {
  const byDay = new Map(trend.map((t) => [t.day, t.count]));
  const out: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  return out;
}

function KpiTile({
  label,
  value,
  unit,
  tone,
  spark,
  pill,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: 'ok' | 'warn' | 'risk' | 'info';
  spark?: number[];
  pill?: string;
}) {
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'risk' ? 'var(--risk)' : 'var(--text)';
  return (
    <Card style={{ padding: 14, flex: '1 1 140px', minWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.35, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          {label}
        </div>
        {pill && <Pill tone="risk">{pill}</Pill>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{unit}</span>}
      </div>
      {spark && spark.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <Sparkline
            data={spark}
            w={120}
            h={28}
            stroke={tone === 'risk' ? 'var(--risk)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)'}
          />
        </div>
      )}
    </Card>
  );
}

function formatNowTime() {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function NowScreen({ orgId }: { orgId: string | null }) {
  const { selectedLocation } = useBuilding();
  const { data: metrics, isLoading, isError, refetch } = useOrgMetrics();
  const { data: asks = [] } = useAsks();
  const { data: incidents = [] } = useIncidents(30);
  const { data: devices = [] } = useDevices(selectedLocation?.id);
  const { data: events = [] } = useEvents(60);
  const live = useAgentActivity(orgId);
  const { data: historical = [] } = useAgentRuns(40);

  const scopedEvents = useMemo(
    () => (selectedLocation ? events.filter((e) => e.locationId === selectedLocation.id) : events),
    [events, selectedLocation],
  );

  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const devicePct = devices.length ? Math.round((onlineDevices / devices.length) * 100) : null;

  const forecastTiles = useMemo(() => {
    const temps = scopedEvents
      .map((e) => payloadNumber(e.payload, 'temp_c'))
      .filter((t): t is number => t != null);
    const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
    const warmAlerts = scopedEvents.filter((e) => e.severity === 'warning' || e.severity === 'critical').length;
    const loadPct = warmAlerts > 0 ? Math.min(95, 55 + warmAlerts * 12) : devicePct ?? 42;
    const thermostats = devices.filter((d) => d.name.toLowerCase().includes('thermostat')).length;

    return [
      {
        label: 'Zone temp',
        value: avgTemp != null ? avgTemp.toFixed(1) : '—',
        unit: avgTemp != null ? '°C avg' : undefined,
        tone: (avgTemp != null && avgTemp >= 28 ? 'warn' : avgTemp != null && avgTemp >= 26 ? 'warn' : 'ok') as
          | 'ok'
          | 'warn'
          | 'info',
        pill: avgTemp != null && avgTemp >= 28 ? 'WARM' : undefined,
      },
      {
        label: 'HVAC load',
        value: String(Math.round(loadPct)),
        unit: '% est.',
        tone: (loadPct >= 70 ? 'warn' : 'info') as 'warn' | 'info',
        pill: loadPct >= 70 ? 'PEAK' : undefined,
      },
      {
        label: 'Sensors',
        value: thermostats || devices.length,
        unit: thermostats ? 'thermostats' : 'devices',
        tone: 'ok' as const,
      },
    ];
  }, [scopedEvents, devices, devicePct]);

  const openAsks = useMemo(() => asks.filter((a) => a.status === 'open'), [asks]);
  const trend = useMemo(() => (metrics ? padTrend7d(metrics.eventsTrend7d) : []), [metrics]);
  const incidentSpark = useMemo(() => {
    if (incidents.length < 2) return undefined;
    const buckets = Array.from({ length: 8 }, () => 0);
    const now = Date.now();
    for (const inc of incidents) {
      const age = now - new Date(inc.createdAt).getTime();
      const bucket = Math.min(7, Math.floor(age / (60 * 60 * 1000)));
      buckets[7 - bucket]++;
    }
    return buckets;
  }, [incidents]);

  const feed = useMemo(() => {
    const seen = new Set<string>();
    const out = [];
    for (const row of [...live, ...historical]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out.slice(0, 24);
  }, [live, historical]);

  if (isError) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <DataError message="Couldn't load Now." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !metrics) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', placeItems: 'center', padding: 48 }}>
        <AdaptivLoader size="md" label="Loading live view…" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)' }}>NOW</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800 }}>
            {selectedLocation?.name ?? 'Workspace'}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatNowTime()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Live operational view</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <KpiTile
          label="Open asks"
          value={metrics.openAsks}
          tone={metrics.openAsks ? 'warn' : 'ok'}
          spark={trend}
        />
        <KpiTile
          label="Incidents"
          value={metrics.incidentsOpen}
          tone={metrics.incidentsOpen ? 'warn' : 'ok'}
          spark={incidentSpark}
        />
        <KpiTile
          label="Fleet"
          value={devicePct ?? '—'}
          unit={devicePct != null ? '% online' : undefined}
          tone={devicePct != null && devicePct < 80 ? 'warn' : 'ok'}
        />
        <KpiTile
          label="Agent spend"
          value={`$${(metrics.agentCostCents24h / 100).toFixed(0)}`}
          unit="24h"
          tone={metrics.agentCostCents24h > 0 ? 'info' : undefined}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <PanelHead title="12-hour forecast" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {forecastTiles.map((f) => (
            <KpiTile key={f.label} label={f.label} value={f.value} unit={f.unit} tone={f.tone} pill={f.pill} />
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-faint)' }}>
          Forecast derived from device events and fleet health at the selected site.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <PanelHead title="Merlin asks" right={<Pill tone={openAsks.length ? 'warn' : 'ok'}>{openAsks.length} open</Pill>} />
            {openAsks.length === 0 ? (
              <Card style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>All clear.</Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {openAsks.slice(0, 6).map((ask) => (
                  <Card key={ask.id} style={{ padding: 14, borderColor: 'var(--accent-line)' }}>
                    <Pill tone="warn">decision</Pill>
                    <p style={{ margin: '10px 0 6px', fontSize: 14, lineHeight: 1.45, fontWeight: 600 }}>{ask.question}</p>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{timeAgo(ask.createdAt)}</span>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Card>
            <PanelHead
              title="Decision stream"
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Dot tone={live.length > 0 ? 'ok' : 'off'} pulse={live.length > 0} size={7} />
                  <Pill tone={live.length > 0 ? 'ok' : 'neutral'}>{live.length > 0 ? 'live' : 'idle'}</Pill>
                </span>
              }
            />
            <AgentActivityPanel activity={feed} embedded />
          </Card>
        </div>

        <aside style={{ position: 'sticky', top: 0 }}>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.35, color: 'var(--text-dim)', marginBottom: 14 }}>
              TODAY AT A GLANCE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Routes / work orders</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{metrics.openAsks + metrics.incidentsOpen}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>items needing attention</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Devices at site</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{devices.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{onlineDevices} reporting online</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Event volume · 7d</div>
                <Sparkline data={trend} w={240} h={40} responsive stroke="var(--accent)" />
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
