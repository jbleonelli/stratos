# Working with agents

Merlin's agents are autonomous co-workers, each focused on one domain of building operations. They watch live signal — incidents, schedules, device telemetry, audit gaps — and decide on their own whether to act, raise something for your approval, or stay quiet. This guide explains what each agent does, how to set one up, what you'll see on the Dashboard, and how to approve the things they raise.

---

## The agents

Each agent has a narrow remit and a clear set of signals it reads. You can enable, disable, and tune any of them without affecting the others. The catalog has **seven core agents** (below) that fit most buildings, plus a set of **vertical-specific agents** that appear automatically based on the building's type — see [Vertical-specific agents](#vertical-specific-agents) further down.

### Cleaning & Hygiene

Watches restroom air-quality spikes, hygiene SLAs, occupancy surges, and supply shortages. When a restroom approaches an SLA breach, it can dispatch an extra crew run on a scheduled cleaning route. Best for buildings with managed cleaning operations and tight hygiene SLAs.

### HVAC & Comfort

Watches temperature drift, CO₂ spikes, VOC readings, and setpoint faults. When a zone has been drifting for long enough that human occupants are likely to notice, it can push a small setpoint change. Conservative by default — won't touch occupied executive zones during meetings.

### Space Management

Watches room bookings, badge swipes, and occupancy. When a room is booked but nobody has badged in for 15+ minutes, it can release the booking back to the calendar so somebody else can grab it. Useful in office environments with chronic ghost-meeting problems.

### Supplies & Stock

Watches consumable inventory, consumption trends, and supplier price changes. When paper towels, soap, or other consumables drop below their reorder point and demand has been elevated, it can place a reorder with the building's preferred vendor.

### Compliance

Watches device firmware versions, NFC check-in trails, certificate expiries, and audit-evidence gaps. When a cohort of devices is lagging on firmware or an audit packet is missing required artifacts, it can queue evidence for the next compliance review.

### Energy

Watches kilowatt-hour deviations from baseline, peak-demand windows, and weather forecasts. When a sustained spike or upcoming heatwave warrants a setback schedule, it can propose one — typically as an "ask" rather than acting unilaterally, since setback schedules touch occupied zones.

### Security & Safety

Watches badge events, door-held alerts, tailgate flags, and after-hours activity. When something credible happens (a tailgate, a badge-deny burst, a door held open past threshold), it escalates to the on-shift guard. Critical security events always wait for a human to confirm before doing anything visible.

---

## Vertical-specific agents

Beyond the seven core agents, Merlin ships agents tuned to particular building types. They surface automatically based on the building's type — a warehouse building shows the warehouse agents, a clinic shows the healthcare ones — so you only see what's relevant. (When you pick a vertical during onboarding, the matching agents are also what Merlin recommends as your starter kit.)

**Warehouse / distribution**

- **Cold-Chain** — cold-storage temperature compliance + probe freshness (HACCP cold-chain breach windows).
- **Predictive Maintenance** — equipment pre-failure signatures across forklifts, conveyors, dock doors, and refrigeration.
- **Asset Tracking** — pallet / tooling / forklift location anomalies via the Adaptiv Smart Asset Tracker.

**Healthcare / clinic**

- **Pharmacy Temperature** — med-room and vaccine-fridge temperature compliance (the 2–8°C excursion window).
- **Asset Tracking** — wheelchair, infusion-pump, and ventilator location (same agent, healthcare-tuned).

**Stadium / arena**

- **Crowd-Flow** — gate ingress, crowd density, and restroom pressure during events.
- **Concession Demand** — queue length, stockouts, and redirect suggestions during peak windows.
- **Incident Choreography** — a coordinator that dispatches when several agents converge on the same event.

**Preview**

- **Parking** — spot occupancy + EV-charger uptime. In standby; switch on once parking telemetry is connected.

---

## How an agent thinks

Every agent runs the same kind of think-loop on a 15-minute rhythm:

1. **Pull live state** for its domain — recent incidents, current schedules, device health, recent overrides, the agent's own prior decisions.
2. **Reason about what's happening.** Most ticks, the answer is "nothing new in my domain right now."
3. **Pick one of three decisions:**
   - **act** — confidently do the thing, autonomously. Recorded in the audit trail with a reason.
   - **ask** — propose the thing, but route it to a human for approval first. Lands as an approval card in the Merlin chat.
   - **skip** — nothing worth doing in the next 15 minutes. Default state for quiet workspaces.
4. **Record the decision** with a one-sentence explanation that you can read on the Dashboard.

