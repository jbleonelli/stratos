// @ts-check
// Phase 3 of the Hypervisor admin rework — local-admin grants.
//
// `user_location_grants` is the existing subtree-permission table from
// migration 017 (Track E). RLS policies already let org owners/admins
// (is_org_admin) and platform admins INSERT/DELETE grants; this module
// is just the client surface that the Hypervisor uses to assign
// "local admins" to specific buildings.
//
// What a grant does, in short: a user with one or more grants is
// scoped to those locations + their descendants + ancestors. Tenant
// super admins (owner of the org with no grants) keep full org
// access. The runtime enforcement lives in has_location_access(text).
//
// API:
//   useLocationGrants(locationId, orgId)
//     → { grants, loaded, refresh }
//   addLocationGrant({ userId, locationId, orgId })
//   removeLocationGrant(grantId)

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function useLocationGrants(locationId, orgId) {
  const [grants, setGrants] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!locationId || !orgId) {
      setGrants([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_location_grants')
        .select('id, user_id, granted_at, granted_by')
        .eq('organization_id', orgId)
        .eq('location_id', locationId);
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[location-grants] fetch failed:', error.message);
        setGrants([]);
      } else {
        setGrants(data || []);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, orgId, tick]);

  return { grants, loaded, refresh: () => setTick((n) => n + 1) };
}

export async function addLocationGrant({ userId, locationId, orgId }) {
  if (!userId || !locationId || !orgId) throw new Error('userId, locationId, orgId required');
  const { data, error } = await supabase
    .from('user_location_grants')
    .insert({ organization_id: orgId, user_id: userId, location_id: locationId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeLocationGrant(grantId) {
  if (!grantId) throw new Error('grantId required');
  const { error } = await supabase.from('user_location_grants').delete().eq('id', grantId);
  if (error) throw new Error(error.message);
}
