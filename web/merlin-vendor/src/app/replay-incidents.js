// @ts-check
// Replay-mode orgs source Activity-feed incidents from a curated
// fixture set (demo_fixtures.incidents) via the public.get_replay_incidents
// RPC. The fixtures carry the full simulator-shape (title + sub + sla +
// status + icon + priority) so the rendered cards look like real
// simulator output, not bare event rows.
//
// Why not just read incident_actions:
//   incident_actions records events on an incident (open/approve/hold)
//   but doesn't carry sub/sla/icon — the visual richness comes from
//   the simulator's in-memory templates. Capturing that shape to DB
//   gives the Activity feed something to render that feels "alive"
//   for replay-mode demos. See migration 141 for schema + seed.
//
// The RPC stamps each row with a `spawned_at` mapped into the past
// hour so the feed feels current on every poll. We refresh every
// 30s; deterministic mapping keeps the order stable within a minute.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const ICON_FALLBACK = 'bell';
const REFRESH_MS = 30_000;

function shapeRow(row) {
  return {
    id: row.ext_id,
    priority: row.priority || 'medium',
    icon: row.icon || ICON_FALLBACK,
    title: row.title,
    sub: row.sub || '',
    sla: row.sla || '',
    status: row.status || '',
    action: row.action || 'open',
    _spawnedAt: new Date(row.spawned_at).getTime(),
    _sim: false,
  };
}

// Returns simulator-shaped incident objects sourced from
// demo_fixtures.incidents. Empty array for non-replay orgs (caller
// passes null orgId in that case).
export function useReplayIncidents(orgId) {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    if (!orgId) {
      setIncidents([]);
      return;
    }
    let cancelled = false;

    async function refresh() {
      const { data, error } = await supabase.rpc('get_replay_incidents', {
        p_org_id: orgId,
        p_limit: 40,
      });
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[replay-incidents] rpc failed:', error.message);
        return;
      }
      setIncidents((data || []).map(shapeRow));
    }

    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orgId]);

  return incidents;
}
