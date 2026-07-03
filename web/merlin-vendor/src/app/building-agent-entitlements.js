// Per-building agent entitlements — client mirror of public
// .building_agent_entitlements (migration 117). One row per
// (organization × building × agent_id) telling the client whether
// that agent is enabled for that building.
//
// Read pattern:
//   const { entitled, ready } = useBuildingAgentEntitlements(buildingId);
//   const visible = AGENTS.filter((a) => entitled.has(a.id));
//
// Mutation pattern (org-admin only — RLS enforces):
//   await setEntitlement(orgId, buildingId, agentId, { active, source });
//
// The hook is org-scoped (one Supabase subscription per org), filtered
// to a single buildingId at consumer time. Switching orgs invalidates
// the cache via registerAuthAwareCache.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { registerAuthAwareCache } from './use-auth-aware-cache.js';

// Module-level cache keyed by orgId — each org gets its own array of
// rows. Listeners are filtered down to a single building at hook time.
let cacheByOrg = new Map(); // orgId → Array<row>
let hydratedByOrg = new Map(); // orgId → boolean
let hydratingByOrg = new Map(); // orgId → Promise
const listeners = new Set(); // fn(orgId)

function emit(orgId) {
  for (const fn of listeners) fn(orgId);
}

// Wipe on sign-out / sign-in-with-different-uid so the next user
// doesn't see the previous user's entitlements before their own load.
registerAuthAwareCache({
  name: 'building-agent-entitlements',
  reset() {
    cacheByOrg = new Map();
    hydratedByOrg = new Map();
    hydratingByOrg = new Map();
    for (const fn of listeners) fn(null);
  },
});

async function loadOrg(orgId) {
  const { data, error } = await supabase
    .from('building_agent_entitlements')
    .select('id, organization_id, building_id, agent_id, source, active')
    .eq('organization_id', orgId);
  if (error) return [];
  return data || [];
}

async function hydrateOnce(orgId) {
  if (!orgId) return;
  if (hydratedByOrg.get(orgId)) return;
  const inflight = hydratingByOrg.get(orgId);
  if (inflight) return inflight;
  const p = (async () => {
    const rows = await loadOrg(orgId);
    cacheByOrg.set(orgId, rows);
    hydratedByOrg.set(orgId, true);
    emit(orgId);
  })();
  hydratingByOrg.set(orgId, p);
  return p;
}

// One realtime subscription per org, lazily created.
const realtimeByOrg = new Map();
function ensureRealtime(orgId) {
  if (!orgId || realtimeByOrg.has(orgId)) return;
  const channel = supabase
    .channel(`building_agent_entitlements_${orgId}_${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'building_agent_entitlements',
        filter: `organization_id=eq.${orgId}`,
      },
      async () => {
        // Cheap: re-pull the full org's rows (small N — at most
        // buildings × agents per org, dozens). Avoids the row-merge
        // dance and keeps cache coherent.
        const rows = await loadOrg(orgId);
        cacheByOrg.set(orgId, rows);
        emit(orgId);
      },
    )
    .subscribe();
  realtimeByOrg.set(orgId, channel);
}

// Hook — returns { rows, entitled, ready } for the given buildingId.
// `rows` is all entitlement rows for the building (including inactive,
// for the admin picker). `entitled` is a Set of agent_ids where
// active=true, for the gating filter.
export function useBuildingAgentEntitlements(orgId, buildingId) {
  const [rows, setRows] = useState(() => filterRows(cacheByOrg.get(orgId), buildingId));
  const [ready, setReady] = useState(() => !!hydratedByOrg.get(orgId));

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setReady(false);
      return;
    }
    const fn = (changedOrgId) => {
      if (changedOrgId !== orgId && changedOrgId !== null) return;
      setRows(filterRows(cacheByOrg.get(orgId), buildingId));
      setReady(!!hydratedByOrg.get(orgId));
    };
    listeners.add(fn);
    hydrateOnce(orgId).then(() => {
      setRows(filterRows(cacheByOrg.get(orgId), buildingId));
      setReady(true);
    });
    ensureRealtime(orgId);
    return () => {
      listeners.delete(fn);
    };
  }, [orgId, buildingId]);

  const entitled = new Set(rows.filter((r) => r.active).map((r) => r.agent_id));
  return { rows, entitled, ready };
}

function filterRows(allRows, buildingId) {
  if (!allRows || !buildingId) return [];
  return allRows.filter((r) => r.building_id === buildingId);
}

// Toggle an entitlement via the server endpoint (G3). The endpoint
// wraps Stripe subscription_item create/delete around the DB upsert
// so $99/mo paid-agent billing happens atomically with the
// entitlement flip. Free-quota + grandfathered paths skip the Stripe
// call; only the 2nd-and-beyond active agent per building bills.
//
// Throws on failure. The thrown Error has `.code` set when the
// server returned one (e.g. 'no_active_subscription' when the org
// needs to complete Pro signup before activating paid agents).
export async function toggleEntitlement(buildingId, agentId, active) {
  if (!buildingId || !agentId) throw new Error('buildingId/agentId required');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch('/api/agents/toggle-entitlement', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ building_id: buildingId, agent_id: agentId, active }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.error || `Request failed (${res.status})`);
    err.code = payload.code;
    err.status = res.status;
    throw err;
  }
  return payload;
}
