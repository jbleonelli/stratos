-- Stratos — V1 baseline schema (authored, greenfield).
--
-- The clean starting point for the domain model: enums, the org/identity core,
-- and the events/asks domain (the first vertical slice), with RLS policies and
-- the SECURITY DEFINER RPCs the slice needs. Further domains land as forward-only
-- migrations under db/migrations/.
--
-- PREREQUISITE: db/helpers/001_authz.sql must be applied first — the RLS policies
-- below call current_user_org(), is_platform_admin(), and has_location_access(),
-- which read the caller's Cognito claims from request.jwt.claims (the claim
-- bridge). See docs/architecture/authorization-and-claim-bridge.md.
--
-- Enforcement model: authorization is primary in the AppSync/Lambda resolver
-- layer; the RLS policies here are the database backstop. Resolvers connect as
-- the non-privileged `stratos_resolver` role and set request.jwt.claims per
-- transaction, so these policies fire on every query.
--
-- gen_random_uuid() is Postgres core (13+); no extension required.

-- ─────────────────────────────── Enums ─────────────────────────────────────

do $$ begin create type public.org_role         as enum ('owner','admin','member');                       exception when duplicate_object then null; end $$;
do $$ begin create type public.org_kind         as enum ('customer','platform');                          exception when duplicate_object then null; end $$;
do $$ begin create type public.org_lifecycle    as enum ('trial','active','suspended','deleted');         exception when duplicate_object then null; end $$;
do $$ begin create type public.user_role        as enum ('owner','manager','worker','contractor','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.location_kind    as enum ('building','floor','zone','room');               exception when duplicate_object then null; end $$;
do $$ begin create type public.device_status    as enum ('online','offline','maintenance');               exception when duplicate_object then null; end $$;
do $$ begin create type public.event_kind       as enum ('sensor_reading','device_alert','manual','webhook','schedule'); exception when duplicate_object then null; end $$;
do $$ begin create type public.event_severity   as enum ('info','warning','critical');                    exception when duplicate_object then null; end $$;
do $$ begin create type public.ask_status       as enum ('open','answered','dismissed','expired');        exception when duplicate_object then null; end $$;

-- ────────────────────────── Shared: touch trigger ──────────────────────────

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────────── Identity core ───────────────────────────────

create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  kind                  public.org_kind      not null default 'customer',
  lifecycle_state       public.org_lifecycle not null default 'trial',
  trial_ends_at         timestamptz,
  primary_contact_email text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index organizations_slug_idx on public.organizations (slug);

-- profiles.user_id is the Cognito `sub`.
create table public.profiles (
  user_id              uuid primary key,
  email                text not null,
  full_name            text,
  role                 public.user_role not null default 'viewer',
  active_org_id        uuid references public.organizations(id) on delete set null,
  impersonating_org_id uuid references public.organizations(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.organization_members (
  org_id    uuid not null references public.organizations(id) on delete cascade,
  user_id   uuid not null references public.profiles(user_id) on delete cascade,
  role      public.org_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.locations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id       uuid references public.locations(id) on delete set null,
  name            text not null,
  kind            public.location_kind not null default 'building',
  created_at      timestamptz not null default now()
);
create index locations_org_idx    on public.locations (organization_id);
create index locations_parent_idx on public.locations (parent_id);

create table public.user_location_grants (
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id     uuid not null references public.locations(id) on delete cascade,
  primary key (user_id, location_id)
);
create index user_location_grants_org_idx on public.user_location_grants (organization_id);

-- ───────────────────────── Events / asks domain ────────────────────────────

create table public.devices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id     uuid not null references public.locations(id) on delete cascade,
  name            text not null,
  kind            text not null default 'sensor',
  status          public.device_status not null default 'online',
  external_id     text,
  created_at      timestamptz not null default now(),
  unique (organization_id, external_id)
);
create index devices_org_idx on public.devices (organization_id);
create index devices_loc_idx on public.devices (location_id);

-- Canonical signal layer. external_id gives at-least-once ingest idempotency.
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id     uuid references public.locations(id) on delete set null,
  device_id       uuid references public.devices(id)   on delete set null,
  kind            public.event_kind     not null,
  severity        public.event_severity not null default 'info',
  external_id     text,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  unique (organization_id, external_id)
);
create index events_org_created_idx on public.events (organization_id, created_at desc);
create index events_loc_idx         on public.events (location_id);

-- Questions the agent raises for a human to resolve.
create table public.asks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id     uuid references public.locations(id) on delete set null,
  event_id        uuid references public.events(id)    on delete set null,
  question        text not null,
  status          public.ask_status not null default 'open',
  answer          text,
  created_by      uuid references public.profiles(user_id) on delete set null,
  resolved_by     uuid references public.profiles(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index asks_org_status_idx on public.asks (organization_id, status);

-- Decision log for the agent runtime (per event → run).
create table public.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id        uuid references public.events(id) on delete set null,
  decision        text not null,
  rationale       text,
  cost_cents      integer not null default 0,
  created_at      timestamptz not null default now()
);
create index agent_runs_org_idx on public.agent_runs (organization_id, created_at desc);

create trigger organizations_touch before update on public.organizations
  for each row execute function public.tg_touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.tg_touch_updated_at();

-- ─────────────────────── Resolver role + privileges ────────────────────────
-- The non-privileged identity the AppSync/Lambda layer connects as. It has NO
-- BYPASSRLS, so the policies below are enforced; the claim bridge does
-- SET LOCAL ROLE stratos_resolver + SET LOCAL request.jwt.claims per request.

do $$ begin create role stratos_resolver nologin; exception when duplicate_object then null; end $$;

-- The Lambda connects as the DB master and drops to stratos_resolver per request
-- (set_config('role', ...)). SET ROLE requires membership, so grant it here.
grant stratos_resolver to current_user;

grant usage on schema public to stratos_resolver;
grant usage on schema auth   to stratos_resolver;
grant select, insert, update, delete on all tables    in schema public to stratos_resolver;
grant execute                         on all functions in schema public to stratos_resolver;
grant execute                         on all functions in schema auth   to stratos_resolver;

-- ──────────────────────────────── RLS ──────────────────────────────────────
-- current_user_org() / is_platform_admin() are wrapped in (select ...) so the
-- planner evaluates them once per query (InitPlan) rather than per row.

alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.organization_members enable row level security;
alter table public.locations            enable row level security;
alter table public.user_location_grants enable row level security;
alter table public.devices              enable row level security;
alter table public.events               enable row level security;
alter table public.asks                 enable row level security;
alter table public.agent_runs           enable row level security;

alter table public.organizations        force row level security;
alter table public.profiles             force row level security;
alter table public.organization_members force row level security;
alter table public.locations            force row level security;
alter table public.user_location_grants force row level security;
alter table public.devices              force row level security;
alter table public.events               force row level security;
alter table public.asks                 force row level security;
alter table public.agent_runs           force row level security;

-- organizations: members read their active org; platform admins read all.
create policy organizations_read on public.organizations for select using (
  (select public.is_platform_admin()) or id = (select public.current_user_org())
);
create policy organizations_admin_all on public.organizations for all using (
  (select public.is_platform_admin())
) with check ((select public.is_platform_admin()));

-- profiles: a user reads/updates their own; platform admins all.
create policy profiles_self_read on public.profiles for select using (
  (select public.is_platform_admin()) or user_id = (select auth.uid())
);
create policy profiles_self_update on public.profiles for update using (
  (select public.is_platform_admin()) or user_id = (select auth.uid())
) with check (
  (select public.is_platform_admin()) or user_id = (select auth.uid())
);

-- organization_members: members read their org's roster; platform admins all.
create policy org_members_read on public.organization_members for select using (
  (select public.is_platform_admin()) or org_id = (select public.current_user_org())
);
create policy org_members_admin_all on public.organization_members for all using (
  (select public.is_platform_admin())
) with check ((select public.is_platform_admin()));

-- locations: org match AND location access; platform admins bypass.
create policy locations_read on public.locations for select using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org()) and public.has_location_access(id))
);
create policy locations_write on public.locations for all using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org()) and public.has_location_access(id))
) with check (
  (select public.is_platform_admin()) or organization_id = (select public.current_user_org())
);

