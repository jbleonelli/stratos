// Live agent decisions. The agent runtime publishes to AppSync (server-side,
// IAM) and we subscribe over the same realtime channel as asks/events. Activity
// is ephemeral — a bounded in-memory feed, not a cached query. Because the agent
// writes asks via a SECURITY DEFINER RPC (not the raiseAsk mutation), a new
// activity also nudges the asks/events queries so their panels stay fresh.

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribe } from '../api/client';
import { ON_AGENT_ACTIVITY } from '../api/graphql';
import type { AgentActivity } from '../api/types';

const MAX = 25;

export function useAgentActivity(orgId: string | null) {
  const qc = useQueryClient();
  const [feed, setFeed] = useState<AgentActivity[]>([]);

  useEffect(() => {
    if (!orgId) return;
    const sub = subscribe<{ onAgentActivity: AgentActivity }>(
      ON_AGENT_ACTIVITY,
      { organizationId: orgId },
      ({ onAgentActivity }) => {
        if (!onAgentActivity) return;
        setFeed((prev) => [onAgentActivity, ...prev].slice(0, MAX));
        if (onAgentActivity.askId) qc.invalidateQueries({ queryKey: ['asks'] });
        qc.invalidateQueries({ queryKey: ['events'] });
        qc.invalidateQueries({ queryKey: ['incidents'] });
        qc.invalidateQueries({ queryKey: ['agentRuns'] });
        qc.invalidateQueries({ queryKey: ['orgMetrics'] });
      },
    );
    return () => sub.unsubscribe();
  }, [orgId, qc]);

  return feed;
}
