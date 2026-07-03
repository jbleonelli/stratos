// Organizations — Phase 11c. Reads the caller's active org record and
// the member roster for that org. Active org id lives on the session
// already (auth.js fetchActiveOrg), so this module only owns the org
// row itself and its membership list.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { useSession, getSession } from './auth.js';

// ────── Active org hydration + cache

let orgCache = null; // { id, name, slug, created_at }
let orgCacheForId = null;
const orgListeners = new Set();
function emitOrg() {
  orgListeners.forEach((fn) => fn(orgCache));
}

async function hydrateOrg(orgId) {
  if (!orgId) {
    orgCache = null;
    orgCacheForId = null;
    emitOrg();
    return null;
  }
  if (orgCacheForId === orgId && orgCache) return orgCache;
  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, created_at, kind, plan, lifecycle_state, suspended_reason, stripe_customer_id, subscription_status, branding_enabled, branding_logo_url, branding_accent_hex, branding_favicon_url, parent_org_id, is_reseller, whitelabel_enabled, replay_mode, notifications_settings',
    )
    .eq('id', orgId)
    .single();
  if (error) {
    captureException(error, { where: 'hydrateOrg' });
    // eslint-disable-next-line no-console
    console.warn('[org-data] active org fetch failed:', error.message);
    return null;
  }
  orgCache = data;
  orgCacheForId = orgId;
  emitOrg();
  return data;
}

// Does the active org satisfy the white-label gate? (Enterprise plan
// OR whitelabel_enabled OR is_reseller.) The DB check constraint
// enforces the same rule on writes; this is for UI gating only — hide
// the Branding card from orgs that can't use it.
export function useOrgCanWhiteLabel() {
  const org = useActiveOrg();
  if (!org) return false;
  return org.plan === 'enterprise' || !!org.whitelabel_enabled || !!org.is_reseller;
}

// Reset the active-org cache so the next read is fresh. Used by the
// Branding card after saveOrgBranding so the live preview reads the
// new values without a full page reload.
export function invalidateActiveOrg() {
  orgCacheForId = null;
  orgCache = null;
  emitOrg();
}

export function useActiveOrg() {
  const session = useSession();
  const orgId = session?.organizationId || null;
  const [org, setOrg] = useState(() => (orgCacheForId === orgId ? orgCache : null));
  useEffect(() => {
    const fn = (next) => setOrg(next);
    orgListeners.add(fn);
    hydrateOrg(orgId).then(fn);
    return () => orgListeners.delete(fn);
  }, [orgId]);
  return org;
}

// Flip the caller's active organization. Writes to profiles.active_org_id
// (Phase 16a migration 023) then hard-reloads the page so every hydrator
// (zones, routes, team, asks, etc.) starts fresh against the new org.
// A subscribing-every-module refresh would be cleaner in theory but
// touching 10+ files of plumbing for a rarely-triggered action isn't
// worth it — most SaaS products reload on org switch and users expect it.
export async function switchOrg(orgId) {
  const session = getSession();
  if (!session?.userId) throw new Error('Not signed in.');
  if (!orgId) throw new Error('Org id required.');
  const { error } = await supabase.from('profiles').update({ active_org_id: orgId }).eq('user_id', session.userId);
  if (error) throw new Error(error.message);
  // Clear every localStorage cache so stale snapshots from the previous
  // org don't flash briefly on the next load. agentic-data.js now also
  // stores per-org keys like `merlin-agentic-config:<orgId>`; wipe those
  // too via prefix-scan.
  if (typeof window !== 'undefined') {
    for (const key of [
      'merlin-session',
      'merlin-team',
      'merlin-zones',
      'merlin-routes',
      'merlin-asks',
      'merlin-agentic-config',
      'merlin-admin-location-expand',
      // UI-state keys that were NOT org-scoped and so carried
      // one org's view/section state (and pinned incident ids)
      // into the next — clear on switch so each org starts
      // clean. See cross-demo isolation audit 2026-06-02.
      'merlin-pinned-incidents',
      'merlinOpSection',
      'merlinOpContractorsSection',
      'merlinOpHypervisorSection',
      'merlinFinancialsV2Sub',
      'merlinSlaWindow',
      'hyperViewerMode',
      'hyperAgentsSubMode',
      'merlinSchedulesSection',
    ]) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    try {
      const prefix = 'merlin-agentic-config:';
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) localStorage.removeItem(k);
      }
    } catch {}
    window.location.reload();
  }
}

