-- Stratos — migration 008: Cognito post-confirmation user bootstrap.
--
-- Ensures a profile row exists and auto-accepts pending org invites for the
-- signup email. Called by the post-confirmation Lambda (DB master, no JWT).

create or replace function public.bootstrap_user_on_signup(
  p_user_id uuid,
  p_email text,
  p_full_name text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv public.organization_invites%rowtype;
  v_loc uuid;
  v_accepted uuid[] := '{}';
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'email is required';
  end if;

  insert into public.profiles (user_id, email, full_name, role)
  values (p_user_id, lower(trim(p_email)), nullif(trim(p_full_name), ''), 'viewer')
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();

  for v_inv in
    select *
    from public.organization_invites
    where lower(email) = lower(trim(p_email))
      and status = 'pending'
      and expires_at > now()
    order by created_at asc
  loop
    insert into public.organization_members (org_id, user_id, role)
    values (v_inv.org_id, p_user_id, v_inv.org_role)
    on conflict (org_id, user_id) do update set role = excluded.role;

    delete from public.user_location_grants
     where user_id = p_user_id and organization_id = v_inv.org_id;

    if v_inv.location_ids is not null and cardinality(v_inv.location_ids) > 0 then
      foreach v_loc in array v_inv.location_ids loop
        insert into public.user_location_grants (user_id, organization_id, location_id)
        values (p_user_id, v_inv.org_id, v_loc)
        on conflict do nothing;
      end loop;
    end if;

    update public.organization_invites
       set status = 'accepted', accepted_at = now(), accepted_by = p_user_id
     where id = v_inv.id;

    v_accepted := array_append(v_accepted, v_inv.org_id);
  end loop;

  if array_length(v_accepted, 1) >= 1 then
    update public.profiles
       set active_org_id = v_accepted[1]
     where user_id = p_user_id and active_org_id is null;
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'invites_accepted', coalesce(v_accepted, '{}')
  );
end $$;

grant execute on function public.bootstrap_user_on_signup(uuid, text, text) to stratos_resolver;
