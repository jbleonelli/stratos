-- Stratos — migration 006: service contracts + SLA rules + contractor access.

do $$ begin create type public.contract_status as enum ('draft','active','suspended','ended'); exception when duplicate_object then null; end $$;

create table public.service_contracts (
  id                uuid primary key default gen_random_uuid(),
  customer_org_id   uuid not null references public.organizations(id) on delete cascade,
  contractor_org_id uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  reference_code    text,
  status            public.contract_status not null default 'draft',
  starts_at         date,
  ends_at           date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (customer_org_id, reference_code)
);
create index service_contracts_customer_idx on public.service_contracts (customer_org_id);
create index service_contracts_contractor_idx on public.service_contracts (contractor_org_id);

create table public.contract_locations (
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key (contract_id, location_id)
);

create table public.contract_sla_rules (
  contract_id      uuid not null references public.service_contracts(id) on delete cascade,
  severity         public.event_severity not null,
  response_minutes int not null check (response_minutes > 0),
  primary key (contract_id, severity)
);

create table public.contract_assignments (
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  primary key (contract_id, user_id)
);

create trigger service_contracts_touch before update on public.service_contracts
  for each row execute function public.tg_touch_updated_at();

alter table public.service_contracts enable row level security;
alter table public.contract_locations enable row level security;
alter table public.contract_sla_rules enable row level security;
alter table public.contract_assignments enable row level security;

alter table public.service_contracts force row level security;
alter table public.contract_locations force row level security;
alter table public.contract_sla_rules force row level security;
alter table public.contract_assignments force row level security;

grant select, insert, update, delete on public.service_contracts to stratos_resolver;
grant select, insert, update, delete on public.contract_locations to stratos_resolver;
grant select, insert, update, delete on public.contract_sla_rules to stratos_resolver;
grant select, insert, update, delete on public.contract_assignments to stratos_resolver;

-- Org-scoped read policies (assignment filtering lives in the resolver query).
create policy service_contracts_read on public.service_contracts for select using (
  (select public.is_platform_admin())
  or customer_org_id = (select public.current_user_org())
  or contractor_org_id = (select public.current_user_org())
);

create policy service_contracts_platform_all on public.service_contracts for all using (
  (select public.is_platform_admin())
) with check ((select public.is_platform_admin()));

create policy contract_locations_read on public.contract_locations for select using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.service_contracts sc
    where sc.id = contract_id
      and (
        sc.customer_org_id = (select public.current_user_org())
        or sc.contractor_org_id = (select public.current_user_org())
      )
  )
);

create policy contract_sla_read on public.contract_sla_rules for select using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.service_contracts sc
    where sc.id = contract_id
      and (
        sc.customer_org_id = (select public.current_user_org())
        or sc.contractor_org_id = (select public.current_user_org())
      )
  )
);

create policy contract_assignments_read on public.contract_assignments for select using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.service_contracts sc
    where sc.id = contract_id
      and (
        sc.customer_org_id = (select public.current_user_org())
        or sc.contractor_org_id = (select public.current_user_org())
      )
  )
);

-- Peer org names on contracts: members may read the counterparty organization row.
create policy organizations_contract_peer_read on public.organizations for select using (
  (select public.is_platform_admin())
  or id = (select public.current_user_org())
  or exists (
    select 1 from public.service_contracts sc
    where (
        (sc.customer_org_id = (select public.current_user_org()) and sc.contractor_org_id = organizations.id)
        or (sc.contractor_org_id = (select public.current_user_org()) and sc.customer_org_id = organizations.id)
      )
  )
);

