# Merlin user's guide — roles & demo accounts

A quick reference for what each role sees in Merlin, who the demo user is, and how to log in. For the engineering-side picture (filters, persona resolution, how to add a new role) see [`roles.md`](./roles.md).

---

## How signing in works

Sign in at [merlin.adaptiv.systems](https://merlin.adaptiv.systems) with the demo email + password. After login, Merlin picks the right shell based on your **role × org type**:

- **Superadmin** anywhere → full Adaptiv shell (cross-org access)
- **Facility role at a real-estate org** → Facility Manager shell (5 pillars: Monitor / Operate / Report / Predict / Innovate, with Merlin chat + agent bar)
- **Facility role at a contractor org** → same shell + Operations → Contracts sub-page (this is the Contractor Manager surface)
- **Cleaning / maintenance / security role** → WorkerApp (today's shifts, NFC check-ins, minimal admin)

Switch between workspaces (orgs) using the **workspace picker in the topbar** — only orgs you're a member of appear there.

**Multi-building tenants** (like Meridian with HQ + MDE + MHC) get a Building Switcher in the topbar. Your default building on first load is controlled by `profiles.preferences.default_building_id`, set by the platform admin or via the demo-invite flow.

**Platform admins** go to `/platform` directly. Customer `/` and platform `/platform/*` use **independent Supabase storageKeys** — sign in at one, you're not signed in to the other.

---

## Core demo accounts

All passwords are `merlin2026` unless noted. Re-create or repair via [`scripts/seed-demo-users.mjs`](../scripts/seed-demo-users.mjs).

### Superadmin — Robin Cole

- **Email:** `robin@adaptiv.systems`
- **Password:** _(ask the workspace owner — not published here)_
- **Org:** Adaptiv (cross-org)
- **What you see:** Full shell, every workspace, every domain, Admin + Agentic editors. Used for cross-tenant ops.
- **Best for testing:** governance, multi-org workflows, switching workspaces.

### Facility Manager — Jamie Lin

- **Email:** `jamie@meridian.com`
- **Password:** `merlin2026`
- **Org:** Meridian HQ
- **What you see:** Whole-building view of Meridian. All 9 domains (hygiene, hvac, space, supply, energy, security, safety, amenity, uptime). Admin section access. Schedules, Insights, Reports, Briefing.
- **Best for testing:** the headline "AI co-worker for buildings" experience. Most demos run from this account.

### Lead Custodian — Maria Chen

- **Email:** `maria@meridian.com`
- **Password:** `merlin2026`
- **Org:** Meridian HQ
- **Linked to roster:** Maria Chen (Lead Custodian) — yes
- **What you see:** WorkerApp. Today's shifts, NFC check-ins for her routes, supply flag buttons. No HVAC / security / energy.
- **Best for testing:** crew-on-the-ground experience, NFC trail.

### HVAC / Maintenance Tech — Darnell Price

- **Email:** `darnell@meridian.com`
- **Password:** `merlin2026`
- **Org:** Meridian HQ
- **Linked to roster:** Darnell Price (HVAC Tech) — yes
- **What you see:** WorkerApp scoped to HVAC + uptime + safety + energy. Work orders, AHU runtime, vendor SLAs.
- **Best for testing:** technical / vendor-coordination story.

### Security Lead — Ivan Kovac

- **Email:** `ivan@meridian.com`
- **Password:** `merlin2026`
- **Org:** Meridian HQ
- **Linked to roster:** Ivan Kovac (Security Lead) — yes
- **What you see:** WorkerApp scoped to security + safety. Badge events, after-hours flags, tailgate review, camera status.
- **Best for testing:** security-ops surface.

### Contractor Manager — Lisa Sparkle

- **Email:** `lisa@sparkleco.com`
- **Password:** `merlin2026`
- **Org:** SparkleCo Cleaning Services (contractor)
- **What you see:** Same shell as Jamie (full Merlin chat, agent bar) — but the agent bar is narrowed to Cleaning · Supplies · Compliance because SparkleCo is a cleaning-services contractor. Operations → **Contracts** sub-page surfaces the 2 customer contracts (Meridian active, FEB2 draft). Operations → Schedules drives team rosters and routes across both customer buildings.
- **Best for testing:** how a cleaning contractor manages crews + routes + per-customer SLA across multiple buildings.

---

## Tenant kinds and profile roles

Two enums govern who-sees-what:

**`organizations.kind`** — what the workspace IS:

- `real_estate` — building owner / operator (Meridian HQ, FEB2)
- `contractor` — service company under contract (SparkleCo)
- `adaptiv` — platform org; membership = `is_platform_admin()`

**`profiles.role`** — what the human DOES (10 values). Each carries chat-persona prompt, suggested questions, KPI tiles, and filter scope. See [`roles.md`](./roles.md) for the full table.

| Role id            | Built?                           | Demo user available?               |
| ------------------ | -------------------------------- | ---------------------------------- |
| `superadmin`       | ✅ full                          | Robin / Philippe                   |
| `facility`         | ✅ full                          | Jamie (Meridian), Lisa (SparkleCo) |
| `cleaning`         | ✅ full                          | Maria                              |
| `maintenance`      | ✅ full                          | Darnell                            |
| `security`         | ✅ full                          | Ivan                               |
| `property_manager` | ⏳ stub — no dedicated shell yet | none                               |
| `tenant`           | ⏳ stub                          | none                               |
| `auditor`          | ⏳ stub                          | none                               |
| `fm_network`       | ⏳ stub                          | none                               |
| `executive`        | ⏳ stub                          | none                               |

The five stub roles are recognized end-to-end (chat persona, SLA filtering, agent filtering, role-picker in Admin → Users) but their bespoke UX shells aren't built. A `property_manager` user logging in today gets the facility shell with the property-manager chat persona — which works as a proof of concept but doesn't yet show the portfolio rollups that role really wants.

To grant one of the deferred roles to an existing user:

1. Sign in as superadmin
2. Admin → Users → pick the user → change role
3. The new role applies on next login (or workspace switch)

---

## Switching workspaces

If you're a superadmin or platform admin and need to see how things look from inside a specific tenant, use the **workspace picker** in the topbar (only orgs you're a member of appear). Platform admins can also use the `/platform/tenants/<id> → Sign in as this tenant` button to impersonate, which writes `profiles.impersonating_org_id` and renders an `ImpersonationBanner` at the top of the customer shell until you exit.

The legacy "Sign in as…" persona switcher inside a single workspace was removed alongside the demo-sandbox concept — to test a different role, sign out and sign in as the demo account directly.

---

## Worker accounts can break if not roster-linked

Cleaning / maintenance / security roles need a `team_members.user_id` row pointing at their auth uid. Without it, WorkerApp shows "No roster link yet". The seeder in `scripts/seed-demo-users.mjs` handles this automatically via the `crewName` field on each demo entry. If you create a new worker via Admin → Users, you also have to add them to a team member row in the same org, or they'll hit that empty state.

---

## Workspaces in the demo

8 orgs in prod as of 2026-05-17 — **three `real_estate` scenarios** (Meridian is now multi-building), **four `contractor`** orgs, and the **Adaptiv platform org**:

| Workspace                    | Kind          | Buildings            | Notes                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meridian**                 | `real_estate` | 3 — HQ + MDE + MHC   | Flagship multi-building scenario. HQ = 50-floor tower (797 devices). MDE = warehouse (`variant='warehouse'`, cold-chain agent). MHC = healthcare clinic (`variant='healthcare'`, pharmacy-temp agent). User's first building controlled by `profiles.preferences.default_building_id`. |
| First Empire Bank            | `real_estate` | 581-branch ecosystem | Daily-cleaning compliance scenario. Branches as `kind='branch'` rows.                                                                                                                                                                                                                  |
| International Monetary Fund  | `real_estate` | 2 (HQ1 + HQ2 in DC)  | **Internal-only demo**, not pitched externally. `variant='imf'`.                                                                                                                                                                                                                       |
| SparkleCo Cleaning Services  | `contractor`  | —                    | 9 crew, 2 contracts (Meridian + FEB). Contractor-manager experience.                                                                                                                                                                                                                   |
| ShineRight Cleaning Services | `contractor`  | —                    | Overnight deep-clean specialist on Meridian.                                                                                                                                                                                                                                           |
| NorthStar Maintenance        | `contractor`  | —                    | HVAC + plumbing on Meridian.                                                                                                                                                                                                                                                           |
| GuardWatch Security          | `contractor`  | —                    | Patrols on Meridian.                                                                                                                                                                                                                                                                   |
| Adaptiv                      | `adaptiv`     | —                    | Platform-admin gate (4 admins: JB · Robin · Philippe · JB Lucas). Not a customer workspace.                                                                                                                                                                                            |

---

## Where each demo lives in the codebase

- Role definitions: [`src/app/roles.js`](../src/app/roles.js) (`ROLES` map)
- Persona resolution: [`src/app/personas.js`](../src/app/personas.js) (`personaOf`)
- Demo user seeder: [`scripts/seed-demo-users.mjs`](../scripts/seed-demo-users.mjs)
- SparkleCo workspace seed: [`scripts/seed-sparkleco.sql`](../scripts/seed-sparkleco.sql) (org + crew + contracts + routes + Lisa's auth row + 8 demo merlin_asks)
- Engineering reference for roles + filters + auth gates: [`docs/roles.md`](./roles.md)
