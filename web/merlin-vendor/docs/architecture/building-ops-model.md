# Building operations model

**Status:** shipped (Tracks G-1 through G-4) + post-shipping cleanup (migration 068 retired the `demo` org kind). Tracks H (DB-backed devices) and J (tweaks persistence + auto-pick) build on top. Subsequently extended with **multi-building tenants** (migrations 104-112: Meridian gained MDE + MHC) and **ecosystem variant flavoring** (migrations 117-125: IMF added with `variant='imf'`).
**Track:** G — multi-org ops model
**Author:** JB + Claude, drafted from the 2026-04-23 discussion; refreshed 2026-05-17 to reflect the multi-building Meridian + IMF + Stripe LIVE + 8-org tenancy.

> **What shipped vs what's in this doc:** the schema + persona split below all landed through migrations 025–028 and `src/app/personas.js`. Migration 068 later dropped the `demo` org kind, so the live `organizations.kind` CHECK is now `('real_estate', 'contractor', 'adaptiv')`. The design is complete and the system runs against it; this doc stays as the architectural reference. Companion docs:
>
> - [user-types.md](../user-types.md) — persona catalog with access grid
> - [roles.md](../roles.md) — engineering reference for roles + filters + auth gates
> - [deferred.md](../deferred.md) — what was cut from the initial rollout

## Why this exists

Merlin's current data model assumes a building is operated by a single organization that employs everyone on site. Real building operations don't work that way. Ownership, management, and labor are almost always three separate commercial relationships, each with its own legal contract, SLA, and login needs. The current model collapses all three into one `organizations` row, which means:

- There's no way to model a facility manager who runs buildings on behalf of a property owner.
- "Contractor" has no existence in the schema even though most cleaning / maintenance / security work is done by outside firms under contract.
- A contractor manager signing in today would see the property's full workspace — agentic config, other contractors' routes, everything — instead of the contracts they hold and the SLAs attached to them.
- Routes carry SLAs, but in practice SLAs attach to _contracts_, which cover sets of routes.
- A route says "visit these zones" but has no model for the tasks that happen at each zone, their own cadences, or their own SLAs (monthly window cleaning inside the weekly restroom sweep).

This doc proposes a schema + UX refactor that lets Merlin model the real commercial fabric of building ops before we seed five scenarios against the wrong model.

---

## The real-world hierarchy

```
Property Owner
 └─ hires ─→ Facility Management (in-house OR external firm)
                   └─ contracts with ─→ Cleaning Contractor
                   └─ contracts with ─→ Maintenance Contractor
                   └─ contracts with ─→ Security Contractor
                                              └─ crew (workers)
```

**Property Owner** — holds the real estate. REIT, corporate, individual landlord. Rarely operates day-to-day. Cares about: asset value, occupancy, operating cost, risk exposure.

**Facility Management** — hired (or in-house) to run the building day-to-day. Signs contracts with service firms. Holds the agentic configuration, sets policy, reviews contractor compliance. Cares about: SLA adherence across contractors, tenant satisfaction, incident response.

**Contractors** — the companies doing the actual work. Cleaning, HVAC, electrical, plumbing, security, landscaping, waste, pest. Each has a contract covering specific locations, services, SLAs, and duration. Cares about: meeting SLA to retain contract, crew scheduling, profitability per contract.

**Workers / crew** — individuals on the ground. Employees of a contractor (or in-house staff of an FM). May or may not have Merlin logins — a lead custodian probably does; a temp cleaning worker might not.

### Collapsed cases

Not every scenario has all three tiers separate. Common collapses:

- **Small property, self-managed:** owner = manager (one org, one role)
- **Corporate HQ:** property owner has an in-house facilities team (FM is a subsidiary or a function, not a separate company)
- **Mid-market:** property owner + external FM firm, FM holds all contractor contracts
- **Large portfolio:** property owner, external FM, dozens of service contractors

The schema has to handle all of these without branching.

---

