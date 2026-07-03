# Working with SLAs

An SLA in Merlin is a **measurable target with a clear owner**. The agents read SLAs to know which signals matter; the ANTICIPATE → SLAs dashboard scores you against them; and the Activity feed bubbles up incidents that put one at risk.

There are two kinds of SLA, and they're deliberately different.

| Kind                   | What it is                                                                                                                                                  | Who can create                                                                                 | Who can see it                                    | Feeds agent reasoning? |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------- |
| **Service Agreement**  | A formal commitment between a buyer (facility manager) and a deliverer (internal staff _or_ an external contractor). Carries terms that lock once accepted. | Workspace Owner / Admin (internal) or a contractor manager with an active contract (cross-org) | Both parties                                      | Yes                    |
| **Performance Target** | An informal KPI you set for yourself or your team. No counterparty, no contract — just a goal.                                                              | Anyone in the org                                                                              | Private by default; admin can promote to org-wide | No — dashboard-only    |

Use **agreements** for things you'd put in a contract. Use **targets** for personal goals and team-internal stretch metrics.

---

## Where SLAs live

> **Where:** Admin → **SLAs**

Two sub-tabs at the top of the section:

- **Service Agreements** — formal commitments (the default tab)
- **Performance Targets** — personal/team KPIs

Contractors don't see Admin → SLAs. Instead they get **two** surfaces: a read-only **SLA tracker** at **MONITOR → SLAs** (follow live adherence, grouped by service line) and the management roll-up at **OPERATE → Contracts → SLAs** (propose / amend / accept). See [Contractor side](#contractor-side) below.

---

## Creating a Service Agreement

> **Where:** Admin → SLAs → Service Agreements → **+ New SLA**

Available to roles: **Workspace Owner**, **Admin**, **Facility Manager** (or platform admin / superadmin).

1. Click **+ New SLA**. An inline form opens.
2. Fill in the basics:
   - **Name** — what shows on cards and in the agent's ask body. _e.g. "Hygiene — Response < 20m"_
   - **Domain** — coarse category, drives the icon + role-filtering: hygiene / comfort / air quality / supplies / security / compliance.
   - **Metric kind** — how the % is computed:
     - **Response time** — % of requests resolved within your chosen time limit
     - **Open-count threshold** — % of windows with the open count at or below your chosen limit
     - **Daily compliance** — % of devices that completed today's scheduled action
     - **Sensor threshold** — % of readings within tolerance (needs sensor data)
   - **Target (%)** — the bar you're holding yourself to. _e.g. 98._
   - The form changes the per-metric inputs depending on the metric kind you picked (the time limit, the open-count limit, and so on).
3. Fill in the accountability fields:
   - **Owner** (free text) — role or person on the hook. _e.g. "Cleaning Services Lead", "Building Operations"._ Shown on the SLA card + included in the agent's ask body so the human approver knows who's responsible.
   - **Description** — one-line context for managers reading the SLA later.
4. **Live data is available** checkbox — uncheck if the underlying sensor class isn't deployed yet. The SLA shows as **Pending data** until you have the inputs to compute it.
5. Click **Create SLA**.

Internal agreements (no contractor counterparty) are **automatically marked In effect** the moment they're created — there's no second party to accept them. They jump straight to the terms-locked state.

---

## Lifecycle of a Service Agreement

Every agreement moves through this lifecycle. The status pill on the row tells you where it is.

```
                +----------+         +-------------+
   create  -->  | Pending  |  Accept |  In effect  |
                +----------+   -->   +-------------+
                     |                      |
                     |                      | New version
                     | Cancel               v
                     v               +-------------+      Accept v2
                  archived           | Pending v2  |     -----------> In effect
                                     +-------------+               (v1 retired)
```

### Pending

- The other party hasn't accepted yet.
- The **author** can edit the terms freely or **Cancel proposal** to retire it.
- The **counterparty** sees an **Accept** button.
- Internal agreements never spend time here — they're auto-accepted on create.

### In effect

- Terms are **locked**. The Edit button is gone — replaced by **New version**.
- Both parties can retire the agreement, but neither can change terms in place.
- Merlin's agents + ANTICIPATE start scoring the org against it.

### Pending v2

- When either party clicks **New version** on an in-effect row, the form opens pre-filled with current terms. Submit creates a new row with **Pending** status that supersedes the current one.
- The original row shows a "A new version is pending acceptance — review it instead" hint.
- You **can't propose v3 while v2 is still pending** — review v2 first.

