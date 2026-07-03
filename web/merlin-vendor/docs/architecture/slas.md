# SLAs — how they're created, where to see them, how they're updated

An SLA in Merlin is a **service-level agreement**: a measurable promise about how
a service line is performed (e.g. _"restroom hygiene response < 20 min"_,
_"0 supply stockouts"_, _"security patrol rounds on schedule"_). This doc covers
the full lifecycle: the data model, how SLAs get created, every place they're
visible, and how they're changed once they exist.

> **User-facing version:** for the click-here, what-you'll-see walkthrough (no
> schema), see [../guides/slas.md](../guides/slas.md).

Backing table: `public.slas`. Key client code: [`src/app/slas-data.js`](../../src/app/slas-data.js)
(hooks + RPC wrappers), [`src/app/slas-ui.jsx`](../../src/app/slas-ui.jsx)
(`SlaForm`, `SlaRow`, metric options). Schema/lifecycle migrations: **044** (base),
**045** (owner_label), **142** (scope + versioning columns), **143** (accept +
lock + supersession triggers), **148** (cross-org accept of data sources).

---

## 1. The shape of an SLA

Every SLA is one row in `public.slas`. The columns that matter:

| Column                       | Meaning                                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (text)                  | Stable id, e.g. `hq-sla-apex-cleaning-2`.                                                                                                                                                                               |
| `organization_id` (uuid)     | **Where the SLA lives** — always the _client / building-owner_ org, even when a contractor authored it. RLS scopes reads here.                                                                                          |
| `name`, `domain`             | Display name + a fine-grained domain tag (`hygiene`, `supplies`, `safety`, `hvac`, `uptime`, `amenity`, `security`, …). The domain is _finer_ than the four service lines and resolves up to a line for grouping/icons. |
| `metric_kind`                | How adherence is measured. One of `response_time`, `count`, `compliance`, `threshold` (see `SLA_METRIC_OPTIONS`).                                                                                                       |
| `target_pct`                 | The numeric target (e.g. `95`).                                                                                                                                                                                         |
| `config` (jsonb)             | Metric-specific parameters (window, thresholds, etc.).                                                                                                                                                                  |
| `scope`                      | `agreement` (two-party, between a client and a contractor) or `target` (the org's own internal KPI — no counterparty).                                                                                                  |
| `authored_by_org`            | Which org _wrote_ the terms.                                                                                                                                                                                            |
| `counterparty_org`           | The _other_ party (the deliverer). For agreements this is the contractor; null for internal targets.                                                                                                                    |
| `contract_id`, `location_id` | The contract + building/area the SLA is scoped to.                                                                                                                                                                      |
| `accepted_at`                | When the counterparty accepted. **Null = pending** (proposed, not in force).                                                                                                                                            |
| `active`, `superseded_by`    | `active=false` once a row is cancelled or replaced by a newer version; `superseded_by` points a new version at the row it replaces.                                                                                     |
| `owner_label`                | Free-text "who's accountable" role (e.g. _"Apex Cleaning Lead"_).                                                                                                                                                       |
| `computable`                 | Whether live % can be computed yet (false → shows as _Pending data_).                                                                                                                                                   |
| `visibility`                 | `private` / `team` / shared — controls who sees a `target`-scope SLA.                                                                                                                                                   |

**Two flavours, by `scope`:**

- **Agreements** (`scope='agreement'`) — a contractual SLA _between two orgs_: a
  client (`organization_id` / usually `authored_by_org`) holds a contractor
  (`counterparty_org`) to a target. These go through a **propose → accept** flow
  and their terms **lock on acceptance**.
- **Targets** (`scope='target'`) — the org's own internal KPI, no counterparty
  (e.g. the Energy / Security / Space agent SLAs). These **auto-accept on insert**
  (trigger `tg_slas_auto_accept_internal`) and have no lock.

---

## 2. How SLAs are created

### a) By the building owner / FM — `Admin → SLAs`

The canonical authoring surface. [`Admin.jsx`](../../src/app/Admin.jsx) →
**SLAs** section (`SlasSection`, hidden for contractor orgs) has two tabs:

- **Agreements** — create an SLA the owner holds a contractor to. The `SlaForm`
  captures name, domain, `metric_kind`, `target_pct`, and metric `config`; on
  submit it inserts with `scope='agreement'`, `authored_by_org` = the owner,
  `counterparty_org` = the contractor, `contract_id`/`location_id` from the
  chosen contract, and `accepted_at = null` (pending until the contractor
  accepts).
- **Targets** — create an internal KPI (`scope='target'`, no counterparty).
  Auto-accepted on insert; governed only by `visibility`.

SLAs are also captured during onboarding via **Admin → Setup → Contracts + SLAs**
(see [building-setup.md](building-setup.md)).

### b) By the contractor — `OPERATE → Contracts → SLAs`

[`ContractorSlas.jsx`](../../src/app/ContractorSlas.jsx) gives a contractor a
cross-customer roll-up of every agreement it's a party to, plus a **"Propose new
agreement"** flow:

1. Pick one of the contractor's active **contracts** (carries the customer +
   service line + covered locations).
