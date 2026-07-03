import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AGENT_ACCENT,
  AGENT_GROUPS,
  AGENTS,
  inferAgentId,
  type AgentDef,
} from '../app/agents-catalog';
import { useAgentRuns, useAsks } from '../queries/useData';
import { useAgentActivity } from '../queries/useAgentActivity';
import { useSession } from '../queries/useSession';
import { Card, Dot, PanelHead, Pill } from '../ui/primitives';
import { Icon } from '../ui/icons';

function AgentCard({
  agent,
  runs,
  pendingAsks,
  onOpen,
}: {
  agent: AgentDef;
  runs: number;
  pendingAsks: number;
  onOpen: () => void;
}) {
  const accent = AGENT_ACCENT[agent.id] ?? 'var(--accent)';
  const live = runs > 0 || pendingAsks > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="ds-nav-row"
      style={{
        display: 'block',
        width: '100%',
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Card
        interactive
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          borderColor: live ? 'var(--accent-line)' : undefined,
        }}
      >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: `color-mix(in oklch, ${accent} 18%, transparent)`,
            color: accent,
          }}
        >
          <Icon.agent size={20} />
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Dot tone={live ? 'ok' : 'off'} pulse={live} size={7} />
          <Pill tone={live ? 'ok' : 'neutral'}>{live ? 'active' : 'idle'}</Pill>
        </span>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>{agent.tag}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone="neutral">{runs} runs</Pill>
        {pendingAsks > 0 && <Pill tone="warn">{pendingAsks} pending</Pill>}
      </div>
      </Card>
    </button>
  );
}

export function AgentsScreen() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const orgId = session?.orgId ?? null;
  const live = useAgentActivity(orgId);
  const { data: historical = [] } = useAgentRuns(100);
  const { data: asks = [] } = useAsks();

  const stats = useMemo(() => {
    const runsByAgent: Record<string, number> = {};
    const asksByAgent: Record<string, number> = {};
    for (const a of AGENTS) {
      runsByAgent[a.id] = 0;
      asksByAgent[a.id] = 0;
    }
    for (const run of [...live, ...historical]) {
      const id = inferAgentId(run.rationale) ?? 'servicing';
      if (runsByAgent[id] !== undefined) runsByAgent[id]++;
      else runsByAgent.servicing++;
    }
    for (const ask of asks.filter((a) => a.status === 'open')) {
      const id = inferAgentId(ask.question) ?? 'servicing';
      if (asksByAgent[id] !== undefined) asksByAgent[id]++;
      else asksByAgent.servicing++;
    }
    return { runsByAgent, asksByAgent };
  }, [live, historical, asks]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)' }}>MONITOR</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>AI Agents</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>
          Specialized agents supervising cleaning, comfort, energy, compliance, and more.
        </p>
      </div>

      {AGENT_GROUPS.map((group) => {
        const agents = AGENTS.filter((a) => a.group === group.id);
        return (
          <div key={group.id}>
            <PanelHead title={group.label} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  runs={stats.runsByAgent[agent.id] ?? 0}
                  pendingAsks={stats.asksByAgent[agent.id] ?? 0}
                  onOpen={() => navigate(`/agents/${agent.id}`)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