### Accept (the counterparty's move)

- One click on the Pending row's **Accept** button records the acceptance. The predecessor (if any) is retired at the same moment.
- Whoever is _not_ the author of the row is the accepter. For internal agreements (no counterparty), creation IS acceptance.

### Cancel / withdraw

- Pending rows can be cancelled by the **author** at any time. They're archived (not deleted) so the audit trail stays intact.
- Accepted rows can be retired by either party, but the row is kept for history.

---

## Creating a Performance Target

> **Where:** Admin → SLAs → Performance Targets → **+ New target**

Available to roles: **anyone** in the org.

1. Click **+ New target**. The form opens. Same shape as the agreement form, with **Owner** and **Live data** hidden — targets are self-owned and assumed to be measurable against your own activity.
2. Fill in name / domain / metric kind / target / description.
3. Click **Create target**.

The new target lands with **Private** visibility — only you can see it.

### Making a target visible to your team or org

The visibility pill on each target row is editable.

- **Private** — only you can see it.
- **Team** — anyone in the org can see it (functionally org-wide today; future iterations may scope this to building or department teams).
- **Org-wide** — anyone in the org can see it AND it surfaces on the optional ANTICIPATE overlay.

**Org-wide requires an Admin to bump it** — a worker can keep their target private or share with the team, but only a Workspace Owner / Admin can promote it to org-wide. This is the "manager bump" — it prevents personal goals from cluttering the org-wide scorecard without a manager's nod.

---

## Where each kind shows up

| Surface                                              | What it shows                                                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin → SLAs → Agreements** (owner)                | All agreements you're a party to (both pending and in-effect). Edit / accept / cancel actions here.                                                                    |
| **Admin → SLAs → Targets** (owner)                   | All targets the visibility settings allow you to see. Yours always; teammates' team-visible or org-visible ones too.                                                   |
| **ANTICIPATE → SLAs** (owner)                        | Live performance scoring — the SLA dashboard. **In-effect agreements only.** Targets and pending proposals never appear here.                                          |
| **Dashboard widgets (KPI Ring, SLA Breach Strip)**   | Same as ANTICIPATE → SLAs — agreements only.                                                                                                                           |
| **Agent reasoning** (Compliance + per-domain agents) | Same — in-effect agreements only. Targets are deliberately excluded so a single worker's goal doesn't tilt org-wide automation.                                        |
| **MONITOR → SLAs (contractor tracker)**              | Read-only follow view: every SLA you're accountable for, **grouped by service line**, with live adherence, status, trend, and click-a-row detail (parameters + owner). |
| **OPERATE → Contracts → SLAs (contractors)**         | The management roll-up of agreements you've proposed or are counterparty to — propose / amend / accept.                                                                |

---

## Contractor side

If your organization is a contractor org (e.g. SparkleCo servicing FEB and Meridian, or Apex on Meridian HQ), you don't see Admin → SLAs. You get two surfaces:

> **Follow:** MONITOR → **SLAs** — a read-only **tracker** of every SLA you're accountable for, **grouped by service line** (Cleaning / Security / Hospitality / Maintenance). Each row shows live adherence vs target, status (on target / at risk / breaching / pending), a trend line, and an **Ask Merlin** button; **click a row** to open its detail — parameters (metric, target, current, window, sample, breaches) and ownership (client, service line, SLA owner). Nothing is editable here — the **Manage in Contracts** button jumps to the management surface.
>
> **Manage:** OPERATE → Contracts → **SLAs** — the cross-customer roll-up where you **propose, amend, and accept**.

The management page rolls up every agreement you're a party to, grouped by customer. Each customer becomes its own card; the rows within use the same agreement chrome you see on the customer side.

### Proposing a new agreement to a customer

1. Click **+ Propose new agreement**. An inline three-step form opens.
2. **Pick a contract** — dropdown of your active contracts (each shows the customer name + service kind).
3. **Pick a location** — filtered to that contract's covered locations.
4. **Fill in the SLA form** — name / domain / metric kind / target / config / owner / description. Same fields as the customer side.
5. Click **Create SLA**.

The row appears in your list with a **Pending** pill. At the same moment, it appears in the customer's Admin → SLAs → Agreements tab with the same Pending pill and an **Accept** button. When they click Accept, it becomes In effect on both sides.

