// @ts-check
// Reseller channel data — for orgs with is_reseller=true.
// Migration 135 added the RLS visibility + write RPCs. This module is
// the typed client handle for the Admin → Channel UI.
//
// What a reseller's owner/admin can do:
//   - useResellerChildren(parentOrgId)   → list of children w/ plan + branding state
//   - updateChildPlan(childOrgId, plan)   → flips child.plan (audit-logged)
//   - releaseChild(childOrgId)            → sets parent_org_id=NULL (audit-logged)
//
// They CANNOT impersonate, override child branding, or assign new
// children — those stay with Adaptiv platform admins.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

// In-memory cache keyed by parent org id. We re-fetch on every mount
// since the data is small and changes are rare; no realtime subs needed.
const childrenCache = new Map();
const listeners = new Set();
function emit(parentOrgId) {
  listeners.forEach((fn) => fn(parentOrgId));
}

async function fetchChildren(parentOrgId) {
  if (!parentOrgId) return [];
  const { data, error } = await supabase
    .from('organizations')
    .select(
      `
      id, name, slug, kind, plan, primary_contact_email,
      lifecycle_state, created_at, updated_at,
      branding_enabled, branding_logo_url, branding_accent_hex, branding_favicon_url,
      whitelabel_enabled, subscription_status
    `,
    )
    .eq('parent_org_id', parentOrgId)
    .order('name');
  if (error) {
    captureException(error, { where: 'fetchChildren' });
    // eslint-disable-next-line no-console
    console.warn('[reseller-data] fetch children failed:', error.message);
    return [];
  }
  // Member count requires a second query — small dataset, batch the IDs.
  const ids = (data || []).map((r) => r.id);
  let memberCounts = {};
  if (ids.length > 0) {
    const { data: rows } = await supabase.from('organization_members').select('org_id').in('org_id', ids);
    for (const r of rows || []) {
      memberCounts[r.org_id] = (memberCounts[r.org_id] || 0) + 1;
    }
  }
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    kind: r.kind,
    plan: r.plan || 'starter',
    primaryContactEmail: r.primary_contact_email || '',
    lifecycleState: r.lifecycle_state || 'active',
    subscriptionStatus: r.subscription_status || null,
    // Branding inheritance state for display:
    //   'own'         — child has branding_enabled=true with its own assets
    //   'inheriting'  — child has no own branding; inherits from this reseller
    //   'none'        — child hasn't enabled branding
    brandingState: deriveBrandingState(r),
    whitelabelEnabled: !!r.whitelabel_enabled,
    memberCount: memberCounts[r.id] || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function deriveBrandingState(row) {
  if (row.branding_enabled && (row.branding_logo_url || row.branding_accent_hex)) {
    return 'own';
  }
  // We don't know here whether the parent has branding_enabled — but
  // by definition of how this list is fetched, the caller is a reseller
  // parent's admin. The reseller's own brand cascades to children
  // unless the child opts out. Treat anything not 'own' as 'inheriting'
  // since the reseller is by-design supposed to be branded.
  return 'inheriting';
}

export function useResellerChildren(parentOrgId) {
  const [rows, setRows] = useState(() => childrenCache.get(parentOrgId) || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!parentOrgId) {
      setRows([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    fetchChildren(parentOrgId).then((next) => {
      if (cancelled) return;
      childrenCache.set(parentOrgId, next);
      setRows(next);
      setLoading(false);
    });
    const onUpdate = (id) => {
      if (id === parentOrgId) setRows(childrenCache.get(parentOrgId) || []);
    };
    listeners.add(onUpdate);
    return () => {
      cancelled = true;
      listeners.delete(onUpdate);
    };
  }, [parentOrgId]);

  return { rows, loading };
}

// Invalidate + re-fetch this parent's children. Called after a mutation.
export async function refreshResellerChildren(parentOrgId) {
  if (!parentOrgId) return;
  const next = await fetchChildren(parentOrgId);
  childrenCache.set(parentOrgId, next);
  emit(parentOrgId);
}

export async function updateChildPlan(childOrgId, plan, parentOrgId) {
  const { error } = await supabase.rpc('reseller_update_child_plan', {
    p_child_org: childOrgId,
    p_plan: plan,
  });
  if (error) throw new Error(error.message);
  await refreshResellerChildren(parentOrgId);
}

export async function releaseChild(childOrgId, parentOrgId) {
  const { error } = await supabase.rpc('reseller_release_child', {
    p_child_org: childOrgId,
  });
  if (error) throw new Error(error.message);
  await refreshResellerChildren(parentOrgId);
}
