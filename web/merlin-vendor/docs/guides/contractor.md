# Merlin for contractors

A field guide for service contractors who run cleaning, HVAC, security, electrical, plumbing, or integrated facility-management contracts on behalf of building owners — and the value Merlin gives them as the AI co-worker on the contractor side of the relationship.

> **Who this is for:** contractor managers — the person who runs the team that services one or more clients' buildings.

---

## What is a contractor in Merlin?

A **contractor** is a service company that runs operations _inside_ a building owner's space under a written commercial relationship called a **contract**. A contractor **does not own the buildings or devices** — it services them on the owner's behalf.

- Multiple contractors can hold contracts on the same building (a cleaning company, a mechanical company, and a security company all serving the same tower).
- One contractor can hold contracts with multiple building owners — one Merlin workspace covers every client you serve.

Each contractor demonstrates a different service discipline — for example cleaning (general), cleaning (deep-clean rotation), HVAC + plumbing, or security patrols. A building owner's facility manager can see all of their active service contractors side by side.

---

## Who's accountable for what

The contractor model has three commercial concepts; understanding them is the foundation of how Merlin shows you data:

- **Contract** — the commercial agreement. It pins down the service kind (cleaning, HVAC, security, electrical, plumbing, waste, pest control, landscaping, maintenance, or other), the owner and contractor parties, an SLA summary, an optional monthly value, start/end dates, and the locations covered. **The monthly value updates automatically when the client accepts a proposal that changes the price** — the contract stays in sync with the agreement.
- **SLA** — the performance commitment, owned by the building's facility manager. The contractor doesn't own the SLA; they're _on the hook_ for the slice of it that maps to their service area. For example, a hygiene SLA (98% of incidents resolved in 20 min) belongs to the building owner, but the cleaning contractor is who carries the can if it breaches.
- **Service area ↔ SLA map** — the bridge between the two. Cleaning covers hygiene, supplies, amenity, and compliance; HVAC covers comfort, air, energy, and uptime; and so on. Merlin uses this to filter "the slice you care about" automatically.

---

## What contractors can do in Merlin

The contractor surface lives at **Operations → Contracts**. Sign in to your contractor workspace and you land here.

### 1. See every contract you hold, in one place

![Contracts dashboard — every contract you hold in one view, with hero stats, contract cards, and the proposal pipeline](/screenshots/contractor/contracts-dashboard.png)

The dashboard lists every contract where your company is the contractor party. Each card shows:

- The client's name (the building owner)
- Contract title + service-area pill
- Status: draft / active / expired / terminated
- Monthly value (if set) — auto-updates when proposals are accepted
- Locations covered (including every floor and room beneath them)
- Start / end dates

**A single Merlin login covers every client you serve.** You don't sign in separately to your customers' workspaces.

### 2. Run-my-business analytics strip

Top of the Contracts page, below the hero, an analytics block surfaces:

- **Lifetime revenue** — monthly value summed across active contracts over the months they've run
- **Monthly run rate** + annualized projection
- **Proposal win rate** — accepted ÷ decided (hidden until you have at least 3 decided)
- **Median client decision time** — from submitted to decided, across all customers
- **Awaiting decision** count when there are pending proposals
- **Biggest improvement this quarter** — looks back over the last 90 days of report snapshots and surfaces the largest positive SLA gain, with the pilot's title, the vendor partner, and the acceptance date

This turns the dashboard from "see today's numbers" into "run my business."

### 3. Live SLA performance per contract

On every active contract card, an inline strip shows the live performance of every SLA that maps to your service area. Each row is colored: green (on track), amber (at risk), red (breach), grey (pending — not yet measurable). The percentage is scoped to the locations your contract covers, not the whole building — if your contract covers Floors 18–32, you only see the figure for your range, even if the building has restrooms outside it.

This is **the answer to "how am I doing on this contract right now?"** at a glance, on every page load.

### 4. Merlin's take — AI recommendations across 3 buckets

Click the **✨ Merlin's take** toggle on any active contract card. Within a moment, Merlin drafts recommendations split into three categories:

