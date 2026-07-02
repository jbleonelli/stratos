-- Stratos — authorization helpers (DB side of the Cognito → RLS claim bridge)
--
-- Authorization is enforced primarily in the AppSync/Lambda application layer,
-- with RLS kept in the database as a backstop. Because the SPA never talks to
-- the database directly, the resolver injects the caller's identity as a
-- transaction-local GUC on every DB call:
--
--   SET LOCAL request.jwt.claims = '{"sub":..,"organization_id":..,"platform_role":..}';
--
-- The helpers below read that GUC, so the RLS policies evaluate the caller's org
-- and role without any app code. This is the "claim bridge."
-- See docs/architecture/authorization-and-claim-bridge.md.

create schema if not exists auth;

-- Raw claims blob set by the resolver for the current transaction.
-- Empty/unset → '{}' so the accessors below return NULL rather than error.
create or replace function public.jwt_claims()
returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
$$;

-- auth.uid(): the Cognito `sub` for the current caller.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(public.jwt_claims() ->> 'sub', '')::uuid;
$$;

-- current_user_org(): the caller's ACTIVE organization. The Cognito
-- pre-token-generation Lambda resolves the active org at sign-in (and on org
-- switch) and writes it into the `organization_id` claim, so the DB reads it
-- straight from the claim.
create or replace function public.current_user_org()
returns uuid language sql stable as $$
  select nullif(public.jwt_claims() ->> 'organization_id', '')::uuid;
$$;

-- is_platform_admin(): back-office cross-tenant access, carried as a claim
-- (platform_role='platform_admin') set by the pre-token-gen Lambda.
create or replace function public.is_platform_admin()
returns boolean language sql stable as $$
  select coalesce(public.jwt_claims() ->> 'platform_role', '') = 'platform_admin';
$$;

-- has_location_access(): location-level scoping within an org. Semantics:
--   • platform admins see everything;
--   • a user with NO location grants in the active org has org-wide access;
--   • otherwise the user must hold an explicit grant on the location.
-- A full location hierarchy would walk a subtree; this baseline uses a flat
-- model — the tenant-isolation semantics under test are identical.
-- SECURITY DEFINER so it can read user_location_grants regardless of that
-- table's own RLS. Written in plpgsql so the body is validated at run time, not
-- creation time — this keeps the helper file loadable before the domain tables
-- exist.
create or replace function public.has_location_access(target uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return
    target is null
    or public.is_platform_admin()
    or not exists (
      select 1 from public.user_location_grants g
      where g.user_id = auth.uid()
        and g.organization_id = public.current_user_org()
    )
    or exists (
      select 1 from public.user_location_grants g
      where g.user_id = auth.uid()
        and g.organization_id = public.current_user_org()
        and g.location_id = target
    );
end;
$$;
