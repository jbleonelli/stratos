// Back-office data layer (SaaS v1, phase 3). Reads + mutations for the
// /platform shell — Adaptiv staff manage tenants from here, distinct from
// the per-workspace Admin page.
//
// Reads use additive RLS policies installed in migration 060
// (organizations_platform_admin_read + org_members_platform_admin_read).
// Writes funnel through SECURITY DEFINER RPCs (platform_create_tenant,
// platform_suspend_tenant, …) so phase 4 can plug audit logging into
// one chokepoint.
//
// No realtime subscriptions — the back-office has a small writer pool
// (Adaptiv staff). Each mutation refreshes the list inline and the
// caller is the only viewer in practice.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { fetchAllPaginated } from './pagination.js';

// ────── Tenants list

let tenantsCache = []; // [{ id, name, slug, kind, lifecycle_state, ... }]
let tenantsCacheLoaded = false;
const tenantsListeners = new Set();
function emitTenants() {
  tenantsListeners.forEach((fn) => fn(tenantsCache.slice()));
}

async function hydrateTenants() {
  // Pull every org plus member + location counts. Counts via PostgREST
  // aggregates avoids N+1. Adaptiv (kind='adaptiv') is filtered OUT
  // client-side after the fetch — pushing the .neq into the query
  // string broke the embedded count subqueries (PR #98 returned an
  // empty list for JB even though the data was there).
  // PostgREST embed disambiguation: locations has THREE FKs back to
  // organizations (organization_id / owner_org_id / manager_org_id).
  // Without an explicit FK hint the count returns
  //   "Could not embed because more than one relationship was found"
  // and the entire query fails — the entire tenants list disappears.
  // !locations_org_fk pins to the organization_id path (the canonical
  // owner). organization_members has only one FK so no hint needed.
  const { data, error } = await supabase
    .from('organizations')
    .select(
      `
      id, name, slug, kind,
      lifecycle_state, primary_contact_email,
      suspended_at, suspended_reason, deleted_at,
      created_at, updated_at,
      members:organization_members(count),
      locations:locations!locations_org_fk(count)
    `,
    )
    .order('created_at', { ascending: true });
  if (error) {
    captureException(error, { where: 'hydrateTenants' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] tenants fetch failed:', error.message);
    tenantsCache = [];
    tenantsCacheLoaded = true;
    emitTenants();
    return [];
  }
  tenantsCache = (data || [])
    // Exclude the platform org itself — operator, not a customer.
    .filter((row) => row.kind !== 'adaptiv')
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: row.kind,
      lifecycleState: row.lifecycle_state || 'active',
      primaryContactEmail: row.primary_contact_email || '',
      suspendedAt: row.suspended_at,
      suspendedReason: row.suspended_reason,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      membersCount: row.members?.[0]?.count ?? 0,
      locationsCount: row.locations?.[0]?.count ?? 0,
    }));
  tenantsCacheLoaded = true;
  emitTenants();
  return tenantsCache;
}

export function useAllTenants() {
  const [tenants, setTenants] = useState(() => tenantsCache.slice());
  const [ready, setReady] = useState(() => tenantsCacheLoaded);
  useEffect(() => {
    const fn = (next) => {
      setTenants(next);
      setReady(true);
    };
    tenantsListeners.add(fn);
    hydrateTenants().then(fn);
    return () => tenantsListeners.delete(fn);
  }, []);
  return { tenants, ready };
}

async function refreshTenants() {
  return hydrateTenants();
}

// ────── Single tenant detail

export async function fetchTenantById(orgId) {
  if (!orgId) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select(
      `
      id, name, slug, kind,
      lifecycle_state, primary_contact_email,
      suspended_at, suspended_reason, deleted_at,
      plan,
      branding_enabled, branding_logo_url, branding_accent_hex, branding_favicon_url,
      parent_org_id, is_reseller, whitelabel_enabled,
      bedrock_geo, model_fast, model_thoughtful,
      created_at, updated_at
    `,
    )
    .eq('id', orgId)
    .single();
  if (error) {
    captureException(error, { where: 'fetchTenantById' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] tenant fetch failed:', error.message);
    return null;
  }
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    kind: data.kind,
    lifecycleState: data.lifecycle_state || 'active',
    primaryContactEmail: data.primary_contact_email || '',
    suspendedAt: data.suspended_at,
    suspendedReason: data.suspended_reason,
    deletedAt: data.deleted_at,
    plan: data.plan || 'starter',
    // White-label (migration 133)
    brandingEnabled: !!data.branding_enabled,
    brandingLogoUrl: data.branding_logo_url || null,
    brandingAccentHex: data.branding_accent_hex || null,
    brandingFaviconUrl: data.branding_favicon_url || null,
    parentOrgId: data.parent_org_id || null,
    isReseller: !!data.is_reseller,
    whitelabelEnabled: !!data.whitelabel_enabled,
    bedrockGeo: data.bedrock_geo === 'eu' ? 'eu' : 'us',
    modelFast: data.model_fast || '',
    modelThoughtful: data.model_thoughtful || '',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// Selectable LLM models for the Excalibur dropdowns. MUST mirror SELECTABLE_MODELS
// in api/_lib/claude-client.ts (frontend/backend are separate build roots, so this
// is a deliberate duplicate — keep in sync; the backend coerceModel() is the
// fail-safe if they drift). An empty id ('') means "inherit" (platform default
// for the per-org card; hardcoded default for the platform card).
export const AI_MODEL_OPTIONS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 · fast, low cost' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 · balanced reasoning' },
];

// Set an org's AI (Bedrock) inference geo — 'us' (us-east-1) or 'eu'
// (eu-central-1, data residency). Super-Admin-only via the organizations
// admin-update RLS policy. Read at request time by api/_lib/claude-client.ts
// resolveOrgLlm(); mirrors the plain-update pattern of updateTenantResellerFields.
export async function updateTenantBedrockGeo(orgId, geo) {
  if (!orgId) throw new Error('orgId required');
  if (geo !== 'eu' && geo !== 'us') throw new Error('invalid_geo');
  const { error } = await supabase.from('organizations').update({ bedrock_geo: geo }).eq('id', orgId);
  if (error) throw new Error(error.message);
}

// Set an org's per-role LLM model overrides. Empty string clears the override
// (→ NULL → falls back to the platform default). Read by resolveOrgLlm().
export async function updateTenantModels(orgId, { fast, thoughtful }) {
  if (!orgId) throw new Error('orgId required');
  const patch = {
    model_fast: fast || null,
    model_thoughtful: thoughtful || null,
  };
  const { error } = await supabase.from('organizations').update(patch).eq('id', orgId);
  if (error) throw new Error(error.message);
}

