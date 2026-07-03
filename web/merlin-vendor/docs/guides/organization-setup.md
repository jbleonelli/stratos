# Modelling your organization in Merlin

Merlin organizes everything under a **location tree**. Real estate portfolios are rarely a flat list — a global company has regions, regions have cities, cities have campuses, campuses have buildings. Merlin lets you mirror that structure exactly, so routes, zones, schedules, and Merlin's decisions attach to the right level.

This guide walks you through building the tree from scratch: what the pieces are, how they nest, and how to keep it readable as it grows.

---

## The mental model

| Piece         | What it is                                                                                   | Example                            |
| ------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Ecosystem** | A grouping node. Has children (more ecosystems or buildings). Has no floors or zones itself. | _EMEA_, _UK_, _London Campus_      |
| **Building**  | A real physical structure. Has floors, zones, routes, crew. The leaf of the tree.            | _1 Churchill Place_, _Meridian HQ_ |

An ecosystem can contain any mix of ecosystems and buildings, to any depth. A typical enterprise setup looks like:

```
Corporate
└── EMEA
    ├── UK
    │   ├── London Campus
    │   │   ├── 1 Churchill Place
    │   │   └── 10 Upper Bank Street
    │   └── Manchester — Tower 1
    └── France
        └── Paris — La Défense
└── Americas
    ├── NYC — 200 West Street
    └── Chicago — Aon Center
```

You can keep it simple if you want — a flat list of buildings with no ecosystems at all is totally valid. Ecosystems are an organizing layer, not a requirement.

---

## Who can do what

| Role                                  | Can do                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Super admin**                       | Create / edit / delete ecosystems and buildings at any level.                                                                         |
| **Facility manager**                  | Same as super admin for location records.                                                                                             |
| **Cleaning / Maintenance / Security** | Read-only on location tree. Can still work on routes, overrides, and incidents inside buildings they're assigned to.                  |
| **Contractor manager**                | Read-only on buildings they hold an active contract against. Can't edit the tree — the property manager / facility manager owns that. |

See [Roles and access](roles-and-access.md) for the full walkthrough of who can do what.

---

## Workspace types

Not every workspace represents a building owner. Merlin supports three kinds:

| Type            | Who                                                                 | Example                          |
| --------------- | ------------------------------------------------------------------- | -------------------------------- |
| **Real estate** | Building owners, property managers, in-house facility teams         | Meridian HQ, First Empire Bank 2 |
| **Contractor**  | Cleaning, HVAC, security, or electrical service companies           | SparkleCo Cleaning Services      |
| **Adaptiv**     | Adaptiv's own workspace; membership unlocks the Adaptiv back-office | Adaptiv                          |

Each type gives its users a slightly different view on sign-in. A manager at a real-estate workspace sees buildings, zones, and routes. A manager at a contractor workspace sees contracts, SLAs per contract, and their own crew. See [Roles and access](roles-and-access.md) for more.

### Building ownership vs management

For simple cases a single company owns and manages its building — they're both roles on the same workspace. For larger portfolios you can split the two:

- **Owner** — the real-estate company that holds the physical building
- **Manager** — the organization actively running operations day-to-day (could be the owner, could be a third-party facility-management firm)

A REIT might own 12 towers across three cities, with different property-management firms running each one. Merlin can model this cleanly: the building's owner is the REIT, its manager is the property-management firm, and separate contractors run cleaning / HVAC / security under contract with the manager.

For the common owner-operated case, you don't have to think about this — ownership and management default to the same workspace automatically.

### Contracts

When a manager hires a contractor firm, Merlin records a contract linking the two. Each contract spells out:

- **Service kind** — cleaning, HVAC, security, electrical, plumbing, integrated facility management
- **SLA summary** — max response time, allowable threshold breaches per month, coverage hours
- **Start and end dates, monthly value, terms**
- **Buildings covered** — one contract can cover multiple buildings

Contracts are how contractors get scoped access. An HVAC tech at Reliable Mechanical sees the mechanical rooms and HVAC sensors in every building where Reliable holds an active HVAC contract — across multiple customers, all inside their single Reliable Mechanical workspace.

---

## Pick your structure before you build

You'll save yourself a lot of editing later if you sketch the tree first. Common dimensions:

- **Geography** — country / state / city / building
- **Business unit** — division / region / site
- **Campus** — campus ID / building
- **A hybrid** — geography at the top, campus at the bottom, business unit in between (not all enterprises fit one clean axis)