-- has_contract_access: contractor cross-tenant read path for covered locations.
create or replace function public.has_contract_access(p_location_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_location_id is null then return false; end if;
  if public.is_platform_admin() then return true; end if;

  if exists (
    select 1 from public.locations l
    where l.id = p_location_id
      and l.organization_id = public.current_user_org()
      and public.has_location_access(l.id)
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.service_contracts sc
    join public.contract_locations cl on cl.contract_id = sc.id
    join public.contract_assignments ca on ca.contract_id = sc.id
    where sc.status = 'active'
      and ca.user_id = auth.uid()
      and sc.contractor_org_id = public.current_user_org()
      and cl.location_id = p_location_id
  );
end $$;

-- create_service_contract: customer org admin creates a contract with a contractor org.
create or replace function public.create_service_contract(
  p_contractor_org_id uuid,
  p_name text,
  p_reference_code text default null,
  p_location_ids uuid[] default '{}',
  p_sla_rules jsonb default '[]'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := current_user_org();
  v_id uuid;
  v_rule jsonb;
  v_loc uuid;
begin
  if v_customer is null then
    raise exception 'No active organization' using errcode = '42501';
  end if;
  if not (select public.is_platform_admin()) and not exists (
    select 1 from public.organization_members
    where org_id = v_customer and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Organization admin role required' using errcode = '42501';
  end if;
  if p_contractor_org_id is null or p_contractor_org_id = v_customer then
    raise exception 'A distinct contractor organization is required';
  end if;
  if not exists (select 1 from public.organizations where id = p_contractor_org_id and kind = 'contractor') then
    raise exception 'Contractor organization not found';
  end if;
  if p_location_ids is null or cardinality(p_location_ids) = 0 then
    raise exception 'At least one location is required';
  end if;
  if exists (
    select 1 from unnest(p_location_ids) lid(id)
    left join public.locations l on l.id = lid.id and l.organization_id = v_customer
    where l.id is null
  ) then
    raise exception 'All locations must belong to the customer organization';
  end if;

  insert into public.service_contracts (customer_org_id, contractor_org_id, name, reference_code, status)
  values (v_customer, p_contractor_org_id, trim(p_name), nullif(trim(p_reference_code), ''), 'draft')
  returning id into v_id;

  foreach v_loc in array p_location_ids loop
    insert into public.contract_locations (contract_id, location_id) values (v_id, v_loc);
  end loop;

  if p_sla_rules is not null then
    for v_rule in select * from jsonb_array_elements(p_sla_rules) loop
      insert into public.contract_sla_rules (contract_id, severity, response_minutes)
      values (
        v_id,
        (v_rule->>'severity')::public.event_severity,
        (v_rule->>'responseMinutes')::int
      );
    end loop;
  end if;

  return v_id;
end $$;
grant execute on function public.create_service_contract(uuid, text, text, uuid[], jsonb) to stratos_resolver;

create or replace function public.update_contract_status(p_contract_id uuid, p_status public.contract_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := current_user_org();
begin
  if not (select public.is_platform_admin()) and not exists (
    select 1 from public.organization_members
    where org_id = v_customer and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Organization admin role required' using errcode = '42501';
  end if;
  update public.service_contracts
     set status = p_status, updated_at = now()
   where id = p_contract_id and customer_org_id = v_customer;
  if not found then
    raise exception 'Contract not found' using errcode = 'no_data_found';
  end if;
end $$;
grant execute on function public.update_contract_status(uuid, public.contract_status) to stratos_resolver;

create or replace function public.assign_contract_member(p_contract_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := current_user_org();
  v_contractor uuid;
begin
  if not (select public.is_platform_admin()) and not exists (
    select 1 from public.organization_members
    where org_id = v_customer and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Organization admin role required' using errcode = '42501';
  end if;

  select contractor_org_id into v_contractor
  from public.service_contracts
  where id = p_contract_id and customer_org_id = v_customer;
  if v_contractor is null then
    raise exception 'Contract not found' using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.organization_members
    where org_id = v_contractor and user_id = p_user_id
  ) then
    raise exception 'User must be a member of the contractor organization';
  end if;

  insert into public.contract_assignments (contract_id, user_id)
  values (p_contract_id, p_user_id)
  on conflict do nothing;

  update public.profiles set role = 'contractor' where user_id = p_user_id and role = 'viewer';
end $$;
grant execute on function public.assign_contract_member(uuid, uuid) to stratos_resolver;

-- list_contractor_organizations: customer admins pick a contractor when creating contracts.
create or replace function public.list_contractor_organizations()
returns setof public.organizations language sql stable security definer set search_path = public as $$
  select * from public.organizations
  where kind = 'contractor' and lifecycle_state <> 'deleted'
  order by name;
$$;
grant execute on function public.list_contractor_organizations() to stratos_resolver;
