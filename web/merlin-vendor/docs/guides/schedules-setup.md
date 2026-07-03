# Getting services running for a building

This walks you through the full chain from a brand-new building to a live daily plan: **create a building → define zones → build the team → set availability → define routes → see today's plan**. Along the way Merlin also gets what it needs to start auto-handling and logging reroutes for you.

End-to-end it takes about 15 minutes for a typical office floor. You only do it once per building; after that you're just editing around the edges.

---

## Who can do what

| Role                                  | Can do                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Super admin**                       | Everything in this guide.                                                                                               |
| **Facility manager**                  | Everything in this guide.                                                                                               |
| **Cleaning / Maintenance / Security** | Read-only. Can approve Merlin asks and log overrides on Today's plan, but can't edit buildings, zones, team, or routes. |

If something in this guide is greyed out or you hit a "permission" error, you're signed in as a role that doesn't have write access — ask a super admin or facility manager to do it.

---

## 1. Create the building

> **Where:** Admin → **Locations**

1. Click the gear icon in the top-right, then **Admin**.
2. On the **Locations** sub-tab, click **+ Building**.
3. Fill in the form:
   - **ID** — a short label used everywhere else (e.g. `london-canary`, `paris-hq`). Lowercase, no spaces. Can't be changed later.
   - **Name** — the human-readable label (e.g. _Canary Wharf_).
   - **Address** — optional; shown on the building card.
   - **Floors** — rough count; zones are what actually get used in routes.
   - **Displays / Sensors** — leave at 0 if you haven't deployed devices yet.
4. Click **Create building**.

The new card appears immediately in the Locations grid. It's tagged **Custom** so you can tell it apart from any sample buildings already in your workspace.

> _Already using Meridian HQ for your demos?_ Skip to step 2 — zones can be added to it without recreating the building.

---

## 2. Define zones (what actually gets serviced)

Zones are the floor-level units of work: **Floor 3 Women's Restroom**, **Floor 12 Pantry**, **Lobby North**, etc. Routes reference zones, not whole floors.

> **Where:** Admin → Locations → (your building card) → **Manage zones**

### Add a floor the fast way

1. Click **Manage zones** on the building card. The zones modal opens.
2. Click **+ Add floor (with standard zones)** at the bottom.
3. Type the floor identifier (numbers like `3` or text like `Ground` both work) and click **Add standard zones**.
4. Merlin drops in four zones for that floor:
   - Women's Restroom
   - Men's Restroom
   - Pantry
   - Hallway

That's the quickest way to populate a floor that follows the common office layout. Repeat for each floor you care about.

### Edit or add individual zones

Each zone row has **Edit** and **Remove** buttons. Click **Edit** to rename, change the type (restroom / kitchen / pantry / hallway / office / conference / lobby / storage / reception / utility / other), or set an optional short code like `F03-WR-N`.

Inside any floor block, click **+ Zone** to add a one-off zone without using the preset.

### A reasonable starter set

A 20-floor office building with normal layout: 20 floors × 4 standard zones = 80 zones. That's plenty to define realistic routes. You don't need to enumerate every broom closet.

> **Tip:** zones are shared across your whole team. Once saved, everyone sees them.

---

## 3. Build the team

> **Where:** Operations → Schedules → **Team roster**

The team roster is your workforce — cleaners, maintainers, security staff. They don't need to be Merlin login accounts; they're just people on the roster.

### Add a team member

1. Click **Operations** in the main tab strip, then **Schedules**.
2. Open the **Team roster** sub-tab.
3. Click **+ Add member** in the top-right.
4. Fill in:
   - **Name** — required.
   - **Team** — cleaning, maintenance, security, or facility. This colour-codes them in the weekly grid and filters in the Team tab.
   - **Role / title** — free text like _Lead Custodian_ or _HVAC Tech_.
   - **Initials** — 2–3 characters for avatars. If you leave it blank we'll derive from the name.
   - **Email / Phone** — optional; useful for later notifications.
5. Scroll down to **Weekly availability**:
   - Each day of the week (Mon through Sun) has its own row.
   - Click **+ Window** to add a work window (start time / end time).
   - You can have multiple windows per day — use this for split shifts like _06:00–10:00_ then _14:00–18:00_.
   - Days with no windows are marked **Off**.
6. Click **Save**.

### Edit someone later

Click any row in the Team tab to reopen the modal. The per-day availability summary you see in the list (_Mon–Fri 06:00–14:00_) is built from the windows you set.

---

## 4. Define the routes

> **Where:** Operations → Schedules → **Routes**

A route is the unit of actual work: _what gets serviced, when, by whom_. One member can have multiple routes; one route can have multiple members (primary + substitutes).

### Create a route

1. On the Routes sub-tab, click **+ New route** (top-right).
2. Fill in:
   - **Route name** — something specific like _Morning restroom sweep · Fl 2–10_.
   - **Service** — Surface clean, Deep clean, Empty bins, Restock supplies, Inspection, Patrol, or Other. This affects how Merlin auto-handles related incidents (see step 6).
   - **Building** — defaults to the current one.
   - **Description** — optional, one-liner.
   - **Cadence** — Every day / Weekdays / Weekends / Once per week / Custom days. Choose _Custom_ to get a day-by-day toggle row.
   - **Start time** — when the route should kick off each day it runs.
   - **Duration (min)** — typical time budget.
   - **SLA threshold (min)** — _optional._ When set, this route contributes to the "at risk" rollup on its parent ecosystem if an override perturbs it today. Leave blank for routes without a hard SLA.
