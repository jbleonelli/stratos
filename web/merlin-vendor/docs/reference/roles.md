# Roles, personas, and what each one sees

Merlin has three identity axes a user sits on, plus a derived UX projection.

1. **Tenant kind** (`organizations.kind`) — what the org _is_. Three values today:
   - `real_estate` — building owner/operator (Meridian HQ, FEB2)
   - `contractor` — service company holding contracts with `real_estate` orgs (SparkleCo)
   - `adaptiv` — the platform org; membership unlocks `is_platform_admin()` and `/platform`
2. **Profile role** (`profiles.role`, enum `user_role`) — what the human _does for a living_. 10 values; see §Roles below.
3. **Org-membership role** (`organization_members.role`, enum `org_role`) — `owner` / `admin` / `member`. Per-org permission scope. **Distinct from the profile role** — easy to mix up.
4. **Persona** — a derived shell selector computed from `(profile.role × org.kind)`. Determines which app surface the user lands on (full admin shell vs WorkerApp vs Contractor Manager shell, etc.). The role + kind are the source of truth; the persona is a UX projection.

A change to `profiles.role` flows through to the persona; a change to `org.kind` (e.g. `real_estate` → `contractor`) re-projects the persona for everyone in that org.

---

## Roles defined today

The `ROLES` map in `src/app/roles.js` is the single registry. Each entry carries: a short id, who it's for, the chat persona prompt Merlin uses, the suggested questions, the KPI tiles, the device-type allowlist, and the domain set used by `filterIncidentsForRole` / `filterSlasForRole` / `filterAgentsForRole`.

### Core roles (built end-to-end)

| Role id       | Title                   | Demo user                    | Domains                      | UX shell           | Notes                                                         |
| ------------- | ----------------------- | ---------------------------- | ---------------------------- | ------------------ | ------------------------------------------------------------- |
| `superadmin`  | Workspace Owner         | Robin Cole, Philippe Laurent | all 9                        | Full Adaptiv shell | Cross-org access. Wins over org.kind in the persona resolver. |
| `facility`    | Facility Manager        | Jamie Lin                    | all 9                        | Facility shell     | Per-building admin. `canDeploy: true`.                        |
| `cleaning`    | Lead Custodian          | Maria Chen                   | hygiene, supply, amenity     | WorkerApp          | Linked to a `team_members` row by `user_id`.                  |
| `maintenance` | HVAC / Maintenance Tech | Darnell Price                | hvac, uptime, safety, energy | WorkerApp          | Linked to a `team_members` row.                               |
| `security`    | Security Lead           | Ivan Kovac                   | security, safety             | WorkerApp          | Linked to a `team_members` row.                               |

### Stub-level roles (recognized end-to-end, full UX shells deferred)

These are recognized by `personaOf`, the chat persona prompt, the SLA / agent / incident filters, and the role-picker in Admin → Users. The right-rail "Merlin handled today" feed has stub copy. **Their dedicated UX shells (portfolio dashboard, tenant ticket inbox, auditor evidence-export view, dispatcher work-order grid, exec rollup) are not built yet** — `personaOf` returns the named persona but `App.jsx` doesn't yet branch on it, so the user lands on whatever the role's `merlinPersona` chat prompt + filter scope allow them to see. Practically: the closest existing shell renders. No demo user has any of these roles today.

| Role id            | Title                      | Demo user       | Domains                                      | Why deferred                                                                                                |
| ------------------ | -------------------------- | --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `property_manager` | VP Real Estate             | Sarah Mendelson | all 9                                        | Needs a portfolio rollup view across many buildings. Today's `facility_manager` shell handles one building. |
| `tenant`           | Tenant Contact             | Akira Yamamoto  | hygiene, amenity, space                      | Needs a scoped read of "the floors I lease" with no peek at other tenants or building-owner ops.            |
| `auditor`          | SOC 2 / Compliance Auditor | Patricia Owusu  | safety, security, uptime, hygiene            | Needs time-bounded read-only credentials + an evidence-export surface.                                      |
| `fm_network`       | CBRE / JLL Dispatcher      | Marcus Vance    | hygiene, hvac, uptime, space, safety, supply | Needs a cross-customer work-order grid with contractor SLA scoring.                                         |
| `executive`        | CFO                        | Daniel Rivera   | all 9                                        | Needs an exec-only summary surface (cost rollups, top wins, risk register).                                 |

---

## Personas (derived shells)

`PERSONAS` in `src/app/personas.js`. The shell selector. `personaOf(session, org)` runs the resolution every time the active org or session changes.