## Current model: what's wrong

| Layer                  | Current                                        | Problem                                                                                                                                |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations          | One kind, with a name/slug                     | Can't distinguish a property co. from a cleaning co. — UX can't adapt                                                                  |
| Locations              | Belong to one organization                     | No way to express "Owner X hired FM Y to run this building"                                                                            |
| Routes                 | Carry location + SLA + service type            | Routes effectively DO model contracts (service_type + SLA) but implicitly; can't attach multiple routes to one SLA or one contract     |
| Role (`profiles.role`) | `facility / cleaning / maintenance / security` | Conflates job function with org type. Everyone at Maple Cleaning does cleaning; role doesn't say whether they're a manager or a worker |
| Tasks                  | Don't exist                                    | Route zone lists can't carry "clean windows monthly" alongside "mop daily"                                                             |

---

## Proposed model

Six concepts, three of them new:

### 1. Organizations gain a `kind`

Originally shipped as a 4-value enum. Migration 068 dropped `demo` once the sandbox UX was retired, so the live constraint is:

```sql
alter table organizations
  add column kind text not null default 'real_estate'
  check (kind in ('real_estate', 'contractor', 'adaptiv'));
```

- **`real_estate`** — property owners + facility management orgs. Holds buildings, runs operations, hires contractors. The distinction between property owner and facility manager is about _which locations they own vs manage_ (see §2), not a different org kind.
- **`contractor`** — service firms. Holds contracts with real-estate orgs. Has workers on its roster. Does not own or directly manage locations.
- **`adaptiv`** — the Adaptiv Systems platform org. Membership in any org with `kind='adaptiv'` is what `is_platform_admin()` checks; that gate unlocks `/platform`.

The retired `demo` kind was used by a "load a sandbox workspace" flow that's no longer offered as user-visible UX. Demos now run against real `real_estate` or `contractor` workspaces seeded by Adaptiv staff via `/platform/tenants` or back-office scripts.

Why no separate `property_owner` vs `facility_mgmt`? Because the split between ownership and management is a _per-location_ relationship, not a per-org one. An FM firm manages buildings owned by many different property orgs; a property owner might self-manage some buildings and outsource others. Modeling at the org level forces false choices.

### 2. Locations gain explicit owner + manager

```sql
alter table locations
  add column owner_org_id   uuid references organizations(id) on delete restrict,
  add column manager_org_id uuid references organizations(id) on delete restrict;

-- Migration default: both = current organization_id (self-managed owner-operator),
-- matching the status quo without breaking anything.
```

- `owner_org_id` — the org that owns the building. Required. Normally doesn't change.
- `manager_org_id` — the org whose facility manager runs day-to-day. Equal to `owner_org_id` for self-managed. Different when management is outsourced.

The existing `organization_id` column becomes redundant in the new model — owner+manager replace it. Keeping it during the transition, removing it in a cleanup phase after everything compiles against the new columns.

### 3. Contracts as first-class

```sql
create type service_kind as enum (
  'cleaning', 'maintenance', 'hvac', 'electrical', 'plumbing',
  'security', 'waste', 'pest_control', 'landscaping', 'other'
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  manager_org_id    uuid not null references organizations(id) on delete restrict,  -- who holds the contract (FM side)
  contractor_org_id uuid not null references organizations(id) on delete restrict,  -- who provides the service
  name text not null,
  service_kind service_kind not null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'expired', 'terminated')),
  start_date date not null default current_date,
  end_date date,                            -- null = ongoing / open-ended
  sla_summary jsonb not null default '{}',  -- structured SLA commitments, e.g. { max_response_min: 20, hygiene_threshold_breaches_per_month: 2 }
  terms text,                                -- free-text contract notes, storage for the "what's in our contract" prose
  monthly_value numeric,                     -- optional — contract value for rollup / BI
  currency text default 'USD',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contract_locations (
  contract_id uuid references contracts(id) on delete cascade,
  location_id text references locations(id) on delete cascade,
  primary key (contract_id, location_id)
);
```

