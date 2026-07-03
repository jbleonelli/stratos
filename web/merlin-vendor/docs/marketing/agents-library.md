# The Merlin Agents Library

## A coordinated, growing fleet of AI agents — general and specialized — for everything a building has to get right

_An Adaptiv Systems product_

---

Merlin doesn't run on one giant model trying to do everything at once. It runs on a coordinated, **growing fleet of agents** of two kinds. **General agents** handle the broad, cross-cutting work — triaging the building, briefing the operator, fielding questions, and coordinating the rest. **Specialized agents** go deep, each one expert in a single operational concern, reasoning continuously over its own slice of real-world signal and accountable for its own outcomes. Generalists for breadth, specialists for depth — a team, not a monolith. (A general agent is still scoped and accountable; it's a generalist _on the team_, not one model pretending to do every job.)

This document is the catalog of the **specialized** agents — eleven today, and growing as new domains and new device classes come online, with the general agents working alongside them. Every agent in the fleet shares the same architecture, the same autonomy controls, and the same Merlin chat interface — what changes is the _concern_ it watches, the _signals_ it reads, and the _judgement_ it applies.

---

## Why a fleet, not a single model

A building is not one thing. It's a layered set of operational concerns that each have their own physics, their own tolerances, their own stakeholders, and their own consequences when they fail.

- The signals that matter to **cleaning** are nothing like the signals that matter to **HVAC**.
- The judgement an **energy** decision requires is nothing like the judgement a **security** decision requires.
- The pace of a **cold-chain** breach is measured in minutes; the pace of a **predictive-maintenance** trend is measured in days.

A single general-purpose model trying to handle all of it ends up shallow on every dimension — competent at nothing, plausible at everything, accountable for none of it.

A fleet of specialists is the opposite. Each agent goes deep on its own domain. Each one's prompt, data sources, and confidence thresholds are tuned to the consequences of _its_ mistakes. And when an agent decides to act — or to ask — the reasoning behind that decision is auditable, attributable, and traceable to the specific signal it was watching.

The result is an operating layer that _understands_ the building, instead of an assistant that talks about it.

---

## The shape of every agent

Every agent in the library shares the same skeleton. This is the part that doesn't change — it's what makes the fleet feel like one product, not a pile of disconnected scripts.

**A purpose.** One sentence. The cleaning agent dispatches crews and verifies completions. The HVAC agent balances zones and holds setbacks. The asset-tracking agent locates things. No agent tries to do two jobs.

**A trigger set.** The specific patterns in the data that wake the agent up. _Air quality threshold crossed. NFC check-in overdue. Occupancy peak. Setpoint drift sustained._ If the trigger doesn't fire, the agent doesn't run. No noise.

**A data-source list.** The specific signals the agent is allowed to read — VOC sensors, badge events, BACnet setpoints, asset trackers, work-order systems. Each source is registered in Merlin's data-source catalog so the operator always knows what each agent is plugged into.

**An autonomy policy.** Four levels: _Propose only_ (the agent suggests, humans decide), _Auto low-risk_ (the agent acts on reversible items, asks on the rest), _Approve critical_ (the agent acts on everything except critical priority), and _Full autonomy_ (the agent acts on everything above its confidence floor and logs it). Each agent has a default; the operator can change it per-agent at any time.

**A confidence floor.** Below this confidence percentage, the agent never acts on its own — even if its autonomy policy would otherwise allow it. The floor is the safety net.

**A playbook.** A short, editable list of _trigger → condition → action_ steps the agent walks. Operators can tune the playbook to their building's specific procedures, quiet hours, excluded zones, and rate limits without touching code.

**A reasoning trail.** Every decision the agent makes — _act, ask, skip, or error_ — writes a row to the audit log with the inputs it saw, the model output it produced, the autonomy gate that approved or downgraded the decision, and the human resolution (if a human was involved). Nothing is invisible.

The agent fleet is the product. The skeleton is what makes it operable at scale.

---

## How agents talk to humans

When an agent decides it needs human judgement, it doesn't send an email. It pushes an **ask** into Merlin chat — a single message with three buttons: _Approve · Hold · Dismiss._

The ask is structured. It carries the agent that produced it, the priority, the reasoning, the proposed action, and a link back to the originating reasoning trail. The chat is shared across the workspace, so whoever's on shift sees it; whoever resolves it is recorded.

This is the loop. Agents watch, agents decide, asks surface when needed, humans resolve them, and the next tick the agent reads its own history and adjusts. Approval makes the agent bolder on similar items; dismissal cools it down. The library learns in motion.

---

## The agents (today)

### 1. Cleaning & Hygiene

