# Demo scenarios

> **⚠️ Aspirational doc — pre-dates the v1 simplification.**
>
> The "Load a demo workspace" flow described below was **retired in migration 068** (mid-2026) along with the `is_demo` column, the `demo` org kind, and the user-menu "Sign in as…" picker. Merlin is now positioned as a real product, not a sandbox.
>
> The v1 build-out targets two `real_estate` scenarios and one `contractor` (Meridian HQ + FEB2 + SparkleCo, plus the Adaptiv platform org) — see [`docs/architecture/building-ops-model.md`](../architecture/building-ops-model.md) for the live tenancy reality.
>
> The scenario specs in this directory (Sandbox Office / Single small building / Company HQ / Hospital / University campus / Bank network) are kept as **aspirational templates** for the multi-org / multi-contract shape we'd want to seed when those verticals come back into scope. Don't trust the "is*demo" / "load-a-demo" details — the scenario \_content* (org count, contract structure, persona mix) is still the useful part.

---

Each scenario is a fully-seeded, self-contained workspace template. Originally these were spun up from **Admin → Organization → Load a demo** as private `is_demo=true` orgs. That flow is gone; the templates remain useful as design references for new tenants Adaptiv staff create via `/platform/tenants`.

Each scenario is designed around **one narrative moment** that Merlin excels at — the thing you'd show a prospect for this vertical. The doc for each scenario locks in:

- **Structure** — ecosystem + buildings + approximate coords for the map view
- **Zones** — per building, with kinds (restroom, kitchen, office, etc.)
- **Team** — workforce roster with teams, roles, initials, schedules
- **Routes** — cadences, SLAs, assignments
- **Seeded history** — recent route overrides + incident actions so the demo feels alive, not blank
- **What Merlin demonstrates** — the moments the scenario showcases

## The five scenarios

Each scenario now seeds **2–5 organizations** — the real-world shape where a property/FM org holds contracts with one or more service contractors. Track G (building-ops-model.md) added `organizations.kind`, `contracts`, `contract_locations`, and a contract-scoped RLS axis so scenarios can express this faithfully.

| Scenario                                   | Vertical         | Orgs | Contracts | Buildings     | Zones | Crew | Routes | Logins | Complexity | Headline                                       |
| ------------------------------------------ | ---------------- | ---- | --------- | ------------- | ----- | ---- | ------ | ------ | ---------- | ---------------------------------------------- |
| [Sandbox Office](sandbox-office.md)        | Tutorial         | 1    | 0         | 1             | 6     | 3    | 2      | 2      | ★          | Framework validation (pre-Track G)             |
| [Single small building](small-building.md) | SMB / coworking  | 2    | 1         | 1 (4 floors)  | 10    | 4    | 2      | 4      | ★★         | Minimal setup, one contract, max autonomy      |
| [Company HQ](company-hq.md)                | Corporate        | 4    | 3         | 1 (50 floors) | ~35   | 8    | 4      | 6      | ★★★        | Three contracts + three contractor shells      |
| [Hospital](hospital.md)                    | Healthcare       | 4    | 3         | 2 (wings)     | ~50   | 10   | 6      | 7      | ★★★        | SLA-driven trauma reshuffles + contractor view |
| [University campus](university-campus.md)  | Education        | 5    | 3         | 6             | ~130  | 15   | 10     | 7      | ★★★        | Owner ≠ manager + ecosystem routes             |
| [Bank network](bank-network.md)            | Retail financial | 5    | 3         | 1 eco + 24    | ~150  | 12   | 8      | 5      | ★★★★       | Map-view nav + one contract / 24 locations     |

Sandbox Office is already shipped (Phase 16b, pre-Track G). The remaining five land as G-4+ phases in any order — each is additive.

## How a scenario is structured

Every scenario is a single `.js` file under `src/app/scenarios/` exporting:

```js
{
  id: 'company-hq',
  name: 'Company HQ',
  tagline: '50-floor office tower · 4 orgs · 3 contracts · 35 zones',
  description: 'A modern corporate headquarters...',
  icon: 'building',
  // Optional: default to the map view on Admin → Locations for this scenario
  defaultView: 'tree' | 'map',
  // Real Supabase auth accounts to seed (handled by /api/create-demo-users)
  users: [
    { username, name, profileRole, orgRole, atOrg },
    ...
  ],
  // Org + contract + data seeder. Runs under caller's auth with
  // active_org_id = the manager org.
  seed: async (supabase, managerOrgId) => { ... }
}
```

