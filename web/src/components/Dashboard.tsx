import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribe } from '../api/client';
import { ON_ASK_RAISED, ON_EVENT_INGESTED } from '../api/graphql';
import { useOrganization } from '../queries/useData';
import { useSession } from '../queries/useSession';
import { useAgentActivity } from '../queries/useAgentActivity';
import { AsksPanel } from './AsksPanel';
import { EventsPanel } from './EventsPanel';
import { AgentActivityPanel } from './AgentActivityPanel';

export function Dashboard({ signOut }: { signOut: () => void }) {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  const { data: session } = useSession();
  const orgId = session?.orgId ?? null;
  const activity = useAgentActivity(orgId);

  // Live updates: AppSync publishes on raiseAsk / ingestEvent for our org.
  useEffect(() => {
    if (!orgId) return;
    const asks = subscribe(ON_ASK_RAISED, { organizationId: orgId }, () =>
      qc.invalidateQueries({ queryKey: ['asks'] }),
    );
    const events = subscribe(ON_EVENT_INGESTED, { organizationId: orgId }, () =>
      qc.invalidateQueries({ queryKey: ['events'] }),
    );
    return () => {
      asks.unsubscribe();
      events.unsubscribe();
    };
  }, [orgId, qc]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Stratos</div>
        <div className="org">
          {org ? (
            <>
              <span className="org-name">{org.name}</span>
              <span className={`pill pill-${org.lifecycleState}`}>{org.lifecycleState}</span>
            </>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
        <div className="spacer" />
        <div className="user">
          {session?.platformRole === 'platform_admin' && <span className="pill pill-admin">platform</span>}
          <span className="email muted">{session?.email}</span>
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="grid">
        <AsksPanel />
        <EventsPanel />
        <AgentActivityPanel activity={activity} />
      </main>
    </div>
  );
}
