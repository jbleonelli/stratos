import type { AgentActivity } from '../api/types';
import { timeAgo } from './format';

// Live feed of agent decisions, pushed from the runtime via AppSync. Purely
// presentational: the subscription lives in useAgentActivity.
export function AgentActivityPanel({ activity }: { activity: AgentActivity[] }) {
  return (
    <section className="panel panel-wide">
      <div className="panel-head">
        <h2>Agent</h2>
        <span className="count">{activity.length ? 'live' : 'idle'}</span>
      </div>

      <ul className="list">
        {activity.map((a) => (
          <li key={a.id} className="activity">
            <div className="activity-head">
              <span className={`pill pill-${a.decision}`}>{a.decision}</span>
              {a.costCents > 0 && <span className="muted">{(a.costCents / 100).toFixed(2)} USD</span>}
              <span className="muted">{timeAgo(a.createdAt)}</span>
            </div>
            {a.rationale && <p className="activity-why">{a.rationale}</p>}
          </li>
        ))}
        {activity.length === 0 && (
          <li className="empty">No agent activity yet — decisions appear here live.</li>
        )}
      </ul>
    </section>
  );
}