Each contract is one service relationship (`contract_locations` is many-to-many so a contract can cover multiple sites in a portfolio). Multiple contracts can cover the same location for different services — e.g. Acme Property hires Maple Cleaning under one contract and Apex Security under another, both for the same building.

### 4. Routes belong to contracts (usually)

```sql
alter table routes
  add column contract_id uuid references contracts(id) on delete set null;
```

- Nullable because self-managed in-house routes (no external contract) should still work.
- When `contract_id` is set, the route inherits the contract's contractor org — the contractor's crew is who runs it.
- SLA threshold on the route is now a _route-level tighter bound_; the contract defines the umbrella SLA.

### 5. Tasks inside routes

```sql
create table route_tasks (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  zone_id  uuid references building_zones(id) on delete cascade,  -- null = applies to all route zones
  organization_id uuid not null,                                    -- denorm for RLS, matches route's managing org
  name text not null,
  description text,
  cadence text not null default 'per_run'
    check (cadence in ('per_run', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'on_condition')),
  cadence_days smallint[] not null default '{}',                    -- for weekly/biweekly with specific days
  last_completed_at timestamptz,                                    -- rolling state for recurring tasks
  sla_minutes integer,                                              -- task-level tighter SLA (optional)
  checklist_item_order integer not null default 0,                  -- display order within route
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
```

**Cadence semantics:**

- `per_run` — this task happens every time the route runs (mop the floor on every restroom sweep)
- `daily / weekly / monthly / quarterly` — task happens at its own cadence even when the parent route runs more frequently (window cleaning every month even though the restroom sweep is daily)
- `on_condition` — task is triggered by state (restock soap when <20%)

For recurring tasks, `last_completed_at` rolls forward every time the task is marked done. Merlin's scheduling logic adds it to today's route if now - last_completed_at ≥ cadence interval.

### 6. Profile role simplified

```sql
-- Proposed: refactor the enum
do $$ begin
  create type user_role_new as enum ('superadmin', 'manager', 'worker');
exception when duplicate_object then null; end $$;
```

Problem: `profiles.role` currently has 5 values and real user data. The migration story:

- `superadmin` → stays
- `facility` → becomes `manager` (they manage the org they're in)
- `cleaning / maintenance / security` → become `worker`; their _specialty_ moves to `team_members.team` which already captures it

The UI no longer inspects `profiles.role` for cleaning/maintenance/security — it looks at `organizations.kind` for context and uses `team_members.team` if it cares about the worker's specialty.

Open question: should we keep the old enum as a legacy column during migration, or do a one-shot rename? Discussed in §Migration below.

---

## Six primary views (what each user type sees on login)

### 1. Property Manager / Portfolio Lead

**Who:** Manager role at a real-estate org that owns many buildings (possibly managed by external FM firms on some of them).

**Landing page:** Portfolio dashboard. Map + tree of owned properties. Summary stats per property: occupancy, contracts active, SLA breach count this month, operating cost trend.

**Primary screens:**

- Locations tree (all owned, regardless of manager)
- Contracts list (contracts they hold directly or inherit from their manager org)
- Portfolio SLA dashboard — breaches per contractor across buildings
- Financial rollups (if `contracts.monthly_value` is populated)

**Cannot see:**

- Agentic config of buildings managed by external FMs (that's their FM's to tune)
- Individual crew rosters (not their abstraction level)

### 2. Facility Manager

**Who:** Manager role at a real-estate org that manages specific buildings. Often the same org as the property owner; sometimes a separate FM firm.

**Landing page:** Today's plan across managed buildings. Open incidents, pending asks, active overrides.

**Primary screens:**

- Schedules (today's plan, routes, team roster, contractors on site)
- Locations tree (managed only; if the FM org has grants on a subtree, that subtree; else all managed)
- Contracts they hold with contractors
- Incident feed + agentic config (this is their tuning surface)
- Admin → Users / Organization / Location access

**Cannot see:**

- Contracts they don't hold (other FMs' contracts for non-managed properties)
- Portfolio-wide financials (their scope is operational, not strategic)

### 3. Contractor Manager

**Who:** Manager role at a contractor org. Runs a cleaning company, maintenance firm, security company.

**Landing page:** Contracts dashboard. Each active contract as a card with SLA compliance bar, crew assigned, recent performance. Alert banner if any contract is in breach risk.

**Primary screens:**

- **Contracts list** — every contract the org holds, grouped by client (which real-estate org), with SLA status, monthly value, contacts
- **SLA dashboard per contract** — recent breaches, response times, MTTR, trending direction
- **Crew roster** — own employees, their certifications, schedules
- **Route performance** — filtered to routes under active contracts only
- **Incident feed** — incidents on buildings they service, scoped to their service_kind

**Cannot see:**

- Other contractors' work (Maple Cleaning doesn't see Apex Security's patrols)
- The FM's agentic config, internal tuning, tenant data
- Buildings where they hold no contract
- Property-level financials (only their own contract values)

This is a genuinely different product surface — the concept nouns are _contract, SLA, crew, route_, not _building, zone, incident_.

### 4. Worker / Crew

**Who:** Worker role at either a real-estate org (in-house staff) or a contractor org.

**Landing page:** My shifts today. Routes they're assigned to, with task checklists.

**Primary screens:**

- **Today's routes** — only ones they're assigned to, chronologically
- **Task checklist per route** — check off items, log completion, upload photos
- **Time clock** (future) — start / end shift
- **Issue flagging** — if they see something broken, flag to their manager

**Cannot see:**

- Other crews' assignments
- Org-level admin, contracts, pricing
- The agentic config, incident feed at the manager level

Minimal, task-focused UI.

### 5. Superadmin

**Who:** Adaptiv staff. Cross-org visibility, all features, always.

**Landing page:** Whatever they left last time, or a portfolio-wide "every org" dashboard when they want it.

**Primary screens:** Everything, unchanged from today.

### 6. Tenant (future, not in v1)

Deferred. When modeled, it would be someone whose "role" is effectively _occupant_, with minimal capabilities: report an issue, request a service, see SLA on their own space. Gated by the tenant holding a registered lease within a location.

---

## RLS: the third axis

We already have:

- **Org scope** (Phase 11b): `organization_id = current_user_org()`
- **Subtree grants** (Phase 12): `has_location_access(location_id)`

We now add:

- **Contract scope**: `has_contract_access(location_id, service_kind)` — returns true if the caller's org holds a contract covering that location for that service.

Policies compose:

- A route is visible if you're at the managing org AND (no grants OR grants cover the location) — **or** — your org holds a contract covering the route's location + service kind.
- An incident action is visible if you're at the managing org and in scope — or — your org holds a contract covering the action's location + service.
- A contract is visible only to its two party orgs (manager org + contractor org).

`has_contract_access` is SECURITY DEFINER (bypasses RLS internally) and runs a subquery:

```sql
create or replace function has_contract_access(target_location text, target_service service_kind)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from contracts c
    join contract_locations cl on cl.contract_id = c.id
    where cl.location_id = target_location
      and c.service_kind = target_service
      and c.status = 'active'
      and c.contractor_org_id = current_user_org()
  );
$$;
```

Contractor crew visibility cascades through their contractor org's contracts.

---

## Migration path (historical)

The migration ran against a Supabase that already had real data. The phased rollout below is preserved as historical record — all phases shipped through migration 028, and migration 068 later dropped the `demo` kind.

Phases:

**G-1 — Schema additions (non-destructive):**

- Add `organizations.kind` with default `real_estate` (existing orgs keep working)
- Add `locations.owner_org_id` + `locations.manager_org_id`, default both to the existing `organization_id`
- Create `contracts` + `contract_locations` tables (empty initially)
- Create `route_tasks` table (empty initially)
- Add `routes.contract_id` (nullable, all existing routes get null = in-house)

Everything still works. No client changes required for the app to keep running.

**G-2 — Role migration:**

- Keep old `profiles.role` enum values valid for now
- Client reads: update UX layer to treat `cleaning / maintenance / security` as `worker`, `facility` as `manager`
- New signups go straight to the 3-value enum
- Gradual: inserting rows with old enum values keeps working; UI just doesn't differentiate them

**G-3 — Contractor-aware UX:**

- Implement the contractor manager view (contracts dashboard, SLA-per-contract UI)
- Worker view (simplified task checklist)
- Gated on `organizations.kind` = `contractor` for the new views

**G-4 — Scenario specs rewrite:**

- Each scenario becomes multi-org: 1 property/FM org + 2–4 contractor orgs + contracts between them
- Demo loader becomes the FM at the real-estate org
- Personas distributed across orgs (some at FM, some at contractors)
- Rich story: "load this scenario and you're the facility manager; flip to Maple Cleaning's boss to see it from the contractor's view."

**G-5 — Legacy cleanup:**

- After everything compiles against new columns, drop `organization_id` on locations (superseded by owner/manager)
- Migrate `profiles.role` enum to the 3-value version; rewrite RLS to use new values
- Remove any lingering assumptions about "one org owns everything"

---

## Implications for the scenarios we already wrote

The five scenario specs need to be reshaped. Before and after, in shorthand:

### Before (current model)

- 1 demo org per scenario
- Team members roster = in-house employees
- Routes attached to that single org

### After (new model)

- 2–5 orgs per scenario:
  - 1 real-estate org (property owner + FM collapsed or separated)
  - 2–4 contractor orgs (cleaning, maintenance, security)
- Contracts linking them, with SLA summaries
- Team members split: in-house workers at the real-estate org, contractor workers at contractor orgs
- Routes belong to contracts, contracts belong to orgs
- Personas: some at the real-estate org (FM, superadmin watcher), some at each contractor org (contractor manager, crew lead)

### New scenario-by-scenario shape

**Company HQ** — 1 real-estate org (self-managed: _Northwind Real Estate_ owns AND manages Northwind Tower). In-house facilities team (_Northwind FM Team_) for minor repairs. External contracts: _Maple Cleaning_, _Reliable Mechanical_ for HVAC, _Cardinal Security_. Four orgs, three contracts.

**Small building** — 1 real-estate org (_The Annex Property Co._, owner + self-managed), 1 contractor org (_Clean Sweep Boston_, cleaning). Two orgs, one contract. Deliberately minimal.

**University campus** — 1 real-estate org (_Lakewood University Facilities_ — university's internal FM division, which is the manager), 1 property owner (_Lakewood University_, owns the land), 3 contractors (_Campus Clean Co._, _Granite Security Services_, _NE HVAC_). Four orgs, three contracts. Demonstrates owner ≠ manager even within one parent entity.

**Hospital** — Complex: property owner = a hospital REIT or non-profit; manager = _Riverside RMC EVS Division_ (internal); contractors = _MedClean Specialty_ (specialized healthcare cleaning), _Cardinal Biomed Services_ (equipment maintenance), _Vigilance Hospital Security_. Three contractors, strict SLAs, good story for healthcare verticals.

**Bank network** — Property owner = _Heartland Real Estate Holdings_ (owns the 24 branches), Facility Manager = _Heartland Bank Facilities_ (corporate division, self-managed). Contractors: _Maple Cleaning Services_ (holds ONE multi-branch contract covering all 24), _Reliable Mechanical_, _Cardinal Security_. The Maple contract is the interesting story: one contract, 24 locations, 5 regional crew leaders. Great demo of multi-location contracts.

---

## Live tenancy reality (as of 2026-05-17)

8 orgs in prod, all three tenant kinds exercised, now with **multi-building real_estate** + **ecosystem variant** patterns:

| Org                             | Kind          | Buildings          | Role                                                                                                                                                                     |
| ------------------------------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Meridian**                    | `real_estate` | 3 (HQ + MDE + MHC) | Flagship multi-building scenario. HQ = 50-floor tower; MDE = warehouse (`variant='warehouse'`); MHC = healthcare (`variant='healthcare'`). 4 active service contractors. |
| **First Empire Bank**           | `real_estate` | 581 (ecosystem)    | Branch-banking compliance scenario. Branches are first-class `kind='branch'` rows.                                                                                       |
| **International Monetary Fund** | `real_estate` | 2 (HQ1 + HQ2)      | Ecosystem with `variant='imf'`. **Internal-only demo** (PR #324) — not pitched externally.                                                                               |
| **SparkleCo Cleaning**          | `contractor`  | —                  | Holds 2 contracts (Meridian + FEB). Lisa Sparkle = contractor_manager persona                                                                                            |
| **ShineRight Cleaning**         | `contractor`  | —                  | Overnight deep-clean specialist on Meridian                                                                                                                              |
| **NorthStar Maintenance**       | `contractor`  | —                  | HVAC + plumbing on Meridian                                                                                                                                              |
| **GuardWatch Security**         | `contractor`  | —                  | Patrols on Meridian                                                                                                                                                      |
| **Adaptiv**                     | `adaptiv`     | —                  | Platform-admin gate (4 admins). No operational data.                                                                                                                     |

The legacy First Empire Bank (FEB1) tenant was deleted alongside the 2026-05-12 database trim. New multi-building extensions to Meridian (MDE 2026-05-13, MHC 2026-05-13) added via migrations 104-112. IMF added 2026-05-15 via migrations 117-125.

### Variant flavoring

`locations.variant` (added in migrations 104-112) is the sub-typing mechanism. Today's variants:

- `warehouse` — cold-chain agent persona, refrigeration monitoring (MDE)
- `healthcare` — pharmacy-temp agent persona, hygiene-compliance focus (MHC)
- `imf` — IMF ecosystem flavoring (1 ecosystem + 2 HQ buildings)

`profiles.preferences.default_building_id` controls per-user first-load landing across multi-building tenants.

---

## Open questions (still relevant)

1. **Self-managed shortcuts in UX.** When an org's kind is `real_estate` and owner = manager for all its locations, should the UI surface the "Contracts" tab at all, or hide it until they have contractors? Simpler onboarding vs consistent UX.

2. **Worker logins — optional or required?** Most scenarios have 8-15 team members but only 4-6 Merlin accounts. Do we keep that ratio (only managers + a few reps get logins) or target one account per crew member? Affects data volume + UX.

3. **Contract approval flow.** Does creating a contract require both orgs to agree (like a marketplace), or is it entered by the manager and visible to the contractor upon creation? Today: manager creates, contractor sees read-only. Later candidate: dual-signature workflow.

4. **SLA structure in `sla_summary`.** JSON is flexible but weakly typed. Do we want a structured schema now (enum of SLA types, numeric thresholds, breach counts) or start freeform and harden later?

5. **Task cadence interactions.** A monthly task inside a daily route — how does it get scheduled? Merlin evaluates at route planning time ("is this task due today?") and adds it to the run if so. The route's expected_duration_min needs to account for tasks that might run today. Open question whether we model `route_duration = sum of per_run tasks + eligible today-due recurring tasks` at runtime.

---

## What was retired post-shipping

- **`demo` org kind** — dropped in migration 068 once Merlin moved from "sandbox" framing to a real product. The "Load a demo workspace" UX, "Sign in as…" persona switcher, and DEMO pills all came out at the same time. Demo data is still seedable for QA via `/api/seed-demo-scenario`, but it's a back-office tool now.
- **First Empire Bank (FEB1)** — the original NYC-region demo tenant was deleted during the v1 trim; FEB2 is the surviving bank scenario.