2. Pick a **location** from that contract.
3. Fill the standard `SlaForm` (name, domain, metric, target, config).
4. Submit → inserts with `scope='agreement'`, `authored_by_org` = the
   **contractor**, `organization_id` = the **customer** (`contract.manager_org_id`),
   `counterparty_org` = the contractor, `accepted_at = null`.

The customer then sees the proposed row with a _Pending_ pill on their side and
accepts it (below).

### c) Internal / agent SLAs (seeded)

The org's own performance SLAs (Energy / Security / Space / Safety, etc.) are
`scope='target'` rows seeded by migration (e.g. **054**). They auto-accept and
need no counterparty.

> **Whichever path:** an _agreement_ is born **pending** (`accepted_at = null`)
> and isn't in force until the other party accepts. A _target_ is in force
> immediately.

---

## 3. Where to see SLAs in the system

### Building owner / FM

- **`Admin → SLAs`** — the management surface (Agreements + Targets tabs): create,
  edit pending, accept proposals, set visibility.
- **`ANTICIPATE → SLAs`** — the owner SLA **dashboard** (`insights-slas`): live
  adherence vs target, what's at risk, pending clauses. Performance via
  `useSlaPerformance(orgId)`, which reads the org's own source tables
  (`device_requests`, `agent_*`, servicing) over a rolling window (14 days by
  default) and grades each clause with `statusFor()`.
- **`MONITOR → Hypervisor` → SLA mode** — SLAs overlaid on the 3D building view.
- **`MONITOR → Cockpit`** — per-service-line tiles roll SLA adherence into the KPI grid.

### Contractor

- **`MONITOR → SLAs`** (the **SLA tracker**,
  [`ContractorSlaTracker.jsx`](../../src/app/ContractorSlaTracker.jsx)) — the
  read/follow surface: every SLA the contractor is accountable for, **grouped by
  service line**, with live adherence vs target, status (on-target / at-risk /
  breaching / pending), a trend sparkline, and **click-a-row** for the detail
  panel (parameters + ownership). Read-only.
- **`OPERATE → Contracts → SLAs`** — the management surface (propose / amend /
  accept). The "Manage in Contracts" link on the tracker points here.
- **`MONITOR → Scorecard`**, **Now bubbles**, **Hypervisor SLA mode** also surface
  SLA signals.

> **Live % data path — important.** The owner owns both the SLA rows _and_ the
> source signals, and RLS locks both to the owner org. A contractor therefore
> **cannot** read them directly. Contractor surfaces get live % through the
> party-guarded server bridge **`/api/contracts/:id/performance`**, which does the
> cross-org compute with the service role (and, for replay/demo orgs, synthesizes
> believable per-clause numbers anchored to real servicing adherence). The
> tracker and the Hypervisor contractor SLA view both read this bridge.

