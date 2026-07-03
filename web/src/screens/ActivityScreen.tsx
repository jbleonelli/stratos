import { useMemo } from 'react';
import { useAgentRuns } from '../queries/useData';
import { useAgentActivity } from '../queries/useAgentActivity';
import { AgentActivityPanel } from '../components/AgentActivityPanel';
import { Card, DataError, Dot, PanelHead, Pill } from '../ui/primitives';

import type { AgentActivity } from '../api/types';

function mergeFeed(live: AgentActivity[], historical: AgentActivity[]): AgentActivity[] {
  const seen = new Set<string>();
  const out: AgentActivity[] = [];
  for (const row of [...live, ...historical]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out.slice(0, 50);
}

export function ActivityScreen({ orgId }: { orgId: string | null }) {
  const live = useAgentActivity(orgId);
  const { data: historical = [], isLoading, isError, refetch } = useAgentRuns();
  const feed = useMemo(() => mergeFeed(live, historical), [live, historical]);

  const stats = useMemo(() => {
    const acts = feed.filter((a) => a.decision === 'act').length;
    const asks = feed.filter((a) => a.decision === 'ask').length;
    const skips = feed.filter((a) => a.decision === 'skip').length;
    return { acts, asks, skips };
  }, [feed]);

  if (isError) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <DataError message="Couldn’t load agent activity." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Card style={{ flex: '1 1 140px', padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.06 }}>
            Act
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--risk)', marginTop: 4 }}>{stats.acts}</div>
        </Card>
        <Card style={{ flex: '1 1 140px', padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.06 }}>
            Ask
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--warn)', marginTop: 4 }}>{stats.asks}</div>
        </Card>
        <Card style={{ flex: '1 1 140px', padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.06 }}>
            Skip
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-soft)', marginTop: 4 }}>{stats.skips}</div>
        </Card>
      </div>

      <Card>
        <PanelHead
          title="Decision log"
          right={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Dot tone={live.length > 0 ? 'ok' : 'off'} pulse={live.length > 0} size={7} />
              <Pill tone={live.length > 0 ? 'ok' : 'neutral'}>{live.length > 0 ? 'receiving live' : 'idle'}</Pill>
            </span>
          }
        />
        {isLoading && feed.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '6px 2px' }}>Loading…</div>
        ) : (
          <AgentActivityPanel activity={feed} embedded />
        )}
      </Card>
    </div>
  );
}