Watches air quality, NFC cleaner check-ins, occupancy thresholds, and waste-bin fill levels. Dispatches crews to rooms that just crossed a hygiene SLA threshold, reroutes routes when a higher-priority space opens up, verifies that cleanings actually happened (NFC tap trail must close), and pushes asks when an SLA is at risk without a free crew member.

**Reads:** VOC sensors · NFC tap log · occupancy · work orders · waste-bin sensors
**Lives in:** every workspace where people walk through spaces

### 2. HVAC & Comfort

Holds zones within their comfort band. Adjusts setpoints on sustained drift, holds setbacks when zones are empty, increases fresh-air intake on CO₂ exceedances, and queues maintenance when a unit faults repeatedly. Quiet-hours and excluded-zone guardrails keep the agent out of server rooms and executive suites overnight by default.

**Reads:** zone temperature · CO₂ sensors · BACnet setpoints · occupancy
**Lives in:** every workspace with conditioned air

### 3. Space Management

Releases ghost bookings (rooms reserved but never occupied), flags double-bookings, and suggests consolidation when adjacent rooms are running far below capacity. The agent that quietly recovers 15–25 % of the conference-room calendar most weeks without anyone noticing.

**Reads:** room calendar (MS Graph / Google Calendar) · occupancy · badge events
**Lives in:** every workspace with meeting rooms

### 4. Supplies & Stock

Watches inventory levels against consumption rate. Places reorders when stock-out is imminent, flags supplier price changes for review, and requests quotes when an SKU's lead time is creeping. Routes through whatever supplier API the workspace has registered.

**Reads:** inventory levels · supplier API · work orders
**Lives in:** every workspace with consumables

### 5. Compliance

Surfaces audit gaps before an auditor does. Watches firmware drift across the device fleet, NFC-trail breaks, certificate expiries, and audit-log completeness. When something slips, the agent queues structured evidence to the audit trail — not a note to a human, but an actual artifact ready for a compliance review.

**Reads:** device fleet · audit log · NFC tap log · certificates
**Lives in:** every workspace with regulatory exposure — healthcare, banking, government, public infrastructure

### 6. Energy

Identifies savings the building is leaving on the table. Compares kWh draw against weather-adjusted baselines, proposes setback schedules during utility peak-demand windows, and requests audits when sustained anomalies appear. Reads the weather forecast so its proposals account for heatwaves and cold snaps before they land.

**Reads:** utility meter · weather API · zone temperature
**Lives in:** every workspace where the bill matters

### 7. Security & Safety

Escalates the events a human guard would escalate. After-hours badge swipes by non-allowlisted people. Doors held open beyond their threshold at the loading dock or lobby. Tailgate patterns. Bursts of badge denies suggesting a card-cloning attempt. Pulls the relevant camera clip and routes the alert to the on-shift supervisor with everything they need in one message.

**Reads:** badge events · cameras · door contacts
**Lives in:** every workspace where someone is physically in the building

### 8. Cold-Chain — _for distribution centers, cold storage, food + pharma_

Watches the temperature probes in cold-storage bays against the HACCP cold-chain spec. Stale probes (no reading inside the tolerance window) and sustained drift both trigger asks before the breach window closes. The agent that buys an operator the 22 minutes between _temperature drift detected_ and _stock at risk_.

**Reads:** zone temperature · cold-storage probes
**Lives in:** workspaces with `kind='warehouse'` zones — distribution centers, 3PL facilities, food-and-beverage processing, refrigerated logistics

### 9. Pharmacy Temperature — _for clinics, hospitals, pharmacies_

Same shape as cold-chain, stricter tolerance. Monitors pharmacy and medication-storage probes against the narrower windows pharma cold-chain requires. Stale probes, sustained drift, vaccine-fridge excursions, and USP 800 compounding-room deviations all flow into asks — because a pharma excursion doesn't just risk product, it can invalidate stock and trigger reportable-event obligations.

**Reads:** zone temperature · pharmacy and med-room probes
**Lives in:** clinics, hospitals, ambulatory pharmacies, vaccine-storage facilities, compounding pharmacies

### 10. Predictive Maintenance — _cross-vertical_

Reads slow signals. Vibration RMS climbing on a fan motor. Current draw drifting up on a compressor. Runtime hours past the scheduled bearing-replacement window. Repeated VFD fault resets. The patterns a human would only catch by sitting down with weeks of telemetry — the agent watches every machine continuously and surfaces the trends _before_ the failure lands.

This is the difference between corrective and preventive maintenance, run by an agent instead of a spreadsheet. The HVAC agent owns real-time comfort drift. The predictive-maintenance agent owns the _trajectory_ of every piece of equipment toward its next failure.

**Reads:** device fleet · work orders · BACnet setpoints
**Lives in:** every workspace with mechanical equipment — which is every workspace

