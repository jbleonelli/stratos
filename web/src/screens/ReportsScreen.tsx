import { useMemo } from 'react';
import { useOrganization, useOrgMetrics } from '../queries/useData';
import { useBuilding } from '../context/BuildingContext';
import { AdaptivLoader, Card, DataError, Pill, Sparkline } from '../ui/primitives';

export function ReportsScreen() {
  const { data: org } = useOrganization();
  const { selectedLocation } = useBuilding();
  const { data: m, isLoading, isError, refetch } = useOrgMetrics();

  const trend = useMemo(() => {
    if (!m) return [];
    const byDay = new Map(m.eventsTrend7d.map((t) => [t.day, t.count]));
    const out: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    return out;
  }, [m]);

  if (isError) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <DataError message="Couldn't load report." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !m) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', placeItems: 'center', padding: 48 }}>
        <AdaptivLoader size="md" label="Building report…" />
      </div>
    );
  }

  const generated = new Date().toLocaleString();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)' }}>REPORT</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>Operations snapshot</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
          {org?.name ?? 'Organization'}
          {selectedLocation ? ` · ${selectedLocation.name}` : ''} · generated {generated}
        </p>
      </div>

      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <Pill tone={m.incidentsOpen ? 'warn' : 'ok'}>{m.incidentsOpen} open incidents</Pill>
          <Pill tone={m.openAsks ? 'accent' : 'neutral'}>{m.openAsks} open asks</Pill>
          <Pill tone="neutral">{m.locationCount} locations</Pill>
          <Pill tone="neutral">
            {m.devicesOnline} online / {m.devicesOffline} offline devices
          </Pill>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Event volume (7 days)</div>
        <Sparkline data={trend} w={400} h={48} responsive stroke="var(--accent)" />

        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>By severity</div>
            {m.eventsBySeverity.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>No events</span>
            ) : (
              m.eventsBySeverity.map((s) => (
                <div key={s.severity} style={{ fontSize: 13, marginBottom: 4 }}>
                  {s.severity}: {s.count}
                </div>
              ))
            )}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Agent decisions</div>
            {m.agentDecisions.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>No runs</span>
            ) : (
              m.agentDecisions.map((d) => (
                <div key={d.decision} style={{ fontSize: 13, marginBottom: 4 }}>
                  {d.decision}: {d.count}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
        Full Merlin report builder (custom layouts, PDF export, scheduled delivery) ships in a later slice.
      </p>
    </div>
  );
}
