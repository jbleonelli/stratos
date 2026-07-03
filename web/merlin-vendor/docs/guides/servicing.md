# Working with Servicing

**Servicing** is the live picture of _everything being done in a building_ — the day-to-day service work that keeps it running. Cleaning, security, hospitality, and maintenance, all in one place, each board showing what's on track, what's slipping against its SLA, and what needs a person right now.

It's the operational counterpart to the rest of Merlin: MONITOR tells you how the building _is_, ANTICIPATE tells you what's _coming_, and Servicing tells you what's _being done about it_ — and lets you act, raise work, and watch Merlin's servicing agent work alongside you.

> **Where:** OPERATE → **Services**

---

## The mental model

Servicing is three levels deep. You drill down; a back link brings you up.

```
Services (roll-up)            ← all four service lines at a glance
   └─ Cleaning / Security / Hospitality / Maintenance   (a domain overview)
        └─ a board            ← one area, e.g. Floors & Carpets, HVAC, Patrols
             └─ a row         ← one item, e.g. Zone 11 — expand for detail + actions
```

| Level                 | What it is                                                                            | What you do here                                           |
| --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Services overview** | The cross-domain roll-up. One card per service line.                                  | Spot which line needs attention; jump in.                  |
| **Domain overview**   | One service line's areas, grouped into buckets.                                       | See which _area_ is slipping; open its board.              |
| **Board**             | One area — a stat strip, a 7-day performance strip, and a "Needs attention" worklist. | Read the live state; act on what's pressing.               |
| **Row (item)**        | A single tracked thing in that area. Click to expand.                                 | See detail + trend; **Mark serviced** or **Raise ticket**. |

There are four domains and **35 areas** in total:

- **Cleaning** (15) — Bathrooms, Common Areas, Workspaces, Kitchens, Stairwells, Elevators, Exterior, Floors, Windows, Disinfection, Air Vents, Waste, Supplies, Laundry, Deep & Specialty.
- **Security** (6) — Access Control, Visitor Management, Surveillance/CCTV, Perimeter, Patrols & Rounds, Incidents & Alarms.
- **Hospitality** (6) — Reception, Concierge, Food & Beverage, Meeting & Events, Guest Requests, Mail & Packages.
- **Maintenance** (8) — HVAC, Electrical, Plumbing, Elevators & Lifts, Building Envelope, Grounds, Preventive Maintenance, Fire & Life Safety.

Each domain has its own colour so you read the canvas at a glance: **Cleaning** cyan · **Security** indigo · **Hospitality** amber · **Maintenance** orange.

---

## Navigating Services

Clicking **Services** in the OPERATE strip lands you on the **Services overview** (the roll-up). An inner strip lets you switch between the roll-up and the four domains:

```
SERVICING ›  [ Overview ]  Cleaning  Security  Hospitality  Maintenance
```

- **Overview** → the cross-domain roll-up.
- A **domain** → that line's grouped overview. Click any area card to open its **board**.
- On a board, the **‹ back** link returns you to the domain overview.

---

## Reading the Services overview (roll-up)

The roll-up answers "how are services doing overall, and where should I look first?"

