# Contractor self-serve — the dual-path model

> **Audience:** engineering. End-user view in [`../guides/contractor.md`](../guides/contractor.md).
> **Status:** 🟢 Canonical — fully shipped through migrations 090–092, PRs #202–#204.
> **Last shipped:** 2026-05-11.

The contractor model has two operational paths. A contractor org can be:

1. **Manager-invited** — an FM-owned (real*estate) org activates a contract that names the contractor as `contractor_org`, scoped to one or more `contract_locations`. The contractor operates \_inside* the FM's tree (rooms, zones, routes, devices the FM owns).
2. **Contractor-led / self-serve** — the contractor org owns its own buildings (`locations.organization_id = contractor_org`), with no FM counterparty needed. They operate inside their own tree.

The same contractor org can hold both kinds of work simultaneously. SparkleCo, ShineRight, NorthStar, and GuardWatch all hold path-1 contracts on Meridian HQ today; any of them can also create path-2 buildings for clients that don't run an FM tenant in Merlin.

This document captures the architecture that makes both paths work without forking the codebase: shared RLS predicates, shared write policies, shared UI surfaces, with the discriminator handled at the org-stamping layer.

---

## Core data shapes

### `organizations.kind`

Three values today: `real_estate`, `contractor`, `adaptiv`. The kind is the primary discriminator. RLS write policies that gate contractor-only paths check `exists (select 1 from organizations where id = current_user_org() and kind = 'contractor')`.

A contractor org's `kind` is the same whether the org has zero contracts (pure self-serve) or fifty contracts (huge portfolio). The contracts table is the source of truth for what _work_ the contractor has access to in other tenants' trees.

### `contracts` + `contract_locations`

From migration 026. The contract row has:

- `manager_org_id` (FM party) and `contractor_org_id` (service party)
- `service_kind` (cleaning / maintenance / hvac / electrical / plumbing / security / waste / pest_control / landscaping / other)
- `status` (draft / active / expired / terminated)
- `monthly_value` (auto-amends on accepted proposal with a non-zero delta)
- `sla_summary` (jsonb — scenario-specific shape)

