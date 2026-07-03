-- Stratos — migration 003: org admin read paths + write RPCs.
--
-- Lets org admins list the roster (emails/names via a profiles policy) and
-- rename the org or change member roles through SECURITY DEFINER RPCs scoped
-- to current_user_org().

-- Org roster: members of the active org may read fellow members' profiles.
create policy profiles_org_roster_read on public.profiles for select using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om_self
    join public.organization_members om_peer
      on om_peer.org_id = om_self.org_id and om_peer.user_id = profiles.user_id
    where om_self.user_id = (select auth.uid())
      and om_self.org_id = (select public.current_user_org())
  )
);

-- update_org_name: owner/admin (or platform admin) renames the active org.
create or replace function public.update_org_name(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
begin
  if v_org is null then
    raise exception 'No active organization' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Organization name is required';
  end if;
  if not (select public.is_platform_admin()) and not exists (
    select 1 from public.organization_members
    where org_id = v_org and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Organization admin role required' using errcode = '42501';
  end if;
  update public.organizations set name = trim(p_name), updated_at = now() where id = v_org;
end $$;
grant execute on function public.update_org_name(text) to stratos_resolver;

-- update_member_role: owner/admin adjusts a member's org_role in the active org.
create or replace function public.update_member_role(p_user_id uuid, p_role public.org_role)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
  v_actor_role public.org_role;
  v_target_role public.org_role;
begin
  if v_org is null then
    raise exception 'No active organization' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if (select public.is_platform_admin()) then
    v_actor_role := 'owner';
  else
    select role into v_actor_role
    from public.organization_members
    where org_id = v_org and user_id = auth.uid();
    if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
      raise exception 'Organization admin role required' using errcode = '42501';
    end if;
  end if;

  select role into v_target_role
  from public.organization_members
  where org_id = v_org and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'Member not found in organization' using errcode = 'no_data_found';
  end if;

  if p_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'Only an owner may assign the owner role' using errcode = '42501';
  end if;
  if v_target_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'Only an owner may change an owner' using errcode = '42501';
  end if;

  if v_target_role = 'owner' and p_role <> 'owner' then
    if (select count(*) from public.organization_members where org_id = v_org and role = 'owner') <= 1 then
      raise exception 'Cannot remove the last owner';
    end if;
  end if;

  update public.organization_members
     set role = p_role
   where org_id = v_org and user_id = p_user_id;
end $$;
grant execute on function public.update_member_role(uuid, public.org_role) to stratos_resolver;
