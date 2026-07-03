-- Stratos — migration 010: floor-plan assets + device placement for hypervisor v2.

alter table public.locations
  add column if not exists floor_plan_url text,
  add column if not exists floor_elevation double precision default 0;

alter table public.devices
  add column if not exists position_x double precision,
  add column if not exists position_y double precision;