Pick the dimension that matches how _decisions_ are made. If budgets roll up by geography, model geography. If facilities managers report by business unit, model that. The structure is what determines how rollups read.

### A few good rules of thumb

- **Each level should be meaningful.** "North America" is meaningful. "North America > Buildings" (a single-child ecosystem wrapping every building flat) isn't.
- **Don't pre-model structure you don't have.** You can always add an ecosystem later and re-home buildings into it. Start flat, nest as patterns emerge.
- **Keep ecosystem names short.** They appear stacked in breadcrumbs ("EMEA › UK › London ›") — long names make the breadcrumb unreadable.

---

## Building the tree

> **Where:** Admin → **Locations**

The Locations page shows the tree. Ecosystems are blue-accented rows with a chevron; buildings are cards nested underneath.

### 1. Start with the top-level ecosystem

Let's build out the geography example above. First, the top of the tree:

1. Click **+ Ecosystem** at the top-right.
2. Fill in:
   - **ID** — a short slug, lowercase, no spaces (e.g. `corporate`). Can't be changed later.
   - **Name** — _Corporate_
   - **Address / region** — optional, descriptive text
   - **Inside of…** — leave as _top-level — no parent_ (this is the root)
   - **Sites** — you can skip this section entirely for modern setups; the `sites` list is a legacy way to declare children inline. We'll use proper ecosystems instead.
3. Click **Create ecosystem**.

_Corporate_ now appears at the top of the tree as an empty ecosystem.

### 2. Nest the sub-ecosystems

Click **+ Ecosystem** again and build _EMEA_:

- **ID** — `emea`
- **Name** — _EMEA_
- **Inside of…** — select **Corporate** from the dropdown
- Create

Repeat for _Americas_. Both now appear indented under _Corporate_.

Keep going down. For _UK_:

- **ID** — `uk`
- **Name** — _UK_
- **Inside of…** — select **Corporate › EMEA**. The dropdown shows the full path so you always know where you're nesting.

### 3. Add a campus ecosystem

Campuses are ecosystems too — they group multiple physical buildings.

- **ID** — `london-campus`
- **Name** — _London Campus_
- **Inside of…** — **Corporate › EMEA › UK**

### 4. Add buildings as leaves

Buildings are created the same way, just with the **+ Building** button:

1. Click **+ Building** at the top-right.
2. Fill in:
   - **ID** — `one-churchill` (slug; can't change later)
   - **Name** — _1 Churchill Place_
   - **Address** — _5 Canada Square, London E14_
   - **Floors** — _32_
   - **Displays / Sensors** — 0 for now; these auto-populate after you run device imports
   - **Inside of…** — **Corporate › EMEA › UK › London Campus**
3. Click **Create building**.

The building appears as a card indented four levels deep inside its London Campus parent.

### 5. Verify with the rollups

Each ecosystem row shows a live stat line on the right. The structural half shows how much is under this node:

> **`3 buildings · 47 zones · 8 routes`**

If anything is actually running or happening today, you'll see that next to it in different colours:

> **`3 buildings · 47 zones · 8 routes · 5 today · 2 overrides · 1 action · 1 at risk`**

- **`N today`** (green) — routes whose cadence covers today in this subtree
- **`N overrides`** (accent, bold) — route overrides currently in effect (one-off for today, or permanent starting ≤ today)
- **`N actions`** (warn tone) — human actions on incidents taken anywhere in the subtree today (approve, hold, escalate, reassign, pin)
- **`N at risk`** (risk-red, bold) — routes with a configured SLA threshold AND an active non-note override today (i.e. work that was supposed to happen under an SLA and got perturbed)

Numbers bubble up through the entire subtree. If you added one building to London Campus, London Campus shows _1 building_, UK shows _1 building_, EMEA shows _1 building_, Corporate shows _1 building_.

This is the payoff for the tree structure: a facility manager scanning the Locations page can see at a glance where the footprint and activity are without drilling down.

---

## Connecting data sources

> **Where:** gear menu → Agentic → Data sources · per building

Buildings come alive when you wire data sources to them. Agents need signals to act on; widgets need telemetry to chart; SLAs need events to score. The **Agentic → Data sources** sub-section is where you register each source and tell Merlin what kind of feed it is.

For a fresh tenant, this surface starts empty: _"No data sources yet for {building}. Connect a sensor, API, or integration to start feeding Merlin and your agents."_ Each source you register here becomes selectable on any agent's data-sources list.

A _data source_ is a category of inputs Merlin can read, not necessarily a single device. Examples:

- **Air-quality sensors** — in restrooms, kitchens, conference rooms
- **Occupancy** — presence sensing rolled up per room
- **HVAC setpoints** — writable heating and cooling targets per zone (third-party integration)
- **Room calendar** — Microsoft or Google Calendar feed for meeting-room context
- **Utility meter** — real-time energy pull from the building's utility

Each source carries five attributes:

- **Name** — human-readable label that appears in agent cards and chat references.
- **Kind** — Sensor, Device, API, Internal, or Ticketing.
- **Protocol** — how the source connects (for example LTE-M, Bluetooth, BACnet, REST, webhook, or MQTT). Informational, helps the operator remember how it connects.
- **Scope** — whole workspace, or a specific building. Use the scoped option for sources that only exist at one building.
- **Origin** — Adaptiv-managed (manufactured and connected by Adaptiv end-to-end) vs third-party (wired via an integration). Affects whether the source shows in the **Adaptiv-managed** or **Third-party** group.

Once registered, a source is available in every agent's **Data sources** list (Agentic → Agents → expand an agent → Data sources). An agent that has no relevant sources wired will skip every tick — that's by design. Wire the source first, then the agent will have something to act on.

For demo orgs (Meridian, IMF, FEB) the catalog is pre-seeded with 12 Adaptiv-managed sources + 12 third-party integrations. For custom (self-serve) tenants the surface starts empty so registered sources reflect what's actually wired.

---

## Campus-wide routes (routes that span multiple buildings)

Routes can attach either to a single building or to an **ecosystem**. When a route's scope is an ecosystem, it covers **all descendant buildings** and its zone picker pulls zones from every one of them, grouped by building.

Use case: _"Campus morning patrol"_ defined once on **London Campus** visits the lobby of 1 Churchill Place, the reception at 10 Upper Bank, and the garage entry of 20 Bank Street — one route, one crew assignment, coverage everywhere.

Creating one:

1. Schedules → Routes → **+ New route**
2. In the **Scope** picker, pick an ecosystem (they're prefixed with ◧). Their breadcrumb path is shown so you always know which level of the tree you're targeting.
3. The Zones picker below expands to show zones grouped by building → floor for every descendant.
4. Save; the route appears on every descendant building's Routes tab and Today's plan with a **`Campus-wide · <Ecosystem>`** accent pill.

Users viewing a single child building see both that building's own routes _and_ any parent ecosystem's routes cascading down. The Campus-wide pill makes the scope obvious at a glance.

---

## Editing structure later

### Re-homing a building or ecosystem

Two ways:

**Via the Edit modal** — click **Edit** on any location card or ecosystem row. The modal lets you:

- Rename
- Change the address
- **Re-home** — pick a new parent from the "Inside of" dropdown (filtered to exclude self and any descendant, so you can't accidentally create a cycle)
- Set latitude/longitude (for map view placement)
- Adjust building-specific fields (floors, sqft, displays, sensors)

**Via drag** — grab any location card and drop it on an ecosystem header. Valid drop targets show an accent-dashed outline on hover; invalid ones (self, descendants, non-ecosystems) silently reject the drop.

The location's ID slug is fixed once created — it's referenced everywhere (zones, routes, assignments, audit log). Name and parent can change freely. Pre-loaded buildings (Meridian HQ, First Empire Bank 2) behave just like custom ones — they're fully editable and re-parentable.

### History

Every structural change lands in an append-only audit log. Click **History** on any location card to see every create, rename, re-home, and delete event with actor name + timestamp. The log survives deletion — even after a location is removed, its history is preserved for audit purposes.

### Cycle protection

The edit modal filters the parent dropdown to exclude your descendants, so the UI won't let you shoot yourself in the foot. Merlin won't let you create a loop — if a move would make a location contain itself, you'll get a clear error and the change is refused.

### Deleting

- **Ecosystems**: hover over the row → **Delete**. Be careful — if you delete an ecosystem with children, the children become orphans (they re-surface at the top level of the tree, not deleted, but their parent path is gone).
- **Buildings**: same pattern, from the building card.
- **Pre-loaded buildings** (Meridian HQ, FEB2) work like any other — you can delete them the same way. If you do, a built-in fallback will reappear on next reload; contact your Adaptiv admin if you want to fully remove one.

---

## Breadcrumbs across the app

Wherever you see a location name, if it's nested, you'll also see its hierarchy path:

- **Topbar location selector** (top of the Agent bar): the active building's selected label shows the parent chain above the building name ("EMEA › UK ›" above "Canary Wharf"). Dropdown options show the same.
- **Merlin chat header**: "Your AI co-worker · EMEA › UK › Canary Wharf" when nested; just the name when top-level.
- **Admin → Locations cards**: each card's address line carries the parent chain in accent colour before the address.
- **Route pickers**: the Scope dropdown in the Route modal and the target picker in Device Import show every building's full ancestry ("EMEA › UK › Canary Wharf") so they're unambiguous.

---

## Finding things in a large tree

> **Where:** Admin → Locations → search bar + segmented filter

Once a tree gets past a couple dozen nodes, scrolling isn't a navigation strategy. Two tools:

- **Search** — live substring match on location name. Ancestors of matches auto-expand so paths stay reachable; anything unmatched hides. Press **Escape** to clear.
- **Kind filter** — `All` / `Buildings` / `Ecosystems` segmented control. Pick _Buildings_ when you want a flat sense of the physical portfolio, _Ecosystems_ when you need a birds-eye campus view.

Filters compose: searching `meridian` with kind = `Buildings` narrows to just Meridian HQ-like buildings. The count pill next to the Locations heading flips to **N / total** so you know you're filtered.

The expand/collapse state of every ecosystem is remembered per browser — you don't re-collapse the same nodes on every visit.

---

## Map view

> **Where:** Admin → Locations → tree/map toggle

Flip to the map view to see every location plotted on a world map. Buildings render as pink dots, ecosystems as blue dots. Click a marker for a popup with name + address + type. Set latitude/longitude in the Edit modal for any location you want plotted; unplotted locations show in the right-hand sidebar as a hint to fill in coords.

The view respects the search + kind filter, so _Ecosystems + "emea"_ on the tree side gives you the same subset as a zoomed-in map of EMEA regions.

---

## What the hierarchy unlocks

Beyond the rollups, the tree is what lets the rest of Merlin reason about scope correctly:

- **Routes** can attach to a building leaf _or_ an ecosystem. Ecosystem-scoped routes cascade to every descendant.
- **Zones** attach only to buildings (they're physical spaces). A route on an ecosystem still works because it pulls zones from descendant buildings.
- **Incident actions and overrides** attach to a location. When Robin approves a reroute at _1 Churchill Place_, the action is recorded against that building; it then automatically rolls up into the totals you see on every ancestor (_London Campus_, _UK_, _EMEA_, _Corporate_).
- **Subtree permissions** — owners and admins can grant a specific user read+write access to only one or more subtrees of the tree. See [Getting started: subtree access grants](getting-started.md#subtree-access-grants-optional) for the UX. Default remains "no grants = full workspace access," so nothing locks down until an admin explicitly restricts someone.

### What the hierarchy does _not_ do (yet)

- **No touch-device support on drag-to-reparent** — desktop mouse path works, touch doesn't. Use the Edit modal dropdown on tablets.
- **No marker clustering on the map** — 4–20 pins render fine; at 200+ markers start to overlap. A cluster plugin is a future polish.
- **No address-based geocoding** — you type lat/lng by hand. An address-to-coords service could fill this in automatically but adds a runtime dependency.
- **No audit trail on non-structural fields** — the history log only captures create / delete / rename / re-home. Changes to displays, sensors, occupancy, etc. aren't logged.
- **No global org-wide audit log page** — history is per-location only. Compliance review across the whole org means checking each location's history individually.

For the complete list of deferred items and the reasoning behind each, see [Deferred items](deferred.md).

---

## Recap

| Step | What you did                                                                                |
| ---- | ------------------------------------------------------------------------------------------- |
| 1    | Chose a dimension (geography, business unit, campus, hybrid)                                |
| 2    | Created top-level ecosystem(s) as the root                                                  |
| 3    | Nested sub-ecosystems inside them using **Inside of…**                                      |
| 4    | Added buildings as leaves, pointing to their parent                                         |
| 5    | Checked rollup counts to confirm the tree is wired right                                    |
| 6    | _(Optional)_ Defined campus-wide routes on an ecosystem to cover multiple buildings at once |

Once the tree is set up, the rest of Merlin (zones, routes, schedules, Merlin's autonomy decisions) plugs into it. See the [Schedules guide](schedules-setup.md) for what to build on top.
