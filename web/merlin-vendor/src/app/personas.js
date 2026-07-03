// Phase G-2 — derived persona type.
// Merlin's 5-value profiles.role enum (superadmin / facility / cleaning
// / maintenance / security) conflates job function with org kind.
// A lead custodian at Maple Cleaning and a lead custodian at an
// in-house FM have the same `role=cleaning` but need radically
// different primary UX — contracts dashboard vs today's plan.
//
// personaOf(session, org) resolves that into five semantic personas:
//
//   superadmin         — Adaptiv staff, everywhere, all views
//   property_manager   — manager at a real_estate org. Portfolio view,
//                        contracts they hold, SLA dashboard across
//                        contractors. (v2 — facility_manager covers
//                        the "manager at real_estate" case today;
//                        splitting portfolio vs per-building is
//                        future UX).
//   facility_manager   — manager at a real_estate org. Today's plan,
//                        schedules, incident feed, agentic config for
//                        their buildings.
//   contractor_manager — manager at a contractor org. Contracts list,
//                        SLA per contract, own crew, scoped route
//                        performance. Different primary nouns.
//   worker             — crew member (cleaning / maintenance / security
//                        profile role). Task checklist for today's
//                        shifts, flagging issues. Minimal admin.
//
// The existing 5-role enum remains the underlying auth surface (RLS
// still checks `profiles.role`, Admin → Users still shows per-role
// pills). This module is the translation layer the new Track G views
// gate on.

export const PERSONAS = {
  SUPERADMIN: 'superadmin',
  PROPERTY_MANAGER: 'property_manager',
  FACILITY_MANAGER: 'facility_manager',
  CONTRACTOR_MANAGER: 'contractor_manager',
  WORKER: 'worker',
  // Deferred-list personas — recognized end-to-end now; full UX
  // shells come later. See docs/reference/roles.md.
  TENANT: 'tenant',
  AUDITOR: 'auditor',
  FM_NETWORK: 'fm_network',
  EXECUTIVE: 'executive',
};

const MANAGER_ROLES = new Set(['facility']);
const WORKER_ROLES = new Set(['cleaning', 'maintenance', 'security']);

// Resolve a persona from a session + active org. Both may be null
// during initial hydration; callers handle the null return.
//
// Rules:
//   superadmin role → superadmin (wins over any org kind)
//   at a contractor org + manager role → contractor_manager
//   at a contractor org + worker role → worker
//   at a real_estate/demo org + manager role → facility_manager
//                                              (property_manager is a
//                                              future sub-split)
//   at a real_estate/demo org + worker role → worker
//   anything else (missing org, unknown role) → null
export function personaOf(session, org) {
  if (!session) return null;
  const role = session.role;
  if (role === 'superadmin') return PERSONAS.SUPERADMIN;

  // Deferred-list roles map 1:1 to their named persona regardless of
  // org.kind. Each one is its own surface — they don't share a shell
  // with the existing facility / worker buckets.
  if (role === 'property_manager') return PERSONAS.PROPERTY_MANAGER;
  if (role === 'tenant') return PERSONAS.TENANT;
  if (role === 'auditor') return PERSONAS.AUDITOR;
  if (role === 'fm_network') return PERSONAS.FM_NETWORK;
  if (role === 'executive') return PERSONAS.EXECUTIVE;

  if (!org) return null;

  const kind = org.kind || 'real_estate';
  const isManager = MANAGER_ROLES.has(role);
  const isWorker = WORKER_ROLES.has(role);

  if (kind === 'contractor') {
    if (isManager) return PERSONAS.CONTRACTOR_MANAGER;
    if (isWorker) return PERSONAS.WORKER;
    return null;
  }

  // real_estate | demo | adaptiv — all three treat managers as facility
  // managers for UX purposes. The new property_manager role gets its
  // own persona; legacy `facility` role still maps to facility_manager.
  if (isManager) return PERSONAS.FACILITY_MANAGER;
  if (isWorker) return PERSONAS.WORKER;
  return null;
}