| Persona              | When                                              | Built?                                         |
| -------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `superadmin`         | role=superadmin (anywhere)                        | ✅                                             |
| `facility_manager`   | role=facility at a real_estate or adaptiv org     | ✅                                             |
| `contractor_manager` | role=facility at a contractor org                 | ✅                                             |
| `worker`             | role=cleaning / maintenance / security at any org | ✅                                             |
| `property_manager`   | role=property_manager                             | ⏳ stub — falls through to facility_manager UI |
| `tenant`             | role=tenant                                       | ⏳ stub — falls through to worker-ish UI       |
| `auditor`            | role=auditor                                      | ⏳ stub — falls through to facility shell      |
| `fm_network`         | role=fm_network                                   | ⏳ stub — falls through to facility shell      |
| `executive`          | role=executive                                    | ⏳ stub — falls through to facility shell      |

---

## Filters keyed on role

Three helpers in `roles.js` decide what subset a role sees on each surface:

### `filterIncidentsForRole(incidents, roleId)`

- Sees everything: `superadmin`, `facility`, `property_manager`, `executive`, `auditor`, `fm_network`
- Domain-filtered: `cleaning` (hygiene/supply/amenity), `maintenance` (hvac/uptime/safety/energy), `security` (security/safety), `tenant` (hygiene/amenity/space)

### `filterSlasForRole(slas, roleId)`

- Sees everything: same six "see-all" roles as above
- Allowlist (regex on SLA name):
  - `cleaning` → `^Hygiene`, `^Supplies`, `^Space`
  - `maintenance` → `^Comfort`, `^Air`, `^Energy`
  - `security` → `^Security`, `^Safety`
  - `tenant` → `^Hygiene`, `^Comfort`, `^Air`, `^Space`

### `filterAgentsForRole(agents, roleId)`

- Sees every agent: same six "see-all" roles
- Whitelist:
  - `cleaning` → cleaning, supply, compliance
  - `maintenance` → hvac, energy, compliance
  - `security` → security, compliance
  - `tenant` → cleaning, space, hvac

---

## Auth gates

In `src/app/auth.js`:

- `assignableRoles(actorRole)` — what the role-picker dropdown shows. Superadmin can grant any role including the deferred-list ones; facility can grant `cleaning / maintenance / security / tenant` only.
- `canAccessAdmin(actorRole)` — `superadmin`, `facility`, `property_manager` see the Admin gear menu.
- `canAccessAgentic(actorRole)` — superadmin only.

---

## Adding a new role

End-to-end checklist:

1. **`src/app/roles.js`** — add an entry to `ROLES` with id, name, who, domains, deviceTypes, merlinPersona, suggestions, kpis. Add a matching block to `MERLIN_TODAY_BY_ROLE`.
2. **`src/app/roles.js`** — extend `filterIncidentsForRole`, `filterSlasForRole`, `filterAgentsForRole` if the role isn't a "see-all".
3. **`src/app/personas.js`** — add a constant to `PERSONAS`, a branch in `personaOf`, and a label in `personaLabel`.
4. **`src/app/auth.js`** — extend `assignableRoles` for who can grant it. Optionally `canAccessAdmin` / `canAccessAgentic` for high-trust roles.
5. **No schema migration needed** — `profiles.role` is free-text and RLS only hardcodes `is_superadmin()`. New string values just work.
6. **Update this doc**.

If the new role needs its own dedicated shell (vs reusing an existing persona's UI), build it as a sibling of `WorkerApp.jsx` / `App.jsx` and switch on the persona in `App.jsx`.

---

## Live-tenancy reality check (as of 2026-05-11)

Four orgs in prod, three of the three tenant kinds exercised:

| Org                 | Kind          | Members | What it demos                                                                                           |
| ------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Meridian HQ         | `real_estate` | 7       | Flagship single-tower scenario (50 floors, ~797 devices, full agent runtime)                            |
| First Empire Bank 2 | `real_estate` | 1 (jb)  | 581-branch ecosystem, daily-cleaning compliance scenario                                                |
| SparkleCo           | `contractor`  | 4       | Holds 2 contracts (Meridian active + FEB2 draft); `facility` role here renders Contractor Manager shell |
| Adaptiv             | `adaptiv`     | 1 (jb)  | Platform-admin gate; not a customer workspace, no operational data                                      |

The `demo` org-kind was retired in migration 068. Demo accounts at Meridian (Jamie / Maria / Darnell / Ivan) plus Lisa Sparkle at SparkleCo cover the 5 core roles end-to-end. The 5 stub roles (`property_manager` / `tenant` / `auditor` / `fm_network` / `executive`) are recognized but no demo user holds them.
