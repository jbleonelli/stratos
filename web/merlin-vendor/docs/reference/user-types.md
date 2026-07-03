# Merlin user types

An enumeration of every category of human who interacts with (or should
interact with) Merlin. Starts with the roles that exist in the system
today, then calls out gaps worth filling as Merlin expands into new
verticals and larger deployments.

Use this when:

- Designing a new surface and asking "who is this for?"
- Discussing access control, RLS, or pricing tiers
- Proposing a new scenario seed — make sure the personas it showcases
  are grounded in this catalog
- Evaluating whether an inbound customer's org chart fits Merlin's
  existing identity model or requires new role work

---

## The three identity axes

Merlin represents user identity along three independent axes. Any real
human is the intersection of values on all three.

### 1. Profile role — job function

Column: `profiles.role` · enum `user_role` defined in
[`src/app/roles.js`](../src/app/roles.js) and the matching Postgres enum.

What the person _does for a living_. Drives filtering of incidents, SLAs,
agent surfaces, and the Merlin system prompt's tone + vocabulary. Ten
values today — five are built end-to-end with full UX shells, five are
recognized by the enum + filters but their dedicated UX shells are
deferred.

**Core five (full shells):**

- `superadmin`
- `facility`
- `cleaning`
- `maintenance`
- `security`

**Stub five (no dedicated shell yet):**

- `property_manager`
- `tenant`
- `auditor`
- `fm_network`
- `executive`

### 2. Org-membership role — tenant access level

Column: `organization_members.role` · enum `org_role` in
[migration 014](../supabase/migrations/014_organizations.sql)

Who can manage a given workspace. Independent of job function — a
cleaning lead at SparkleCo is `member` in SparkleCo's org but might
also be `admin` in a small family-owned contractor workspace. Three
values:

- `owner` — cannot be removed, can transfer ownership
- `admin` — can invite/remove users, manage billing
- `member` — read + scoped write per RLS

### 3. Tenant kind — what the org IS

Column: `organizations.kind` · enforced by a CHECK constraint with three
values today (post-migration 068):

- `real_estate` — building owner / operator. Owns locations, devices,
  agents, SLAs. Holds contracts with `contractor` orgs.
- `contractor` — service company that operates routes for one or more
  `real_estate` orgs under contract. No locations of its own.
- `adaptiv` — the platform org. Membership = `is_platform_admin()` →
  unlocks `/platform`. Not a customer workspace.

The legacy `demo` kind was retired in migration 068 alongside the
"sandbox demo" UX. Loading a demo is no longer a user-visible flow.

### 4. Derived persona — UX shell