export async function updateOrgName(orgId, name) {
  const { data, error } = await supabase
    .from('organizations')
    .update({ name: name.trim() })
    .eq('id', orgId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  orgCache = data;
  orgCacheForId = data.id;
  emitOrg();
  return data;
}

// Update the org's outbound-notification settings (email/Slack opt-in for
// ticket events). Gated by the organizations_admin_update RLS policy
// (is_org_admin). Shape: { ticket_events, email_to: string[], slack_webhook_url }.
export async function updateOrgNotificationsSettings(orgId, settings) {
  const { data, error } = await supabase
    .from('organizations')
    .update({ notifications_settings: settings })
    .eq('id', orgId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  orgCache = data;
  orgCacheForId = data.id;
  emitOrg();
  return data;
}

// ────── Members hydration + cache

let membersCache = []; // [{ org_id, user_id, role, joined_at, profile }]
let membersCacheForOrg = null;
const membersListeners = new Set();
function emitMembers() {
  membersListeners.forEach((fn) => fn(membersCache.slice()));
}

async function hydrateMembers(orgId) {
  if (!orgId) {
    membersCache = [];
    membersCacheForOrg = null;
    emitMembers();
    return [];
  }
  if (membersCacheForOrg === orgId && membersCache.length > 0) return membersCache;
  // Two queries, merged client-side. We can't express this as a single
  // PostgREST join because organization_members.user_id and
  // profiles.user_id both FK to auth.users(id) independently — there's
  // no direct relationship between the two tables for PostgREST to infer.
  const { data: memberships, error: mErr } = await supabase
    .from('organization_members')
    .select('org_id, user_id, role, joined_at')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true });
  if (mErr) {
    captureException(mErr, { where: 'hydrateMembers' });
    // eslint-disable-next-line no-console
    console.warn('[org-data] memberships fetch failed:', mErr.message);
    return [];
  }
  const userIds = (memberships || []).map((m) => m.user_id);
  let profilesById = {};
  if (userIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, first_name, last_name, company, role, picture')
      .in('user_id', userIds);
    if (pErr) {
      captureException(pErr, { where: 'hydrateMembers' });
      // eslint-disable-next-line no-console
      console.warn('[org-data] profiles fetch failed:', pErr.message);
    } else {
      profilesById = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
    }
  }
  membersCache = (memberships || []).map((m) => ({
    org_id: m.org_id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    profile: profilesById[m.user_id] || null,
  }));
  membersCacheForOrg = orgId;
  emitMembers();
  return membersCache;
}

export function useOrgMembers() {
  const session = useSession();
  const orgId = session?.organizationId || null;
  const [members, setMembers] = useState(() => (membersCacheForOrg === orgId ? membersCache.slice() : []));
  useEffect(() => {
    const fn = (next) => setMembers(next);
    membersListeners.add(fn);
    hydrateMembers(orgId).then(fn);
    return () => membersListeners.delete(fn);
  }, [orgId]);
  return members;
}

// Is the caller an owner or admin of their active org? Used to gate the
// rename button + future invite/remove actions. The server enforces this
// via RLS (is_org_admin) — this is just for UI gating.
export function useIsOrgAdmin() {
  const session = useSession();
  const members = useOrgMembers();
  if (!session?.userId) return false;
  const me = members.find((m) => m.user_id === session.userId);
  return me ? me.role === 'owner' || me.role === 'admin' : false;
}

// Is the caller an owner of their active org? Distinct from useIsOrgAdmin,
// which also returns true for admins. Used by the customer-side tier
// gating (migration 132): only owners can invite at role='admin' or
// role='owner'. Admins can only invite role='member'.
export function useIsOrgOwner() {
  const session = useSession();
  const members = useOrgMembers();
  if (!session?.userId) return false;
  const me = members.find((m) => m.user_id === session.userId);
  return me ? me.role === 'owner' : false;
}

// ────── Invites (Phase 11d) — pending invite list + CRUD

let invitesCache = []; // [{ id, org_id, email, role, token, ... }]
let invitesCacheForOrg = null;
const invitesListeners = new Set();
function emitInvites() {
  invitesListeners.forEach((fn) => fn(invitesCache.slice()));
}

