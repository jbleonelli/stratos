import { useMemo } from 'react';
import { useBuilding } from '../context/BuildingContext';
import { useAnswerAsk, useAsks, useIncidents, useOrgMetrics, useAgentRuns } from '../queries/useData';
import { useSession } from '../queries/useSession';
import { timeAgo } from '../components/format';
import { AdaptivLoader, Button, Card, DataError, Dot, PanelHead, Pill, Ring, Sparkline } from '../ui/primitives';
import { Icon } from '../ui/icons';

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

function CtaCard({
  title,
  body,
  meta,
  tone = 'accent',
  onApprove,
  onHold,
}: {
  title: string;
  body: string;
  meta?: string;
  tone?: 'accent' | 'warn' | 'risk';
  onApprove?: () => void;
  onHold?: () => void;
}) {
  const border =
    tone === 'risk' ? 'var(--risk)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent-line)';
  return (
    <Card
      style={{
        padding: 16,
        borderColor: border,
        background:
          tone === 'risk'
            ? 'color-mix(in oklch, var(--risk) 8%, var(--surface))'
            : tone === 'warn'
              ? 'color-mix(in oklch, var(--warn) 8%, var(--surface))'
              : 'var(--surface)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: 'var(--accent-pink)', marginBottom: 6 }}>
        NEEDS YOU
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.45, color: 'var(--text-soft)' }}>{body}</p>
      {meta && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>{meta}</div>}
      {(onApprove || onHold) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {onApprove && (
            <Button onClick={onApprove} style={{ padding: '6px 12px', fontSize: 12 }}>
              Approve
            </Button>
          )}
          {onHold && (
            <Button variant="ghost" onClick={onHold} style={{ padding: '6px 12px', fontSize: 12 }}>
              Hold
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function GlanceStat({ value, label, tone }: { value: string | number; label: string; tone?: 'ok' | 'warn' | 'risk' }) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'risk' ? 'var(--risk)' : 'var(--text)';
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
    </div>
  );
}

export function BriefingScreen() {
  const { selectedLocation } = useBuilding();
  const { data: session } = useSession();
  const { data: asks = [] } = useAsks();
  const { data: incidents = [] } = useIncidents(20);
  const { data: metrics, isLoading, isError, refetch } = useOrgMetrics();
  const { data: runs = [] } = useAgentRuns(12);
  const answer = useAnswerAsk();

  const openAsks = useMemo(() => asks.filter((a) => a.status === 'open').slice(0, 3), [asks]);
  const criticalIncidents = useMemo(
    () => incidents.filter((i) => i.severity === 'critical' || i.severity === 'warning').slice(0, 3),
    [incidents],
  );
  const attentionCount = openAsks.length + criticalIncidents.length;
  const calm = attentionCount === 0;

  const firstName = (session?.email?.split('@')[0] ?? 'there').split(/[._-]/)[0];
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const trend = useMemo(() => (metrics ? padTrend7d(metrics.eventsTrend7d) : []), [metrics]);

  const handledRecently = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return runs.filter((r) => new Date(r.createdAt).getTime() >= cutoff).slice(0, 4);
  }, [runs]);

  if (isError) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <DataError message="Couldn't load briefing." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !metrics) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', placeItems: 'center', padding: 48 }}>
        <AdaptivLoader size="md" label="Loading briefing…" />
      </div>
    );
  }

  const deviceTotal = metrics.devicesOnline + metrics.devicesOffline + metrics.devicesMaintenance;
  const onlinePct = deviceTotal ? Math.round((metrics.devicesOnline / deviceTotal) * 100) : 0;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <header>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)', marginBottom: 6 }}>
              MY DAY
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {calm
                ? `${greeting}, ${firstName} — all clear`
                : `${greeting}, ${firstName} — ${attentionCount} need${attentionCount === 1 ? 's' : ''} you`}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-dim)', maxWidth: 520 }}>
              {calm
                ? `Nothing needs your decision at ${selectedLocation?.name ?? 'this building'} right now.`
                : 'Review the cards below — approve or hold each ask Merlin surfaced.'}
            </p>
          </header>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Card style={{ flex: '1 1 120px', padding: 14 }}>
              <GlanceStat value={metrics.openAsks} label="Open asks" tone={metrics.openAsks ? 'warn' : 'ok'} />
            </Card>
            <Card style={{ flex: '1 1 120px', padding: 14 }}>
              <GlanceStat value={metrics.incidentsOpen} label="Incidents" tone={metrics.incidentsOpen ? 'warn' : 'ok'} />
            </Card>
            <Card style={{ flex: '1 1 160px', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Ring pct={onlinePct} size={44} tone={onlinePct >= 90 ? 'ok' : onlinePct >= 70 ? 'warn' : 'risk'} />
                <GlanceStat value={`${onlinePct}%`} label="Fleet online" />
              </div>
            </Card>
          </div>

          <div>
            <PanelHead
              title={calm ? 'Building status' : 'Your attention'}
              right={!calm ? <Pill tone="warn">{attentionCount} open</Pill> : undefined}
            />
            {calm ? (
              <Card style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ color: 'var(--ok)', marginBottom: 10 }}>
                  <Icon.sparkle size={28} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Merlin has the building</div>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
                  Open the chat panel anytime to ask a question or raise a decision.
                </p>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {openAsks.map((ask) => (
                  <CtaCard
                    key={ask.id}
                    title="Agent ask"
                    body={ask.question}
                    meta={timeAgo(ask.createdAt)}
                    onApprove={() => answer.mutate({ askId: ask.id, answer: 'Approved' })}
                    onHold={() => answer.mutate({ askId: ask.id, answer: 'On hold — reviewing' })}
                  />
                ))}
                {criticalIncidents.map((inc) => (
                  <CtaCard
                    key={inc.id}
                    title={inc.kind}
                    body={inc.payload ? inc.payload.slice(0, 160) : 'Incident flagged for review'}
                    meta={`${inc.severity} · ${timeAgo(inc.createdAt)}`}
                    tone={inc.severity === 'critical' ? 'risk' : 'warn'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 0 }}>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.35, color: 'var(--text-dim)', marginBottom: 12 }}>
              TODAY AT A GLANCE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <GlanceStat value={metrics.locationCount} label="Locations" />
              <GlanceStat
                value={`$${(metrics.agentCostCents24h / 100).toFixed(0)}`}
                label="Agent spend 24h"
                tone={metrics.agentCostCents24h > 0 ? 'warn' : undefined}
              />
              <GlanceStat value={metrics.devicesOnline} label="Online" tone="ok" />
              <GlanceStat value={metrics.devicesOffline} label="Offline" />
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8 }}>Signal trend</div>
              <Sparkline data={trend} w={240} h={36} responsive stroke="var(--accent)" />
            </div>
          </Card>

          <Card style={{ padding: 16 }}>
            <PanelHead
              title="Merlin handled"
              right={
                handledRecently.length > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Dot tone="ok" pulse size={6} />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>recent</span>
                  </span>
                ) : undefined
              }
            />
            {handledRecently.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-faint)' }}>No recent agent actions in the last 48h.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {handledRecently.map((run) => (
                  <li
                    key={run.id}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 12.5,
                      color: 'var(--text-soft)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>{run.rationale ?? run.decision}</span>
                      <Pill tone={run.decision === 'act' ? 'risk' : run.decision === 'ask' ? 'warn' : 'neutral'}>
                        {run.decision}
                      </Pill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
