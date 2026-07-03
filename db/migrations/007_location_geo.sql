-- Stratos — migration 007: geo coordinates for map / hypervisor views.

alter table public.locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
