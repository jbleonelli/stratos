-- Stratos claim-bridge proof — deterministic seed.
-- UUIDs are fixed and human-readable, and mirrored in fixtures.mjs. Keep the
-- two files in sync.
--
--   Orgs:      Alpha Property Group (alpha), Beta Facilities (beta)
--   Locations: Alpha Tower, Alpha Annex (alpha); Beta Plaza (beta)
--   Users:     alpha_admin  — org-wide (no grants)
--              alpha_scoped — grant to Alpha Tower only
--              beta_admin   — org-wide in Beta
--              platform     — platform_admin (claim-only, no rows needed)

insert into public.organizations (id, name, slug) values
  ('0a1a0a1a-0000-0000-0000-000000000001', 'Alpha Property Group', 'alpha'),
  ('0b1b0b1b-0000-0000-0000-000000000001', 'Beta Facilities',      'beta');

insert into public.locations (id, organization_id, name) values
  ('10c0a001-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', 'Alpha Tower'),
  ('10c0a001-0000-0000-0000-000000000002', '0a1a0a1a-0000-0000-0000-000000000001', 'Alpha Annex'),
  ('10c0b001-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', 'Beta Plaza');

-- alpha_scoped is confined to Alpha Tower. alpha_admin has NO grants → org-wide.
insert into public.user_location_grants (user_id, organization_id, location_id) values
  ('05e00a01-0000-0000-0000-000000000002', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000001');

insert into public.asks (id, organization_id, question) values
  ('a5c00a01-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', 'Alpha: reduce HVAC setpoint overnight?'),
  ('a5c00b01-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', 'Beta: extend cleaning window?');

insert into public.devices (id, organization_id, location_id, name) values
  ('de000a01-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000001', 'Alpha Tower Thermostat'),
  ('de000a01-0000-0000-0000-000000000002', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000002', 'Alpha Annex Thermostat'),
  ('de000b01-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', '10c0b001-0000-0000-0000-000000000001', 'Beta Plaza Thermostat');