-- user_location_grants: a user reads their own; platform admins all.
create policy grants_read on public.user_location_grants for select using (
  (select public.is_platform_admin())
  or (user_id = (select auth.uid()) and organization_id = (select public.current_user_org()))
);
create policy grants_admin_all on public.user_location_grants for all using (
  (select public.is_platform_admin())
) with check ((select public.is_platform_admin()));

-- Reusable org+location scoping for domain tables.
-- devices: org match AND location access.
create policy devices_read on public.devices for select using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org()) and public.has_location_access(location_id))
);
create policy devices_write on public.devices for all using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org()) and public.has_location_access(location_id))
) with check (
  (select public.is_platform_admin()) or organization_id = (select public.current_user_org())
);

-- events: org match AND (no location OR location access).
create policy events_read on public.events for select using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org())
      and (location_id is null or public.has_location_access(location_id)))
);
create policy events_write on public.events for all using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org())
      and (location_id is null or public.has_location_access(location_id)))
) with check (
  (select public.is_platform_admin()) or organization_id = (select public.current_user_org())
);

-- asks: org match AND (no location OR location access).
create policy asks_read on public.asks for select using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org())
      and (location_id is null or public.has_location_access(location_id)))
);
create policy asks_write on public.asks for all using (
  (select public.is_platform_admin())
  or (organization_id = (select public.current_user_org())
      and (location_id is null or public.has_location_access(location_id)))
) with check (
  (select public.is_platform_admin()) or organization_id = (select public.current_user_org())
);

