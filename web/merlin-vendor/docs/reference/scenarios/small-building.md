# Single small building

**Tagline:** 4-floor boutique office · 10 zones · 4 crew
**Icon:** building
**Vertical:** SMB / coworking / professional services

## Story

A small shared workspace in a restored 4-story building. Mix of anchor tenant offices and flex/coworking memberships. Around 200 people at peak. The building is owned + self-managed by **The Annex Property Co** — a two-person LLC that owns this single property. No dedicated facilities team. Cleaning is contracted out to one small local firm (Clean Sweep Boston); security is a part-time in-house concierge. That's it — two orgs, one contract.

This is the **"Merlin replaces the facilities manager"** story — the workspace is too small to justify a full-time ops team, so Merlin handles the routine (scheduling cleans, flagging maintenance, coordinating with the cleaning vendor) while the owner focuses on tenants.

## What Merlin demonstrates

The **autopilot story**: Merlin's autonomy is cranked up (`full-auto`) because there's no one to approve anything. The user loading this demo sees:

- Most incidents have already been auto-handled by Merlin (approve pill: `Auto`)
- Only genuine edge cases (vendor no-shows, after-hours badge anomalies) get escalated
- Clean, quiet dashboard — the "Merlin ran the building all day" narrative

Complementary to Company HQ's `approve-critical` model. Good for SMB pitches.

## Structure

Single building. No ecosystem. Two orgs, one contract — the smallest viable scenario shape.

## Organizations (2)

| ID                | Name                  | Kind          | Role in scenario                                        |
| ----------------- | --------------------- | ------------- | ------------------------------------------------------- |
| `annex-property`  | The Annex Property Co | `real_estate` | Owner + self-managed. Morgan's org.                     |
| `clean-sweep-bos` | Clean Sweep Boston    | `contractor`  | Small local cleaning firm (one office, ~8 total staff). |

## Contracts (1)

| #   | Name                               | Manager        | Contractor         | Service    | Monthly | SLA summary                                   |
| --- | ---------------------------------- | -------------- | ------------------ | ---------- | ------- | --------------------------------------------- |
| 1   | Daily cleaning + reactive response | Annex Property | Clean Sweep Boston | `cleaning` | $4,000  | `response_min: 60`, `weekend_coverage: light` |

## Buildings

| Field       | Value                                      |
| ----------- | ------------------------------------------ |
| ID          | `the-annex` (→ `the-annex-<org8>` in seed) |
| Name        | The Annex                                  |
| Address     | 48 Washington St · Boston, MA              |
| Kind        | building                                   |
| Floors      | 4                                          |
| Sqft        | 22,000                                     |
| Displays    | 24                                         |
| Sensors     | 180                                        |
| Occupancy   | 0.72                                       |
| Peak today  | 0.85                                       |
| Latitude    | 42.3581                                    |
| Longitude   | -71.0603                                   |
| Owner org   | The Annex Property Co                      |
| Manager org | The Annex Property Co (self-managed)       |
| Custom      | true                                       |

## Zones (10 total)

### Ground floor

- **Lobby / Reception** (lobby, `F1-LB`)
- **Coffee Bar** (kitchen, `F1-CB`)
- **Restroom Ground** (restroom, `F1-RM`)

### Floor 2 (anchor tenant)

- **Women's Restroom** (restroom, `F2-WR`)
- **Men's Restroom** (restroom, `F2-MR`)
- **Kitchenette** (pantry, `F2-KT`)

### Floor 3 (coworking)

- **Women's Restroom** (restroom, `F3-WR`)
- **Men's Restroom** (restroom, `F3-MR`)
- **Phone Booth Cluster** (other, `F3-PB`)

### Floor 4 (conference + event)

- **Conf Rm Union** (conference, `F4-CF-UN`)

## Merlin user accounts (4)

Four logins cover the scenario: the owner, the cleaning vendor's lead, one crew member, and the in-house concierge.

| username       | name          | profile role | at org             | org role | bio                                                                                                                                                       |
| -------------- | ------------- | ------------ | ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `morgan-annex` | Morgan Reyes  | `facility`   | Annex Property     | admin    | Building owner + manager. Wears every hat. Persona = **facility_manager**.                                                                                |
| `priya-annex`  | Priyanka Shah | `facility`   | Clean Sweep Boston | admin    | Runs Clean Sweep. Sees one contract (the Annex). Persona = **contractor_manager**. Demonstrates the contractor shell at its smallest — one contract card. |
| `nadia-annex`  | Nadia Rashid  | `cleaning`   | Clean Sweep Boston | member   | Morning custodian dispatched by Clean Sweep to the Annex. Persona = **worker**.                                                                           |
| `eli-annex`    | Eli Moreno    | `security`   | Annex Property     | member   | In-house part-time concierge. Not contracted out — works directly for Morgan. Persona = **worker** (in-house worker at a real_estate org).                |

