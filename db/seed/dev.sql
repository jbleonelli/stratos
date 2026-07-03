-- Stratos — deterministic dev/demo/test seed for the V1 baseline.
-- Fixed, human-readable UUIDs, mirrored in db/proof/fixtures.mjs. Keep in sync.
-- Load order: db/helpers/001_authz.sql → db/V1_baseline.sql → this file.
--
--   Orgs:      Alpha Property Group (customer), Beta Facilities (customer),
--              Adaptiv (platform)
--   Users:     alpha_admin  — owner, org-wide (no location grants)
--              alpha_scoped — worker, granted Alpha Tower only
--              beta_admin   — owner, org-wide in Beta
--              contractor   — Swift HVAC tech, assigned Alpha Tower contract
--              platform     — Adaptiv staff (platform admin via claim)

insert into public.organizations (id, name, slug, kind, lifecycle_state) values
  ('0a1a0a1a-0000-0000-0000-000000000001', 'Alpha Property Group', 'alpha',   'customer',   'active'),
  ('0b1b0b1b-0000-0000-0000-000000000001', 'Beta Facilities',      'beta',    'customer',   'active'),
  ('0c1c0c1c-0000-0000-0000-000000000001', 'Swift HVAC Services',  'swift',   'contractor', 'active'),
  ('0f0f0f0f-0000-0000-0000-000000000001', 'Adaptiv',              'adaptiv', 'platform',   'active');

insert into public.profiles (user_id, email, full_name, role, active_org_id) values
  ('05e00a01-0000-0000-0000-000000000001', 'admin@alpha.example',   'Alpha Admin',    'owner',      '0a1a0a1a-0000-0000-0000-000000000001'),
  ('05e00a01-0000-0000-0000-000000000002', 'worker@alpha.example',  'Alpha Worker',   'worker',     '0a1a0a1a-0000-0000-0000-000000000001'),
  ('05e00b01-0000-0000-0000-000000000001', 'admin@beta.example',    'Beta Admin',     'owner',      '0b1b0b1b-0000-0000-0000-000000000001'),
  ('05e00c01-0000-0000-0000-000000000001', 'tech@swift.example',    'Swift Tech',     'contractor', '0c1c0c1c-0000-0000-0000-000000000001'),
  ('05e0f001-0000-0000-0000-000000000001', 'staff@adaptiv.example', 'Platform Staff', 'owner',      '0f0f0f0f-0000-0000-0000-000000000001');

insert into public.organization_members (org_id, user_id, role) values
  ('0a1a0a1a-0000-0000-0000-000000000001', '05e00a01-0000-0000-0000-000000000001', 'owner'),
  ('0a1a0a1a-0000-0000-0000-000000000001', '05e00a01-0000-0000-0000-000000000002', 'member'),
  ('0b1b0b1b-0000-0000-0000-000000000001', '05e00b01-0000-0000-0000-000000000001', 'owner'),
  ('0c1c0c1c-0000-0000-0000-000000000001', '05e00c01-0000-0000-0000-000000000001', 'member'),
  ('0f0f0f0f-0000-0000-0000-000000000001', '05e0f001-0000-0000-0000-000000000001', 'owner');

insert into public.locations (id, organization_id, name, kind, latitude, longitude) values
  ('10c0a001-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', 'Alpha Tower', 'building', 48.8566, 2.3522),
  ('10c0a001-0000-0000-0000-000000000002', '0a1a0a1a-0000-0000-0000-000000000001', 'Alpha Annex', 'building', 48.8580, 2.3540),
  ('10c0b001-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', 'Beta Plaza',  'building', 48.8738, 2.2950);

-- alpha_scoped is confined to Alpha Tower; alpha_admin has NO grants → org-wide.
insert into public.user_location_grants (user_id, organization_id, location_id) values
  ('05e00a01-0000-0000-0000-000000000002', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000001');

insert into public.devices (id, organization_id, location_id, name, external_id) values
  ('de000a01-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000001', 'Alpha Tower Thermostat', 'alpha-tower-t1'),
  ('de000a01-0000-0000-0000-000000000002', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000002', 'Alpha Annex Thermostat', 'alpha-annex-t1'),
  ('de000b01-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', '10c0b001-0000-0000-0000-000000000001', 'Beta Plaza Thermostat',  'beta-plaza-t1');

insert into public.events (id, organization_id, location_id, device_id, kind, severity, external_id, payload) values
  ('e5e00a01-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000001', 'de000a01-0000-0000-0000-000000000001', 'device_alert', 'warning',  'alpha-evt-1', '{"temp_c": 26.5}'),
  ('e5e00a02-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000002', 'de000a01-0000-0000-0000-000000000002', 'device_alert', 'critical', 'alpha-evt-2', '{"temp_c": 31.2}'),
  ('e5e00b01-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', '10c0b001-0000-0000-0000-000000000001', 'de000b01-0000-0000-0000-000000000001', 'device_alert', 'info',    'beta-evt-1',  '{"temp_c": 21.0}');

insert into public.asks (id, organization_id, location_id, event_id, question, status) values
  ('a5c00a01-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000001', 'e5e00a01-0000-0000-0000-000000000001', 'Alpha Tower is warm — lower the setpoint overnight?', 'open'),
  ('a5c00b01-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', '10c0b001-0000-0000-0000-000000000001', 'e5e00b01-0000-0000-0000-000000000001', 'Beta Plaza cleaning window — extend by an hour?',      'open');

-- Agent decision log
insert into public.agent_runs (id, organization_id, event_id, decision, rationale, cost_cents) values
  ('a5000a01-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', 'e5e00a01-0000-0000-0000-000000000001', 'ask',  'Temperature elevated — surfaced a question for the operator.', 2),
  ('a5000b01-0000-0000-0000-000000000001', '0b1b0b1b-0000-0000-0000-000000000001', 'e5e00b01-0000-0000-0000-000000000001', 'skip', 'Within normal operating range — no action needed.', 0);

-- Service contract: Alpha Tower HVAC maintenance → Swift HVAC
insert into public.service_contracts (id, customer_org_id, contractor_org_id, name, reference_code, status, starts_at) values
  ('5c000a01-0000-0000-0000-000000000001', '0a1a0a1a-0000-0000-0000-000000000001', '0c1c0c1c-0000-0000-0000-000000000001', 'Alpha Tower HVAC', 'ALPHA-HVAC-01', 'active', current_date);

insert into public.contract_locations (contract_id, location_id) values
  ('5c000a01-0000-0000-0000-000000000001', '10c0a001-0000-0000-0000-000000000001');

insert into public.contract_sla_rules (contract_id, severity, response_minutes) values
  ('5c000a01-0000-0000-0000-000000000001', 'critical', 60),
  ('5c000a01-0000-0000-0000-000000000001', 'warning', 240);

insert into public.contract_assignments (contract_id, user_id) values
  ('5c000a01-0000-0000-0000-000000000001', '05e00c01-0000-0000-0000-000000000001');
