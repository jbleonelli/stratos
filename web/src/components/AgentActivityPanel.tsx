import type { AgentActivity, AgentDecision } from '../api/types';
import { timeAgo } from './format';
import { AgentAvatar, Card, Dot, PanelHead, Pill } from '../ui/primitives';

const decisionTone = (d: AgentDecision) => (d === 'act' ? 'risk' : d === 'ask' ? 'warn' : 'neutral');

function ActivityList({ activity }: { activity: AgentActivity[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {activity.map((a, i) => (
        <li
          key={a.id}
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            animation: 'ds-fade-in .2s ease',
          }}
        >
          <AgentAvatar size={26} glow={false} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Pill tone={decisionTone(a.decision)}>{a.decision}</Pill>
              {a.costCents > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  ${(a.costCents / 100).toFixed(2)}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 'auto' }}>{timeAgo(a.createdAt)}</span>
            </div>
            {a.rationale && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>{a.rationale}</p>
            )}
          </div>
        </li>
      ))}
      {activity.length === 0 && (
        <li style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 22, fontSize: 13 }}>
          No agent activity yet — decisions appear here live.
        </li>
      )}
    </ul>
  );
}

// Live feed of agent decisions. Purely presentational — subscriptions and queries
// live in useAgentActivity / useAgentRuns.
export function AgentActivityPanel({ activity, embedded = false }: { activity: AgentActivity[]; embedded?: boolean }) {
  const live = activity.length > 0;

  if (embedded) return <ActivityList activity={activity} />;

  return (
    <Card>
      <PanelHead
        title="Agent"
        right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Dot tone={live ? 'ok' : 'off'} pulse={live} size={7} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>{live ? 'live' : 'idle'}</span>
          </span>
        }
      />
      <ActivityList activity={activity} />
    </Card>
  );
}
