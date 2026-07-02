-- Stratos — migration 002: agent runtime system write paths + spend guard.
--
-- The agent runtime (EventBridge → SQS → worker Lambda / Step Functions) is a
-- SYSTEM actor, not a tenant user: it has no Cognito identity and no
-- request.jwt.claims. So its writes cannot go through the claim bridge +
-- stratos_resolver like the user-facing RPCs. Instead it calls the SECURITY
-- DEFINER functions below, which are OWNED by stratos_auth (the BYPASSRLS role
-- introduced in V1_baseline for resolve_login_claims). Each function scopes its
-- write to an explicit organization_id passed by the trusted runtime.
--
-- Load order: db/helpers/001_authz.sql → db/V1_baseline.sql → this file.

-- ── Per-org spend budget ────────────────────────────────────────────────────
-- Hourly Bedrock cost cap (cents). The spend guard reads this before any
-- LLM-backed decision; a breach short-circuits the run to 'skip'.
alter table public.organizations
  add column if not exists agent_hourly_budget_cents integer not null default 100;

-- stratos_auth owns the definer functions; it needs to read the budget/spend
-- and write the decision log + agent-raised asks (BYPASSRLS covers the row
-- policies, but table grants are still required).
-- SELECT is needed alongside INSERT because the definer functions use
-- `returning id` (RETURNING reads the row back).
grant select         on public.organizations to stratos_auth;
grant select, insert on public.agent_runs     to stratos_auth;
grant select, insert on public.asks           to stratos_auth;

-- ── Spend accounting ────────────────────────────────────────────────────────
-- Total agent cost (cents) for an org over a trailing window, from the log.
create or replace function public.agent_spend_cents(p_org uuid, p_window interval)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_cents), 0)::int
  from public.agent_runs
  where organization_id = p_org
    and created_at > now() - p_window;
$$;
alter function public.agent_spend_cents(uuid, interval) owner to stratos_auth;

-- Spend guard: would one more run of the given estimated cost stay within the
-- org's hourly budget? Unknown org → deny (fail closed).
create or replace function public.agent_run_allowed(p_org uuid, p_est_cost_cents integer default 0)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_budget integer;
  v_spent  integer;
begin
  select agent_hourly_budget_cents into v_budget
  from public.organizations where id = p_org;

  if v_budget is null then
    return false;
  end if;

  v_spent := public.agent_spend_cents(p_org, interval '1 hour');
  return (v_spent + greatest(coalesce(p_est_cost_cents, 0), 0)) <= v_budget;
end $$;
alter function public.agent_run_allowed(uuid, integer) owner to stratos_auth;

-- ── System write paths ──────────────────────────────────────────────────────
-- record_agent_run: append to the decision log for an explicit org.
create or replace function public.record_agent_run(
  p_org       uuid,
  p_event     uuid,
  p_decision  text,
  p_rationale text    default null,
  p_cost_cents integer default 0
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_org is null then
    raise exception 'organization_id is required';
  end if;
  if coalesce(p_decision, '') = '' then
    raise exception 'decision is required';
  end if;

  insert into public.agent_runs (organization_id, event_id, decision, rationale, cost_cents)
  values (p_org, p_event, p_decision, p_rationale, greatest(coalesce(p_cost_cents, 0), 0))
  returning id into v_id;
  return v_id;
end $$;
alter function public.record_agent_run(uuid, uuid, text, text, integer) owner to stratos_auth;

-- agent_raise_ask: the agent surfaces a question to operators. Distinct from the
-- user-facing raise_ask (which is claims-scoped); this scopes to an explicit org
-- and has no created_by (system-authored).
create or replace function public.agent_raise_ask(
  p_org      uuid,
  p_event    uuid,
  p_question text,
  p_location uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_org is null then
    raise exception 'organization_id is required';
  end if;
  if coalesce(trim(p_question), '') = '' then
    raise exception 'question is required';
  end if;

  insert into public.asks (organization_id, location_id, event_id, question)
  values (p_org, p_location, p_event, trim(p_question))
  returning id into v_id;
  return v_id;
end $$;
alter function public.agent_raise_ask(uuid, uuid, text, uuid) owner to stratos_auth;

-- ── Privilege boundary ──────────────────────────────────────────────────────
-- These are system paths: keep them off PUBLIC and off the tenant-facing
-- resolver role. The runtime connects as the DB master (current_user at
-- migration time), so grant execute there explicitly.
revoke all on function public.record_agent_run(uuid, uuid, text, text, integer) from public;
revoke all on function public.agent_raise_ask(uuid, uuid, text, uuid)           from public;
revoke all on function public.agent_run_allowed(uuid, integer)                  from public;
revoke all on function public.agent_spend_cents(uuid, interval)                 from public;

revoke execute on function public.record_agent_run(uuid, uuid, text, text, integer) from stratos_resolver;
revoke execute on function public.agent_raise_ask(uuid, uuid, text, uuid)           from stratos_resolver;
revoke execute on function public.agent_run_allowed(uuid, integer)                  from stratos_resolver;
revoke execute on function public.agent_spend_cents(uuid, interval)                 from stratos_resolver;

grant execute on function public.agent_spend_cents(uuid, interval)                 to current_user;
grant execute on function public.agent_run_allowed(uuid, integer)                  to current_user;
grant execute on function public.record_agent_run(uuid, uuid, text, text, integer) to current_user;
grant execute on function public.agent_raise_ask(uuid, uuid, text, uuid)           to current_user;
