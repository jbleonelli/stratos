# Getting started with Merlin

![Merlin sign-in screen — the entry point for every persona](/screenshots/getting-started/login-page.png)

This is the full setup guide — from a brand-new organization to a building that's running live daily plans with Merlin watching over it. Read it top-to-bottom the first time; come back later for any piece that needs a refresher.

For an empty org → first building running routes, budget roughly **30 minutes**. Most of that is the human decisions (tree shape, team roster, cadences), not clicks.

> **Want to skip ahead?** Adaptiv staff can spin up a fully-populated workspace for you, pre-loaded with realistic operations data. Demo accounts at Meridian HQ and SparkleCo cover the same mix of roles you'd set up yourself.

---

## The mental model

Merlin has seven things stacked on top of each other. You set them up in roughly this order; each layer reads the one below it.

| Layer            | What it is                                                                   | Example                                                                  |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Organization** | Your multi-tenant workspace. All data below is scoped to one org.            | _Adaptiv Demo_, _Contoso Facilities_                                     |
| **Users**        | People with Merlin logins. Each is a member of one (or more) organizations.  | `jamie@meridian.com`                                                     |
| **Locations**    | Buildings + ecosystems. Ecosystems nest to mirror real estate portfolios.    | _EMEA → UK → London Campus → 1 Churchill Place_                          |
| **Devices**      | Displays + sensors physically deployed inside a building.                    | SDG panel on Fl 32 · VOC sensor in women's restroom                      |
| **Zones**        | Service units inside a building — the thing a route visits.                  | _Fl 2 Women's Restroom_, _Fl 18 Pantry_                                  |
| **Team**         | Workforce roster + weekly availability. Not every team member needs a login. | _Maria Chen · Lead Custodian · Mon–Fri 06–14_                            |
| **Routes**       | Recurring service runs: zones + service type + cadence + crew.               | _Morning restroom sweep · Fl 2/18/32 · daily 07:00 · 3h · Maria + Priya_ |

Daily operations — **My Day**, the **Now** briefing, the **Hypervisor**, **Activity**, Today's plan, and Merlin's own reroutes — read every layer at once.

---

## The three role systems

There are **three** kinds of role in Merlin and it's important to keep them straight. The first two are unconditional; the third is an optional per-user restriction layered on top. Your _workspace type_ (real estate, contractor, or Adaptiv platform admin) then decides which app view you land on.

**Full guide:** see [Roles & access](roles-and-access.md) for a walkthrough of who's who in Merlin and how to set up access for your team.

### Profile role (what you do)

Lives on the user profile. Determines what features they see and edit inside any org they belong to.

| Role          | Typical person          | What they can edit                                       |
| ------------- | ----------------------- | -------------------------------------------------------- |
| `superadmin`  | Adaptiv staff           | Everything, every org (bypasses org scoping)             |
| `facility`    | Facility manager        | Locations, zones, team, routes, overrides                |
| `cleaning`    | Custodian               | Read-only + approve asks + log overrides on Today's plan |
| `maintenance` | HVAC tech / electrician | Same as cleaning                                         |
| `security`    | Guards, patrol          | Same as cleaning                                         |

### Organization role (where you belong)

Lives on the membership row. Determines what they can do _to the organization itself_.

| Role     | What it unlocks                                                                                |
| -------- | ---------------------------------------------------------------------------------------------- |
| `owner`  | Rename the org, invite + revoke members, grant + revoke subtree access. Typically 1–2 per org. |
| `admin`  | Invite + revoke members, grant + revoke subtree access.                                        |
| `member` | See the workspace. No org-management rights.                                                   |