**Status grading** (`statusFor(current, target)`): `current ≥ target` → **ok**;
within 5 points → **at-risk**; otherwise → **breach**; `computable=false` →
**pending**.

---

## 4. How SLAs are updated

The rules differ before vs after acceptance — this is the core of the model.

### Accepting a proposed agreement

The counterparty accepts via the `accept_sla(p_sla_id)` RPC
(`acceptSla()` in `slas-data.js`; SECURITY DEFINER, migration 143). Guards:

- Only `scope='agreement'` rows with a counterparty (internal targets auto-accept).
- Only the **accepter** (the party that isn't the author) may call it.
- The row must be active and not already accepted.
- On success it stamps `accepted_at`; if this row supersedes a predecessor
  (`superseded_by` set), the predecessor flips to `active=false`.

`actorRoleForAgreement(sla, callerOrgId)` resolves whether the current org is the
`author`, the `accepter`, or `both` (internal) — the UI uses this to show the
right action (Edit vs Accept).

### Editing a _pending_ SLA (before acceptance)

While `accepted_at IS NULL`, the **authoring** org can freely edit the terms
(name, `target_pct`, `metric_kind`, `config`, `domain`, …). The RLS UPDATE policy
only lets the authoring side touch pending rows; the client funnels edits through
`stripImmutable()` (drops create-time-only / RPC-managed fields). Editing a
pending proposal is the normal way to iterate before the other party signs off.

### Changing an _accepted_ SLA → amend via versioning

Once `accepted_at` is set, terms are **locked** by trigger
`tg_slas_lock_accepted_terms` (migration 143): `target_pct`, `metric_kind`,
`config`, `domain`, `location_id`, `organization_id`, and `scope` become
immutable, and `accepted_at` is one-way. Any attempt to change them raises a
`check_violation`. (This is the durable gotcha behind FK ordering elsewhere — you
can't quietly mutate locked terms.)

To change accepted terms you **version** the SLA:

1. Insert a **new** SLA row with `superseded_by` = the accepted row's id (and the
   same `organization_id` + `counterparty_org`).
2. The new row goes through the normal **propose → accept** flow.
3. When the successor is accepted, `accept_sla` flips the **predecessor**
   `active = false`, so only the new version is live.

Trigger `tg_slas_validate_supersession` enforces the rules: no self-reference, the
predecessor must exist, be an **accepted agreement** (not still pending), and match
org + counterparty.

### Things that are _not_ locked

- **Visibility** of a `target`-scope SLA — `setTargetVisibility(slaId, visibility)`.
- **Active flag** — flips on accept (predecessor), cancel, or reject.

### Related knobs (separate tables, not the SLA row)

- **Penalties** — the FM sets per-contract penalty terms via
  `setContractPenalty()` (mig 237; floor / rate / cap / escalation). See
  `contract_penalty_ledger` + the SLA-penalties work.
- **Contractor alert thresholds** — `setContractorThreshold()` (mig 227) sets the
  adherence level + lead time at which Merlin warns the contractor a line is
  _forecast_ to dip.

---

## TL;DR

- An SLA is a row in `public.slas`. **Agreements** are two-party and lock on
  acceptance; **targets** are the org's own KPIs and auto-accept.
- **Created** by the owner in `Admin → SLAs`, by the contractor via
  `OPERATE → Contracts → SLAs → Propose`, or seeded for internal agent KPIs. An
  agreement starts **pending** until the counterparty accepts (`accept_sla`).
- **Seen** by the owner in `Admin → SLAs` + `ANTICIPATE → SLAs` (+ Hypervisor /
  Cockpit), and by the contractor in `MONITOR → SLAs` (tracker) +
  `OPERATE → Contracts → SLAs`. Contractor live % comes from the
  `/api/contracts/:id/performance` bridge, not direct reads.
- **Updated**: freely while pending (authoring side only); after acceptance the
  terms are **locked** — change them by creating a **new version** (`superseded_by`)
  that the counterparty re-accepts.