3. In the **Zones** section, check the zones the route should visit. Zones are grouped by floor; pick from wherever in the building.
4. Click **Save**.

### Add crew to the route

Once the route is saved, the **Assignments** section activates.

1. Pick a member from the dropdown.
2. Click **Add**. They're added as **Primary** by default.
3. Repeat to add more members.
4. The first person is the _primary_ runner; additional ones are treated as _substitutes_ (visible on Today's plan when primaries are overridden).

You can **Remove** anyone's assignment later without touching the route itself.

### Tip: split wide buildings into multiple routes

A 48-floor tower with one "Morning sweep" route covering every restroom is too much for one person. Break it into _Fl 1–16_, _Fl 17–32_, _Fl 33–48_ and assign different crew to each. Overrides (step 6) handle day-to-day shuffles.

### Route tasks (the checklist inside a route)

A route says _"visit these zones"_ — but not _"do what at each zone."_ Tasks fill that in: a named checklist item attached to a route, optionally scoped to a specific zone, with its own cadence.

A single morning restroom sweep route might carry these tasks:

- Check-in + ready check — every run
- Restock soap + paper towels — every run
- Mop floors — every run
- Wipe mirrors + counters — every run
- Empty bins — every run
- **Deep window cleaning** — monthly, scoped to Floor 32 West restroom only (lights up once per month on top of the daily checklist)

Supported cadences:

- **Every run** — runs every time the route executes
- **Daily / weekly / biweekly / monthly / quarterly** — runs on that schedule regardless of how often the route itself runs
- **On condition** — runs when a trigger fires (e.g. restock when a supply level falls below threshold)

Tasks show up on Today's plan and on each worker's shift checklist. If a contractor crew is running the route, they see the tasks for their route without seeing anything else in the building.

### Linking a route to a contract

If the work is done by a contractor firm (for example, Maple Cleaning handling your tower's cleaning), link the route to the contract so the contractor's crew can see it. This is how you keep the right people seeing the right work without giving away access to anything else.

Routes without a contract link are treated as in-house — they stay inside your workspace only.

---

## 5. See today's plan

> **Where:** Operations → Schedules → **Today's plan**

This is the view your cleaning leads, facility managers, and on-shift crew look at each morning.

It shows every route whose cadence covers today, sorted by start time. Each row has:

- **Start time** (colour-shifted accent if there's an active override)
- **Route name + override badge** (if any)
- **Service type pill**
- **Assignee avatars + names** (reflecting any overrides)
- **Override button** — to log a reassign / skip / extra / note

### Logging a manual override

Say Maria called out sick at 6:30am.

1. Click **Override** on the row where Maria is primary.
2. Pick **Reassign** as the action.
3. Set **Original** to Maria and **Replacement** to Priya (or anyone available).
4. Choose **Just today** or **Permanent (from today)**:
   - _Just today_ — it's a one-off; tomorrow's plan reverts.
   - _Permanent (from today)_ — Priya takes over this route going forward until someone overrides again.
5. Add a reason (e.g. _Maria called out sick_) and save.

The row now shows an **Override** badge, the assignee stack updates to Priya, and the change is visible to everyone on your team.

### Skipping a route

Pick action **Skip** instead. The row renders struck-through and dimmed for today.

### Cancelling an override

Open the same override modal and click **Remove** on the active override. Removing an override clears it entirely (facility managers and super admins only); other roles add a counter-override instead.

---

## 6. When Merlin reroutes

Merlin automatically watches the incident stream and takes action based on each agent's **autonomy** setting (MONITOR → AI Agents). If a cleaning incident fires and the cleaning agent is set to _auto-low-risk_ or _full-auto_, Merlin auto-handles it and writes its own override onto the matching route.

You'll see:

- A **Merlin reroute** accent pill on the route row on Today's plan.
- The reason line reads something like _Urgent · VOC drift — Floor 32 East_.
- The override is shared with everyone in real time — if Robin sees it, Jamie sees it within a second or two.

You can **Review** a Merlin reroute and add a counter-override if it's wrong, or just let it stand. Every override (human or Merlin) is recorded in the activity history, so you can look it up later.

### Controlling Merlin's behaviour

- **MONITOR → AI Agents → Cleaning** → change _Autonomy_ to:
  - **Propose** — Merlin never auto-handles; every cleaning incident becomes a human-approval ask.
  - **Auto low-risk** — Merlin handles medium/info on its own; critical and high still push asks.
  - **Approve critical** — the default; Merlin handles everything except critical.
  - **Full autonomy** — Merlin handles everything, even critical.

The setting takes effect right away, for everyone on your team.

---

## Recap

| Step | Sub-nav                          | What you built                        |
| ---- | -------------------------------- | ------------------------------------- |
| 1    | Admin → Locations                | The building record                   |
| 2    | Admin → Locations → Manage zones | Floor-level zones you can service     |
| 3    | Schedules → Team roster          | Workers + their weekly availability   |
| 4    | Schedules → Routes               | Named service runs tying zones + team |
| 5    | Schedules → Today's plan         | The daily live view                   |
| 6    | MONITOR → AI Agents              | How aggressively Merlin reroutes      |

Once this is in place, the day-to-day loop is: glance at Today's plan in the morning, log any overrides, and let Merlin handle the rest.