- **Do now** _(amber)_ — operational moves you can take with your existing crew and cadence. _"Pull Maria's Wednesday shift forward; Floor 32 East trending breach."_
- **Propose to client** _(pink)_ — strategic upsells, cadence changes, scope expansions. **Each strategic item can carry a suggested vendor partner** — when the issue genuinely calls for a third-party product, Merlin picks one from the marketplace and a "Suggested partner" chip renders below the recommendation.
- **Risk alerts** _(red)_ — concrete forward-looking predictions. _"At current trajectory, Hygiene SLA breaches in 4 days if Floor 18 cadence holds — rebalance now to prevent SLA penalty."_

### 5. Convert a recommendation into a real proposal — one click

Every item in the "Propose to client" bucket has an **✉ Make proposal** pill. Click → the contract drawer opens to the Proposals section in compose mode with the recommendation pre-filled as the body. **If Merlin attached a vendor partner, the composer's vendor picker lands on that vendor automatically and the category defaults to "innovation partner."**

This is the headline moment: Merlin spots an opportunity and surfaces the right partner, you turn it into a structured upsell in two clicks.

### 6. Author and submit innovation proposals

Inside any active contract drawer, the **Proposals** section lets you draft, edit, and submit structured proposals to the facility manager. Each proposal carries:

- Title + body (the pitch)
- Category: cadence change · scope expansion · new service · innovation partner · other
- Expected outcome (what improves)
- Monthly value change (optional pricing change). **When the client accepts a proposal that changes the price, the contract's monthly value updates automatically** — you don't need a separate "update contract terms" step.
- **Optional: an attached marketplace vendor** — when the proposal is about bringing in a third-party product, you pick from the marketplace and the vendor card embeds in the proposal both parties see (name, tagline, region, key features, learn-more link)

A proposal moves through clear stages: drafted → submitted → accepted, declined, or countered (which sends it back for another round) → and can be withdrawn at any point. The client accepts or declines with a note, or counter-proposes with revised terms. You see status changes in real time.

### 7. Generate periodic performance reports

The **Reports** section freezes the live SLA snapshot into a row your client can read. _Live_ SLA % drifts every minute; a **report** is a deliverable — its number doesn't change after you generate it.

- Click **"Generate weekly"** or **"Generate monthly"**
- The snapshot computes (SLA performance, breach details, location count) → a row appears in **draft** status
- The snapshot also embeds **innovation pilots accepted this period** (with their vendor info captured inline) and **active prior pilots** within the 90-day attribution window
- Click **"Mark as sent to client"** — the report flips to **sent**, stamps the timestamp, and the client sees it as a deliverable

Re-running "Generate monthly" within the same period refreshes the existing snapshot in place (it flips back to **draft**) instead of creating duplicates.

### 8. Merlin auto-narrate the report

Click **✨ Draft with Merlin** on any report and Merlin reads the frozen snapshot (SLA results, pilots accepted this period with their before/after changes, active prior pilots with cumulative impact, and contract details) and drops 2-3 paragraphs into the narrative field. First-person plural, concrete and quantitative, honest about misses, no filler.

You edit and save as usual. Hit **"Re-draft with Merlin"** if the first pass needs another shot — re-rolling never overwrites your unsaved edits.

### 9. Per-pilot impact attribution + cumulative tracking

Every report measures the before/after SLA change around each accepted proposal's decision date:

- **Pilots accepted this period** compare the 14 days before acceptance against the period since acceptance — each SLA's change is shown with a color-coded ↑↓→ arrow.
- **Active pilots from prior periods** compare the 14 days before acceptance (frozen at acceptance) against everything since — the measured window grows with each successive report. A May report shows about 30 days of impact, June about 60, July about 90.
- **Aging-out** — when a pilot's 90-day attribution window will close before the next period, the report flags it with **"Absorbed into baseline next period"** so its disappearance from later reports isn't silent.

The report is honest about confidence: it distinguishes a real measured change, a too-early result (less than 3 days of data), insufficient sample, or a case where the figure couldn't be computed. It never claims an impact it can't back up.

### 10. Export reports as PDF for procurement / stakeholders

Every report row has an **Export PDF** button (visible to both parties). Click → a clean, print-friendly view opens in a new tab → use your browser's Print → Save as PDF to produce a polished deliverable. The document title gives the file a useful name.

