// Platform → Overview · Performance.
//
// Aggregates the headline numbers a platform admin wants on a single
// page: tenants, users, buildings under coverage, devices deployed.
// All four reads are RLS-gated to platform admins (organizations,
// organization_members, locations, devices) so mounting this hook
// inside /platform is the only auth plumbing needed.
//
// Self-serve revenue (MRR / ARR / paying tenants) is intentionally
// left as a placeholder until the subscriptions table ships. The
// `contracts` table is contractor↔FM business data that lives inside
// Merlin, NOT what Merlin charges customers for — easy mix-up worth
// flagging here so a future hand doesn't wire it up by mistake.
//
// One-shot fetch on mount + manual refresh — back-office page, low
// cardinality writes, no realtime needed.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

// Building-shaped location kinds. Mirrors the set used in
// platform-data.fetchTenantLocationsBreakdown so counts agree across
// the back-office.
const BUILDING_KINDS = new Set(['building', 'branch']);

function emptyPerformance() {
  return {
    tenants: {
      total: 0,
      active: 0,
      suspended: 0,
      realEstate: 0,
      contractor: 0,
      addedLast30: 0,
      addedLast90: 0,
    },
    users: {
      total: 0,
      // Distinct user_ids — a person on two orgs counts once.
      distinct: 0,
    },
    buildings: {
      total: 0,
    },
    devices: {
      total: 0,
    },
    // [{ orgId, name, slug, kind, lifecycleState, members, buildings, devices, createdAt }]
    perTenant: [],
  };
}

export function usePlatformPerformance() {
  const [data, setData] = useState(() => emptyPerformance());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Four parallel queries. Each one is platform-admin readable
        // by RLS (migration 063) so cross-tenant aggregation just
        // works without any RPC chokepoint.
        //
        // For locations we only fetch the building-shaped kinds — the
        // tree-interior rows (floor / room / zone / position) would
        // multiply cardinality by ~50× without changing the number
        // shown in the widget.
        const [orgsRes, devicesRes, locationsRes, membersRes] = await Promise.all([
          supabase
            .from('organizations')
            .select(
              `
              id, name, slug, kind,
              lifecycle_state, created_at
            `,
            )
            .order('created_at', { ascending: true }),
          supabase.from('devices').select('id, organization_id'),
          supabase.from('locations').select('id, organization_id, kind').in('kind', Array.from(BUILDING_KINDS)),
          supabase.from('organization_members').select('org_id, user_id'),
        ]);

        if (orgsRes.error) throw orgsRes.error;
        if (devicesRes.error) throw devicesRes.error;
        if (locationsRes.error) throw locationsRes.error;
        if (membersRes.error) throw membersRes.error;

        // Strip the platform org itself — operator, not a customer.
        // Same rule as PlatformTenants.
        const orgs = (orgsRes.data || []).filter((o) => o.kind !== 'adaptiv');
        const orgIds = new Set(orgs.map((o) => o.id));

        // Per-org rollups
        const devicesByOrg = new Map();
        for (const d of devicesRes.data || []) {
          if (!d.organization_id || !orgIds.has(d.organization_id)) continue;
          devicesByOrg.set(d.organization_id, (devicesByOrg.get(d.organization_id) || 0) + 1);
        }

        const buildingsByOrg = new Map();
        for (const l of locationsRes.data || []) {
          if (!l.organization_id || !orgIds.has(l.organization_id)) continue;
          buildingsByOrg.set(l.organization_id, (buildingsByOrg.get(l.organization_id) || 0) + 1);
        }

        const membersByOrg = new Map();
        const distinctUsers = new Set();
        for (const m of membersRes.data || []) {
          if (!m.org_id || !orgIds.has(m.org_id)) continue;
          membersByOrg.set(m.org_id, (membersByOrg.get(m.org_id) || 0) + 1);
          if (m.user_id) distinctUsers.add(m.user_id);
        }

        // Tenants rollup
        const now = Date.now();
        const day30 = 30 * 86_400_000;
        const day90 = 90 * 86_400_000;
        let active = 0,
          suspended = 0,
          realEstate = 0,
          contractor = 0;
        let addedLast30 = 0,
          addedLast90 = 0;
        for (const o of orgs) {
          if (o.lifecycle_state !== 'deleted') {
            if (o.lifecycle_state === 'suspended') suspended += 1;
            else active += 1;
          }
          if (o.kind === 'real_estate') realEstate += 1;
          if (o.kind === 'contractor') contractor += 1;
          const createdAt = o.created_at ? new Date(o.created_at).getTime() : null;
          if (createdAt) {
            if (now - createdAt <= day30) addedLast30 += 1;
            if (now - createdAt <= day90) addedLast90 += 1;
          }
        }

        // Per-tenant rows for the table — sorted by devices desc, then
        // by buildings desc so the biggest-footprint tenants are top
        // of fold. Once self-serve revenue lands, swap to MRR-desc.
        const perTenant = orgs.map((o) => ({
          orgId: o.id,
          name: o.name,
          slug: o.slug,
          kind: o.kind,
          lifecycleState: o.lifecycle_state || 'active',
          members: membersByOrg.get(o.id) || 0,
          buildings: buildingsByOrg.get(o.id) || 0,
          devices: devicesByOrg.get(o.id) || 0,
          createdAt: o.created_at,
        }));
        perTenant.sort((a, b) => {
          if (b.devices !== a.devices) return b.devices - a.devices;
          if (b.buildings !== a.buildings) return b.buildings - a.buildings;
          return (a.name || '').localeCompare(b.name || '');
        });

        const totalDevices = Array.from(devicesByOrg.values()).reduce((s, n) => s + n, 0);
        const totalMembers = Array.from(membersByOrg.values()).reduce((s, n) => s + n, 0);
        const totalBuildings = Array.from(buildingsByOrg.values()).reduce((s, n) => s + n, 0);

        if (!alive) return;
        setData({
          tenants: {
            total: orgs.length,
            active,
            suspended,
            realEstate,
            contractor,
            addedLast30,
            addedLast90,
          },
          users: {
            total: totalMembers,
            distinct: distinctUsers.size,
          },
          buildings: {
            total: totalBuildings,
          },
          devices: {
            total: totalDevices,
          },
          perTenant,
        });
        setReady(true);
        setError(null);
      } catch (err) {
        if (!alive) return;
        captureException(err, { where: 'usePlatformPerformance' });
        // eslint-disable-next-line no-console
        console.warn('[platform-performance-data] fetch failed:', err.message);
        setError(err.message);
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  return { data, ready, error, refresh: () => setTick((n) => n + 1) };
}
