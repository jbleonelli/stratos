-- Stratos — migration 004: org admins manage member location scope.
--
-- Org admins may read all grants in the active org (for the roster UI).
-- Writes go through set_member_location_grants — empty array means org-wide.

create policy grants_org_admin_read on public.user_location_grants for select using (
  (select public.is_platform_admin())
  or (
    organization_id = (select public.current_user_org())
    and exists (
      select 1 from public.organization_members om
      where om.org_id = organization_id
        and om.user_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  )
);

-- set_member_location_grants: replace a member's location scope in the active org.
-- An empty location list removes all grants → org-wide access per has_location_access().
create or replace function public.set_member_location_grants(p_user_id uuid, p_location_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
  v_actor_role public.org_role;
  v_bad uuid;
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

  if not exists (
    select 1 from public.organization_members
    where org_id = v_org and user_id = p_user_id
  ) then
    raise exception 'Member not found in organization' using errcode = 'no_data_found';
  end if;

  if p_location_ids is not null and cardinality(p_location_ids) > 0 then
    select l.id into v_bad
    from unnest(p_location_ids) as lid(id)
    left join public.locations l on l.id = lid.id and l.organization_id = v_org
    where l.id is null
    limit 1;
    if v_bad is not null then
      raise exception 'Location % is not in the active organization', v_bad;
    end if;
  end if;

  delete from public.user_location_grants
   where user_id = p_user_id and organization_id = v_org;

  if p_location_ids is not null and cardinality(p_location_ids) > 0 then
    insert into public.user_location_grants (user_id, organization_id, location_id)
    select p_user_id, v_org, unnest(p_location_ids)
    on conflict do nothing;
  end if;
end $$;
grant execute on function public.set_member_location_grants(uuid, uuid[]) to stratos_resolver;