### 11. Renewal cycle — Merlin pre-drafts your year-end pitch

When a contract's end date is within 60 days, the contract card surfaces a warning callout:

> **Contract ends in 23 days.** Get ahead of the conversation — let Merlin draft a renewal proposal grounded in the year's accepted pilots.

Click **"Draft renewal with Merlin"** → Merlin composes a renewal proposal (title, body, price change, expected outcome) grounded in every accepted proposal across the contract's lifetime plus the measured SLA impact from the last six reports → and opens the proposal composer pre-filled with all four fields. You edit and submit through the usual proposal flow.

### 12. Crew utilization across contracts

The **Utilization** subnav (between Team and Routes) shows where each crew member is overbooked vs has headroom across your full route portfolio. Per crew member:

- **Capacity**: the sum of their work-availability windows
- **Load**: route runs times their expected duration, split across the people assigned
- **Bands**: Overbooked (>100%) / Tight (>80%) / Headroom (<40%)
- Team-level totals across cleaning / maintenance / security at the top
- A 100% gridline on the progress bars so over/under is visual at a glance

Pitch cadence changes where you're tight, scope expansions where you have room — backed by hard numbers.

### 13. Manage your crew + routes across all contracts

Your **Schedules** page shows your full crew roster, weekly availability, and routes — across every customer building you service. No per-customer login switching. The route pages support the same daily-plan / overrides / today's-zones model the building owner uses, scoped to the buildings under your active contracts.

### 14. In-app notifications

A bell in the topbar fires the moment any proposal status changes or a report is sent. It works across both sides of the relationship — when your client accepts your proposal, your bell lights up; when you send a monthly report, theirs does. Each notification links straight to the right place (proposals inbox / contracts drawer / reports inbox), and dismissing or "mark all read" is one click.

### 15. Contractor-flavored Merlin chat

The floating Merlin chat recognizes you're a contractor and switches to a portfolio-aware assistant. It draws on your contracts, recent proposals, run rate, win rate, and biggest pilot improvement, so questions like _"how am I doing across my contracts?"_ or _"what should I propose next?"_ get answered grounded in your actual numbers — first-person plural, from a contractor's point of view, referencing your portfolio and crew.

It also knows what contractors **cannot** do, so it won't suggest you tweak the building owner's settings.

### 16. Operate the building tree directly (Buildings → Hypervisor)

![Buildings tab — your contracted + self-owned buildings in one grid](/screenshots/contractor/buildings-tab.png)

The **Buildings** sub-nav lists every building you have access to — both **contracted** (a facility manager activated a contract for your company) and **self-owned** (you created the building yourself, see §17). Click a building → the **Hypervisor** opens scoped to that building's structure (floors → rooms → devices → routes), with edit access to the things you can actually change:

- **Add / rename / delete floors and rooms** in a contracted building. The new entries stay visible to the building owner automatically, so both parties see the same structure.
- **Create routes** on the building, tagged to your active contract. Routes you create stay visible to both parties.
- **Edit route zones + crew assignments** for routes you own.

For a large contracted building today, every contractor with an active contract drills into the same building structure the facility manager sees, but the actions available to them are scoped to what their contract grants. This is one of the two ways you can work in a building.

### 17. Spin up your own building (self-serve)

Inside the Buildings sub-nav, the **+ New building** button lets you create a top-level building owned by _your_ company — no building-owner counterparty needed. You name it, click Create, and it appears in the Buildings grid tagged "Owned by your org".

From there it works exactly like a contracted building: open the Hypervisor → add floors, rooms, zones, routes; assign crew; install devices (see §19). This is the second way you can work in a building — the case where you're servicing a client directly without a separate building-owner workspace on the other end.

### 18. Buy hardware direct from Adaptiv

The **Hardware** sub-nav (between Buildings and Today) opens a four-tab store that takes you from catalog browsing to a delivered device in inventory:

![Hardware → Browse — kits up top, individual products below, each with bill of materials, price, and install time](/screenshots/contractor/hardware-browse.png)