### 11. Asset Tracking — _cross-vertical_

Locates things. People who own assets they can't afford to lose — wheelchairs, infusion pumps, ventilators, pallets, forklifts, ground-support equipment, AV carts, laptops — deploy **Adaptiv Smart Asset Trackers** alongside the asset. Each tracker fuses 5G/LTE, GPS, Wi-Fi, and Bluetooth into a single position estimate — accurate outdoors via GPS, accurate indoors via Wi-Fi anchors or BLE proximity, with cellular backhaul as the always-on safety net.

The agent watches every tracker continuously. Stale beacons (a tracker that hasn't reported a fix in 30+ minutes on a high-value asset) trigger a dispatch-to-locate ask. Geofence breaches (an asset leaving its authorized zone) trigger a security notification. Off-hours unauthorized movement triggers an escalation. Patterns across an asset class (two wheelchairs missing in 6 hours) trigger an inventory audit.

Works the same way in a hospital, a 3PL warehouse, an airport apron, or a multi-floor office. The vertical changes; the agent doesn't.

**Reads:** Smart Asset Trackers
**Lives in:** hospitals · clinics · warehouses · distribution centers · airports · campuses · offices · anywhere assets move

### 12. Parking — _coming online_

In standby today. The infrastructure (parking-spot sensors, EV chargers, ANPR cameras) is registered in the data-source catalog; the agent itself activates when the first parking deck wires in. When it does, it'll watch deck capacity, EV-charger uptime, idle-EV sessions, and accessible-spot dwell compliance.

**Reads:** parking spot sensors · EV chargers · ANPR cameras
**Lives in:** workspaces with parking infrastructure

---

## The agents by vertical

| Vertical                            | The agents that matter most                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Corporate HQ / office tower**     | Cleaning · HVAC · Space · Supplies · Security · Energy · Compliance · Predictive Maintenance · Asset Tracking |
| **Distribution center / warehouse** | Cold-Chain · Predictive Maintenance · Asset Tracking · Security · Cleaning · Energy                           |
| **Clinic / hospital / pharmacy**    | Pharmacy Temperature · Cleaning · Compliance · Asset Tracking · HVAC · Security · Predictive Maintenance      |
| **Banking branch network**          | Cleaning · Compliance · Security · Energy · Asset Tracking                                                    |
| **Airport / transport hub**         | Asset Tracking · Cleaning · Security · HVAC · Predictive Maintenance · Energy                                 |
| **University / campus**             | Cleaning · HVAC · Space · Energy · Security · Asset Tracking · Parking                                        |

Every workspace gets every agent — that's not the question. The question is which ones do meaningful work for _your_ operation. Agents that don't have signal stay quiet at zero cost. Agents that do have signal start producing decisions on day one.

---

## The library grows with the device library

Every new device class Adaptiv brings to market is paired with the agent that knows what to do with its signal.

- The **Smart Display** brought the cleaning, compliance, and space agents.
- The **People Counter** brought the occupancy half of cleaning, HVAC, and space.
- The **Smart Logger** brought the NFC-trail half of cleaning and the security crew-loop.
- The **cold-storage Smart Logger** brought the cold-chain agent.
- The **Smart Asset Tracker** brought the asset-tracking agent.
- The **parking-spot sensor + EV charger pair** will bring the parking agent online.
- The next device — and the next agent — are already on the roadmap.

The hardware is the foundation. The data is the substrate. The agents are how the data becomes action. Every new device extends the library; every new agent extends what the building can do without anyone having to think about it.

---

## What the agents library is _not_

A few things worth saying out loud, so there's no ambiguity.

**It is not a chatbot.** A chatbot waits for you to ask. The agents library acts on its own, on its own schedule, against its own signals. Merlin chat is the interface where asks surface — it's not the engine.

**It is not a generic AI assistant.** Each agent has a single concern, a tuned set of inputs, and a defined autonomy policy. There is no "the AI" — there's the cleaning agent, the HVAC agent, the asset-tracking agent. Specificity is the point.

**It is not a black box.** Every decision an agent makes is recorded with its inputs, its reasoning, its confidence, its autonomy gate, and its outcome. The reasoning trail is queryable. Audit and accountability are built in, not bolted on.

**It is not optional infrastructure.** The agents library is the product. The dashboards, the device fleet, the Merlin chat — those are the surfaces. The agents are what's actually _doing the work_.

---

## In one line

**A coordinated fleet of specialized AI agents, grounded in five-plus years of physical-world telemetry across eight thousand-plus buildings, running continuously inside every workspace Adaptiv serves — operating the building so the humans don't have to.**

That's the library. It already does the work of an entire operations team across most of our customers' buildings. The library grows. The work compounds.
