-- Stratos — migration 005: org member invites + profile bootstrap.

do $$ begin create type public.invite_status as enum ('pending','accepted','revoked','expired'); exception when duplicate_object then null; end $$;

create table public.organization_invites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  email        text not null,
  org_role     public.org_role not null default 'member',
  location_ids uuid[] not null default '{}',
  status       public.invite_status not null default 'pending',
  invited_by   uuid not null references public.profiles(user_id),
  token_hash   text not null,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(user_id),
  created_at   timestamptz not null default now()
);
create index organization_invites_org_idx on public.organization_invites (org_id);
create unique index organization_invites_pending_email_idx
  on public.organization_invites (org_id, lower(email))
  where status = 'pending';

alter table public.organization_invites enable row level security;
alter table public.organization_invites force row level security;

grant select, insert, update, delete on public.organization_invites to stratos_resolver;

create policy org_invites_admin_read on public.organization_invites for select using (
  (select public.is_platform_admin())
  or (
    org_id = (select public.current_user_org())
    and exists (
      select 1 from public.organization_members om
      where om.org_id = organization_invites.org_id
        and om.user_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  )
);

create policy org_invites_platform_all on public.organization_invites for all using (
  (select public.is_platform_admin())
) with check ((select public.is_platform_admin()));

-- ensure_profile: idempotent profile row for a Cognito identity.
create or replace function public.ensure_profile(p_email text, p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  insert into public.profiles (user_id, email, full_name, role)
  values (auth.uid(), coalesce(nullif(trim(p_email), ''), auth.uid()::text || '@unknown'), coalesce(nullif(trim(p_full_name), ''), null), 'viewer')
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
end $$;
grant execute on function public.ensure_profile(text, text) to stratos_resolver;

-- create_org_invite: owner/admin invites a user by email; returns raw token once.
create or replace function public.create_org_invite(
  p_email text,
  p_org_role public.org_role default 'member',
  p_location_ids uuid[] default '{}'
)
returns table(invite_id uuid, invite_token text) language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  if v_org is null then
    raise exception 'No active organization' using errcode = '42501';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email is required';
  end if;
  if not (select public.is_platform_admin()) and not exists (
    select 1 from public.organization_members
    where org_id = v_org and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Organization admin role required' using errcode = '42501';
  end if;

  if p_location_ids is not null and cardinality(p_location_ids) > 0 then
    if exists (
      select 1 from unnest(p_location_ids) lid(id)
      left join public.locations l on l.id = lid.id and l.organization_id = v_org
      where l.id is null
    ) then
      raise exception 'All locations must belong to the active organization';
    end if;
  end if;

  update public.organization_invites
     set status = 'revoked'
   where org_id = v_org and lower(email) = lower(trim(p_email)) and status = 'pending';

  insert into public.organization_invites (
    org_id, email, org_role, location_ids, invited_by, token_hash, expires_at
  ) values (
    v_org,
    lower(trim(p_email)),
    coalesce(p_org_role, 'member'),
    coalesce(p_location_ids, '{}'),
    auth.uid(),
    md5(v_token),
    now() + interval '14 days'
  )
  returning id into v_id;

  invite_id := v_id;
  invite_token := v_token;
  return next;
end $$;
grant execute on function public.create_org_invite(text, public.org_role, uuid[]) to stratos_resolver;

-- revoke_org_invite
create or replace function public.revoke_org_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
begin
  if not (select public.is_platform_admin()) and not exists (
    select 1 from public.organization_members
    where org_id = v_org and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Organization admin role required' using errcode = '42501';
  end if;
  update public.organization_invites
     set status = 'revoked'
   where id = p_invite_id
     and org_id = v_org
     and status = 'pending';
  if not found then
    raise exception 'Invite not found or not pending' using errcode = 'no_data_found';
  end if;
end $$;
grant execute on function public.revoke_org_invite(uuid) to stratos_resolver;

-- accept_org_invite: authenticated user accepts by token; materializes membership.
create or replace function public.accept_org_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.organization_invites%rowtype;
  v_loc uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if coalesce(trim(p_token), '') = '' then
    raise exception 'Invite token is required';
  end if;

  select email into v_email from public.profiles where user_id = v_user;

  select * into v_inv
  from public.organization_invites
  where token_hash = md5(trim(p_token))
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if v_inv.id is null then
    raise exception 'Invalid or expired invite' using errcode = '42501';
  end if;

  if lower(coalesce(v_email, '')) <> lower(v_inv.email) then
    raise exception 'Invite email does not match signed-in user' using errcode = '42501';
  end if;

  insert into public.profiles (user_id, email, role, active_org_id)
  values (v_user, v_inv.email, 'viewer', v_inv.org_id)
  on conflict (user_id) do update
    set active_org_id = coalesce(public.profiles.active_org_id, excluded.active_org_id),
        updated_at = now();

  insert into public.organization_members (org_id, user_id, role)
  values (v_inv.org_id, v_user, v_inv.org_role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  delete from public.user_location_grants
   where user_id = v_user and organization_id = v_inv.org_id;

  if v_inv.location_ids is not null and cardinality(v_inv.location_ids) > 0 then
    foreach v_loc in array v_inv.location_ids loop
      insert into public.user_location_grants (user_id, organization_id, location_id)
      values (v_user, v_inv.org_id, v_loc)
      on conflict do nothing;
    end loop;
  end if;

  update public.profiles set active_org_id = v_inv.org_id where user_id = v_user and active_org_id is null;

  update public.organization_invites
     set status = 'accepted', accepted_at = now(), accepted_by = v_user
   where id = v_inv.id;

  return v_inv.org_id;
end $$;
grant execute on function public.accept_org_invite(text) to stratos_resolver;

-- my_pending_invites: invitee reads pending invites for their profile email.
create or replace function public.my_pending_invites()
returns setof public.organization_invites language plpgsql stable security definer set search_path = public as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where user_id = auth.uid();
  if v_email is null then
    return;
  end if;
  return query
    select i.*
    from public.organization_invites i
    where lower(i.email) = lower(v_email)
      and i.status = 'pending'
      and i.expires_at > now()
    order by i.created_at desc;
end $$;
grant execute on function public.my_pending_invites() to stratos_resolver;

-- Members may always read their own membership rows (needed post-invite accept).
create policy org_members_self_read on public.organization_members for select using (
  user_id = (select auth.uid())
);