Computed in [`src/app/personas.js`](../src/app/personas.js) from
`(profile.role, org.kind)`. This is the translation layer Track G
introduced — the same `facility` job role needs radically different
primary UX at an in-house FM (today's plan + schedules) vs a
contractor (contracts dashboard + crew). Nine values:

- `superadmin`
- `property_manager` (stub — falls through to facility shell today)
- `facility_manager`
- `contractor_manager`
- `worker`
- `tenant` / `auditor` / `fm_network` / `executive` (stubs — recognized,
  no dedicated shell yet)

---

## Roles implemented today

The five rows from `roles.js`, with the full signal each carries.

### Super Admin — `superadmin`

- **Archetype:** Adaptiv-side workspace owner; also the per-customer
  workspace owner at enterprises that elect a dedicated admin
- **Demo persona:** Robin Cole · Workspace Owner
- **Primary shell:** Full manager shell (all five tabs)
- **Org kinds where it appears:** adaptiv, real_estate, contractor
- **Sees:** everything across the workspace — all locations, all users,
  all domains (hygiene, hvac, space, supply, energy, security, safety,
  amenity, uptime), all device types
- **Can do:** deploy, invite, transfer, delete — no limits in the UI
- **Merlin tone:** comprehensive, strategic, references cross-tenant
  patterns, governance, risk
- **Typical questions:** "Who has admin access?", "How many devices
  across the workspace?", "Which location costs us the most?"

### Facility Manager — `facility`

- **Archetype:** owns the building(s) end-to-end; the buck stops here
- **Demo persona:** Jamie Lin · Facility Manager
- **Primary shell:** Full manager shell
- **Org kinds:** real_estate (most common), adaptiv
- **Sees:** all domains for buildings they manage; cross-domain rollups
  (energy + comfort + hygiene together); SLAs, costs, tradeoffs
- **Device types in scope:** display_touch, display_eink, airq,
  occupancy, camera, badge, leak, beacon
- **Merlin tone:** strategic, surfaces cross-domain patterns, references
  SLAs + costs
- **Typical questions:** "Why is Floor 32 flagging again?", "Prep
  Monday board meeting", "Draft SLA report"

### Cleaning Services — `cleaning`

- **Archetype:** lead custodian running a crew; either in-house or at a
  cleaning contractor
- **Demo persona:** Maria Chen · Lead Custodian
- **Primary shell:**
  - At a real_estate org → Worker shell (My shifts today)
  - At a contractor org with manager-level profile role → Contractor
    Manager shell (currently the `facility` role triggers this at
    contractor orgs — see `personas.js`)
- **Org kinds:** real_estate, contractor
- **Sees:** hygiene, supply, amenity only; restroom displays,
  occupancy, air quality
- **Does not see:** HVAC setpoints, badge access, firmware deploys
- **Merlin tone:** warm, operational, uses cleaning language
  ("route", "refill", "sweep")
- **Typical questions:** "Where is my crew right now?", "What needs
  cleaning next?", "Flag a supply shortage"

### Building Maintenance — `maintenance`

- **Archetype:** HVAC tech, electrician, plumber, elevator-vendor
  liaison
- **Demo persona:** Darnell Price · HVAC Tech
- **Primary shell:** Worker shell (today's work orders + checklist)
- **Org kinds:** real_estate, contractor
- **Sees:** HVAC, uptime, safety, energy; air-quality sensors, leak
  sensors, eInk status panels
- **Does not see:** cleaning routes, badge policy
- **Merlin tone:** technical, terse, references vendor SLAs (OTIS,
  Trane, JCI), work orders, setpoints, runtime hours
- **Typical questions:** "What work orders are open?", "Show AHU-7
  runtime", "Elevator B3 history"

### Building Security — `security`

- **Archetype:** security lead running lobby + after-hours coverage
- **Demo persona:** Ivan Kovac · Security Lead
- **Primary shell:** Worker shell (today's incidents + checklist)
- **Org kinds:** real_estate, contractor
- **Sees:** security, safety; cameras, badge readers, beacons
- **Does not see:** cleaning schedules, HVAC setpoints
- **Merlin tone:** crisp, operational, facts-first
- **Typical questions:** "Show after-hours badge activity", "Any doors
  held open?", "Tailgate events today"

---

## Derived personas — the UX split

What the raw `profile.role × org.kind` matrix resolves to:

| profile.role → <br> org.kind ↓ | superadmin | facility           | cleaning | maintenance | security |
| ------------------------------ | ---------- | ------------------ | -------- | ----------- | -------- |
| **adaptiv**                    | superadmin | facility_manager   | worker   | worker      | worker   |
| **real_estate**                | superadmin | facility_manager   | worker   | worker      | worker   |
| **contractor**                 | superadmin | contractor_manager | worker   | worker      | worker   |

The five stub profile roles (`property_manager` / `tenant` / `auditor` /
`fm_network` / `executive`) map 1:1 to their named persona regardless of
`org.kind`, but no dedicated shell renders for them yet — `App.jsx`
falls through to the closest existing shell.

Three rendered shells:

- Full manager shell (superadmin, facility_manager) — 5 tabs,
  building-owner view
- Contractor shell (contractor_manager) — contracts dashboard, SLA
  per contract, own crew, scoped route perf
- Worker shell (worker) — today's plan, checklist, flag issues

---

## Gaps — user types Merlin doesn't yet serve

Grouped by how concretely they're on the roadmap. These aren't
commitments; they're a checklist to evaluate when a customer asks
"can your platform handle X?"

### Already in the enum, no shell yet

The five "stub" profile roles below have an enum value, a
`merlinPersona` chat prompt, SLA / agent / incident filter scope, and
a `personaOf` mapping — but no dedicated shell. They land on the
closest existing shell when granted today. The bullet under each is
what would need to be built to give them a real surface.

**Property Manager (portfolio-level)**

Distinguishes the person managing a _portfolio_ of buildings
(cross-building decisions, capex, tenant mix) from the per-building
facility manager. Same `org.kind = real_estate` but different primary
noun — portfolio KPIs vs building ops.

- Lands when: Northwind RE or similar owner-operator asks for a
  portfolio dashboard
- Schema impact: none — profile role + `personaOf` already wired

**Tenant / Occupant contact**

The representative from the tenant side of a lease — HR manager at a
company leasing floors 32–40 of a tower. Reports issues, sees hygiene
SLA compliance for their floors, doesn't touch infrastructure.

- Lands when: larger commercial properties need a tenant-facing view
- Schema impact: read-only RLS scoped to leased zones (a
  `tenant_leases` join). Org kind stays `real_estate`.

**Auditor / Compliance officer**

Read-only cross-workspace access to evidence — NFC-logged cleaning
completions, incident actions, SLA reports. Often a third-party
(health-dept inspector, SOC 2 auditor).

- Lands when: regulated scenarios (hospital, bank, school) where
  audit trail is a primary deliverable
- Schema impact: a scoped-read-only membership concept (below
  `member`), possibly time-bounded tokens

**FM Network Dispatcher**

The person on the phone at a facilities-management network (CBRE,
JLL) assigning work orders across multiple buildings + contractors.

- Related to but distinct from `contractor_manager` — they dispatch
  the contractors rather than _being_ one
- Schema impact: probably a new org kind (`fm_network`) and a
  cross-customer work-order grid

**Executive / CFO**

Read-only portfolio KPIs, cost rollups, trend reports. Doesn't do
ops; consumes summaries.

- Lands when: a real customer asks for an exec digest
- Schema impact: none — derivable from current scope, just needs an
  exec-rollup surface

### Mid-term — adjacent business functions

**Vendor / Procurement**

The person ordering parts, provisioning devices, handling invoices.
Spans multiple contractors. Today this is implicit — Priya Kumar as
"Lead Installer" in DEPLOYMENTS but without a login.

- Lands when: we ship a real Provisioning workflow (currently demo
  decoration)
- Schema impact: new profile.role `procurement`, plus a deployments
  table with installer assignments

### Long tail — probably never Merlin users directly

These are people _affected by_ Merlin but unlikely to sign in. Worth
naming so we don't try to build roles for them:

- **Building occupants / employees** — consumers of SLAs; file
  tickets via their employer's HR, not directly
- **Visitors / guests** — badge-holders, not Merlin users
- **Emergency responders** — would consume incident feeds via an API
  integration, not a UI login
- **Insurance adjusters** — request audit exports for claims, not
  interactive users

---

## Access-control notes by role

Which surfaces each role should be able to see/edit. Mostly
implemented today; gaps flagged.

| Surface                  | superadmin | facility | cleaning       | maintenance | security       | contractor_manager     | worker      |
| ------------------------ | ---------- | -------- | -------------- | ----------- | -------------- | ---------------------- | ----------- |
| Briefing                 | R          | R        | R              | R           | R              | —                      | —           |
| Dashboard                | R          | R        | R              | R           | R              | R (contracts)          | —           |
| Operations → Hypervisor  | R          | R        | R              | R           | R              | —                      | —           |
| Operations → Devices     | R/W        | R/W      | R              | R           | R              | R (own contract scope) | —           |
| Operations → Deployments | R/W        | R/W      | —              | —           | —              | —                      | —           |
| Operations → Schedules   | R/W        | R/W      | R (own routes) | R (own WOs) | R (own shifts) | R/W (own crew)         | R (own day) |
| Reports                  | R          | R        | — (digest)     | — (digest)  | — (digest)     | R (own contracts)      | —           |
| Insights                 | R          | R        | —              | —           | —              | —                      | —           |
| Admin → Users            | R/W        | R/W      | —              | —           | —              | R/W (own org)          | —           |
| Admin → Locations        | R/W        | R/W      | —              | —           | —              | —                      | —           |
| Admin → Devices          | R/W        | R/W      | —              | —           | —              | —                      | —           |

Legend: R = read, R/W = read + write, — = hidden, (...) = scoped. A
worker shell intentionally collapses most of the above into the
checklist — the table shows what the underlying RLS permits, not
what the shell renders.

---

## When to add a new role

Rule of thumb: introduce a new `profile.role` or a new derived
persona only when **both** are true:

1. The person's access scope (what they can see + edit) differs
   meaningfully from every existing role, AND
2. Their primary UX nouns differ — i.e. a new shell or a
   substantially different default landing page is justified

If only (1) is true → scope them with an existing role + RLS grants
(subtree access, contract scope). If only (2) is true → it's a
UX tweak, not a role.

History:

- Track G added `contractor_manager` because contractor orgs failed
  both tests against facility_manager — they see contracts (not
  buildings), read across a different join (contract_locations not
  subtree_grants), and write to their own crew's team_members only
- `worker` was added alongside because a cleaning lead at a
  contractor org needs a checklist view, not a manager shell —
  failing test (2) against contractor_manager

---

## Open questions

Things to resolve before expanding the role system:

- Should `superadmin` be an org-membership role instead of a profile
  role? Today a superadmin has both `profiles.role='superadmin'` and
  `organization_members.role='owner'`; the two are redundant.
- Does `property_manager` merit a split, or is it just a tweak on
  facility_manager's landing page?
- How do auditors + tenant_contact access multi-tenant data — via
  time-bounded share links, or via a scoped membership row?
- What's the smallest credential unit — a per-user JWT is the
  current assumption, but vendor/procurement workflows may need a
  service-account concept.

These don't need answers now; flag them when a real customer forces
the question.