If an agent decides "act" but its proposed action is high-stakes, the autonomy policy you configured can downgrade it to "ask." The agent itself stays cautious; you set how cautious by configuring its autonomy level.

---

## Setting up an agent

> **Two places, two jobs.** Admin → Agents owns the _enabled_ state (with billing). Agentic → Agents owns _behavior_ (autonomy, data sources, playbook). They're deliberately separate so the team member who controls spend isn't the same person who tunes tactics.

### Step 1 — Enable in **Admin → Agents** (per building)

> **Where:** Admin → Agents · Org owners + admins only

The Admin → Agents table shows every agent that exists for your industry vertical, alongside its tier (_Free_ for your first agent, _$99/mo_ for additional paid agents), per-building cost, and an Active toggle. Toggle changes apply immediately with prorated charges on the Pro plan; Enterprise tenants see _Included_ and toggle freely.

For a fresh tenant on Pro, all agents start _Locked_ on the AI Agents page. Until you enable at least one here, that page shows a _"Locked"_ row per agent with a **Manage agents →** button that opens this Admin → Agents table.

The first agent enabled per building is free (free quota). Each additional agent is $99 / month, prorated to the day you toggle it. Grandfathered customers see _Grandfathered_ in the Source column at $0.

### Step 2 — Tune behavior in **Agentic → Agents**

> **Where:** gear menu (top-right) → Agentic → Agents

This is where each agent's behavior lives — autonomy, confidence floor, max actions per hour, data sources, playbook. For fresh tenants with nothing enabled yet, this section shows an empty card _"No agents enabled yet for {building}"_ with an **Enable agents** button that routes back to Admin → Agents.

Once you've toggled an agent on in Admin, it shows up here with all the controls below. Changes save immediately, per building.

### Step 3 — Watch on **MONITOR → AI Agents**

This is the live page. One card per agent enabled for the building, showing today's actions, latest decisions, pending asks. The card is read-only — for behavior changes flip back to Agentic → Agents.

Each Agentic → Agents card has the same set of controls below.

### Enabled toggle

Turn the agent on or off for this workspace. A disabled agent stops thinking entirely — it won't even write heartbeat entries until you re-enable it.

### Autonomy level

Four levels, ordered from most cautious to most autonomous:

- **Propose only** — the agent only ever asks. Never acts on its own. Use when you want full visibility before anything happens.
- **Approve critical** — the agent acts on its own except when an item is critical-priority. Critical items always wait for human approval. This is the default and a good starting point for most agents.
- **Auto low-risk** — the agent acts on anything it judges low-risk. Higher-stakes items still ask. Good for HVAC and Space, where the actions are reversible.
- **Full autonomy** — the agent acts on everything above its confidence floor. Use only after you've watched the agent for a few weeks and trust its judgement.

### Confidence floor

A percentage. The agent always reports its own confidence in each decision. If that number is below the floor you set, the agent downgrades the decision to "ask" regardless of autonomy level. Setting a floor of 80% on a critical agent (Security, Compliance) is a good sanity-check; for forgiving agents like Space, 60–70% is fine.

### Max actions per hour

A safety throttle. Even if the agent's reasoning is sound, a runaway feedback loop should never produce 50 setpoint changes in an hour. Caps the agent's autonomous actions; "ask" decisions and skips don't count against the cap.

### Triggers

Plain-English descriptions of what wakes the agent up. "Air quality threshold," "CO₂ over 900 ppm," "Stock below reorder point." Editing triggers shapes how the agent behaves — Merlin reads them as guidance about what counts as actionable signal.

### Data sources

A list of the named data sources the agent has access to — VOC sensors, badge events, the room calendar, the device fleet, etc. An agent can only reason about sources it's connected to. You manage the full list of data sources elsewhere in the Agentic page; per-agent assignment determines which subset each agent can see.

### Playbook

A small set of steps that fine-tune the agent's behaviour: "If trigger X happens under condition Y, take action Z, with autonomy Inherit." Useful for codifying SOPs that should always be followed (e.g. "If after-hours badge AND non-allowlist, always notify on-shift, never auto-resolve").

---

## Watching agents under MONITOR

Open **MONITOR → AI Agents** to see the live state of every agent enabled for the current building.

### KPI strip

