import { useMemo } from 'react';
import { useOrgMetrics } from '../queries/useData';
import type { EventSeverity } from '../api/types';
import { AdaptivLoader, Card, DataError, Pill, Ring, Sparkline } from '../ui/primitives';

function KpiTile({
  label,
  value,
  tone = 'neutral',
  sub,
}: {
  label: string;
  value: string | number;
  tone?: 'ok' | 'warn' | 'risk' | 'accent' | 'neutral';
  sub?: string;
}) {
  return (
    <Card style={{ flex: '1 1 160px', padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.06 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          marginTop: 6,
          color:
            tone === 'ok'
              ? 'var(--ok)'
              : tone === 'warn'
                ? 'var(--warn)'
                : tone === 'risk'
                  ? 'var(--risk)'
                  : tone === 'accent'
                    ? 'var(--accent)'
                    : 'var(--text)',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

const sevTone = (s: EventSeverity): 'info' | 'warn' | 'risk' =>
  s === 'critical' ? 'risk' : s === 'warning' ? 'warn' : 'info';

function padTrend7d(trend: Array<{ day: string; count: number }>): number[] {
  const byDay = new Map(trend.map((t) => [t.day, t.count]));
  const out: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(byDay.get(key) ?? 0);
  }
  return out;
}

export function InsightsScreen() {
  const { data: m, isLoading, isError, refetch } = useOrgMetrics();

  const trend = useMemo(() => (m ? padTrend7d(m.eventsTrend7d) : []), [m]);
  const totalEvents = useMemo(
    () => (m ? m.eventsBySeverity.reduce((n, s) => n + s.count, 0) : 0),
    [m],
  );
  const criticalCount = m?.eventsBySeverity.find((s) => s.severity === 'critical')?.count ?? 0;

  if (isError) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <DataError message="Couldn’t load insights." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !m) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', placeItems: 'center', padding: 48 }}>
        <AdaptivLoader size="md" label="Loading insights…" />
      </div>
    );
  }

  const deviceTotal = m.devicesOnline + m.devicesOffline + m.devicesMaintenance;
  const onlinePct = deviceTotal ? Math.round((m.devicesOnline / deviceTotal) * 100) : 0;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiTile
          label="Open incidents"
          value={m.incidentsOpen}
          tone={m.incidentsOpen ? 'warn' : 'ok'}
          sub={criticalCount ? `${criticalCount} critical` : 'All clear'}
        />
        <KpiTile label="Open asks" value={m.openAsks} tone={m.openAsks ? 'accent' : 'neutral'} />
        <KpiTile
          label="Agent spend (24h)"
          value={`$${(m.agentCostCents24h / 100).toFixed(2)}`}
          tone={m.agentCostCents24h > 0 ? 'accent' : 'neutral'}
        />
        <KpiTile label="Locations" value={m.locationCount} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Signal volume</div>
          <div style={{ marginBottom: 12 }}>
            <Sparkline data={trend} w={280} h={48} responsive stroke="var(--accent)" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{totalEvents} events · last 7 days</div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Fleet health</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Ring pct={onlinePct} size={56} tone={onlinePct >= 90 ? 'ok' : onlinePct >= 70 ? 'warn' : 'risk'} />
            <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: 'var(--ok)' }}>{m.devicesOnline}</strong> online
              </div>
              <div>
                <strong style={{ color: 'var(--text-dim)' }}>{m.devicesOffline}</strong> offline ·{' '}
                <strong style={{ color: 'var(--warn)' }}>{m.devicesMaintenance}</strong> maintenance
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Events by severity</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {m.eventsBySeverity.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>No events yet.</span>
            ) : (
              m.eventsBySeverity.map((s) => (
                <Pill key={s.severity} tone={sevTone(s.severity)}>
                  {s.severity} · {s.count}
                </Pill>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Agent decisions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {m.agentDecisions.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>No agent runs yet.</span>
            ) : (
              m.agentDecisions.map((d) => (
                <Pill key={d.decision} tone={d.decision === 'act' ? 'risk' : d.decision === 'ask' ? 'warn' : 'neutral'}>
                  {d.decision} · {d.count}
                </Pill>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