You can cancel a pending proposal at any time (it's yours until accepted). After accept, **both sides** can retire the agreement or propose a New version, but terms are locked.

### Why the cross-organization model

A contractor's agreement with a customer is, by design, a two-party commitment. The author proposes; the counterparty accepts. Either side can amend by creating a new version that the other side accepts. The agreement is shared with both organizations and tied to the contract that governs the relationship.

---

## Versioning in practice

You can't change the target percentage, metric kind, configuration, or domain of an accepted agreement. To amend, you create a new version.

1. On an in-effect row, click **New version**. The form opens with the current terms pre-filled.
2. Edit the bits that need changing (target %, response time, etc.).
3. Click **Create SLA**. The new row appears with **Pending**, marked as superseding the original.
4. The original row now shows "A new version is pending acceptance — review it instead." The Edit + New version actions are gone — you focus on resolving v2.
5. The other party clicks **Accept** on v2. At that moment v2 becomes the active version and v1 is retired together. The org now operates against v2.

If you accidentally proposed v2 and want to back out, click **Cancel proposal** on the v2 row. The original v1 stays In effect.

Old versions are kept for audit history — they don't show in the active list but can be surfaced by a future "version history" view if you need to reconstruct a timeline.

---

## What's mutable on an accepted agreement

Once accepted, the **terms** are immutable:

- The target %, metric kind, configuration (response time / threshold / window times / etc.), domain, and location
- The parties to the agreement (the customer, the counterparty, the authoring organization, and the governing contract)

These you can still change:

- **Name** — fix typos without re-versioning
- **Display order** — re-sort the list
- **Owner** — the accountable role rotates ("Cleaning Services Lead" → "Operations Lead, NY")
- **Active state** — archive when retired
- **Live-data flag** — flip from pending-data to live-data once the sensor class is deployed

Anything in the terms list requires a New version.

---

## Quick reference

| Action                            | Where                                                                 | Who                      | Result                                                                     |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| Create an internal agreement      | Admin → SLAs → Agreements → + New SLA                                 | Owner / Admin / Facility | Row appears with **In effect** pill (auto-accepted)                        |
| Propose to a contractor           | (same as above, the contractor row gets a Pending pill on their side) | Owner / Admin / Facility | Contractor sees Accept button on their side                                |
| Contractor proposes to a customer | OPERATE → Contracts → SLAs → + Propose new agreement                  | Contractor manager       | Customer sees Pending row with Accept button                               |
| Accept a pending proposal         | Admin → SLAs → Agreements (or OPERATE → Contracts → SLAs)             | The counterparty         | Row flips to **In effect**; any predecessor retires                        |
| Follow your SLAs (contractor)     | MONITOR → SLAs (the tracker)                                          | Contractor               | Read-only — live adherence grouped by service line, click a row for detail |
| Amend an accepted agreement       | New version button on the row                                         | Either party             | Pending v2 appears; original keeps running until accepted                  |
| Cancel your own pending proposal  | Cancel proposal button                                                | Author                   | Row archives; if there was a v1 predecessor, it stays in effect            |
| Create a personal target          | Admin → SLAs → Performance Targets → + New target                     | Anyone                   | Private target, only you can see it                                        |
| Promote a target to org-wide      | Visibility selector on the row                                        | Admin only               | Target shows up on the optional ANTICIPATE overlay                         |

---

## Troubleshooting

**I clicked Accept and got "caller is not the accepter."**
You're the author of that pending row, not the counterparty. The other side needs to accept. If you authored AND you're the only party (internal agreement), it should have auto-accepted at create — if it didn't, something went wrong; ping support.

**The Edit button is greyed out on an agreement I created.**
It's been accepted. Click **New version** instead.

**I tried to make my target org-wide and got "requires admin (manager bump)."**
Working as designed — only Workspace Owners / Admins can promote a target to org-wide. Ask one of them.

**My agreement shows "A new version is pending acceptance — review it instead" but I never proposed v2.**
The other party did. Look further down the list for the Pending row with the predecessor link — accept or cancel it.

**A contractor told me they proposed an SLA but I don't see it.**
Check that you (a) have an active contract with that contractor and (b) the contract covers the location they picked. Merlin only shows cross-organization agreements when there's an active contract between you — without one, the agreement stays hidden.