- **Portfolio summary** across the top: **overall adherence**, **items tracked**, **overdue now**, **open requests** — the whole building's service health in four numbers.
- **One card per domain**, each showing:
  - an **adherence ring** (the % of items within their SLA),
  - a **trend sparkline** (last several days of that domain's adherence),
  - **overdue** and **open** pills,
  - the area count and total items tracked.

Click a card to drop into that domain's overview.

---

## Reading a domain overview

A domain overview is its areas as cards, grouped into buckets (e.g. Cleaning → _Spaces_ / _Surfaces & Air_ / _Supplies & Programs_; Security → _Access_ / _Monitoring_ / _Response_). Each card shows the area's **adherence %**, a **trend sparkline**, and **overdue / open** pills.

Cards are clickable — open one to see its board. An area with no data yet shows a muted "No data yet".

---

## Reading a board

Every board has the same three parts, so once you can read one you can read all 35.

1. **Stat strip** — the headline counts for _now_: total items, how many are overdue, how many have open requests.
2. **Performance strip — last 7 days** — SLA adherence (with a live **trend sparkline**), sessions, items serviced, requests resolved, and traffic/throughput.
3. **Needs attention** — the worklist, **ordered by urgency**: items with open requests first, then the most overdue versus the service SLA. A board that's all green shows "nothing pressing right now".

### Drilling into an item

Click any row to expand it. You'll see:

- **Detail stats** — the SLA window, time since last service, services in the last 24h, traffic, open count.
- A **7-day trend** for that item.
- Two actions (below).

---

## Acting on a board

Each expanded row gives you two real actions:

| Action                                                      | What it does                                                                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mark serviced** _(e.g. "Mark cleaned", "Mark patrolled")_ | Records the item as just serviced — resets its clock and clears any open request. The board updates immediately. Use it when the work is done.                                                                      |
| **Raise ticket**                                            | Creates a follow-able **ticket** for the item — title and detail pre-filled from the row, priority set from how pressing it is. It appears in **OPERATE → Tickets** and can be assigned, tracked, and closed there. |

> The two actions cover the two cases: _"this is handled"_ (Mark serviced) vs _"someone needs to own this"_ (Raise ticket). See [Working with Tickets](tickets.md) for the ticket lifecycle.

---

## The servicing agent

Merlin runs a **Servicing & SLAs** co-worker agent that watches every board alongside you. You'll see it work in three places:

| You'll see…                                                                  | Where                                        | What it means                                                                                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **An ask** — "Cleaning Floors: Zone 11 needs attention. Approve a dispatch?" | MONITOR → **My Day** (and the Activity feed) | The agent spotted a pressing item and wants your call. **Approve**, **Modify**, or **Dismiss**.                    |
| **An action** — "Dispatched crew to … and verified completion."              | OPERATE → **Activity**                       | The agent handled a routine overdue item itself; the board reflects it.                                            |
| **A ticket** — "Escalation: [Servicing] …"                                   | OPERATE → **Tickets**                        | An item breached its SLA badly enough that the agent escalated it to a person — a ticket is created automatically. |

The agent is part of Merlin's wider runtime — its autonomy (propose vs act vs escalate) is governed the same way as every other agent. See [Working with agents](agents.md).

---

## Definitions

| Term             | Meaning                                                                                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SLA window**   | The target interval for servicing an item (e.g. restrooms every 4h, HVAC every 24h, fire safety every 168h). Configured per (building, area) in `servicing_sla_targets` and sourced by the board — change a target there and the board's overdue calc + "needs attention" list follow. |
| **Overdue**      | Time since last service has passed the item's SLA window.                                                                                                                                                                                                                              |
| **Open request** | An occupant/manager request logged against the item that hasn't been resolved.                                                                                                                                                                                                         |
| **Adherence**    | The share of an area's items currently within their SLA window. The headline health number.                                                                                                                                                                                            |
| **Trend**        | Adherence over the last several days — captured hourly, so the sparkline reflects real movement, not a static figure.                                                                                                                                                                  |

---

## Common workflows

### 1. Morning triage (top-down)

1. OPERATE → **Services** → read the portfolio summary.
2. Find the domain with the lowest adherence / most overdue → open it.
3. Find the worst **area** card → open its board.
4. Work the **Needs attention** list top to bottom: expand a row, **Mark serviced** when done, or **Raise ticket** if it needs an owner.

### 2. Clear what Merlin surfaced (loop-driven)

1. MONITOR → **My Day** → review the **Servicing** asks.
2. **Approve** the dispatches you agree with (Merlin acts), **Dismiss** the ones you don't.
3. Anything escalated to a ticket shows in **OPERATE → Tickets** — assign and track it there.

### 3. Log work you did off-system

- On the relevant board, expand the item and hit **Mark serviced** so the record matches reality.

### 4. Hand a job to someone

- Expand the item → **Raise ticket** → go to **Tickets** to assign it (to a contractor org or a named crew), set a due date, and follow it to done.

---

## Notes & edge cases

- **Bathrooms** is a special cleaning area: on buildings with live Adaptiv devices it reads real device data; everywhere else it uses the building's own demo dataset. Either way it behaves like the other boards.
- **Real-estate buildings only.** Servicing appears for real-estate orgs; contractor-only workspaces don't see it.
- **Per-building.** Boards reflect the building selected in the workspace switcher. Switch buildings to see another site's servicing.
- **Demo buildings** drift continuously — items age, get serviced, requests pop up — so the boards always look alive. On demo orgs the servicing agent's activity is generated locally (no external model calls), so it costs nothing to leave running.

---

## Where this connects

| Surface                         | Relationship                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Tickets](tickets.md)           | "Raise ticket" and agent escalations land here for ownership + tracking.                                                                                                 |
| [Agents](agents.md)             | The Servicing & SLAs agent that watches the boards and asks/acts/escalates.                                                                                              |
| **My Day** (MONITOR)            | Where the agent's servicing asks await your approval.                                                                                                                    |
| **Activity** (OPERATE)          | The log of what the agent and the building did.                                                                                                                          |
| [Schedules](schedules-setup.md) | Where the routes and crews that _do_ the servicing are defined. Each board's items are route_tasks under a program route.                                                |
| [Contractors](contractor.md)    | Each board's route is tied to a contract, so the board shows the **contractor** servicing that area (e.g. Security → GuardWatch). Per-contract reports cover the domain. |