- **Browse** — recommended kits first (Restroom Basics, Conference Room, Open Floor, Security Perimeter, Leak Monitoring) → individual products below (Smart Display Touch Classic, Air Quality Sensor v2, mmWave Occupancy, NFC + BLE Badge Reader, etc.). Each card shows the bill of materials, price, and estimated install time. "Add to cart" is one click.

![Hardware → Cart — line items, qty editor, subtotal, and the checkout form](/screenshots/contractor/hardware-cart.png)

- **Cart** — quantity editor + ship-to address fields. Card payment at checkout is live, so real charges are processed for hardware orders.

![Hardware → Orders — placed order with status pill, line-item summary, and the fulfillment CTA](/screenshots/contractor/hardware-orders.png)

- **Orders** — every order you've placed, with a color-coded status pill (cart / placed / confirmed / shipped / delivered / cancelled) and a line-item summary.

![Hardware → Inventory — every unit owned by the org with serials, delivery dates, and per-unit Install buttons](/screenshots/contractor/hardware-inventory.png)

- **Inventory** — every unit owned by your company. Delivered units carry an **Install** button (see §19).

### 19. Install delivered devices into a building

![Install modal — pick a target location grouped by building, add an optional friendly name, and submit to install the device](/screenshots/contractor/install-modal.png)

The **Inventory** tab's Install button opens a modal: pick a location from the buildings you have access to (your own buildings plus every floor and room of your contracted buildings, grouped by building), optionally name the device, and submit. When you install:

- The device joins the **fleet of whoever owns that location** — installing into a contracted building lands the device in the building owner's fleet (they see it natively), while installing into one of your own buildings lands it in yours.
- The inventory unit moves from **delivered** to **installed**, and the date is stamped.
- A lifecycle record is kept for the audit trail.

This closes the loop: **Browse → Cart → Place order → Install** runs end-to-end without leaving the app, and the device starts producing data as soon as it's live.

---

## What contractors **cannot** do (by design)

- **Edit the building owner's AI configuration, autonomy thresholds, or device fleet.** That's the facility manager's tuning surface.
- **See SLAs outside your service area.** Cleaning contractors don't see HVAC or security SLAs.
- **See other contractors' work on the same building.** A cleaning company doesn't see a security company's patrols.
- **See the building owner's raw device activity directly.** Cross-company access is blocked. The per-contract performance dashboard is the bridge — it shows you only the scoped slice that maps to your contract.
- **Generate reports about contracts you don't hold.** Only the contractor party on a contract can write reports about it.
- **Change the decision the facility manager owns.** Contractors can't mark their own proposal as accepted, and the building owner can't rewrite a contractor's pitch. Each party can only change their own fields, and notifications can only be marked read.
- **Accept their own proposals.** Only the building owner can move a submitted proposal to accepted, declined, or countered.

---

## Why use Merlin as a contractor

The argument is operational, commercial, and strategic — three reasons to keep one tab open.

### Operational: know your own performance in real time

Without Merlin, contractors learn about SLA breaches from the facility manager in a quarterly review email. By that point the breach is months old, the customer is angry, and the renewal conversation is harder.

With Merlin: every active contract card shows live % vs target. You see a breach forming **as it forms**, with location-level breakdown. You can rebalance crew the same day instead of explaining it the next quarter. Notifications make sure you don't have to be in-app to find out.

### Operational: AI co-worker that knows your domain + your portfolio

The "Merlin's take" panel doesn't write generic ops advice — it reads your live SLA signal, correlates it with breach contributors and trends, and tells you concretely _what to do_ and _where_. The chat sidebar goes a layer deeper: ask it about your win rate or your biggest pilot impact and it grounds the answer in your real portfolio data, not generic platitudes.

### Operational: utilization across customers

The Utilization tab tells you in one screen who's stretched and who has headroom across your full portfolio — not per customer, _across all of them_. That's the data that decides whether your next conversation with a client is "we should do less here" or "we have capacity to do more."

### Commercial: structured, evidence-backed upsells

Most contractor-to-owner conversations about scope expansion are awkward and qualitative ("we think we'd do a better job if you'd let us..."). With Merlin:

- **AI surfaces the opportunity** — _"Floor 32 cadence shows a 12-min response gap; bump 2× to 3× weekly."_
- **AI suggests the right partner** — for innovation pitches, the recommendation comes pre-attached to a marketplace vendor matched to the problem class
- **One click converts the recommendation into a proposal** — pre-filled with the data + the partner
- **Submit to client** — they see a structured document with the data, the rationale, the partner's vendor card, and an explicit value change
- **The system tracks the back-and-forth** — accept / decline / counter — so nothing falls between the cracks
- **On accept, the contract amends itself** — the monthly value updates automatically; no separate "update contract terms" step

The conversation goes from _"we feel..."_ to _"the data shows X, here's what we propose, here's the partner."_ That's a different kind of vendor-customer dynamic.

### Commercial: shareback reports that hold up to audit

Every monthly report freezes a snapshot — the building owner's auditors, the contractor's renewals team, and any third-party reviewer all see the same numbers a month later. The narrative the contractor adds humanizes the report; the snapshot keeps it factually unchallengeable. Auto-narrate makes the writing fast; PDF export makes it portable.

### Commercial: pilot impact that's verifiable

This closes the question every contractor gets: _"how do we know the pilot worked?"_. Each report carries before/after SLA changes per accepted pilot, and prior-period pilots accumulate cumulative impact across successive reports. When a pilot ages out at 90 days, it's flagged as absorbed into baseline — so the disappearance is honest, not silent.

### Commercial: multi-customer leverage

Merlin's contractor surface aggregates across every customer you service. Your dashboard shows all your clients side by side, with a portfolio-wide analytics block (lifetime revenue, run rate, win rate, biggest improvement). As you grow, you don't need a new system per customer — the same workspace handles 2 contracts or 200.

### Strategic: marketplace cross-link with AI matching

When you spot a chronic issue your existing crew can't fix (recurring VOC events, parking compliance, after-hours security incidents), Merlin's marketplace exposes innovation partners that solve exactly that class of problem. The strategic-recommendations bucket can pre-attach the right vendor automatically, so you become the customer's eyes-and-ears for innovation while capturing the relationship value of bringing the right product to the right problem.

### Strategic: defensible against the next contractor

The longer you've been in Merlin with a customer, the harder it is for a competitor to dislodge you:

- The performance history is on file (every monthly report, frozen, exportable as PDF)
- The proposal record shows you've been actively trying to improve (every accepted/countered/declined proposal)
- The pilot impact data is portable across the contract's lifetime — when contracts come up for renewal, Merlin pre-drafts a renewal proposal grounded in the year's accepted pilots, so the renewal conversation is yours to lose, not theirs to win

---

## How to set up your workspace

1. **Your contractor workspace is created.** Today this is set up for you when you come on board.
2. **You're invited as the first member**, with the contractor-manager role — this is what tailors the experience to running service contracts.
3. **Your customers (the building owners) write contracts** in their own workspace that name your company as the contractor. Your dashboard automatically lists every contract pointed at your company, and new contracts appear within seconds.
4. **You add your crew** via Schedules → Team roster. Crew members can be roster-only (no Merlin login) or have their own login as cleaning / maintenance / security users. NFC badges can be linked for service check-ins.
5. **You're live.** Each new contract appears on the dashboard within seconds. No further setup.

---

## What's still on the roadmap

A few capabilities are coming but not built yet:

- **Real shipping / carrier tracking** — live carrier tracking with real shipping labels and automatic status updates on your orders.
- **Bulk install** — installing one unit at a time today; a bulk worksheet that maps many delivered units to many locations in one go would speed up large kit orders.
- **Drag-and-drop installation on the floor plan** — drag a delivered device onto a room on the floor-plan view to install it, instead of picking from a dropdown.
- **Multi-contractor comparison for building owners** — when an owner holds several contractors (cleaning + HVAC + security), a comparative scorecard that helps them rate and compare their service providers.
- **Outbound notifications by email and chat** — the in-app bell is live; outbound alerts would mean you don't need to be in the app to find out a proposal changed status.
- **Auto-flagging of flat or under-performing pilots** — a signal that surfaces pilots showing consistently flat or negative impact, so you know to retire them early.