No dedicated maintenance login — Hiroshi is in the team_members roster but on-call rather than active daily, so no need for a separate account. If maintenance needs scaled up, Morgan would contract it to a third firm (future).

## Team roster (4 crew, split across orgs)

### Clean Sweep Boston (2 crew)

| Name         | Role                    | Initials | Schedule                           |
| ------------ | ----------------------- | -------- | ---------------------------------- |
| Nadia Rashid | Lead custodian          | NR       | Mon–Fri 06:00–12:00 (morning only) |
| Marcus Cole  | Custodian (evening sub) | MC       | Tue/Thu 17:00–21:00 (vendor sub)   |

### The Annex Property Co (2 crew, in-house)

| Name           | Team        | Role                  | Initials | Schedule            |
| -------------- | ----------- | --------------------- | -------- | ------------------- |
| Hiroshi Tanaka | maintenance | Handyman (on-call)    | HT       | Mon/Wed 09:00–13:00 |
| Eli Moreno     | security    | Concierge (part-time) | EM       | Mon–Fri 08:00–14:00 |

The roster is intentionally thin to demonstrate the small-building economics. Notice maintenance + security stay in-house on the property's own roster — they're too part-time to contract out. Only cleaning has enough daily volume to justify a vendor relationship.

## Routes (2)

Both routes attach to contract #1 (Clean Sweep's cleaning contract). Maintenance + security don't have recurring routes in this scenario — they're reactive + ad hoc.

| #   | Name                        | Scope     | Contract       | Service       | Cadence  | Start | Duration | SLA | Primary      |
| --- | --------------------------- | --------- | -------------- | ------------- | -------- | ----- | -------- | --- | ------------ |
| 1   | Morning full-building sweep | The Annex | #1 Clean Sweep | surface_clean | weekdays | 06:00 | 180 min  | —   | Nadia Rashid |
| 2   | Evening top-up              | The Annex | #1 Clean Sweep | empty_bins    | Tue/Thu  | 17:00 | 60 min   | —   | Marcus Cole  |

No SLA thresholds — small building, Merlin operates on autonomy not on tight deadlines.

### Route tasks (examples)

Route 1 has ~5 tasks (per_run mopping, restock, daily surface wipe) + a **monthly gutter check** that only fires once per month from within the daily sweep. Keeps the checklist short and the demo scannable.

## Assignments

- **Route 1** → Nadia (primary)
- **Route 2** → Marcus (primary)

Maintenance calls and security events don't have recurring routes — Merlin dispatches as needed.

## Seeded history (last 7 days)

### Route overrides (~5)

- **Yesterday, 10:30** — Merlin auto-handled: "Coffee bar restock triggered — HVAC pressure drop on F3 detected, Hiroshi notified async. No route impact." Source: `merlin`, action: `note`.
- **2 days ago, 06:15** — Human override: "Nadia running 15m late — route shifted +15m." Source: `human`, action: `note`.
- **3 days ago, 17:30** — Merlin auto-handled: "F3 Men's soap low — added to Marcus's route." Source: `merlin`, action: `extra`.
- **5 days ago, 09:00** — Merlin auto-handled: "Concierge door-held-open 4m — auto-closed via access control, Eli notified." Source: `merlin`, action: `note`.
- **6 days ago, 10:15** — Human override: "Vendor no-show — Nadia covered F4 event prep as extra." Source: `human`, action: `extra`.

### Incident actions (~25)

Heavy on auto-handled rows (approve + `Auto` pills) — HVAC drift corrections, lighting overrides, supply restocks. A few human approvals (coffee vendor booking, after-hours badge reviews). One escalation: "Manager review — tenant complaint about F3 temp." Because autonomy is full-auto, the feed shows Merlin running most of the day with minimal human touch.

## Agentic config

- Autonomy policy: `full-auto` ← the distinctive setting
- Proactive pings: `light` (don't buzz the manager all day)
- Approval confidence threshold: 60% (lower bar, more auto-handles)
- Persona: `concise`

## What loading this demo feels like

1. Loads in <3 seconds — smallest scenario.
2. Lands on **The Annex Property Co** (active org), facility-manager shell. Dashboard: few incidents, most with `Auto` pill. Quiet, well-run.
3. Admin → Locations: `1 building · 10 zones · 2 routes · 1 today · 0 overrides · 0 at risk`.
4. User menu sign-in-as options: Morgan (facility mgr), Priyanka (contractor mgr — 1 contract), Nadia (worker), Eli (worker).
5. Click **Sign in as Priyanka** → contractor shell with one contract card: "Daily cleaning + reactive response · Annex Property ↔ Clean Sweep · $4,000/mo · 2 SLA terms."
6. Click **Sign in as Nadia** → worker shell, one route: the morning sweep.

Contrasts nicely with Company HQ — same Merlin, different autonomy profile, smallest possible footprint of the three-persona model.