`seed()` runs under the caller's auth with `profile.active_org_id` already flipped to the new manager org. Every insert into that org's data passes RLS because the caller is owner. The seed _also_ creates **contractor orgs** via the `create_demo_org` RPC (they need to exist as real orgs), then creates contracts between manager and contractor, then seeds contractor-side data (team_members, route_assignments, etc.) with each row's `organization_id` set to the contractor org — NOT the manager org.

> Wait, how does RLS pass for writes into the contractor org? The manager org's owner isn't a member of the contractor orgs.
>
> **Answer:** the scenario seed runs as superadmin from the user's perspective only when the user IS a superadmin. For non-superadmin loaders, we'd need either:
> (a) A service-role RPC that seeds the full scenario atomically (mirrors `/api/create-demo-users`), or
> (b) Auto-adding the loader as owner of each contractor org during creation, then removing themselves after seeding.
>
> This is an **open question** to resolve during G-4 implementation. Option (a) is cleaner; option (b) is lighter. See open question #3 in `docs/architecture/building-ops-model.md`.

### Seeded data conventions

- **Location ids** get a per-org suffix (first 8 chars of `orgId`) because `locations.id` is a globally-unique text PK. Two users loading the same scenario must not collide.
- **Merlin config** is _not_ seeded — RLS restricts inserts to superadmins, and the config hydrator falls back to sensible defaults when rows are missing. Superadmin explorers can tune their demo from Admin → Agentic after it loads.
- **Availability windows** are realistic: overnight shifts wrap past midnight, split shifts are fine, part-time crew don't work 5 days.
- **Lived-in history** means: 5–15 recent `route_overrides` (some Merlin-sourced to show autonomy) + ~20 recent `incident_actions` across the week. This gives the Admin → Locations rollups real numbers to display the moment the user lands.

### What a scenario is NOT

- Not a customer-specific replica. Names, addresses, crew names are fictional. Anonymize real accounts.
- Not a simulator variant. The simulator stays HQ-flavored for v1 per the 16-track decision. Scenario data feels alive through seeded history, not through live simulation.
- Not a permanent product state. Users can edit their demo freely. If they trash it they can delete the org (future phase) or just ignore it.

## Merlin user accounts per scenario

Each scenario seeds 4–6 **real Supabase auth accounts** alongside the workforce roster, so the person loading the demo can sign in as different roles and experience the role-gated UX (facility manager vs cleaning vs security, etc.) properly. These are distinct from `team_members` rows — team_members is the full workforce roster (all crew members, with schedules), while auth accounts are just the subset who need Merlin logins.

### Account scheme

- **Email:** `{username}-{orgUuid8}@merlin-demo.invalid`. The `.invalid` TLD guarantees no delivery attempts. The org-uuid suffix ensures two users loading the same scenario don't collide on email uniqueness.
- **Password:** Shared `demo2026` across every scenario persona. The demo org is scoped to the loader via org-level RLS, so shared passwords are safe — nobody outside the demo org can see its data regardless.
- **Created via:** `POST /api/create-demo-users` Vercel endpoint (service-role-key pattern already used by `/api/admin-create-user`). The client calls it with the org id + scenario id after the org exists.
- **Membership:** each persona gets an `organization_members` row with the scenario-appropriate org role (owner/admin/member).
- **Cleanup:** auth users are not yet deleted when a demo org is removed. That's a later phase; for now they accumulate. Emails are unique enough that they don't interfere with real signups.

### UX: Sign-in-as picker

When a user's **active org is a demo** (i.e. `organizations.is_demo = true`), the user menu grows a _Demo accounts_ section listing every scenario persona with 1-click **Sign in as…** buttons. Clicking signs out the current session, signs in as the chosen persona (shared password auto-filled), and reloads. Available only in demo orgs — in real orgs the section is hidden so the user never accidentally impersonates a real teammate.

### Account structure per scenario

Each scenario's doc includes a **Merlin user accounts** section listing:

| Field            | Meaning                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `username`       | short lowercase handle, used to form the email                      |
| `name`           | human-readable display name                                         |
| `role` (profile) | `superadmin` / `facility` / `cleaning` / `maintenance` / `security` |
| `role` (org)     | `owner` / `admin` / `member`                                        |
| `bio`            | one-line description of who this person is in the scenario's story  |

The demo loader is always added as `owner` of the demo org. Scenario personas are seeded alongside as additional logins — the loader is never one of them (so their real profile stays separate from the scenario cast).

## How to propose a change to a scenario

Edit the relevant `.md` here, push, and note the delta in the PR. Once JB signs off, implement the seed changes in `src/app/scenarios/<id>.js`. Keep the doc in sync with what the seed actually does — these docs are the single source of truth for what each scenario contains.