async function hydrateInvites(orgId) {
  if (!orgId) {
    invitesCache = [];
    invitesCacheForOrg = null;
    emitInvites();
    return [];
  }
  const { data, error } = await supabase
    .from('organization_invites')
    .select('id, org_id, email, role, token, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    captureException(error, { where: 'hydrateInvites' });
    // eslint-disable-next-line no-console
    console.warn('[org-data] invites fetch failed:', error.message);
    return [];
  }
  invitesCache = data || [];
  invitesCacheForOrg = orgId;
  emitInvites();
  return invitesCache;
}

export function usePendingInvites() {
  const session = useSession();
  const orgId = session?.organizationId || null;
  const [invites, setInvites] = useState(() => (invitesCacheForOrg === orgId ? invitesCache.slice() : []));
  useEffect(() => {
    const fn = (next) => setInvites(next);
    invitesListeners.add(fn);
    hydrateInvites(orgId).then(fn);
    return () => invitesListeners.delete(fn);
  }, [orgId]);
  return invites;
}

export async function createInvite({ email, role = 'member' }) {
  const session = getSession();
  if (!session?.organizationId) throw new Error('No active organization.');
  const clean = (email || '').trim().toLowerCase();
  if (!clean || !/.+@.+\..+/.test(clean)) throw new Error('Enter a valid email address.');
  const { data, error } = await supabase
    .from('organization_invites')
    .insert({
      org_id: session.organizationId,
      email: clean,
      role,
      invited_by: session.userId,
    })
    .select()
    .single();
  if (error) {
    // Unique-violation means a pending invite already exists for this email.
    if (error.code === '23505') {
      throw new Error('This email already has a pending invite. Revoke it first to re-invite.');
    }
    throw new Error(error.message);
  }
  invitesCache = [data, ...invitesCache];
  emitInvites();
  return data;
}

export async function revokeInvite(id) {
  const { error } = await supabase
    .from('organization_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  invitesCache = invitesCache.filter((r) => r.id !== id);
  emitInvites();
}

// Build the shareable URL for an invite. Uses the current origin so it
// works in both preview + prod without a config knob.
export function inviteLink(token) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?invite=${token}`;
}

// ────── Subtree grants (Phase 12c) — per-user location_access grants

let grantsCache = []; // [{ id, organization_id, user_id, location_id, granted_at, granted_by }]
let grantsCacheForOrg = null;
const grantsListeners = new Set();
function emitGrants() {
  grantsListeners.forEach((fn) => fn(grantsCache.slice()));
}

async function hydrateGrants(orgId) {
  if (!orgId) {
    grantsCache = [];
    grantsCacheForOrg = null;
    emitGrants();
    return [];
  }
  const { data, error } = await supabase
    .from('user_location_grants')
    .select('id, organization_id, user_id, location_id, granted_at, granted_by')
    .eq('organization_id', orgId)
    .order('granted_at', { ascending: true });
  if (error) {
    captureException(error, { where: 'hydrateGrants' });
    // eslint-disable-next-line no-console
    console.warn('[org-data] grants fetch failed:', error.message);
    return [];
  }
  grantsCache = data || [];
  grantsCacheForOrg = orgId;
  emitGrants();
  return grantsCache;
}

export function useOrgGrants() {
  const session = useSession();
  const orgId = session?.organizationId || null;
  const [grants, setGrants] = useState(() => (grantsCacheForOrg === orgId ? grantsCache.slice() : []));
  useEffect(() => {
    const fn = (next) => setGrants(next);
    grantsListeners.add(fn);
    hydrateGrants(orgId).then(fn);
    return () => grantsListeners.delete(fn);
  }, [orgId]);
  return grants;
}

export async function createGrant({ user_id, location_id }) {
  const session = getSession();
  if (!session?.organizationId) throw new Error('No active organization.');
  if (!user_id || !location_id) throw new Error('User and location required.');
  const { data, error } = await supabase
    .from('user_location_grants')
    .insert({
      organization_id: session.organizationId,
      user_id,
      location_id,
      granted_by: session.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('This user already has access to that location.');
    }
    throw new Error(error.message);
  }
  grantsCache = [...grantsCache, data];
  emitGrants();
  return data;
}

export async function revokeGrant(id) {
  const { error } = await supabase.from('user_location_grants').delete().eq('id', id);
  if (error) throw new Error(error.message);
  grantsCache = grantsCache.filter((g) => g.id !== id);
  emitGrants();
}
