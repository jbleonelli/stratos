-- Stratos claim-bridge proof — minimal org-scoped schema.
--
-- A deliberately small slice of the domain model exercising the platform's
-- standard RLS shapes, to prove tenant isolation holds when a Lambda resolver
-- injects Cognito claims by hand (rather than a PostgREST-style auto-injection).
--
-- Two scoping patterns are represented:
--   • org-scoped only          → asks
--   • org-scoped + location     → devices, locations
-- Load order: db/helpers/001_authz.sql, then this file, then seed.sql.

create table if not exists public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  lifecycle_state text not null default 'active'
);

create table if not exists public.locations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null
);

create table if not exists public.user_location_grants (
  user_id         uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id     uuid not null references public.locations(id) on delete cascade,
  primary key (user_id, location_id)
);

-- org-scoped only
create table if not exists public.asks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question        text not null
);

-- org + location scoped (mirrors public.devices)
create table if not exists public.devices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id     uuid not null references public.locations(id) on delete cascade,
  name            text not null
);

-- ── The resolver's DB role ────────────────────────────────────────────────
-- NOT a superuser, NO BYPASSRLS. This is the identity the Lambda / RDS Data API
-- connects as; the claim bridge does SET LOCAL ROLE to it so RLS actually fires.
-- (A superuser or the table owner would silently bypass every policy below.)
do $$ begin
  create role stratos_resolver nologin;
exception when duplicate_object then null; end $$;

grant usage on schema public to stratos_resolver;
grant usage on schema auth   to stratos_resolver;
grant select, insert, update, delete on all tables    in schema public to stratos_resolver;
grant execute                         on all functions in schema public to stratos_resolver;
grant execute                         on all functions in schema auth   to stratos_resolver;

-- ── Enable + FORCE RLS on every tenant table ──────────────────────────────
alter table public.organizations        enable row level security;
alter table public.locations            enable row level security;
alter table public.user_location_grants enable row level security;
alter table public.asks                 enable row level security;
alter table public.devices              enable row level security;
alter table public.organizations        force  row level security;
alter table public.locations            force  row level security;
alter table public.user_location_grants force  row level security;
alter table public.asks                 force  row level security;
alter table public.devices              force  row level security;

-- ── Policies ──────────────────────────────────────────────────────────────
-- current_user_org() / is_platform_admin() are wrapped in (select ...) so the
-- planner hoists them to an InitPlan (evaluated once per query, not per row).

-- organizations: a member sees their active org; platform admins see all.
create policy organizations_read on public.organizations for select using (
  (select public.is_platform_admin()) or id = (select public.current_user_org())
);

-- locations: org match AND location access; platform admins bypass.
create policy locations_read on public.locations for select using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org()) and public.has_location_access(id))
);

-- user_location_grants: a user sees their own grants; platform admins all.
create policy grants_read on public.user_location_grants for select using (
  (select public.is_platform_admin())
  or (user_id = (select auth.uid()) and organization_id = (select public.current_user_org()))
);

-- asks: org-scoped read; platform admins all.
create policy asks_read on public.asks for select using (
  (select public.is_platform_admin()) or organization_id = (select public.current_user_org())
);

-- devices: org match AND location access; platform admins bypass.
create policy devices_read on public.devices for select using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org()) and public.has_location_access(location_id))
);
