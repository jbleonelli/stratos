-- Stratos — migration 009: work orders (field tasks / tickets).

do $$ begin create type public.work_order_status as enum ('open','in_progress','done','cancelled'); exception when duplicate_object then null; end $$;

create table public.work_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id     uuid references public.locations(id) on delete set null,
  device_id       uuid references public.devices(id) on delete set null,
  contract_id     uuid references public.service_contracts(id) on delete set null,
  title           text not null,
  description     text,
  status          public.work_order_status not null default 'open',
  photo_url       text,
  created_by      uuid references public.profiles(user_id) on delete set null,
  assigned_to     uuid references public.profiles(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index work_orders_org_status_idx on public.work_orders (organization_id, status);

alter table public.work_orders enable row level security;
alter table public.work_orders force row level security;

grant select, insert, update, delete on public.work_orders to stratos_resolver;

create policy work_orders_read on public.work_orders for select using (
  (select public.is_platform_admin())
  or (
    organization_id = (select public.current_user_org())
    and (location_id is null or public.has_location_access(location_id) or public.has_contract_access(location_id))
  )
  or (location_id is not null and public.has_contract_access(location_id))
);

create policy work_orders_write on public.work_orders for all using (
  (select public.is_platform_admin())
  or (
    organization_id = (select public.current_user_org())
    and (location_id is null or public.has_location_access(location_id) or public.has_contract_access(location_id))
  )
  or (location_id is not null and public.has_contract_access(location_id))
) with check (
  (select public.is_platform_admin())
  or organization_id = (select public.current_user_org())
  or (location_id is not null and public.has_contract_access(location_id))
);

create or replace function public.create_work_order(
  p_title text,
  p_description text default null,
  p_location_id uuid default null,
  p_device_id uuid default null,
  p_contract_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
  v_id uuid;
begin
  if v_org is null then raise exception 'No active organization' using errcode = '42501'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Title is required'; end if;
  if p_location_id is not null and not public.has_location_access(p_location_id) and not public.has_contract_access(p_location_id) then
    raise exception 'No access to location' using errcode = '42501';
  end if;
  insert into public.work_orders (organization_id, location_id, device_id, contract_id, title, description, created_by)
  values (v_org, p_location_id, p_device_id, p_contract_id, trim(p_title), nullif(trim(p_description), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_work_order(text, text, uuid, uuid, uuid) to stratos_resolver;

create or replace function public.complete_work_order(p_work_order_id uuid, p_photo_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_user_org();
begin
  if v_org is null then raise exception 'No active organization' using errcode = '42501'; end if;
  update public.work_orders
     set status = 'done',
         photo_url = nullif(trim(p_photo_url), ''),
         completed_at = now()
   where id = p_work_order_id
     and status in ('open', 'in_progress')
     and (
       organization_id = v_org
       or (location_id is not null and public.has_contract_access(location_id))
     );
  if not found then
    raise exception 'Work order not found or already completed' using errcode = 'no_data_found';
  end if;
end $$;
grant execute on function public.complete_work_order(uuid, text) to stratos_resolver;