**Both roles apply.** A user can be `facility` + `admin` (runs operations AND can invite teammates) or `cleaning` + `member` (runs routes but can't touch org settings). Superadmins sidestep org role entirely because they can see every org.

### Which view you land on

Workspaces come in different flavors — a real-estate workspace (building owners), a contractor workspace (cleaning or maintenance firms), or the Adaptiv platform-admin workspace. Combined with your job role, that decides which of three landing views you see:

| View                | Who sees it                                                 | What it contains                                                                                                                       |
| ------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Management view** | Super admin, or Facility Manager at a real-estate workspace | Full experience across the five pillars — **MONITOR · OPERATE · REPORT · PREDICT · INNOVATE**. The "build and run the workspace" view. |
| **Contractor view** | Facility Manager at a contractor workspace                  | Contracts dashboard, SLA per contract, own crew, scoped routes. The "serve multiple buildings across multiple clients" view.           |
| **Crew view**       | Cleaning / Maintenance / Security at any workspace          | Today's shifts, checklist, flag issues. Minimal admin.                                                                                 |

The same Cleaning Services role at a cleaning contractor vs at an in-house facility lands on different views — each tailored to how that person actually works.

### Subtree access grants (optional)

An owner or admin can narrow _where in the location tree_ a specific user can see and write. By default every member has full workspace access — this is the permissive opt-in model. Add a grant on "London Campus" and that user immediately collapses to seeing only London Campus and its descendants. Revoke the last grant and they spring back to full access.

Grants compose additively: two grants on "EMEA" and "NYC" mean the user sees both subtrees and nothing else. Superadmins bypass grants entirely.

> **Where:** Admin → Organization → _Location access_ card (owners + admins only)

---

## Step 1 — Get into an organization

There are two paths in, depending on whether you're being invited or you're bootstrapping a brand-new workspace.

### Path A: You received an invite link

The simplest path. An owner or admin sent you a URL that looks like `https://<your-merlin>/?invite=<token>`.

1. Open the link. Merlin strips the token from the URL and stashes it for later.
2. You land on the sign-in page with a small pink "You've been invited" callout.
3. **If you already have a Merlin account:** sign in with the email the invite was sent to.
4. **If you're new:** click _Create a new account_ and sign up with the exact email the invite was sent to.
5. On sign-in, Merlin automatically consumes the invite. A top banner confirms _"Invite accepted — you're now part of the workspace."_

The email must match the invite. If you sign in with a different account Merlin rejects the invite and leaves your previous memberships untouched.

### Path B: You're the first person in a brand-new org

Self-serve signup is now live. Open `https://<your-merlin>/signup`, enter your name, work email, password, and company name. On submit Merlin creates your account, sets up a new trial organization with a 30-day window, and makes you its owner. You land directly in the new workspace.

If you arrived via a pricing button (e.g. _Choose Pro_) the chosen plan is honored — your organization is set to that plan, and checkout opens automatically. If you came in cold from `/signup`, the organization defaults to the starter plan; you can upgrade later from **Admin → Organization**.

### First sign-in for a brand-new tenant

The workspace starts genuinely empty — no buildings, no devices, no crew, no agents enabled. Merlin recognises this and replaces the normal shell with a focused first-run experience:

1. **Add your first building.** A single centered card titled _"Welcome to {your org}. Add your first building"_ with name + address inputs. Submit and your building is created; the full shell replaces the card immediately with your building selected in the top picker.
2. **Empty states everywhere else.** Until you wire data sources and crew, the pages that would normally show charts and grids show empty cards explaining the next step:
   - **MONITOR → Metrics** — _"No metrics yet for {building}. Connect a data source…"_ with an **Add a data source** button that opens **Agentic → Data sources**.
   - **MONITOR → AI Agents** — every agent shows as _Locked_ with a **Manage agents** button that opens **Admin → Agents**.
   - **OPERATE → Devices** — _"0 devices · {building}. No devices installed yet. Bulk-import via Admin → Device import to get started."_
   - **OPERATE → Schedules** — _"No crew yet for {building}. Add team members from Admin → Team to start scheduling shifts."_
   - **OPERATE → Deployments** — top hero + rollout templates only appear once you have devices.
3. **Sign-out escape hatch.** The first-run card has a _Sign out_ link in the top-right in case you realise you signed in to the wrong account.

The simulator that drives the demo orgs (Meridian, IMF, FEB) is off for self-serve tenants — your Activity feed and Recent human actions widgets stay empty until your own devices and crew produce real events. This is intentional; it's the difference between _your_ tenant and a _demo_ tenant.

Once you're in, you'll see your workspace name in three places:

- **User menu (top-right)** — pink accent pill below your company name.
- **Admin → Organization** — the workspace card with the org name, slug, and created date.
- **Everything you create or view** — kept within your workspace automatically. You can't accidentally see another organization's data.

---

## Step 2 — Invite your team

> **Where:** Admin → Organization → _Pending invites_ card (owners + admins only)

1. Click the gear icon top-right → **Admin** → **Organization** sub-tab.
2. Scroll to **Pending invites**. Click **+ Invite**.
3. Enter the teammate's email and pick an org role (`owner` / `admin` / `member`). For most users, `member` is correct — they can still be a `facility` profile-role and run operations.
4. Click **Create link**. A green callout appears with a one-click **Copy link** button.
5. Share the link however you want — Slack DM, email, SMS. Merlin doesn't send email itself (yet).
6. Invites expire after **14 days**. Revoke any that haven't been accepted with **Revoke** on the row.

### Re-inviting after revoke

If an invite is still pending, you can't create a duplicate for the same email — Merlin surfaces _"This email already has a pending invite. Revoke it first to re-invite."_ Hit **Revoke** on the existing row, then create a fresh one.

### Setting profile roles

Invites control _org role_, not _profile role_. After a new user joins, go to **Admin → Users** and set their profile role (facility / cleaning / maintenance / security) from the dropdown. The profile role is what actually unlocks the feature surfaces they need day-to-day.

---

## Step 3 — Model your organization's real estate

> **Where:** Admin → Locations

Think before you click: geography? business unit? campus? Pick the dimension that matches how _decisions roll up_. Once you have that, build the tree bottom-up or top-down — doesn't matter, you can re-parent later.

**Full deep-dive:** [Modelling your organization in Merlin](organization-setup.md) walks through ecosystems, nesting, re-homing, rollups, campus-wide routes, and how Merlin prevents cycles.

Short version:

1. Click **+ Ecosystem** for grouping nodes (e.g. _EMEA_, _London Campus_). Ecosystems have no floors or zones themselves — they exist to group other things.
2. Click **+ Building** for real physical structures. Buildings have floors, zones, routes, and crew.
3. Set a building's _parent_ to place it inside an ecosystem. Nest as deeply as you need — Merlin supports practically unlimited depth.

You can also keep it flat — a single building with no ecosystem is totally valid.

**Working with a large tree:**

- **Search + kind filter** at the top of the Locations card narrows the tree to matches (substring match on name, optional Buildings/Ecosystems filter). Press Escape to clear. Ancestors of matches auto-expand so paths stay reachable.
- **Drag-to-reparent** — grab any location card and drop it on an ecosystem to move it. Invalid drops (self, descendants, non-ecosystems) don't accept. Merlin won't let you create an invalid move (a building can't contain itself).
- **History** button on any location opens an append-only audit log: every create, delete, rename, and re-home with actor + timestamp.
- **Map view** toggle at the top of the Locations card plots every location with coordinates on an interactive map. Buildings and ecosystems render in distinct tones; locations without coordinates show in a sidebar. Edit a location to set its latitude and longitude.
- **Expand/collapse state is remembered** per browser — collapse "Corporate" once and it stays collapsed across reloads.

---

## Step 4 — Set up each building for Merlin (the Setup hub)

> **Where:** Admin → **Setup** (building-scoped — pick a building, see its hub)

The steps that follow (devices, zones, roster, routes) each capture one slice of a building's data. The **Setup hub** is the front door that ties them together: one resumable checklist of everything Merlin needs to ground its answers and agent decisions for a building, with a **Merlin readiness** score so you — and Merlin — always know what's still missing. Start here; the deep-dive steps below are reachable from inside the hub _and_ from their standalone surfaces.

Pick a building from the picker and you get a checklist of sections, fillable in any order, each showing its state — ✓ done · ◐ partial · ○ empty:

| Section               | What it captures                                        | Where the detail lives      |
| --------------------- | ------------------------------------------------------- | --------------------------- |
| **Building profile**  | Vertical, hours of operation, occupancy profile         | Set at building creation    |
| **Spatial model**     | Floors + zones                                          | Step 6                      |
| **Devices & sensors** | The device fleet                                        | Step 5                      |
| **Contracts & SLAs**  | Cleaning / maintenance / security contracts + SLA terms | hub · upload a PDF          |
| **Workforce**         | Team roster, trades, certifications                     | Step 7 · or upload an Excel |
| **Coverage rules**    | Minimum staffing per shift                              | hub panel                   |
| **Consumables**       | Stock items + reorder thresholds                        | hub panel                   |
| **Suppliers**         | Procurement catalogue                                   | hub panel                   |
| **Knowledge / SOPs**  | Standard-operating-procedure docs                       | hub · upload docs           |
| **Merlin agents**     | Which agents are on for the building                    | Admin → Agents (see Step 9) |

**Document-first is the fast way.** Upload-capable sections (contracts, workforce, SOPs, consumable catalogues) take a document — drop the contract PDF or the workforce Excel and Merlin extracts the structured fields, shows you _"here's what I extracted — confirm or correct,"_ and saves them once you approve. Manual entry is always available as the fallback.

The **readiness ring** (top of the hub, also shown on the building header and on My Day) is the share of applicable sections you've completed — some sections depend on the building type, so a warehouse isn't penalised for skipping restroom consumables. Empty sections are also what let Merlin answer honestly — _"I don't have the cleaning contract for this building yet"_ — instead of guessing.

---

## Step 5 — Devices

Every building can have a device fleet — Touch eInk panels in restrooms, BLE sensors for air quality / occupancy / leak detection, cameras, badge readers, beacons. Merlin's Devices, Deployments, and Hypervisor tabs all read from this fleet.

There are **two** ways to populate devices:

### A. Pre-seeded tenant (Adaptiv-managed)

Adaptiv staff can hand a customer a workspace that already has devices populated — Meridian HQ ships with 797 devices across 411 locations, FEB2 ships with 581 branch devices. Brand-new workspaces start empty; Adaptiv runs the device-import flow below to populate them.

### B. Spreadsheet import (manual)

If your building has Adaptiv hardware deployed and you have a device spreadsheet from the install team, bring it in now.

> **Where:** Admin → Device import

1. Pick the target building from the dropdown (flat-list or tree-picker — either works).
2. Drag the Excel file onto the dropzone (or click to pick).
3. Merlin reads the sheet, sorts each row into a display or a sensor, and adds them. The building's display / sensor counts update automatically.

No worries about what columns are in the sheet — Merlin keeps the full original row, so anything you had is still there later.

### Browsing the fleet

> **Where:** Operations → Devices

Shows every device in the active building: counts per kind, online/degraded/offline/updating breakdown, per-device cards with signal, battery, firmware, error codes. Click any card to see rich telemetry (TVOC/CO₂ for air quality, LTE carrier/band/IMEI for cellular displays, embedded sensor probes for Touch panels, BLE aggregator graph for sensors that uplink through nearby panels).

Empty state on a building with no devices yet: _"No devices installed in {building} yet. Bulk-import via Admin → Device import to get started."_

---

## Step 6 — Define zones

Zones are the units of service inside a building. A route visits a zone, not a whole floor.

> **Where:** Admin → Locations → (your building card) → **Manage zones**

**Full deep-dive:** [Getting services running for a building](schedules-setup.md#2-define-zones-what-actually-gets-serviced) has the detailed walkthrough.

Short version:

1. Click **Manage zones** on the building card.
2. Use **+ Add floor (with standard zones)** to drop in _Women's Restroom / Men's Restroom / Pantry / Hallway_ on a new floor in one click. Repeat per floor.
3. Edit individual zones (name, kind, code, sort order) inline, or add one-off zones that don't fit the standard preset (lobbies, conference rooms, utility closets).

Zone `kind` matters later — _restroom_, _kitchen_, _pantry_, _hallway_, _office_, etc. drive Merlin's cleaning priority logic and the route-builder's zone filter.

---

## Step 7 — Build the team roster

> **Where:** Schedules → **Team roster**

**Full deep-dive:** [Getting services running for a building](schedules-setup.md#3-build-the-team-roster) covers the roster in detail.

Short version:

1. Click **+ New member**.
2. Enter their name, team (cleaning / maintenance / security / facility), role description, initials, optional email + phone.
3. If the team member is also a Merlin login, leave email blank — the two systems are loosely coupled. Most cleaners / maintainers / security staff won't have Merlin logins, so treat the roster as standalone.

### Weekly availability

For each member:

1. Click their row.
2. For each day of the week, add one or more work windows (e.g. _06:00 – 14:00_). Split shifts are fine — just add two windows.
3. Windows that wrap past midnight (e.g. _22:00 – 06:00_) are treated as overnight and colored appropriately on the grid.

Availability feeds Today's plan (shows who's on shift right now) and route assignments (warns if a route's primary is off that day).

---

## Step 8 — Define routes

> **Where:** Schedules → **Routes**

**Full deep-dive:** [Getting services running for a building](schedules-setup.md#4-define-routes) covers the route form in full.

Short version: a route is _"do X service across these zones, on this cadence, with this crew"_.

1. Click **+ New route**.
2. Give it a name (e.g. _Morning restroom sweep · Fl 2/18/32_).
3. Pick the **location** — this can be a single building OR a whole ecosystem (routes can span buildings in a campus).
4. Pick the **service type** — surface clean, deep clean, empty bins, restock, inspection, patrol, other.
5. Pick the **cadence** — daily, weekdays, weekends, weekly, or a custom day-of-week set.
6. Set the **expected start time** + **expected duration** (drives Today's plan timeline ordering).
7. Optionally set an **SLA threshold (min)**. When set, this route contributes to the "at risk" rollup on its parent ecosystem when the route is perturbed by an override today.
8. Click the route after creation to pick zones (ordered — the sequence is the visit order) and assign team members (primary, substitute, trainee).

---

## Step 9 — Daily operations

Once a building is set up and its agents are on, Merlin runs the workspace day-to-day. Here's where the work shows up.

### My Day — your morning landing

> **Where:** MONITOR → **Briefing** (the view you land on when you open Merlin)

My Day is the first thing you see. A hero line at the top tells you how many things need you right now (_"N things need your attention"_). Below it:

- **A 3D snapshot of the building** pins the most pressing pending decisions to the floors where they happened — alert floors are tinted, and clicking a floor or a card opens a detail drawer.
- **Pending asks** — agent decisions waiting on you. Each card names the agent and its reason, shows the decision, and gives you the resolve buttons inline (plus **Details** to open the full drawer).
- **"Since you last checked, Merlin handled these"** lists what the agents did on their own in the last ~48 hours. Click a row to jump into Activity.

When nothing's pending and Merlin's been acting on its own, My Day says so rather than inventing work.

**Approve / Hold — or Acknowledge / Dismiss.** The resolve buttons change with the kind of ask:

- If the agent is proposing a **concrete action** (e.g. a setpoint change), you'll see **Approve** (green-light it) and **Hold** (pause to review first).
- If the agent is only **flagging something for awareness** (no action queued), the buttons read **Acknowledge** (noted) and **Dismiss** (clear it). The drawer states this explicitly so you're never guessing whether something will execute.

Asks are realtime and shared — approving in one browser clears the ask everywhere instantly, and anyone in the workspace can answer them.

### Now — the compact briefing

> **Where:** MONITOR → **Now**

A decisions-first alternative to My Day, for when you want the state of the building at a glance without the 3D canvas: a KPI strip (SLA compliance, active incidents, fleet health, energy vs budget), a 12-hour forecast row, a **Merlin asks** column with the top pending decisions, and a **Today at a glance** sidebar (route status + shift handover).

### Hypervisor — the building in 3D

> **Where:** OPERATE → **Hypervisor** (facility / admin roles)

An interactive 3D wireframe of the building. A mode toggle paints different data onto the floors:

- **Merlin** — pending agent decisions as badges on the floors that raised them.
- **Agents** — agent-run activity (live / resolved / pending).
- **SLAs** — floors tinted by SLA performance.
- **Sensing** — floors tinted by sensor readings; toggle between **air quality, temperature, humidity, occupancy, and noise**. (Readings are simulated per floor until live sensors stream in.)

Drag to orbit, scroll to zoom, and use the canvas buttons to fit / reset / toggle labels. A side **Activity** panel and a **replay slider** (scrub back through the last hours) round it out.

### Activity — the full work queue

> **Where:** OPERATE → **Activity**

Everything Merlin has surfaced or handled for the building, in one feed. Filter pills across the top — **All · Needs action · Open · Resolved** (each with a count) — let you focus. Pending asks sort to the top with the same **Approve / Hold** (or **Acknowledge / Dismiss**) buttons as My Day; open incidents follow; resolved work (Approved / On Hold / Dismissed / auto-handled) sits below. My Day shows you the top few and the last 48 hours; Activity is the complete history.

### Today's plan, overrides, and agent autonomy

- **Today's plan** (**Schedules → Today's plan**) — every route running today, ordered by expected start time, with who's on it, whether it's a standing assignment or a Merlin reroute, and any active overrides. The shift lead's morning view.
- **Incidents → asks.** Merlin's signals (sensor spikes, occupancy thresholds, SLA risks) either get **auto-handled** silently when they're low-risk and high-confidence (Merlin records the change it made for the audit trail), or become a **pending ask** on My Day / Now / Activity for a human to approve.
- **Overrides** — humans override Merlin with **Reassign / Skip / Extra run** on a Today's plan card. Overrides are append-only: "cancelling" one means adding a later override that reverses it. The audit log on Admin → Locations shows every one — who, when, and why.
- **Agentic config** (**Admin → Agentic**, superadmin only) — per-agent autonomy sliders (Cleaning, Maintenance, Security, …). Turn an agent down to _propose only_ and it asks before everything; turn it up to _full auto_ and it only asks about novel, high-risk calls. The **data sources** tab sets which feeds each agent trusts; the **permissions** matrix sets which roles can override which agent.

---

## Common housekeeping

### Rename the organization

Admin → Organization → **Rename** (owners + admins only).

### Remove a teammate

Admin → Users → (row) → **Remove**. This deletes their profile; their org membership cascades. If they were assigned to routes or availability, re-assign first — history stays as an audit record.

### Re-home a building into an ecosystem

Admin → Locations → (building card) → **Edit** → set a new parent. Or just drag the card onto the target ecosystem. Merlin won't let you create an invalid move (a building can't contain itself).

### Grant a user access to a subtree only

Admin → Organization → Location access → (member row) → **+ Grant** → pick a building or ecosystem. Their view immediately narrows to that subtree. Remove all grants to restore full access.

### See what happened to a location

Admin → Locations → (card) → **History**. Every structural change (create, rename, re-home, delete) is recorded with actor + timestamp.

### Invite revoke

Admin → Organization → Pending invites → **Revoke**. The invite link stops working immediately.

### Sign somebody out everywhere

Admin → Users → (row) → **Remove**, then re-invite them. There's no "log this session out" button — the profile delete is the hammer.

---

## Permissions cheat sheet

When something is greyed out or throws a "permission" error, it's almost always one of four things:

1. **Profile role too low** for the feature (e.g. cleaning trying to edit a route).
2. **Org role too low** for the action (e.g. member trying to rename the org).
3. **Subtree access restricts you** — you have one or more grants and the location you're trying to reach isn't inside any of them. Ask an owner/admin to widen your grants, or remove all grants to restore full access.
4. **You're signed into the wrong org.** Check the pill in the user menu — if it says the wrong workspace, accept the right invite first.

Superadmins bypass all three role systems but have to be careful: their writes can cross orgs, so double-check the workspace pill before editing.

---

## What's next

- **[Modelling your organization](organization-setup.md)** — deeper coverage of the location tree, rollups, and keeping a large tree readable.
- **[Running services in a building](schedules-setup.md)** — detailed zone / team / route / availability walkthrough, including per-route checklist items.
- **[Roles and access](roles-and-access.md)** — who's who in Merlin, and how to give the right access to the right person.
- **Agentic config reference** _(coming later)_ — per-agent playbook tuning and the autonomy slider logic.