// ─────────────────────── effective role (2026-05-17) ───────────────────────
// User-facing single-word role label that reflects the full Adaptiv
// hierarchy. The word "Persona" is gone from the UI — readers see one
// short term that matches the everyday vocabulary:
//
//   Owner       — the single human Merlin Owner (god mode, isMerlinOwner)
//   Super Admin — Adaptiv platform admin (isPlatformAdmin but not owner)
//   Admin       — manager at a real_estate customer org (Jamie at Meridian)
//   Contractor  — manager at a contractor org (Lisa at SparkleCo)
//   Cleaning    — crew with profile.role='cleaning'
//   Maintenance — crew with profile.role='maintenance'
//   Security    — crew with profile.role='security'
//   Property Manager / Tenant / Auditor / Executive / FM Dispatcher — deferred
//
// The hierarchy of who-can-create-whom:
//   Owner can create Super Admins (RLS: is_merlin_owner() on adaptiv-org writes)
//   Super Admins can create customer-org Admins (via /platform/tenants)
//   Admins can create buildings, users, members inside their own org
//
// Returns a string key. effectiveRoleLabel(key, t) renders the localized text.
export function effectiveRoleKey(session, org) {
  if (!session) return null;
  // 4-tier Adaptiv hierarchy (migration 131). Order matters: Owner first,
  // then platformRole-based, so the deeper signal beats the broad
  // isPlatformAdmin check. Pre-131 sessions (cached before deploy) get
  // 'super_admin' for safety since that's the most-common backfill.
  if (session.isMerlinOwner) return 'owner';
  if (session.platformRole === 'super_admin') return 'super_admin';
  if (session.platformRole === 'admin') return 'platform_admin';
  if (session.platformRole === 'normal_user') return 'normal_user';
  // Fallback: any Adaptiv-org member with no platform_role set (e.g.
  // an upgrade-skew window) reads as super_admin so they keep their
  // existing access. Cleared when current_platform_role lands.
  if (session.isPlatformAdmin) return 'super_admin';

  const role = session.role;
  // Deferred-list roles map 1:1 — same as personaOf.
  if (role === 'property_manager') return 'property_manager';
  if (role === 'tenant') return 'tenant';
  if (role === 'auditor') return 'auditor';
  if (role === 'fm_network') return 'fm_network';
  if (role === 'executive') return 'executive';
  if (role === 'cleaning') return 'cleaning';
  if (role === 'maintenance') return 'maintenance';
  if (role === 'security') return 'security';

  // Manager (profile.role='facility') splits by org kind.
  // NOTE: customer-side "admin" label collides with platform-side "Admin"
  // tier name. To keep them distinct we tag the customer-side one
  // 'tenant_admin'. The label renderer maps both to "Admin" — context
  // makes the distinction clear in the UI; the keys differ for tests
  // and any future tier-aware logic.
  const kind = org?.kind || 'real_estate';
  if (role === 'facility') {
    return kind === 'contractor' ? 'contractor' : 'tenant_admin';
  }

  // `superadmin` profile.role without platform-admin membership shouldn't
  // happen anymore (it's how all four Adaptiv staff got platform access),
  // but if it does, treat as super_admin so the UI doesn't read blank.
  if (role === 'superadmin') return 'super_admin';

  return null;
}

// Returns the localized label for an effective-role key. Falls back to a
// dash. Callers pass the t() function so we don't depend on i18n.js here.
export function effectiveRoleLabel(key, t) {
  if (!key) return '—';
  const i18n = t?.(`effective_role.${key}`);
  if (i18n && i18n !== `effective_role.${key}`) return i18n;
  // English fallback if no t() is available (dev tools, console).
  switch (key) {
    case 'owner':
      return 'Owner';
    case 'super_admin':
      return 'Super Admin';
    case 'platform_admin':
      return 'Admin';
    case 'normal_user':
      return 'User';
    case 'tenant_admin':
      return 'Admin';
    case 'contractor':
      return 'Contractor';
    case 'cleaning':
      return 'Cleaning';
    case 'maintenance':
      return 'Maintenance';
    case 'security':
      return 'Security';
    case 'property_manager':
      return 'Property Manager';
    case 'tenant':
      return 'Tenant';
    case 'auditor':
      return 'Auditor';
    case 'fm_network':
      return 'FM Dispatcher';
    case 'executive':
      return 'Executive';
    default:
      return '—';
  }
}