The `contract_locations` join table lists every location id the contract covers (text type, matches `locations.id`). One contract can cover N locations; one location can sit under N contracts (e.g. cleaning + HVAC contractors both serve Meridian's `'hq'`).

### `locations.organization_id`

Every location row carries `organization_id` — the org that **owns** the building tree this location belongs to. For Meridian HQ, every `'hq*'` location has `organization_id = Meridian-org`. For a contractor-owned building, the building's locations have `organization_id = contractor-org`.

This single column is the discriminator for path 1 vs path 2 at the row level. A contractor reading `locations` rows sees:

- Their own org's rows directly (via the `organization_id = current_user_org()` branch of `locations_read`)
- The FM's rows for any contracted building, via `is_contractor_on_location(id)` — the subtree-aware function from migration 091 — which checks the row's `id` against every `contract_locations.location_id` for active contracts where the contractor is the contractor_org party

---

## RLS predicates (migrations 028 + 090 + 091)

### `is_contractor_on_location(target_location text) → boolean`

The cross-tenant read predicate. Returns `true` when the caller's `current_user_org()` is the contractor party on **any** active contract whose `contract_locations` covers `target_location` OR an ancestor of it.

**Subtree matching is critical.** Migration 028 originally shipped this as an exact-match check. That meant a contractor with a contract on `'hq'` (the building root) saw the `'hq'` row but **not** any of its children (`'hq-fl-3-r-floor-3-conf-maple'`, etc.) — the customer's `customCache` for the Hypervisor tree was empty past the root. Migration 091 replaced the body with a position-based prefix check:

```sql
target_location = cl.location_id
or position(cl.location_id || '-' in target_location) = 1
```

`position(prefix in target) = 1` is the safe equivalent of `target LIKE prefix || '%'` — it works even when `cl.location_id` contains `_` or other LIKE metacharacters. The trailing `'-'` boundary prevents `'hq'` from matching `'hqx-...'`.

This function is `SECURITY DEFINER` so the policy-side reads against `contracts + contract_locations` succeed without granting the caller broader rights on those tables.

### `contractor_manager_org_for_location(target_location text) → uuid`

The write-side stamping helper. For a contracted location, returns the **manager_org_id** of the most-specific active contract the caller holds. Used by every path-1 `_contractor_managed` write policy as the required `organization_id` for new rows.

Longest-prefix-wins selection — if a contractor holds both a building-root contract and a floor-specific contract, the floor contract's manager_org wins (relevant when a contractor is sub-engaged for a specific subtree).

### `is_contractor_on_contract(target_contract uuid) → boolean`

Migration 028's original helper. Used by route-side policies (routes / route_zones / route_assignments) where the row already has a `contract_id` reference. Faster than the location-subtree match when the contract is in hand.

---

## Write policy shape (the `_contractor_managed` vs `_contractor_self` pattern)

For every table that contractors can write to (`routes`, `route_zones`, `route_assignments`, `locations`, `building_zones`), we add **two parallel write policies** that sit alongside the existing FM-side policies:

### Path 1 — `_contractor_managed`

```sql
create policy locations_write_ins_contractor_managed on public.locations
  for insert with check (
    public.is_contractor_on_location(id)
    and organization_id = public.contractor_manager_org_for_location(id)
  );
```

Gate: caller has an active contract on this location's subtree, AND the row is stamped with the contract's manager_org_id. The stamp requirement is what keeps the FM's own-org read branch working — a contractor-created row on a Meridian floor lands with `organization_id = Meridian-org`, so Lily Park sees it natively without us needing a separate cross-org read path on every table.

### Path 2 — `_contractor_self`

```sql
create policy locations_write_ins_contractor_self on public.locations
  for insert with check (
    organization_id = public.current_user_org()
    and exists (
      select 1 from public.organizations
      where id = public.current_user_org() and kind = 'contractor'
    )
  );
```

Gate: caller is in a contractor-kind org, AND the row is stamped with their own org. Equivalent to the FM-side write policy in spirit, just gated on `kind = 'contractor'` so non-contractor orgs can't accidentally write through this path.

### RLS OR-combine semantics

Postgres OR-combines multiple policies on the same action. Adding two `_contractor_*` policies to a table that already had a `_write_ins` policy creates three accept-paths:

1. FM facility/superadmin via the original gate
2. Contractor via active contract (path 1)
3. Contractor via own-org write (path 2)

A row only needs to satisfy **one** to pass the `with check` constraint. There's no interference between the paths.

---

## Org-id inheritance in the client (custom-locations.js)

The RLS policies enforce _what_ the `organization_id` must be on a contractor write. The client code makes that automatic by **inheriting from the parent location**:

```js
// custom-locations.js — createChildLocation
const rec = {
  ...,
  // PR2: contractor admin creating under a contracted FM building
  // inherits the FM's organization_id from the parent. For FM in-house
  // flows the parent's org equals the caller's session org so this is
  // a no-op rename of where the org id comes from.
  organizationId: parent.organizationId || getSession()?.organizationId || null,
};
```

This is the keystone of the dual-path model on the UI side. The same `createChildLocation` function handles both:

- Lisa creating Floor 51 under Meridian's `'hq'` → parent `'hq'`'s org is Meridian's → new row stamps Meridian → RLS path-1 policy passes → FM sees the new floor natively
- Lisa creating Floor 1 under her own `'sparkleco-acme'` building → parent's org is SparkleCo → new row stamps SparkleCo → RLS path-2 policy passes

The Hypervisor's inline tree CRUD ("+ Add child", rename, delete) and bulk-load CSV ride on top of `createChildLocation`. No fork.

### `createTopLevelBuilding` (PR3)

For self-serve building creation (the `+ New building` CTA in ContractorApp), there's no parent to inherit from. `createTopLevelBuilding({ name })` explicitly stamps `organization_id = getSession()?.organizationId` and inserts a parent-less row. RLS path-2 policy accepts because the contractor org is `kind = 'contractor'`.

---

## Hypervisor scoping (HypervisorPage props)

`HypervisorPage` was originally hard-coded to fetch the location tree filtered by `session?.organizationId`. For a contractor visiting a contracted FM building, that returns empty — the rows are owned by the FM, not the contractor. Two new props bridge the gap:

```jsx
export function HypervisorPage({ building, onOpenChat, orgIdOverride, editable: editableProp }) {
  const orgId = orgIdOverride ?? session?.organizationId;
  const editable = editableProp ?? !orgIdOverride;
  ...
}
```

ContractorApp's Buildings tab uses both:

- `orgIdOverride={building.managerOrgId}` for contracted buildings → tree fetches against the FM's org, returning Meridian's 50 floors
- For self-owned buildings, no override → tree fetches against the contractor's own org

`editable` defaults to `!orgIdOverride` (so contracted buildings get an extra opt-in step) but is now `true` for both paths since RLS handles authorization — the prop just decides whether bulk-load + inline CRUD affordances render.

---

## Migrations index

| Migration                                | What it adds                                                                                                                                                                  | Path                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `026_contracts.sql`                      | Contracts table + contract_locations join + service_kind enum                                                                                                                 | both (foundational) |
| `028_contractor_rls.sql`                 | Read predicates: `is_contractor_on_contract`, `is_contractor_on_location` (exact match, later widened)                                                                        | path 1              |
| `090_contractor_write_via_contract.sql`  | Write policies on routes / route_zones / route_assignments. Helper `manager_org_for_contract(contract_id)`.                                                                   | path 1              |
| `091_contractor_locations_and_zones.sql` | Subtree fix for `is_contractor_on_location` (position-based prefix). Write policies on locations + building_zones. Helper `contractor_manager_org_for_location(location_id)`. | both                |
| `092_seed_additional_contractors.sql`    | Seeds ShineRight + NorthStar + GuardWatch with 5 crew each + active Meridian contracts + 2 routes per contractor + admin demo user.                                           | both (data only)    |

---

## "Contractor admin" — a note on roles vs org kind

`profiles.role` is a 10-value enum (`superadmin`, `facility`, `cleaning`, `maintenance`, `security`, `property_manager`, `tenant`, `auditor`, `fm_network`, `executive`). It does **not** have a `contractor_admin` value.

A contractor's operations manager has `profile.role = 'facility'` AND sits in a `kind = 'contractor'` org. That combination is what triggers the contractor-manager persona, the ContractorApp shell, and the contractor chat persona. The discriminator is the org kind, not the profile role.

This means:

- `canAccessHypervisor()` (which gates on profile role) already passes for contractor admins without modification — `'facility'` is in the allow list.
- `can_write_team()` (same role check) already lets contractor admins manage their own crew roster.
- New write policies key on org kind, not profile role, because the role would also match an FM facility user.

If we ever need to distinguish "contractor admin" from "contractor crew member" inside a contractor org, we'd add it to the `user_role` enum — but the demo set today only seeds one user per contractor org (the ops manager), so the distinction hasn't been needed.

---

## What's still aspirational

See [`../reference/deferred.md`](../reference/deferred.md) for the full list. The biggest open ones tied to this model:

- **Email-invite onboarding for contractors** — today contractor orgs are created by platform admin or by the contractor signing in to ContractorApp (no first-creation handshake from the FM side). A path-1 "FM invites contractor by email + first contract is wired in the same flow" is a natural next step.
- **`organizations.kind = 'contractor'` extension** — if Adaptiv ever rolls out non-contractor service providers (e.g. inspection auditors, regulators) that need cross-tenant subtree read access, the same predicate shape would work — but the `kind` enum would need a new value and the policies broadened.
