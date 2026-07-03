-- ✅ APPLIED as migration 258 (2026-06-21, PR #987). Kept here as the review artifact.
-- Post-audit hardening, phase 2 (follow-up to mig 257).
--
-- ── VALIDATION (2026-06-21, against prod read-only) ──
-- v1 of this draft used `REVOKE … FROM PUBLIC`. The grant-matrix check revealed
-- that was a NO-OP: all 37 authenticated-only target functions hold a DIRECT
-- `anon` grant (created via `GRANT … TO anon, authenticated`), not a PUBLIC one.
-- Corrected below to `REVOKE … FROM anon, public`. After that, anon has no
-- remaining execute path (anon is not a member of any other role), so this
-- deterministically removes anon-executability — verified at the privilege level
-- without a branch (a branch built from the same migrations would carry the same
-- direct grants and not have surfaced it).
--
-- Classification of the 100 non-trigger SECURITY DEFINER functions:
--   • 19 POLICY HELPERS (current_user_org, is_platform_admin, has_location_access,
--     can_write_*, …) — called INSIDE RLS policies; revoking from anon/authenticated
--     makes every org-scoped query fail → TOTAL OUTAGE. ❌ NOT TOUCHED.
--   • 48 CLIENT RPCs — this file. 37 → authenticated-only; 11 → keep anon (public).
--   • 33 INTERNAL-ONLY (cron/replay/order/webhook) — a further phase.
--
-- STILL NEEDS an app-flow check before applying (privilege matrix is verified;
-- the open question is whether any of these is called PRE-AUTH):
--   1. Public device viewer (/device/<id>) — *_for_viewer + building_sensor_readings
--      + get_replay_incidents (kept anon below — confirm that set is complete).
--   2. Login branding (get_effective_branding), signup (self_serve_create_org,
--      accept_invite) — kept anon below.
--   3. ⚠️ current_platform_role / count_data_sources — moved to authenticated-only;
--      confirm the client never calls them while signed out (session bootstrap).
--   4. Platform admin console (platform_*/reseller_*) + contractor/worker flows.

-- ── authenticated-only: remove the direct anon grant (and any PUBLIC) ──
revoke execute on function public.accept_sla(p_sla_id text) from anon, public;
grant  execute on function public.accept_sla(p_sla_id text) to authenticated;
revoke execute on function public.accept_source_catalog(p_id text) from anon, public;
grant  execute on function public.accept_source_catalog(p_id text) to authenticated;
revoke execute on function public.contractor_dispatch(p_line text, p_title text, p_detail text) from anon, public;
grant  execute on function public.contractor_dispatch(p_line text, p_title text, p_detail text) to authenticated;
revoke execute on function public.count_data_sources(p_org_id uuid, p_building_id text) from anon, public;
grant  execute on function public.count_data_sources(p_org_id uuid, p_building_id text) to authenticated;
revoke execute on function public.current_platform_role() from anon, public;
grant  execute on function public.current_platform_role() to authenticated;
revoke execute on function public.delete_merlin_config(p_org_id uuid, p_location_id text, p_section text) from anon, public;
grant  execute on function public.delete_merlin_config(p_org_id uuid, p_location_id text, p_section text) to authenticated;
revoke execute on function public.demo_fulfill_order(p_order_id uuid) from anon, public;
grant  execute on function public.demo_fulfill_order(p_order_id uuid) to authenticated;
revoke execute on function public.install_inventory_device(p_inventory_id uuid, p_location_id text, p_device_name text) from anon, public;
grant  execute on function public.install_inventory_device(p_inventory_id uuid, p_location_id text, p_device_name text) to authenticated;
revoke execute on function public.platform_ad_create(p_id text, p_name text, p_spec text, p_pitch text, p_bullets jsonb, p_chat_prompt text, p_illustration_key text, p_image_url text, p_position integer, p_active boolean) from anon, public;
grant  execute on function public.platform_ad_create(p_id text, p_name text, p_spec text, p_pitch text, p_bullets jsonb, p_chat_prompt text, p_illustration_key text, p_image_url text, p_position integer, p_active boolean) to authenticated;
revoke execute on function public.platform_ad_delete(p_id text) from anon, public;
grant  execute on function public.platform_ad_delete(p_id text) to authenticated;
revoke execute on function public.platform_ad_set_active(p_id text, p_active boolean) from anon, public;
grant  execute on function public.platform_ad_set_active(p_id text, p_active boolean) to authenticated;
revoke execute on function public.platform_ad_update(p_id text, p_name text, p_spec text, p_pitch text, p_bullets jsonb, p_chat_prompt text, p_illustration_key text, p_image_url text, p_position integer, p_active boolean) from anon, public;
grant  execute on function public.platform_ad_update(p_id text, p_name text, p_spec text, p_pitch text, p_bullets jsonb, p_chat_prompt text, p_illustration_key text, p_image_url text, p_position integer, p_active boolean) to authenticated;
revoke execute on function public.platform_create_tenant(p_name text, p_slug text, p_kind text, p_primary_contact_email text, p_owner_email text) from anon, public;
grant  execute on function public.platform_create_tenant(p_name text, p_slug text, p_kind text, p_primary_contact_email text, p_owner_email text) to authenticated;
revoke execute on function public.platform_impersonate_end() from anon, public;
grant  execute on function public.platform_impersonate_end() to authenticated;
revoke execute on function public.platform_impersonate_start(p_org_id uuid) from anon, public;
grant  execute on function public.platform_impersonate_start(p_org_id uuid) to authenticated;
revoke execute on function public.platform_remove_member(p_org_id uuid, p_user_id uuid) from anon, public;
grant  execute on function public.platform_remove_member(p_org_id uuid, p_user_id uuid) to authenticated;
revoke execute on function public.platform_set_member_role(p_org_id uuid, p_user_id uuid, p_role text) from anon, public;
grant  execute on function public.platform_set_member_role(p_org_id uuid, p_user_id uuid, p_role text) to authenticated;
revoke execute on function public.platform_soft_delete_tenant(p_org_id uuid) from anon, public;
grant  execute on function public.platform_soft_delete_tenant(p_org_id uuid) to authenticated;
revoke execute on function public.platform_suspend_tenant(p_org_id uuid, p_reason text) from anon, public;
grant  execute on function public.platform_suspend_tenant(p_org_id uuid, p_reason text) to authenticated;
revoke execute on function public.platform_unsuspend_tenant(p_org_id uuid) from anon, public;
grant  execute on function public.platform_unsuspend_tenant(p_org_id uuid) to authenticated;
revoke execute on function public.platform_update_member_profile(p_user_id uuid, p_patch jsonb) from anon, public;
grant  execute on function public.platform_update_member_profile(p_user_id uuid, p_patch jsonb) to authenticated;
revoke execute on function public.platform_update_tenant_contact(p_org_id uuid, p_primary_contact_email text) from anon, public;
grant  execute on function public.platform_update_tenant_contact(p_org_id uuid, p_primary_contact_email text) to authenticated;
revoke execute on function public.platform_update_tenant_plan(p_org_id uuid, p_plan text) from anon, public;
grant  execute on function public.platform_update_tenant_plan(p_org_id uuid, p_plan text) to authenticated;
revoke execute on function public.platform_update_tenant_slug(p_org_id uuid, p_slug text) from anon, public;
grant  execute on function public.platform_update_tenant_slug(p_org_id uuid, p_slug text) to authenticated;
revoke execute on function public.reseller_release_child(p_child_org uuid) from anon, public;
grant  execute on function public.reseller_release_child(p_child_org uuid) to authenticated;
revoke execute on function public.reseller_update_child_plan(p_child_org uuid, p_plan text) from anon, public;
grant  execute on function public.reseller_update_child_plan(p_child_org uuid, p_plan text) to authenticated;
revoke execute on function public.servicing_resolve_item(p_domain text, p_item text) from anon, public;
grant  execute on function public.servicing_resolve_item(p_domain text, p_item text) to authenticated;
revoke execute on function public.set_building_setup(p_location_id text, p_patch jsonb) from anon, public;
grant  execute on function public.set_building_setup(p_location_id text, p_patch jsonb) to authenticated;
revoke execute on function public.set_contract_costs(p_contract_id uuid, p_crew_count integer, p_hourly_rate numeric, p_hours_per_week numeric, p_supplies_monthly numeric, p_currency text) from anon, public;
grant  execute on function public.set_contract_costs(p_contract_id uuid, p_crew_count integer, p_hourly_rate numeric, p_hours_per_week numeric, p_supplies_monthly numeric, p_currency text) to authenticated;
revoke execute on function public.set_contract_penalty(p_contract_id uuid, p_floor_pct numeric, p_rate_pct numeric, p_cap_pct numeric, p_escalation_pct numeric) from anon, public;
grant  execute on function public.set_contract_penalty(p_contract_id uuid, p_floor_pct numeric, p_rate_pct numeric, p_cap_pct numeric, p_escalation_pct numeric) to authenticated;
revoke execute on function public.set_contractor_alert_threshold(p_threshold_pct integer, p_lead_days integer, p_enabled boolean) from anon, public;
grant  execute on function public.set_contractor_alert_threshold(p_threshold_pct integer, p_lead_days integer, p_enabled boolean) to authenticated;
revoke execute on function public.set_merlin_config(p_org_id uuid, p_location_id text, p_section text, p_value jsonb) from anon, public;
grant  execute on function public.set_merlin_config(p_org_id uuid, p_location_id text, p_section text, p_value jsonb) to authenticated;
revoke execute on function public.set_servicing_sla_target(p_domain text, p_hours numeric) from anon, public;
grant  execute on function public.set_servicing_sla_target(p_domain text, p_hours numeric) to authenticated;
revoke execute on function public.set_suggestion_decision(p_id uuid, p_status text) from anon, public;
grant  execute on function public.set_suggestion_decision(p_id uuid, p_status text) to authenticated;
revoke execute on function public.set_suggestion_status(p_id uuid, p_status text) from anon, public;
grant  execute on function public.set_suggestion_status(p_id uuid, p_status text) to authenticated;
revoke execute on function public.set_target_visibility(p_sla_id text, p_visibility text) from anon, public;
grant  execute on function public.set_target_visibility(p_sla_id text, p_visibility text) to authenticated;
revoke execute on function public.worker_complete_route_task(p_route_task_id uuid) from anon, public;
grant  execute on function public.worker_complete_route_task(p_route_task_id uuid) to authenticated;

-- ── keep anon (genuinely public / pre-auth surfaces) — normalize off PUBLIC ──
revoke execute on function public.accept_invite(invite_token uuid) from public;
grant  execute on function public.accept_invite(invite_token uuid) to authenticated, anon;
revoke execute on function public.building_sensor_readings(p_building text, p_metric text) from public;
grant  execute on function public.building_sensor_readings(p_building text, p_metric text) to authenticated, anon;
revoke execute on function public.derive_sla_source_health(p_org_id uuid) from public;
grant  execute on function public.derive_sla_source_health(p_org_id uuid) to authenticated, anon;
revoke execute on function public.equipment_reliability_for_viewer(p_building text) from public;
grant  execute on function public.equipment_reliability_for_viewer(p_building text) to authenticated, anon;
revoke execute on function public.get_effective_branding(p_org_id uuid) from public;
grant  execute on function public.get_effective_branding(p_org_id uuid) to authenticated, anon;
revoke execute on function public.get_replay_incidents(p_org_id uuid, p_limit integer) from public;
grant  execute on function public.get_replay_incidents(p_org_id uuid, p_limit integer) to authenticated, anon;
revoke execute on function public.restroom_state_for_viewer(p_building_id text) from public;
grant  execute on function public.restroom_state_for_viewer(p_building_id text) to authenticated, anon;
revoke execute on function public.self_serve_create_org(p_company_name text, p_plan text, p_audience text) from public;
grant  execute on function public.self_serve_create_org(p_company_name text, p_plan text, p_audience text) to authenticated, anon;
revoke execute on function public.servicing_open_items_for_viewer(p_building_id text) from public;
grant  execute on function public.servicing_open_items_for_viewer(p_building_id text) to authenticated, anon;
revoke execute on function public.servicing_rollup_for_viewer(p_building_id text) from public;
grant  execute on function public.servicing_rollup_for_viewer(p_building_id text) to authenticated, anon;
revoke execute on function public.servicing_state_for_viewer(p_building_id text, p_domain text) from public;
grant  execute on function public.servicing_state_for_viewer(p_building_id text, p_domain text) to authenticated, anon;
