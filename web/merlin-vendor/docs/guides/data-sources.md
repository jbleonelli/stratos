# Working with data sources

Data sources are the upstream signals Merlin and the agents read to do their work. Without them, an SLA can't be measured and an agent can't act. They're one of the two pillars of the system — the other being [SLAs](slas.md).

There are two kinds of object, both reachable from one screen, and they're deliberately different.

| Kind              | What it is                                                                                                                                                                                                  | Who can create                                                                                  | Counts toward billing?                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Catalog entry** | A _kind_ of signal Merlin knows how to consume — "Restroom IAQ feed", "Badge events", "Cleaning crew NFC trails".                                                                                           | Workspace Owner / Admin / Facility (or an external contractor under an active service contract) | No — catalog is the definition                            |
| **Connection**    | A live _instance_ feeding data — a specific sensor at a specific location, a specific external feed, a specific contractor team's NFC trail. Has status (healthy / degraded / offline / pending / retired). | Same roles as the catalog                                                                       | Yes — billable when status is **healthy** or **degraded** |

One catalog entry has many connections. Devices show up here as connections rooted in a per-kind catalog entry. New integrations (external feeds, polling APIs) live here too as catalog entries with non-device connections.

A connection itself comes in **three flavours**, picked when you click + Connect a source: **Adaptiv device** (signal from a first-party device), **External feed** (signal pushed in from a third-party system), and **Simulated** (synthetic signal for demos and bring-up). All three behave the same way and share the same status lifecycle — only the source of the signal differs. See [Creating a connection](#creating-a-connection) below.

---

## Where data sources live

> **Where:** Agentic → **Sources**

Three sub-tabs at the top of the section:

- **Catalog** (default) — the kinds of signals available in this workspace.
- **Connections** — live instances feeding data. Status pill on each. Filtered to the currently-active building when one is selected.
- **Simulator** — settings for org-wide synthetic signal generation plus a roll-up of every Simulated source connection running in the workspace. The synthetic-incident frequency control is Merlin Owner only; everything else on this tab is admin-accessible.

When at least one simulated connection is running, a small "N simulated sources running" strip appears at the top of the Catalog and Connections tabs as a shortcut into the Simulator tab.

Contractor orgs get a parallel surface at **Operations → Sources** that rolls up across customer contracts. See [Contractor side](#contractor-side) below.

---

## Creating a catalog entry

> **Where:** Agentic → Sources → Catalog → **+ New catalog entry**

Available to: **Workspace Owner**, **Admin**, **Facility Manager** (or platform admin / superadmin).

1. Click **+ New catalog entry**. The inline form opens.
2. Fill in the basics:
   - **Name** — short label. _e.g. "Restroom IAQ feed"._
   - **Signal kind** — free-text categorization (sensor, event, api, device, derived, etc.) that drives the row icon.
   - **Transport** — how the data arrives (rest, mqtt, webhook, ble, bacnet, lte_m, …).
   - **Provider** — who provides it:
     - **Adaptiv** — first-party (SDG, people counter, etc.)
     - **Third party** — direct vendor integration (Comfy, Density, Genea, …)
     - **Contractor** — only available on the contractor surface; not selectable here.
   - **Status** — usually leave as Available. Use Deprecated when sunsetting an entry.
   - **Description** — one-line context for admins reading this later.
3. **Scope** (only visible when you're viewing a specific building) — toggle:
   - **Org-wide** — every building in your org sees this entry.
   - **Only `{building name}`** — entry is visible only when that building is selected.

   The toggle defaults to building-only because you're viewing one building when you click New. Switch to org-wide for catalog entries that apply across the portfolio.

4. Click **Create**.

The new row appears immediately. Scope is **locked once created** — to change scope, delete and recreate.

---

## Creating a connection

> **Where:** Agentic → Sources → Connections → **+ Connect a source**

Available to the same roles as catalog entries.

1. Click **+ Connect a source**. The form opens with a **Source kind** picker at the top.
2. Pick the kind — every connection is one of three:

   | Kind               | What it is                                                         | Where the signal comes from                                                                                                            |
   | ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
   | **Adaptiv device** | A first-party device — Smart Display, People Counter, Smart Logger | The device itself — its status updates automatically as it reports in                                                                  |
   | **External feed**  | A third-party push — BMS bridge, vendor integration, polling API   | The owning integration sends data to a unique ingest URL for the connection (provisioned automatically on create — click Edit to view) |
   | **Simulated**      | A synthetic source — generated on a schedule, no real device       | Synthetic signal produced automatically at the interval you choose                                                                     |

3. Fill in the form (fields adapt to the chosen kind):
   - **Name** (optional) — defaults to the external_id.
   - **External ID** — vendor or device identifier (hidden for Simulated).
   - **Catalog entry** — pick the kind of signal (catalog entries you created above appear here).
   - **Location** — building this connection is rooted at.
   - **Status** — Pending by default for real connections; flips to Healthy automatically once the first signal arrives. Simulated connections start Healthy immediately.
   - **Signal interval** _(Simulated only)_ — every 1 / 5 / 15 / 30 / 60 minutes.
   - **Impersonate device class** _(Simulated only)_ — Smart Display Classic / People Counter Basic / Smart Logger Basic / Smart Logger (Bank). Makes the synthetic source mimic a specific kind of device, so agents wired to that signal type can be exercised against it.
4. Click **Create**.

Catalog and Location are **locked on edit** — moving a connection between catalogs or locations means delete + recreate.

### Why offer simulation as a first-class connection

Simulated sources behave exactly like real sources — same status lifecycle, same SLA links, same billing treatment. The only difference is that the signal is synthetic. That means an admin can wire an agent against a Simulated connection during a demo or agent bring-up and the agent behaves identically to how it would against a real source. Turning the simulation off hands the same connection over to a real feed without anything else changing.

---

## Simulator settings

> **Where:** Agentic → Sources → **Simulator**

A roll-up of every Simulated source connection running in the workspace, plus two cards that control org-wide synthetic signal generation.

**Running simulations list (top of the tab).** One row per running Simulated connection. Shows the connection name, impersonated device class, last-signal timestamp, and interval pill. Edits and deletes happen back on the Connections sub-tab (the same row); this view is read-only by design — it's where you confirm what's running, not where you tune it.

**Synthetic incident cadence** _(Merlin Owner only)_. Controls how often synthetic incidents are generated for agents to react to. A higher cadence increases the work the agents do, so this control is reserved for the Owner. Non-owners see _that_ the card exists with a polite "Owner only" placeholder explaining why — better than hiding the surface.

**Device-event synthesis cadence + profile picker** _(admin-accessible)_. Controls how often synthetic device events are generated (button presses, ratings, badge taps, status reports). Admins can tune this freely.

**Discoverability strip.** When at least one simulated source is running and you're on Catalog or Connections, a thin "N simulated sources running" strip appears at the top of the Sources page with an "Open Simulator →" CTA. Hidden on the Simulator tab itself to avoid double-counting.

---

## Connection lifecycle

```
   create  --> +---------+               +---------+
               | Pending |--first signal->| Healthy |
               +---------+                +---------+
                                              ^|
                                  recovery    || 4h silence
                                              |v
                                          +----------+
                                          | Degraded |
                                          +----------+
                                              ^|
                                  any fresh   || 24h silence (cumulative)
                                  signal      |v
                                          +---------+
                                          | Offline |
                                          +---------+
                                              |
                                  end-of-life | (manual)
                                              v
                                          +---------+
                                          | Retired |
                                          +---------+
```

### How status flips work

Connection status updates automatically based on how recently a source has reported in:

| Current status               | When a signal is…                              | Flips to                               |
| ---------------------------- | ---------------------------------------------- | -------------------------------------- |
| Pending / Degraded / Offline | Fresh (received within the last 4 hours)       | **Healthy** (first signal or recovery) |
| Healthy / Degraded           | 4 to 24 hours since the last signal            | **Degraded**                           |
| Healthy / Degraded           | More than 24 hours, or no signal ever received | **Offline**                            |

**Retired** is the only status that doesn't update automatically — it's end-of-life and only changes back via a manual edit.

### What keeps a connection's signal fresh?

- **Device-backed connections** — update automatically as the device reports in. Recovery is effectively real-time once the device is reporting again.
- **External connections** — the upstream system sends data to the connection's ingest URL. See [External feed ingest](#external-feed-ingest) below.
- **Simulated connections** — synthetic signal is generated automatically at the interval you configured. The connection then promotes through the normal status flow.

### External feed ingest

When you create an External connection, a unique ingest URL is provisioned automatically. To view and copy it, click **Edit** on the connection — the form expands with an Ingest URL panel showing the URL and a usage example with copy buttons.

The upstream system sends data to this URL on whatever cadence it pleases. Keep the URL private — anyone who has it can keep the connection reporting as healthy.

### Status colors at a glance

- 🟢 **Healthy** — feeding signal recently
- 🟡 **Degraded** — silent for 4 to 24 hours, but not yet considered offline
- 🔴 **Offline** — silent for more than 24 hours, or never reported
- ⚪ **Pending** — created, no first signal yet
- ⚪ **Retired** — manually taken out of service

### About the thresholds

The 4-hour and 24-hour windows are the same across all connections today. They suit both production sources (which typically report every few minutes, giving plenty of headroom before alerting) and demo data (sources that haven't reported recently stay degraded rather than immediately going offline). Per-source-type thresholds — a daily weather feed needs much looser windows than a real-time air-quality probe — are a planned future enhancement.

---

## Where each surfaces

| Surface                                      | What it shows                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agentic → Sources → Catalog**              | Org-wide + per-building catalog entries for the current building. Manage scope, description, deprecation state.                                               |
| **Agentic → Sources → Connections**          | Live instances rooted at the current building. Status pills, last signal, location. Inline pills surface Simulated and External-feed connections at a glance. |
| **Agentic → Sources → Simulator**            | Running simulations roll-up + Owner-gated synthetic incident cadence + admin-tunable device-event synthesis.                                                  |
| **Admin → Organization → Subscription card** | Per-building billable count: connections in Healthy or Degraded state. Pending / Offline / Retired don't count.                                               |
| **Admin → SLAs → Agreements**                | SLA rows display an **Impaired** or **Paused** pill when their linked source dependencies degrade ([see the SLA bridge](#bridge-with-slas)).                  |
| **Subscription billing**                     | Per-building data-source charges update to match the current billable count.                                                                                  |
| **Operations → Sources (contractors)**       | Cross-customer roll-up of catalog entries the contractor has proposed. Customer-side reads the same entry in their Agentic → Sources catalog.                 |

---

## Bridge with SLAs

Each Service Agreement can declare which catalog entries it depends on, via a multi-select in the SLA edit form ("Linked data sources"). When set, the SLA row in Admin → SLAs → Agreements shows a derived health pill computed from those sources' connection statuses:

| State                             | Pill                      | Meaning                                                 |
| --------------------------------- | ------------------------- | ------------------------------------------------------- |
| All linked sources healthy        | (no pill — normal)        | % is trustworthy                                        |
| Some degraded/offline, ≥1 healthy | 🟡 **Sources impaired**   | % is computed but may be partial — tooltip lists counts |
| Zero healthy                      | 🔴 **Computation paused** | % goes null until at least one source recovers          |
| No linked sources                 | (no pill)                 | Source-aware health is opt-in                           |

This is the answer to _"why is my Hygiene SLA at 0%?"_ — instead of letting it silently flatline, the UI surfaces _"the IAQ sensor on Floor 32 has been silent for 6 hours."_

---

## Contractor side

If your organization is a contractor (e.g. SparkleCo servicing FEB and Meridian), you don't see Agentic → Sources. Your equivalent lives at:

> **Where:** Operations → **Sources**

Cross-customer roll-up grouped by customer. Each row uses the same catalog chrome you see on the customer side. Lets you propose new data feeds your crews can provide to customers.

### Proposing a catalog entry to a customer

1. Click **+ Propose new source**. The inline form opens.
2. **Pick a contract** — dropdown of your active contracts (each shows the customer name + service kind).
3. **Pick a location** (optional) — leave blank for an org-wide entry covering every building in that customer.
4. **Fill in the catalog details** — name, signal kind, transport, description. Provider is locked to "Contractor."
5. Click **Create**.

The row appears in your list with a **Pending acceptance** pill. At the same moment, it appears in the customer's Agentic → Sources catalog with the same Pending pill and an **Accept** button. When they click Accept, the entry goes live — agents can be wired to it, SLAs can list it as a dependency, and connections can be provisioned against it.

### Why the cross-organization model

A contractor-provided data source is a real contractual element of the relationship. You propose; the customer accepts. The entry lives in the customer's organization (both parties can read it) and is tied to the contract that governs the relationship — so if the contract ends, the source can be deactivated as part of the same cleanup.

---

## Quick reference

| Action                               | Where                                                                  | Who                      | Result                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Create org-wide catalog entry        | Agentic → Sources → Catalog → + New                                    | Owner / Admin / Facility | Visible in every building                                                             |
| Create building-scoped catalog entry | Same, with Scope toggle = "Only {building}"                            | Same                     | Visible only when that building is selected                                           |
| Edit catalog entry                   | Edit button on the row                                                 | Same                     | Updates name/description/status — scope is locked                                     |
| Create an Adaptiv-device connection  | Connections → + Connect → **Adaptiv device**                           | Same                     | Lands as Pending; flips Healthy once the device starts reporting in                   |
| Create an External (feed) connection | Connections → + Connect → **External feed**                            | Same                     | Lands as Pending; ingest URL auto-provisioned (click Edit on the row to view + copy)  |
| Create a Simulated connection        | Connections → + Connect → **Simulated** + pick interval + device class | Same                     | Lands as Healthy immediately; synthetic signal stays fresh on the configured interval |
| Retrieve a connection's ingest URL   | Connections → Edit on the row → "Ingest URL" panel                     | Same                     | URL + usage example, both with copy buttons                                           |
| Stop a running simulation            | Connections → Delete on the row                                        | Same                     | Row stops receiving simulated signal; moves through Degraded → Offline normally       |
| Tune device-event synthesis          | Sources → Simulator → Device simulator card                            | Owner / Admin            | Cadence + device-class profile picker                                                 |
| Tune synthetic incident cadence      | Sources → Simulator → Data simulator card                              | **Merlin Owner only**    | Owner-gated by design                                                                 |
| Propose source to a customer         | Operations → Sources → + Propose new source (contractor surface)       | Contractor manager       | Customer sees Pending row with Accept button                                          |
| Accept a contractor proposal         | Agentic → Sources → Catalog, click Accept on Pending row               | Customer admin           | Row goes live; pending pill replaced by provider pill                                 |
| Link sources to an SLA               | Admin → SLAs → Agreements → edit → "Linked data sources" multi-select  | Owner / Admin / Facility | Row shows Impaired/Paused pill when deps degrade                                      |
| Check billable count                 | Admin → Organization → Subscription card                               | Anyone                   | Reflects healthy + degraded connections per building                                  |

---

## Troubleshooting

**My subscription card shows a lower number than I had yesterday.**
The billing count reflects connections in Healthy or Degraded state only. Connections that have flipped to Offline (no signal in 24 hours or more) are excluded. Check the Connections tab — anything that should be healthy and isn't has probably stopped reporting. The number recovers automatically once signal resumes.

**A catalog entry I created doesn't appear in the per-agent picker yet.**
Known transitional state. Pre-existing entries remain agent-linkable now; newly created entries become linkable in an upcoming release.

**I proposed a source to a customer but they say they don't see it.**
Check that (a) you have an active contract with that customer and (b) the contract covers the location you picked (or you left location blank for org-wide). A proposal is only visible to the customer when there's a live contract to back it.

**My SLA shows "Computation paused" but I expect it to compute.**
Every catalog entry you've linked to that SLA is in Degraded, Offline, or Retired status. Open Agentic → Sources → Connections and check the underlying instances. Common causes: a sensor went silent, an external feed stopped delivering, a contractor's NFC trail stopped reporting.

**A connection is stuck on Pending after I expected it to start reporting.**
No signal has actually arrived yet. Diagnose by kind:

- **Adaptiv device** — confirm the device is online and reporting in. If it isn't, the device is the cause, not Merlin.
- **External feed** — confirm the upstream system is sending data to the connection's ingest URL (Edit → "Ingest URL" panel) and that the URL is correct.
- **Simulated** — the connection should have landed Healthy immediately on create. If it's stuck on Pending, refresh and recreate it.

Once a signal arrives, the connection promotes from Pending to Healthy automatically.

**I tried to point a catalog entry at a floor and got an error.**
By design — per-building catalog scoping only accepts buildings, ecosystems, or branches. Floors, restrooms, and zones sit inside a building and can't be scoped to directly. Choose the parent building instead.

**Can I undo an Accept?**
No. Accept is one-way (same as SLA accept). If the terms turn out to be wrong, the proper path is to deactivate the catalog entry and have the contractor propose a new version. There's no versioning chain for catalog entries the way SLAs have — that's a future enhancement if it becomes a frequent need.

**My external feed's ingest URL is being rejected even though I copied it straight from the form.**
Most common causes: (a) the URL got altered somewhere upstream (copy it exactly as shown, no extra encoding); (b) the connection was deleted and your integration is still sending to the old URL; (c) trailing whitespace from a copy/paste. Re-copy from the Ingest URL panel and retry.

**My external feed is being rejected as "retired."**
The connection's status is Retired. Either un-retire it (Edit → Status → Healthy/Pending) or repoint the upstream system at a new connection.

**My simulated connection isn't producing signal.**
Open Sources → Simulator and confirm the row appears in the Running simulations list. If it appears but the last signal is older than the configured interval, check that the simulation is still switched on for that connection (Edit on the row).

**The "N simulated sources running" strip never appears.**
The strip shows only when at least one simulated connection is running at or under the building you're currently viewing. If you created a simulated source from a different building's view, switch buildings to see it. The strip is also hidden when you're already on the Simulator sub-tab to avoid double-counting.