// Update reseller-channel fields (Super-Admin-only via RLS on
// organizations + the gate constraint on branding_enabled). Used by
// the /platform/tenants/<id> Reseller card.
export async function updateTenantResellerFields(orgId, fields) {
  if (!orgId) throw new Error('orgId required');
  const patch = {};
  if (typeof fields.isReseller === 'boolean') patch.is_reseller = fields.isReseller;
  if (typeof fields.whitelabelEnabled === 'boolean') patch.whitelabel_enabled = fields.whitelabelEnabled;
  if ('parentOrgId' in fields) patch.parent_org_id = fields.parentOrgId || null;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('organizations').update(patch).eq('id', orgId);
  if (error) throw new Error(error.message);
}

// List orgs flagged as resellers — feeds the parent_org_id dropdown.
export async function fetchResellerOrgs() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('is_reseller', true)
    .order('name');
  if (error) {
    captureException(error, { where: 'fetchResellerOrgs' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] reseller orgs fetch failed:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchTenantMembers(orgId) {
  if (!orgId) return [];
  // Two queries merged client-side — same approach as org-data.useOrgMembers.
  // Single nested select would tie us to a specific FK relation that PostgREST
  // doesn't always pick up cleanly between members → profiles.
  const { data: rows, error } = await supabase
    .from('organization_members')
    .select('org_id, user_id, role, joined_at')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true });
  if (error) {
    captureException(error, { where: 'fetchTenantMembers' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] members fetch failed:', error.message);
    return [];
  }
  const ids = (rows || []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, email, display_name, role')
    .in('user_id', ids);
  const byId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
  return rows.map((r) => ({
    userId: r.user_id,
    orgRole: r.role,
    joinedAt: r.joined_at,
    email: byId[r.user_id]?.email || '—',
    name: byId[r.user_id]?.display_name || byId[r.user_id]?.email || '—',
    profileRole: byId[r.user_id]?.role || null,
  }));
}

// ────── Mutations (RPCs from migration 060)

// Returns { orgId, inviteToken } — inviteToken is null if no owner email
// was provided. Caller can build the shareable URL via inviteLink(token).
export async function platformCreateTenant({ name, slug, kind, primaryContactEmail, ownerEmail }) {
  const { data, error } = await supabase.rpc('platform_create_tenant', {
    p_name: name,
    p_slug: slug,
    p_kind: kind,
    p_primary_contact_email: primaryContactEmail || null,
    p_owner_email: ownerEmail || null,
  });
  if (error) throw new Error(error.message);
  await refreshTenants();
  return {
    orgId: data?.org_id || null,
    inviteToken: data?.invite_token || null,
  };
}

export async function platformSuspendTenant(orgId, reason) {
  const { error } = await supabase.rpc('platform_suspend_tenant', {
    p_org_id: orgId,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  await refreshTenants();
}

export async function platformUnsuspendTenant(orgId) {
  const { error } = await supabase.rpc('platform_unsuspend_tenant', {
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message);
  await refreshTenants();
}

export async function platformSoftDeleteTenant(orgId) {
  const { error } = await supabase.rpc('platform_soft_delete_tenant', {
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message);
  await refreshTenants();
}

// ────── Tenant detail: locations breakdown + addresses + branch
//        count from device telemetry (FEB-style ecosystems store
//        the 581 branch coords inside devices.telemetry rather than
//        as locations rows).

// Aggregates the locations rows for a tenant into the precise stats
// JB asked for. Returns counts by kind PLUS sqft totals at the
// building / floor / room levels (parsed defensively — sqft is a free
// text column that holds things like "50,000" or "—"). Building-
// address count is the number of distinct (building, addr) pairs.
//
// Hierarchy reminder:
//   Ecosystem → Location → Building → Floor → Zone → Room → Position
function parseSqft(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export async function fetchTenantLocationsBreakdown(orgId) {
  const empty = {
    total: 0,
    byKind: [],
    buildings: 0,
    floors: 0,
    rooms: 0,
    zones: 0,
    positions: 0,
    // Counts from sibling tables — same denominator a customer
    // sees in the Hypervisor (PR #216 added the device leaves;
    // surfacing the numbers here closes the loop so Platform
    // and Hypervisor show identical figures for the same org).
    operationalZones: 0,
    routes: 0,
    devices: 0,
    distinctAddresses: 0,
    sqftBuildings: 0,
    sqftFloors: 0,
    sqftRooms: 0,
  };
  if (!orgId) return empty;
  // Fetch locations + parallel counts from the three sibling tables that
  // Hypervisor reads from (building_zones, routes, devices). Each is a
  // single COUNT query — cheaper than pulling rows, and a single round-trip
  // overall since Promise.all parallelizes.
  const [locsRes, zonesRes, routesRes, devicesRes] = await Promise.all([
    supabase.from('locations').select('id, kind, name, addr, sqft, floors').eq('organization_id', orgId),
    supabase.from('building_zones').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('routes').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('devices').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
  ]);
  if (locsRes.error) {
    captureException(locsRes.error, { where: 'fetchTenantLocationsBreakdown' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] locations breakdown fetch failed:', locsRes.error.message);
    return empty;
  }
  // Sibling-table counts are nice-to-have; a missing one (e.g. RLS slip)
  // shouldn't blank the whole breakdown — log + carry on with 0.
  const operationalZones = zonesRes?.error ? 0 : zonesRes?.count || 0;
  const routes = routesRes?.error ? 0 : routesRes?.count || 0;
  const devices = devicesRes?.error ? 0 : devicesRes?.count || 0;
  if (zonesRes?.error) {
    /* eslint-disable-next-line no-console */ console.warn(
      '[platform-data] zones count failed:',
      zonesRes.error.message,
    );
  }
  if (routesRes?.error) {
    /* eslint-disable-next-line no-console */ console.warn(
      '[platform-data] routes count failed:',
      routesRes.error.message,
    );
  }
  if (devicesRes?.error) {
    /* eslint-disable-next-line no-console */ console.warn(
      '[platform-data] devices count failed:',
      devicesRes.error.message,
    );
  }
  const rows = locsRes.data || [];

  const byKindMap = new Map();
  const seenAddrs = new Set();
  let distinctAddresses = 0;
  let sqftBuildings = 0,
    sqftFloors = 0,
    sqftRooms = 0;

  for (const r of rows) {
    byKindMap.set(r.kind, (byKindMap.get(r.kind) || 0) + 1);

    if (r.addr) {
      const key = r.addr.trim().toLowerCase();
      if (!seenAddrs.has(key)) {
        seenAddrs.add(key);
        distinctAddresses += 1;
      }
    }

    const sqft = parseSqft(r.sqft);
    if (sqft != null) {
      if (r.kind === 'building' || r.kind === 'branch') sqftBuildings += sqft;
      else if (r.kind === 'floor') sqftFloors += sqft;
      else if (
        r.kind === 'room' ||
        r.kind === 'restroom' ||
        r.kind === 'meeting_room' ||
        r.kind === 'conference_room' ||
        r.kind === 'training_room' ||
        r.kind === 'lounge' ||
        r.kind === 'lobby' ||
        r.kind === 'amenity' ||
        r.kind === 'auditorium' ||
        r.kind === 'cafeteria' ||
        r.kind === 'server_room' ||
        r.kind === 'dock' ||
        r.kind === 'boardroom' ||
        r.kind === 'mailroom'
      )
        sqftRooms += sqft;
    }
  }

  const byKind = Array.from(byKindMap.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  // Roll up "rooms" to mean any room-shaped kind so the headline
  // number matches a customer's intuition ("how many rooms total?").
  const roomKinds = new Set([
    'room',
    'restroom',
    'meeting_room',
    'conference_room',
    'training_room',
    'lounge',
    'lobby',
    'amenity',
    'auditorium',
    'cafeteria',
    'server_room',
    'dock',
    'boardroom',
    'mailroom',
  ]);
  const buildingKinds = new Set(['building', 'branch']);
  const sumByKinds = (kinds) => rows.filter((r) => kinds.has(r.kind)).length;

  return {
    total: rows.length,
    byKind,
    distinctAddresses,
    buildings: sumByKinds(buildingKinds),
    floors: sumByKinds(new Set(['floor'])),
    zones: sumByKinds(new Set(['zone'])),
    rooms: sumByKinds(roomKinds),
    positions: sumByKinds(new Set(['position'])),
    // Operational entities — exposed alongside the locations breakdown
    // so the Platform tenant detail mirrors the Hypervisor's reality.
    // operationalZones is the canonical "zones" count for customers like
    // Meridian where zones live in building_zones, NOT in locations
    // (locations-only `zones` stays in the return for back-compat).
    operationalZones,
    routes,
    devices,
    sqftBuildings,
    sqftFloors,
    sqftRooms,
  };
}

// ────── Tenant detail: locations CRUD (platform-admin path)
//
// Customer-side editing lives in custom-locations.js but those
// helpers stamp `organization_id` from the caller's session — wrong
// when a platform admin is editing on behalf of a different tenant.
// These platform-side wrappers take org_id explicitly and rely on
// the locations RLS policy `is_platform_admin()` for authorization.
// Both code paths write to the same `locations` table, so the customer-
// side Admin → Locations editor stays naturally in sync.

export async function fetchTenantLocations(orgId, { limit = 1000 } = {}) {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from('locations')
    .select(
      `
      id, organization_id, kind, name, addr, parent_id,
      floors, sqft, displays, sensors, branches,
      latitude, longitude, custom, created_at, updated_at
    `,
    )
    .eq('organization_id', orgId)
    .order('kind', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit);
  if (error) {
    captureException(error, { where: 'fetchTenantLocations' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] tenant locations fetch failed:', error.message);
    return [];
  }
  return data || [];
}

const LOCATION_FIELDS = [
  'kind',
  'name',
  'addr',
  'parent_id',
  'floors',
  'sqft',
  'displays',
  'sensors',
  'branches',
  'latitude',
  'longitude',
];

function cleanLocationPatch(patch) {
  const out = {};
  for (const k of LOCATION_FIELDS) {
    if (patch[k] === undefined) continue;
    let v = patch[k];
    if (typeof v === 'string') v = v.trim();
    if (v === '') v = null;
    if (k === 'floors' || k === 'displays' || k === 'sensors' || k === 'branches') {
      v = v == null ? null : Number(v);
    }
    if (k === 'latitude' || k === 'longitude') {
      v = v == null ? null : Number(v);
    }
    out[k] = v;
  }
  return out;
}

export async function platformCreateLocation(orgId, record) {
  if (!orgId) throw new Error('orgId required');
  if (!record?.id) throw new Error('id required');
  if (!record.name) throw new Error('name required');
  if (!record.kind) throw new Error('kind required');

  // Normalise the slug so it never collides on a stray space.
  const cleanId = String(record.id)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleanId) throw new Error('id required');

  const row = {
    id: cleanId,
    organization_id: orgId,
    custom: true,
    occupancy: 0.5,
    peak_today: 0.7,
    sites: [],
    ...cleanLocationPatch(record),
  };
  const { data, error } = await supabase.from('locations').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function platformUpdateLocation(id, patch) {
  if (!id) throw new Error('id required');
  const clean = cleanLocationPatch(patch);
  if (Object.keys(clean).length === 0) return;
  const { data, error } = await supabase.from('locations').update(clean).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function platformDeleteLocation(id) {
  if (!id) throw new Error('id required');
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// FEB / FEB2 style: 581 branches live in devices.telemetry rather
// than locations rows. Count distinct branch_id telemetry values
// so the tenant detail can show "1 ecosystem · 5 regional groups
// · 581 physical branches".
export async function fetchTenantBranchCount(orgId) {
  if (!orgId) return 0;
  const { data, error } = await supabase.from('devices').select('telemetry').eq('organization_id', orgId);
  if (error) {
    captureException(error, { where: 'fetchTenantBranchCount' });
    return 0;
  }
  const seen = new Set();
  for (const d of data || []) {
    const id = d?.telemetry?.branch_id;
    if (id) seen.add(id);
  }
  return seen.size;
}

// ────── Member profile (full record for the editor drawer)

export async function fetchMemberProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      user_id, email, first_name, last_name, display_name,
      phone, title, company,
      address_line1, address_line2, city, region, postal_code, country,
      role, created_at, updated_at
    `,
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    captureException(error, { where: 'fetchMemberProfile' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] member profile fetch failed:', error.message);
    return null;
  }
  return data || null;
}

export async function platformUpdateMemberProfile(userId, patch) {
  // Strip undefined keys so the RPC's "key present in patch?" check is
  // accurate. Empty strings stay so the DB can null them out.
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v !== undefined) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return;
  const { error } = await supabase.rpc('platform_update_member_profile', {
    p_user_id: userId,
    p_patch: clean,
  });
  if (error) throw new Error(error.message);
}

export async function platformResetMemberPassword(userId) {
  // Hits the Vercel function which uses the admin API to send the
  // recovery email. Same path the customer-side "Forgot password"
  // ends in — the difference is only who triggered it.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  const r = await fetch('/api/admin-reset-password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  let payload = {};
  try {
    payload = await r.json();
  } catch {}
  if (!r.ok) throw new Error(payload.error || `Request failed (${r.status})`);
  return payload;
}

// ────── Tenant detail: member-management mutations (migration 079)

export async function platformSetMemberRole(orgId, userId, role) {
  const { error } = await supabase.rpc('platform_set_member_role', {
    p_org_id: orgId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function platformRemoveMember(orgId, userId) {
  const { error } = await supabase.rpc('platform_remove_member', {
    p_org_id: orgId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function platformUpdateTenantContact(orgId, email) {
  const { error } = await supabase.rpc('platform_update_tenant_contact', {
    p_org_id: orgId,
    p_primary_contact_email: email || null,
  });
  if (error) throw new Error(error.message);
  await refreshTenants();
}

// Rename the tenant's slug. Validation + uniqueness + audit happen
// server-side (migration 088). Throws on slug_required / slug_format
// / slug_length / slug_taken / tenant_not_found — the caller can
// branch on error.message for a useful UI message.
export async function platformUpdateTenantSlug(orgId, slug) {
  const { error } = await supabase.rpc('platform_update_tenant_slug', {
    p_org_id: orgId,
    p_slug: slug,
  });
  if (error) throw new Error(error.message);
  await refreshTenants();
}

// Set a tenant's subscription plan directly (Super-Admin override).
// Bypasses the Stripe Checkout / Customer Portal flow for enterprise
// customers on annual contracts billed outside Stripe. Server-side
// validation + audit log via platform_update_tenant_plan (migration 134).
// Throws on plan_required / plan_invalid / tenant_not_found.
export async function platformUpdateTenantPlan(orgId, plan) {
  const { error } = await supabase.rpc('platform_update_tenant_plan', {
    p_org_id: orgId,
    p_plan: plan,
  });
  if (error) throw new Error(error.message);
  await refreshTenants();
}

// ────── Platform product ads catalog (phase 6)

let adsCache = [];
let adsCacheLoaded = false;
const adsListeners = new Set();
function emitAds() {
  adsListeners.forEach((fn) => fn(adsCache.slice()));
}

function normalizeAd(row) {
  return {
    id: row.id,
    name: row.name || '',
    spec: row.spec || '',
    pitch: row.pitch || '',
    bullets: Array.isArray(row.bullets) ? row.bullets : [],
    chatPrompt: row.chat_prompt || '',
    illustrationKey: row.illustration_key || 'generic',
    imageUrl: row.image_url || null,
    active: row.active !== false,
    position: row.position ?? 100,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hydratePlatformAds() {
  // Returns the full catalog (active + inactive) for the back-office.
  // Customer-facing reads in product-ads.js filter to active=true.
  const { data, error } = await supabase
    .from('platform_product_ads')
    .select('*')
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    captureException(error, { where: 'hydratePlatformAds' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] platform ads fetch failed:', error.message);
    adsCache = [];
    adsCacheLoaded = true;
    emitAds();
    return [];
  }
  adsCache = (data || []).map(normalizeAd);
  adsCacheLoaded = true;
  emitAds();
  return adsCache;
}

export function useAllPlatformAds() {
  const [rows, setRows] = useState(() => adsCache.slice());
  const [ready, setReady] = useState(() => adsCacheLoaded);
  useEffect(() => {
    const fn = (next) => {
      setRows(next);
      setReady(true);
    };
    adsListeners.add(fn);
    hydratePlatformAds().then(fn);
    return () => adsListeners.delete(fn);
  }, []);
  return { ads: rows, ready };
}

export async function refreshPlatformAds() {
  return hydratePlatformAds();
}

export async function platformCreateAd(ad) {
  const { data, error } = await supabase.rpc('platform_ad_create', {
    p_id: ad.id,
    p_name: ad.name,
    p_spec: ad.spec || null,
    p_pitch: ad.pitch || null,
    p_bullets: ad.bullets || [],
    p_chat_prompt: ad.chatPrompt || null,
    p_illustration_key: ad.illustrationKey || 'generic',
    p_image_url: ad.imageUrl || null,
    p_position: ad.position ?? 100,
    p_active: ad.active !== false,
  });
  if (error) throw new Error(error.message);
  await refreshPlatformAds();
  return data; // slug
}

export async function platformUpdateAd(id, patch) {
  const { error } = await supabase.rpc('platform_ad_update', {
    p_id: id,
    p_name: patch.name ?? null,
    p_spec: patch.spec ?? null,
    p_pitch: patch.pitch ?? null,
    p_bullets: patch.bullets ?? null,
    p_chat_prompt: patch.chatPrompt ?? null,
    p_illustration_key: patch.illustrationKey ?? null,
    p_image_url: patch.imageUrl ?? null,
    p_position: patch.position ?? null,
    p_active: patch.active ?? null,
  });
  if (error) throw new Error(error.message);
  await refreshPlatformAds();
}

export async function platformDeleteAd(id) {
  const { error } = await supabase.rpc('platform_ad_delete', { p_id: id });
  if (error) throw new Error(error.message);
  await refreshPlatformAds();
}

export async function platformSetAdActive(id, active) {
  const { error } = await supabase.rpc('platform_ad_set_active', {
    p_id: id,
    p_active: !!active,
  });
  if (error) throw new Error(error.message);
  await refreshPlatformAds();
}

// ────── Impersonation (phase 5)
//
// Both wrappers reload the page: switching the effective org affects
// every cached customer-side store (devices, locations, asks, …) so a
// soft-refresh is too risky. The post-RPC reload lands the user in the
// right shell — customer side after start, /platform/tenants after end.

export async function platformImpersonateStart(targetOrgId) {
  const { error } = await supabase.rpc('platform_impersonate_start', { p_org_id: targetOrgId });
  if (error) throw new Error(error.message);
  // Clear customer-side caches so the impersonated org loads fresh.
  if (typeof window !== 'undefined') {
    for (const key of [
      'merlin-session',
      'merlin-team',
      'merlin-zones',
      'merlin-routes',
      'merlin-asks',
      'merlin-agentic-config',
      'merlin-admin-location-expand',
    ]) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    window.location.assign('/');
  }
}

export async function platformImpersonateEnd() {
  const { error } = await supabase.rpc('platform_impersonate_end');
  if (error) throw new Error(error.message);
  if (typeof window !== 'undefined') {
    for (const key of [
      'merlin-session',
      'merlin-team',
      'merlin-zones',
      'merlin-routes',
      'merlin-asks',
      'merlin-agentic-config',
      'merlin-admin-location-expand',
    ]) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    window.location.assign('/platform/tenants');
  }
}

// ────── Audit log (phase 4)

let auditCache = [];
let auditCacheLoaded = false;
const auditListeners = new Set();
function emitAudit() {
  auditListeners.forEach((fn) => fn(auditCache.slice()));
}

async function hydrateAudit() {
  // Latest 200 rows. Audit volume is low in v1; pagination + filters can
  // come later if needed. Joins to profiles + organizations done client-side
  // so the row stays interpretable even after a target tenant is renamed.
  const { data, error } = await supabase
    .from('platform_audit_log')
    .select('id, actor_user_id, action, target_org_id, target_user_id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    captureException(error, { where: 'hydrateAudit' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] audit fetch failed:', error.message);
    auditCache = [];
    auditCacheLoaded = true;
    emitAudit();
    return [];
  }

  const actorIds = [...new Set((data || []).map((r) => r.actor_user_id).filter(Boolean))];
  const orgIds = [...new Set((data || []).map((r) => r.target_org_id).filter(Boolean))];

  const [actorsRes, orgsRes] = await Promise.all([
    actorIds.length
      ? supabase.from('profiles').select('user_id, email, display_name').in('user_id', actorIds)
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? supabase.from('organizations').select('id, name, slug').in('id', orgIds)
      : Promise.resolve({ data: [] }),
  ]);
  const actorById = Object.fromEntries((actorsRes.data || []).map((p) => [p.user_id, p]));
  const orgById = Object.fromEntries((orgsRes.data || []).map((o) => [o.id, o]));

  auditCache = (data || []).map((row) => ({
    id: row.id,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorName: actorById[row.actor_user_id]?.display_name || actorById[row.actor_user_id]?.email || '—',
    actorEmail: actorById[row.actor_user_id]?.email || null,
    targetOrgId: row.target_org_id,
    targetOrgName: orgById[row.target_org_id]?.name || null,
    targetOrgSlug: orgById[row.target_org_id]?.slug || null,
    targetUserId: row.target_user_id,
    payload: row.payload || {},
    createdAt: row.created_at,
  }));
  auditCacheLoaded = true;
  emitAudit();
  return auditCache;
}

export function useAuditLog() {
  const [rows, setRows] = useState(() => auditCache.slice());
  const [ready, setReady] = useState(() => auditCacheLoaded);
  useEffect(() => {
    const fn = (next) => {
      setRows(next);
      setReady(true);
    };
    auditListeners.add(fn);
    hydrateAudit().then(fn);
    return () => auditListeners.delete(fn);
  }, []);
  return { rows, ready };
}

export async function refreshAuditLog() {
  return hydrateAudit();
}

// ────── Stripe overview (cross-tenant payment ops)
//
// Surfaces what's happening with Stripe Checkout: which orgs have a
// Stripe customer record, recent paid orders + gross revenue, orders
// awaiting payment, orders with the last_payment_error blob set,
// cancellation reasons. Migration 097 added the columns; 098 added the
// failure-surface columns. Platform-admin RLS bypass on device_orders
// (migration 093) is what makes the cross-tenant SELECT work.

let stripeCache = { stats: null, orders: [] };
let stripeCacheLoaded = false;
const stripeListeners = new Set();
function emitStripe() {
  stripeListeners.forEach((fn) => fn({ ...stripeCache, orders: stripeCache.orders.slice() }));
}

async function hydrateStripe() {
  // Pull every order in any state with Stripe context. We do it in one
  // query rather than splitting by status — the table is small (a few
  // dozen rows even in a busy tenant) and the page filters client-side.
  // Embed org name + slug so the table reads naturally without a
  // separate org lookup.
  const { data: orders, error: oErr } = await supabase
    .from('device_orders')
    .select(
      `
      id, organization_id, status, total_cents, currency,
      placed_at, paid_at, shipped_at, delivered_at, cancelled_at,
      stripe_session_id, stripe_payment_intent_id,
      cancellation_reason, last_payment_error,
      refunded_at, refunded_amount_cents, refund_reason, stripe_refund_id,
      created_at, updated_at,
      org:organizations!device_orders_organization_id_fkey(id, name, slug, kind, stripe_customer_id)
    `,
    )
    .order('created_at', { ascending: false })
    .limit(300);

  if (oErr) {
    captureException(oErr, { where: 'hydrateStripe' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] stripe orders fetch failed:', oErr.message);
    stripeCache = { stats: null, orders: [] };
    stripeCacheLoaded = true;
    emitStripe();
    return stripeCache;
  }

  const { count: orgsWithStripe } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .not('stripe_customer_id', 'is', null);

  // Roll up stats client-side from the orders list.
  const stats = {
    orgsWithStripe: orgsWithStripe || 0,
    paidCount: 0,
    awaitingCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    refundedCount: 0,
    grossPaidCents: 0,
    grossRefundedCents: 0,
    last30dPaidCents: 0,
    last30dPaidCount: 0,
  };
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const normalized = (orders || []).map((o) => ({
    id: o.id,
    orgId: o.organization_id,
    orgName: o.org?.name || '—',
    orgSlug: o.org?.slug || null,
    orgKind: o.org?.kind || null,
    orgHasStripeCustomer: !!o.org?.stripe_customer_id,
    status: o.status,
    totalCents: o.total_cents || 0,
    currency: o.currency || 'USD',
    placedAt: o.placed_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    deliveredAt: o.delivered_at,
    cancelledAt: o.cancelled_at,
    stripeSessionId: o.stripe_session_id,
    stripePaymentIntentId: o.stripe_payment_intent_id,
    cancellationReason: o.cancellation_reason,
    lastPaymentError: o.last_payment_error,
    refundedAt: o.refunded_at,
    refundedAmountCents: o.refunded_amount_cents || 0,
    refundReason: o.refund_reason,
    stripeRefundId: o.stripe_refund_id,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  }));
  for (const o of normalized) {
    if (o.paidAt) {
      stats.paidCount += 1;
      stats.grossPaidCents += o.totalCents;
      if (new Date(o.paidAt).getTime() >= cutoff) {
        stats.last30dPaidCents += o.totalCents;
        stats.last30dPaidCount += 1;
      }
    } else if (o.status === 'placed') {
      stats.awaitingCount += 1;
    }
    if (o.lastPaymentError) stats.failedCount += 1;
    if (o.status === 'cancelled') stats.cancelledCount += 1;
    if (o.refundedAt) {
      stats.refundedCount += 1;
      stats.grossRefundedCents += o.refundedAmountCents || 0;
    }
  }

  stripeCache = { stats, orders: normalized };
  stripeCacheLoaded = true;
  emitStripe();
  return stripeCache;
}

export function useStripeOverview() {
  const [state, setState] = useState(() => ({ ...stripeCache }));
  const [ready, setReady] = useState(() => stripeCacheLoaded);
  useEffect(() => {
    const fn = (next) => {
      setState(next);
      setReady(true);
    };
    stripeListeners.add(fn);
    hydrateStripe().then(fn);
    return () => stripeListeners.delete(fn);
  }, []);
  return { stats: state.stats, orders: state.orders, ready };
}

export async function refreshStripe() {
  return hydrateStripe();
}

export const STRIPE_STATUS_TONES = {
  cart: 'neutral',
  placed: 'info',
  confirmed: 'info',
  shipped: 'accent',
  delivered: 'ok',
  cancelled: 'risk',
  refunded: 'warn',
};

// ────── Refund creation (platform admin only)
// Calls /api/refunds/create on the live deploy. The endpoint runs
// stripe.refunds.create() then calls record_order_refund. Webhook
// re-fires charge.refunded a few seconds later; RPC is idempotent
// so the second arrival is a no-op.
//
// amountCents omitted (or null) = full refund of remaining balance.
// reason: optional free-text up to 280 chars; surfaces on the order's
// refund banner and in Stripe metadata.
export async function createOrderRefund({ orderId, amountCents = null, reason = null }) {
  if (!orderId) throw new Error('order id required');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not authenticated');
  const apiBase =
    typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
      ? 'https://merlin.adaptiv.systems'
      : '';
  const res = await fetch(`${apiBase}/api/refunds/create`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, amount_cents: amountCents, reason }),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ────── Team activity — Adaptiv staff + demo accounts
//
// Cohort: any user who is a member of a kind='adaptiv' org (the
// Adaptiv platform staff) OR whose primary org slug is in the demo
// allowlist below (Meridian + contractors that ship as canned demo
// content). Surfaces last_sign_in_at, total recorded sign-ins, last
// sign-in geo from user_sign_ins.
//
// Demo allowlist is hardcoded for now — we know the seed; if we ever
// promote a tenant out of demo, move them off this list. A migration
// or platform_settings entry could replace this later.

// Demo allowlist by slug. Verified against prod: meridian-hq,
// first-empire-bank, sparkleco, shineright, northstar-maint, guardwatch.
// Update this list (or move it to platform_settings) when a real
// non-demo tenant signs up so they don't accidentally land in the
// team-activity view.
// Slugs treated as "demo / seed" tenants — anything in this set is the
// canonical Adaptiv showcase data, not a paying customer. Used by:
//   - hydrateTeamActivity (cohort filter for /platform/team-activity)
//   - isDemoOrgSlug() helper (DEMO badges on /platform/tenants + /platform/users)
// Move to platform_settings once we have more than 6 demo orgs to track.
export const DEMO_ORG_SLUGS = new Set([
  'meridian-hq',
  'first-empire-bank',
  'sparkleco',
  'shineright',
  'northstar-maint',
  'guardwatch',
  'hemisphere-center',
]);

// True if the given org slug is one of the canonical demo tenants. Use
// alongside the DEMO_ORG_SLUGS set when a single membership check is
// cleaner than filtering an array.
export function isDemoOrgSlug(slug) {
  return !!slug && DEMO_ORG_SLUGS.has(slug);
}

// Pick a user's "primary" org for back-office display. The rule (durable
// since 2026-05-17): Adaptiv employees primary to Adaptiv. The previous
// fallback (memberships[0]) showed JB/Robin/Philippe as primary'd to
// Meridian HQ because they got owner-role memberships there during the
// pre-platform-org demo era (well before migration 059 added the Adaptiv
// platform org). Their *employer* is Adaptiv; Meridian membership is a
// legacy artifact.
//
// Priority:
//   1. Adaptiv-kind org if present (Adaptiv staff identity)
//   2. The membership matching profiles.active_org_id (explicit pin)
//   3. First membership by joined-at order (deterministic fallback)
function pickPrimaryMembership(memberships, activeOrgId) {
  if (!memberships || memberships.length === 0) return null;
  const adaptiv = memberships.find((m) => m.orgKind === 'adaptiv');
  if (adaptiv) return adaptiv;
  const active = memberships.find((m) => m.orgId === activeOrgId);
  if (active) return active;
  return memberships[0] || null;
}

let teamActivityCache = { rows: [], totalSignIns: 0 };
let teamActivityCacheLoaded = false;
const teamActivityListeners = new Set();
function emitTeamActivity() {
  for (const fn of teamActivityListeners) fn(teamActivityCache);
}

async function hydrateTeamActivity() {
  // 1) Pull all profiles + their memberships so we can apply the
  //    cohort filter. Same shape as useAllUsers — could share but the
  //    payload is small enough to duplicate without pain.
  const [profilesRes, membershipsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'user_id, email, display_name, first_name, last_name, role, company, active_org_id, is_merlin_owner, created_at, updated_at',
      )
      .order('created_at', { ascending: true }),
    supabase
      .from('organization_members')
      .select('user_id, org_id, role, joined_at, organizations(id, name, slug, kind)')
      .order('joined_at', { ascending: true }),
  ]);
  if (profilesRes.error) {
    captureException(profilesRes.error, { where: 'hydrateTeamActivity' });
    teamActivityCache = { rows: [], totalSignIns: 0 };
    teamActivityCacheLoaded = true;
    emitTeamActivity();
    return teamActivityCache;
  }

  const membershipsByUser = {};
  for (const m of membershipsRes.data || []) {
    if (!m.organizations) continue;
    if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = [];
    membershipsByUser[m.user_id].push({
      orgId: m.organizations.id,
      orgName: m.organizations.name,
      orgSlug: m.organizations.slug,
      orgKind: m.organizations.kind,
      orgRole: m.role,
      joinedAt: m.joined_at,
    });
  }

  // 2) auth.users last_sign_in_at lives in a protected schema; we
  //    expose it via the platform_admin RLS bypass on the public
  //    'auth_users_view' if it existed, but it doesn't yet — for now
  //    we rely on user_sign_ins as the historical source AND fall back
  //    to whatever we can reach via the profiles-table mirror.
  // Approach: query our user_sign_ins for the cohort and aggregate.

  const allUsers = (profilesRes.data || []).map((p) => {
    const memberships = membershipsByUser[p.user_id] || [];
    const primary = pickPrimaryMembership(memberships, p.active_org_id);
    return {
      userId: p.user_id,
      email: p.email || '—',
      displayName: p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '—',
      profileRole: p.role || null,
      company: p.company || '',
      createdAt: p.created_at,
      memberships,
      primaryOrgId: primary?.orgId || null,
      primaryOrgName: primary?.orgName || null,
      primaryOrgKind: primary?.orgKind || null,
      primaryOrgSlug: primary?.orgSlug || null,
      primaryOrgRole: primary?.orgRole || null,
      isAdaptivStaff: memberships.some((m) => m.orgKind === 'adaptiv'),
      isDemoCohort: memberships.some((m) => DEMO_ORG_SLUGS.has(m.orgSlug)),
      isMerlinOwner: !!p.is_merlin_owner,
    };
  });

  // Categorize every user. OWNER is its own tier (the single human
  // "god mode" Merlin Owner — migration 129). STAFF wins over DEMO
  // (an Adaptiv employee who's also been given access to a demo org
  // should read as STAFF, not DEMO). REAL = neither — a paying-customer
  // signup. Now that Stripe is LIVE (2026-05-14), real-customer sign-ins
  // are meaningful signal too, so the cohort filter was dropped to let
  // them appear.
  for (const u of allUsers) {
    u.accountType = u.isMerlinOwner ? 'owner' : u.isAdaptivStaff ? 'staff' : u.isDemoCohort ? 'demo' : 'real';
  }

  // 3) Pull every user_sign_ins row across all users. Bounded by user
  //    count today (~30-50) × ~100 sign-ins each = well under the 1000
  //    cap. If user-base grows past ~100 we'll paginate.
  const allUserIds = allUsers.map((u) => u.userId);
  let signIns = [];
  if (allUserIds.length > 0) {
    const { data } = await supabase
      .from('user_sign_ins')
      .select('user_id, signed_in_at, ip, user_agent, city, region, country, latitude, longitude')
      .in('user_id', allUserIds)
      .order('signed_in_at', { ascending: false })
      .limit(1000);
    signIns = data || [];
  }

  // Aggregate sign-ins by user.
  const byUser = new Map();
  for (const u of allUsers)
    byUser.set(u.userId, { ...u, signInCount: 0, signInCount30d: 0, lastSignIn: null, recentSignIns: [] });
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
  for (const s of signIns) {
    const row = byUser.get(s.user_id);
    if (!row) continue;
    row.signInCount += 1;
    if (new Date(s.signed_in_at).getTime() >= cutoff) row.signInCount30d += 1;
    if (!row.lastSignIn || s.signed_in_at > row.lastSignIn.signed_in_at) {
      row.lastSignIn = s;
    }
    if (row.recentSignIns.length < 10) row.recentSignIns.push(s);
  }

  const rows = [...byUser.values()].sort((a, b) => {
    // Most-recently-active first; users with no sign-ins last.
    const ta = a.lastSignIn?.signed_in_at || '';
    const tb = b.lastSignIn?.signed_in_at || '';
    return tb.localeCompare(ta);
  });

  teamActivityCache = {
    rows,
    totalSignIns: signIns.length,
    totalSignIns30d: signIns.filter((s) => new Date(s.signed_in_at).getTime() >= cutoff).length,
    cohortSize: allUsers.length,
    adaptivStaffCount: allUsers.filter((u) => u.accountType === 'staff').length,
    demoCount: allUsers.filter((u) => u.accountType === 'demo').length,
    realCustomerCount: allUsers.filter((u) => u.accountType === 'real').length,
  };
  teamActivityCacheLoaded = true;
  emitTeamActivity();
  return teamActivityCache;
}

export function useTeamActivity() {
  const [state, setState] = useState(() => ({ ...teamActivityCache }));
  const [ready, setReady] = useState(() => teamActivityCacheLoaded);
  useEffect(() => {
    const fn = (next) => {
      setState(next);
      setReady(true);
    };
    teamActivityListeners.add(fn);
    hydrateTeamActivity().then(fn);
    return () => teamActivityListeners.delete(fn);
  }, []);
  return { ...state, ready };
}

export const ACTION_LABELS = {
  tenant_create: 'Tenant created',
  tenant_suspend: 'Tenant suspended',
  tenant_unsuspend: 'Tenant un-suspended',
  tenant_soft_delete: 'Tenant soft-deleted',
  tenant_update_contact: 'Contact updated',
  ad_create: 'Ad created',
  ad_update: 'Ad updated',
  ad_delete: 'Ad deleted',
  ad_set_active: 'Ad active toggled',
  impersonate_start: 'Impersonation started',
  impersonate_end: 'Impersonation ended',
};

export const ACTION_TONES = {
  tenant_create: 'ok',
  tenant_suspend: 'warn',
  tenant_unsuspend: 'ok',
  tenant_soft_delete: 'risk',
  tenant_update_contact: 'neutral',
  ad_create: 'ok',
  ad_update: 'neutral',
  ad_delete: 'risk',
  ad_set_active: 'neutral',
  impersonate_start: 'warn',
  impersonate_end: 'neutral',
};

// ────── SAMSIC CRM (Notion mirror, migration 153) ──────────────────
//
// Read-only mirror of the SAMSIC CRM Notion database. The 15-min
// sync cron + a Sync-now button keep public.sales_crm_samsic
// in step with Notion (the source of truth). RLS gates reads to
// Owner + Super Admin.

export function useSamsicCrm() {
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // PostgREST caps single SELECTs at 1000 rows. SAMSIC has 1300+
  // rows; without pagination the table silently truncates and the
  // count pill says "1000" when the DB has more. fetchAllPaginated
  // walks pages until the server returns a partial.
  const buildQuery = () =>
    supabase.from('sales_crm_samsic').select('*').order('notion_last_edited_at', { ascending: false });

  const refresh = async () => {
    setError(null);
    try {
      const data = await fetchAllPaginated(buildQuery);
      setRows(data);
      setReady(true);
    } catch (err) {
      captureException(err, { where: 'useSamsicCrm' });
      setError(err?.message || String(err));
      setRows([]);
      setReady(true);
    }
  };

  // Splice an updated row into local state without refetching the
  // whole table. Used after a successful inline edit — the endpoint
  // returns the freshly-upserted row, so we drop it in by
  // notion_page_id and the table re-renders in place.
  const patchRow = (updated) => {
    if (!updated?.notion_page_id) return;
    setRows((prev) => {
      const i = prev.findIndex((r) => r.notion_page_id === updated.notion_page_id);
      if (i === -1) return [updated, ...prev];
      const out = prev.slice();
      out[i] = { ...prev[i], ...updated };
      return out;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAllPaginated(buildQuery);
        if (cancelled) return;
        setRows(data);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        captureException(err, { where: 'useSamsicCrm' });
        setError(err?.message || String(err));
        setRows([]);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, ready, error, refresh, patchRow };
}

// Resolve a Notion file proxy URL (/api/notion/file/<pageId>?...
// or /api/notion/file/raw?...) to a short-lived signed URL by
// fetching the endpoint with auth + asking for JSON instead of a
// 302. Returns the resolved URL string.
//
// The 302 path doesn't work for "open in a new tab" / clicking a
// link because the new browser context can't carry the Bearer
// header. This helper keeps auth in the in-app fetch + hands the
// caller a publicly-accessible signed URL they can window.open
// or set as <img src> without re-auth.
export async function resolveProxiedFileUrl(proxyPath) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const sep = proxyPath.includes('?') ? '&' : '?';
  const r = await fetch(`${proxyPath}${sep}json=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error || `Resolve failed (${r.status})`);
  if (!body?.url) throw new Error('Proxy returned no url');
  return body.url;
}

// On-demand sync trigger. Returns the endpoint payload so the caller
// can surface counts in a toast / banner. Errors thrown — caller
// catches + shows them.
export async function syncSamsicCrmNow() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const r = await fetch('/api/sales/sync-now', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error || `Sync failed (${r.status})`);
  return body;
}

// Suivi SAV mirror (mig 155, PR 4). Read-only cache of the linked
// SAV records — surfaced inline on each SAMSIC row via the SAV chip
// + popover. We index by samsic_page_url (the back-relation array)
// so the page can look up "SAVs for this SAMSIC row" in O(1).
export function useSamsicSav() {
  const [bySamsicId, setBySamsicId] = useState({}); // map<samsic.notion_page_id, sav[]>
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Paginated read — SAV can also grow past PostgREST's 1000-row cap.
      let data = [];
      try {
        data = await fetchAllPaginated(() =>
          supabase.from('sales_crm_samsic_sav').select('*').order('notion_last_edited_at', { ascending: false }),
        );
      } catch (e) {
        captureException(e, { where: 'useSamsicSav' });
        data = [];
      }
      if (cancelled) return;
      const map = {};
      for (const sav of data || []) {
        for (const samsicId of sav.samsic_page_urls || []) {
          // Notion IDs sometimes round-trip with/without dashes — normalise
          // by stripping non-hex so the keys match SAMSIC.notion_page_id
          // (uuid type, dashed canonical form).
          const key = String(samsicId).replace(/-/g, '');
          if (!map[key]) map[key] = [];
          map[key].push(sav);
        }
      }
      setBySamsicId(map);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { bySamsicId, ready };
}

// Mirror of the Suivi SAV status options.
export const SAMSIC_SAV_STATUS_TONES = {
  'A traiter': 'warn',
  'En attente': 'info',
  Fini: 'ok',
};

// Notion user directory cache (mig 154). Populated by the same sync
// that pulls SAMSIC CRM pages. Used to resolve
// sales_crm_samsic.lead_user_id → display name + avatar so the UI
// can show a real person instead of a UUID.
export function useNotionUsers() {
  const [byId, setById] = useState({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('notion_users').select('id, name, avatar_url, email, kind');
      if (cancelled) return;
      const map = {};
      for (const u of data || []) map[u.id] = u;
      setById(map);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { byId, ready };
}

// Inline-edit a single SAMSIC CRM cell. Notion is the source of
// truth; this writes there + refreshes our mirror in one round trip.
// Caller passes the current row's `notion_last_edited_at` as the
// baseline so the server can return 409 + the live row if Notion
// was edited from another surface since the UI loaded.
//
// Returns { ok, new_last_edited_at, row } on success.
// On 409 conflict, throws an Error with code='conflict' and `.row`
// attached so the UI can show the live values.
// On other failure, throws an Error with the server message.
export async function updateSamsicCell({ page_id, column, value, expected_last_edited_at }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const r = await fetch('/api/sales/samsic/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ page_id, column, value, expected_last_edited_at }),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 409) {
    const err = new Error(body?.error || 'edited in Notion since you loaded');
    err.code = 'conflict';
    err.row = body?.row || null;
    err.current_last_edited_at = body?.current_last_edited_at || null;
    throw err;
  }
  if (!r.ok) throw new Error(body?.error || `Update failed (${r.status})`);
  return body;
}

// Allowed status values for the inline editor. Mirrors the Postgres
// CHECK constraint (migration 153) and the STATUS_REWRITE map on the
// sync side (api/_lib/notion-samsic.ts) + STATUS_REWRITE_REVERSE on
// the write side (api/_lib/notion-samsic-writer.ts). When Notion
// adds a new status option, update all four spots.
export const SAMSIC_STATUS_OPTIONS = ['Lead', 'Qualified', 'Proposal', 'Closed', 'SWITCH', 'Lost', 'AO'];

// Allowed priority tags for the inline editor. Mirrors the Notion
// multi_select options.
export const SAMSIC_PRIORITY_OPTIONS = ['A FACTURER', 'High', 'Medium', 'MANQUE INFOS', 'DISPLAY', 'STOCK1'];

// SAMSIC CRM status pipeline + tone map. Statut values in Notion
// include emoji ("Proposal 👀", "Closed 💪") — we strip those on
// sync (api/_lib/notion-samsic.ts STATUS_REWRITE).
export const SAMSIC_STATUS_TONES = {
  Lead: 'info',
  Qualified: 'warn',
  Proposal: 'accent',
  Closed: 'ok',
  SWITCH: 'neutral',
  Lost: 'risk',
  AO: 'neutral',
};

// Priorité (multi-select) tones — mirrors the Notion option colors.
export const SAMSIC_PRIORITY_TONES = {
  'A FACTURER': 'ok',
  High: 'risk',
  Medium: 'accent',
  'MANQUE INFOS': 'info',
  DISPLAY: 'warn',
  STOCK1: 'neutral',
};

// ────── Users-wide list (Adaptiv platform-admin only)
//
// Drives /platform/users. Joins profiles → active organization → all
// organization_memberships → orgs. The platform-admin RLS bypass
// (migration 060) gives us the full cross-tenant view without
// service-role. Two queries client-side because PostgREST struggles
// with nested embeds back through profiles when both sides have
// multi-FK relationships into organizations.

let usersCache = [];
let usersCacheLoaded = false;
const usersListeners = new Set();
function emitUsers() {
  usersListeners.forEach((fn) => fn(usersCache.slice()));
}

async function hydrateUsers() {
  const [profilesRes, membershipsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'user_id, email, display_name, first_name, last_name, role, company, active_org_id, is_merlin_owner, created_at, updated_at',
      )
      .order('created_at', { ascending: true }),
    supabase
      .from('organization_members')
      .select('user_id, org_id, role, joined_at, organizations(id, name, slug, kind)')
      .order('joined_at', { ascending: true }),
  ]);

  if (profilesRes.error) {
    captureException(profilesRes.error, { where: 'hydrateUsers' });
    // eslint-disable-next-line no-console
    console.warn('[platform-data] users fetch failed:', profilesRes.error.message);
    usersCache = [];
    usersCacheLoaded = true;
    emitUsers();
    return [];
  }

  const membershipsByUser = {};
  for (const m of membershipsRes.data || []) {
    if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = [];
    if (m.organizations) {
      membershipsByUser[m.user_id].push({
        orgId: m.organizations.id,
        orgName: m.organizations.name,
        orgSlug: m.organizations.slug,
        orgKind: m.organizations.kind,
        orgRole: m.role,
        joinedAt: m.joined_at,
      });
    }
  }

  usersCache = (profilesRes.data || []).map((p) => {
    const memberships = membershipsByUser[p.user_id] || [];
    const primary = pickPrimaryMembership(memberships, p.active_org_id);
    const displayName = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '—';
    return {
      userId: p.user_id,
      email: p.email || '—',
      displayName,
      firstName: p.first_name || '',
      lastName: p.last_name || '',
      profileRole: p.role || null,
      company: p.company || '',
      activeOrgId: p.active_org_id,
      // Primary org used for grouping + sort. If no active_org_id is
      // pinned we fall back to the oldest membership so the cell
      // never reads "—" for users who do have memberships.
      primaryOrgId: primary?.orgId || null,
      primaryOrgName: primary?.orgName || (memberships.length === 0 ? '— (no membership)' : '—'),
      primaryOrgKind: primary?.orgKind || null,
      primaryOrgSlug: primary?.orgSlug || null,
      primaryOrgRole: primary?.orgRole || null,
      memberships,
      memberCount: memberships.length,
      // Single-instance "god mode" flag from migration 129.
      isMerlinOwner: !!p.is_merlin_owner,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
  usersCacheLoaded = true;
  emitUsers();
  return usersCache;
}

export function useAllUsers() {
  const [users, setUsers] = useState(() => usersCache.slice());
  const [ready, setReady] = useState(() => usersCacheLoaded);
  useEffect(() => {
    const fn = (next) => {
      setUsers(next);
      setReady(true);
    };
    usersListeners.add(fn);
    hydrateUsers().then(fn);
    return () => usersListeners.delete(fn);
  }, []);
  return { users, ready };
}

export async function refreshUsers() {
  return hydrateUsers();
}

// ────── Display helpers

export const KIND_LABELS = {
  real_estate: 'Real estate',
  contractor: 'Contractor',
  adaptiv: 'Adaptiv (platform)',
};

export const LIFECYCLE_LABELS = {
  active: 'Active',
  suspended: 'Suspended',
  deleted: 'Deleted',
};

export const LIFECYCLE_TONES = {
  active: 'ok',
  suspended: 'warn',
  deleted: 'risk',
};