-- agent_runs: org-scoped read; platform admins all. Writes come from the agent
-- runtime via SECURITY DEFINER paths, so no resolver-role write policy here.
create policy agent_runs_read on public.agent_runs for select using (
  (select public.is_platform_admin()) or organization_id = (select public.current_user_org())
);

-- ──────────────────────────────── RPCs ─────────────────────────────────────
-- SECURITY DEFINER functions run as the owner and therefore bypass RLS, so each
-- one scopes writes to current_user_org() explicitly. They are the sanctioned
-- write paths; direct table writes are still gated by the WITH CHECK policies
-- above as a backstop.

-- self_serve_create_org: provision a trial org for the authenticated caller.
-- Idempotent — returns the caller's existing non-deleted org if they have one.
create or replace function public.self_serve_create_org(p_company_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id  uuid := auth.uid();
  v_email    text;
  v_org_id   uuid;
  v_slug     text;
  v_existing uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required';
  end if;

  select om.org_id into v_existing
  from public.organization_members om
  join public.organizations o on o.id = om.org_id
  where om.user_id = v_user_id and o.lifecycle_state <> 'deleted'
  order by om.joined_at asc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  v_slug := regexp_replace(lower(trim(p_company_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');
  if v_slug = '' then v_slug := 'tenant'; end if;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 4);
  end loop;

  select email into v_email from public.profiles where user_id = v_user_id;

  insert into public.organizations (name, slug, kind, lifecycle_state, trial_ends_at, primary_contact_email)
  values (trim(p_company_name), v_slug, 'customer', 'trial', now() + interval '30 days', v_email)
  returning id into v_org_id;

  insert into public.organization_members (org_id, user_id, role) values (v_org_id, v_user_id, 'owner');
  update public.profiles set active_org_id = v_org_id where user_id = v_user_id;

  return v_org_id;
end $$;
grant execute on function public.self_serve_create_org(text) to stratos_resolver;

-- set_active_org: switch the caller's active org (must be a member).
create or replace function public.set_active_org(p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.organization_members
    where org_id = p_org_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of that organization' using errcode = '42501';
  end if;
  update public.profiles set active_org_id = p_org_id where user_id = auth.uid();
end $$;
grant execute on function public.set_active_org(uuid) to stratos_resolver;

-- ingest_event: idempotent event insert, scoped to the caller's active org.
create or replace function public.ingest_event(
  p_kind        public.event_kind,
  p_severity    public.event_severity default 'info',
  p_location_id uuid  default null,
  p_device_id   uuid  default null,
  p_external_id text  default null,
  p_payload     jsonb default '{}'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
  v_id  uuid;
begin
  if v_org is null then
    raise exception 'No active organization' using errcode = '42501';
  end if;

  insert into public.events (organization_id, location_id, device_id, kind, severity, external_id, payload)
  values (v_org, p_location_id, p_device_id, p_kind, p_severity, p_external_id, coalesce(p_payload, '{}'))
  on conflict (organization_id, external_id) do nothing
  returning id into v_id;

  if v_id is null and p_external_id is not null then
    select id into v_id from public.events
    where organization_id = v_org and external_id = p_external_id;
  end if;

  return v_id;
end $$;
grant execute on function public.ingest_event(public.event_kind, public.event_severity, uuid, uuid, text, jsonb) to stratos_resolver;

-- raise_ask: create an open ask scoped to the caller's active org.
create or replace function public.raise_ask(
  p_question    text,
  p_location_id uuid default null,
  p_event_id    uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
  v_id  uuid;
begin
  if v_org is null then
    raise exception 'No active organization' using errcode = '42501';
  end if;
  if coalesce(trim(p_question), '') = '' then
    raise exception 'Question is required';
  end if;

  insert into public.asks (organization_id, location_id, event_id, question, created_by)
  values (v_org, p_location_id, p_event_id, trim(p_question), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.raise_ask(text, uuid, uuid) to stratos_resolver;

-- answer_ask: resolve an ask in the caller's active org.
create or replace function public.answer_ask(p_ask_id uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
begin
  update public.asks
     set status      = 'answered',
         answer      = p_answer,
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_ask_id
     and organization_id = v_org
     and status = 'open';

  if not found then
    raise exception 'Ask not found, not open, or not in your organization'
      using errcode = 'no_data_found';
  end if;
end $$;
grant execute on function public.answer_ask(uuid, text) to stratos_resolver;

-- ─────────────────── Login claim resolution (pre-token bridge) ──────────────
-- The Cognito pre-token-generation Lambda calls resolve_login_claims(sub) at
-- sign-in (and on org switch) to compute the organization_id + platform_role
-- claims it injects into the token. At that moment the caller has NO claims yet,
-- so the lookup must read identity tables directly. `stratos_auth` is a BYPASSRLS
-- role that OWNS the function, so the SECURITY DEFINER body sidesteps FORCE RLS
-- (it is nologin — reachable only by executing this one function).

do $$ begin create role stratos_auth nologin bypassrls; exception when duplicate_object then null; end $$;
grant stratos_auth to current_user; -- lets this migration ALTER ... OWNER TO stratos_auth
grant usage on schema public to stratos_auth;
grant select on public.profiles, public.organization_members, public.organizations to stratos_auth;

create or replace function public.resolve_login_claims(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org      uuid;
  v_platform boolean;
begin
  -- Active org: explicit impersonation wins, else the profile's active org,
  -- else the earliest non-deleted membership (freshly-provisioned users).
  select coalesce(p.impersonating_org_id, p.active_org_id) into v_org
  from public.profiles p where p.user_id = p_user_id;

  if v_org is null then
    select om.org_id into v_org
    from public.organization_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = p_user_id and o.lifecycle_state <> 'deleted'
    order by om.joined_at asc
    limit 1;
  end if;

  -- Platform admin = member of any platform-kind org (e.g. the Adaptiv org).
  select exists (
    select 1 from public.organization_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = p_user_id and o.kind = 'platform'
  ) into v_platform;

  return jsonb_strip_nulls(jsonb_build_object(
    'organization_id', v_org,
    'platform_role', case when v_platform then 'platform_admin' else null end
  ));
end $$;

alter function public.resolve_login_claims(uuid) owner to stratos_auth;
-- Not a tenant-facing path: keep it off the resolver role and off PUBLIC.
revoke all on function public.resolve_login_claims(uuid) from public;
revoke execute on function public.resolve_login_claims(uuid) from stratos_resolver;
