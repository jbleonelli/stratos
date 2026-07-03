import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AGENT_ACCENT, AGENT_BY_ID, inferAgentId } from '../app/agents-catalog';
import { useAgentRuns, useAsks } from '../queries/useData';
import { useAgentActivity } from '../queries/useAgentActivity';
import { useSession } from '../queries/useSession';
import { AgentActivityPanel } from '../components/AgentActivityPanel';
import { timeAgo } from '../components/format';
import { Button, Card, PanelHead, Pill } from '../ui/primitives';
import { Icon } from '../ui/icons';

export function AgentDetailScreen() {
  const { agentId = '' } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const agent = AGENT_BY_ID[agentId];
  const { data: session } = useSession();
  const orgId = session?.orgId ?? null;
  const live = useAgentActivity(orgId);
  const { data: historical = [] } = useAgentRuns(80);
  const { data: asks = [] } = useAsks();

  const accent = AGENT_ACCENT[agentId] ?? 'var(--accent)';

  const runs = useMemo(() => {
    const all = [...live, ...historical];
    const seen = new Set<string>();
    return all.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      const id = inferAgentId(r.rationale);
      return id === agentId || (!id && agentId === 'servicing');
    });
  }, [live, historical, agentId]);

  const pendingAsks = useMemo(
    () => asks.filter((a) => a.status === 'open' && inferAgentId(a.question) === agentId),
    [asks, agentId],
  );

  if (!agent) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Card style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--text-dim)' }}>Unknown agent.</p>
          <Button onClick={() => navigate('/agents')}>Back to agents</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: `color-mix(in oklch, ${accent} 18%, transparent)`,
            color: accent,
            flexShrink: 0,
          }}
        >
          <Icon.agent size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <Button variant="ghost" onClick={() => navigate('/agents')} style={{ marginBottom: 8, padding: '4px 0' }}>
            ← All agents
          </Button>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{agent.name}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>{agent.tag}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Pill tone="accent">propose mode</Pill>
            <Pill tone="neutral">{runs.length} recent runs</Pill>
            {pendingAsks.length > 0 && <Pill tone="warn">{pendingAsks.length} pending asks</Pill>}
          </div>
        </div>
      </div>

      {pendingAsks.length > 0 && (
        <div>
          <PanelHead title="Awaiting your decision" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingAsks.map((ask) => (
              <Card key={ask.id} style={{ padding: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: 14 }}>{ask.question}</p>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{timeAgo(ask.createdAt)}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <PanelHead title="Recent decisions" />
        {runs.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: 13 }}>No runs yet for this agent.</div>
        ) : (
          <AgentActivityPanel activity={runs.slice(0, 20)} embedded />
        )}
      </Card>
    </div>
  );
}