- **Active agents** — how many are enabled and currently running.
- **Learning** — how many are in calibration mode (haven't built up enough history yet to act confidently).
- **Actions today** — total autonomous actions taken across all agents since midnight.
- **Pending asks** — total approval cards currently waiting in the Merlin chat.
- **Disabled** — how many agents are off.

### Agent cards

Each agent has a card that shows everything you need to read its state at a glance:

- **Name + status dot** — live indicator for enabled/active/learning/disabled.
- **Big number** — that agent's autonomous actions today.
- **Autonomy pills** — current autonomy level, confidence floor, hourly cap.
- **Reads from** — the data sources this agent is connected to.
- **Latest action pill** — the most recent thing the agent actually did, with a short summary and timestamp ("Released Conf Alder · +25m · just now"). Disappears when the agent hasn't acted today.
- **Last ran** — relative timestamp + the agent's full reasoning for its most recent decision. Tinted by decision type (green for act, amber for ask, grey for skip).
- **Expand chevron** — click to see today's full timeline of every decision the agent made, with reasoning and resolution.

The cards are live — they update within seconds as new decisions land.

---

## Approving an ask

When an agent decides "ask," it raises a card in the Merlin chat. Open the Merlin panel (right side of the screen), switch to the **Activity** tab, and you'll see all pending asks stacked by priority.

Each agent-raised card looks like a regular Merlin ask but carries a small "from <Agent> agent" badge. Click that badge to jump to the agent's card on the Dashboard with its reasoning highlighted — useful when you want to know why the agent flagged this.

Three responses, all one-click:

- **Approve** — Merlin actually does the thing the agent proposed (places the order, releases the booking, queues the evidence, etc.). The agent records that you approved this kind of item, and is more confident proposing similar things in future.
- **Hold** — defer the decision. The card is removed from the queue but no action fires; the agent records that you held the item and may re-propose if the underlying signal persists.
- **Dismiss** — the agent backs off. Records that you didn't want this; the agent leans toward skip on similar inputs going forward.

---

## Tuning an agent over time

A practical recipe for moving an agent from cautious to confident:

1. **Start in Propose-only.** Watch the agent for a few days. Read the cards it raises.
2. **Approve good ones, dismiss bad ones.** The agent learns from your responses and factors them into its next run.
3. **When you find yourself approving the same kind of ask repeatedly,** tighten one knob: either bump autonomy to Approve-critical, or lower the confidence floor by 10 points. Re-watch.
4. **If the agent starts acting on its own and you'd have approved it anyway** — leave it. You've successfully shifted work off your desk.
5. **If it acts on something you wouldn't have approved** — dismiss similar items, walk back the autonomy level a notch, and tell the agent why via its triggers or playbook.

The right autonomy level isn't fixed. A new building might warrant Propose-only on every agent for the first month; once you've seen the patterns, three or four can graduate to Auto-low-risk and you only ever see the genuinely tricky calls.

---

## Permissions

Two stacked role systems govern who can do what. Both apply: a user's profile role decides which agents they see by _domain_, and their organization membership role decides whether they can _configure_ agents at all.

By profile role (filters what's visible):

- **Superadmin / Facility Manager** see every agent for their building.
- **Cleaning, Maintenance, Security crews** see only the agents relevant to their domain — a cleaner sees Cleaning & Hygiene and can approve cleaning asks, but doesn't see Energy or Compliance.
- **Contractors** see agents on contracts that cover their assigned locations, scoped further by what their contract grants them visibility into.

By organization membership role (controls write access):

- **Owner / Admin** of the building's organization can configure autonomy levels, confidence floors, playbooks, and toggle agents on/off via Admin → Agents (which also affects billing).
- **Member** can approve / hold / dismiss asks raised in the Merlin chat — but can't change autonomy levels or playbooks. Configuration stays write-gated on purpose: the autonomy level changes the operational risk profile of the building.

A _facility manager who is also an org owner_ (the common buyer persona) gets full configuration access; a _facility manager who is a member_ sees the same live state but can only read.

---

## Cost, billing, and safety

### Operational cost

Agents are intentionally cheap to run. Each run costs roughly the price of a few rounded-down fractions of a cent — across a fully-enabled building you're looking at a few cents per day. The hourly action caps prevent runaway behaviour.

### Billing (Pro plan)

Agent entitlement is per-building:

- **First agent per building is free**, regardless of which agent.
- **Each additional active agent is $99/mo per building**, billed as an add-on alongside the building's Pro plan.
- **Grandfathered agents** (enabled before the per-building billing model rolled out) keep their original status and don't count against the cap.

The Admin → Agents page shows your current count, free quota usage, and projected monthly cost in real time. Toggling an agent updates your billing instantly so it always matches what you have enabled.

### Audit

Every decision the agent makes is logged in the audit trail with timestamp and reasoning, so a review of any action is always possible.

If an agent ever does something you wouldn't have, you can roll it back through Operations and the agent will see the rollback on its next run — it learns the same way it does from explicit dismissals.
