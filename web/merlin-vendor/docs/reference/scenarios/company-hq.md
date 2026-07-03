# Company HQ

**Tagline:** 50-floor office tower · 35 zones · 8 crew
**Icon:** building
**Vertical:** Corporate / enterprise headquarters

## Story

A modern tech company's headquarters — a 50-floor glass tower in downtown Chicago. Single building, high zone density, ~4,000 employees at peak occupancy, tight cleaning standards because clients visit frequently. The real-estate and facility management is handled in-house by **Northwind Real Estate** (they own AND manage the tower themselves). Cleaning, HVAC/maintenance, and security are all contracted out — three separate contractor orgs with three separate contracts. Classic high-visibility corporate setup.

## What Merlin demonstrates

The **lunch-rush cascade**: between 11:30 and 13:30, restroom usage triples on high-traffic floors. Merlin watches the sensor feed, sees Floor 32 East Restroom cross a hygiene threshold 40 minutes before its scheduled clean, pulls Maria's crew ahead of their 14:00 sweep, logs the reroute, and notifies the facility manager. The user loading this demo sees:

- A Merlin-sourced reroute already in Today's plan
- Historical overrides showing Merlin has been correct every day this week
- An SLA-at-risk rollup that drops to zero after the reroute lands

This is the narrative to lead every enterprise pitch with.

## Structure

Single building, no parent ecosystem. Flat and simple on the location side — but four organizations on the org side.

## Organizations (4)

| ID               | Name                    | Kind          | Role in scenario                                                                 |
| ---------------- | ----------------------- | ------------- | -------------------------------------------------------------------------------- |
| `northwind-re`   | Northwind Real Estate   | `real_estate` | Owner + manager of Northwind Tower. Jamie's org.                                 |
| `maple-cleaning` | Maple Cleaning Services | `contractor`  | Cleaning contractor. Holds the daily-cleaning contract. Maria + Diego work here. |
| `reliable-mech`  | Reliable Mechanical     | `contractor`  | HVAC + general maintenance contractor. Darnell's org.                            |
| `cardinal-sec`   | Cardinal Security       | `contractor`  | Security contractor. Ivan's org.                                                 |

All four are created fresh when the user loads the demo. The loader (the signed-in user) is added as **owner** of Northwind Real Estate — the FM org they're running this building from.

## Contracts (3)

| #   | Name                            | Manager      | Contractor          | Service    | Monthly | SLA summary                                                                                   |
| --- | ------------------------------- | ------------ | ------------------- | ---------- | ------- | --------------------------------------------------------------------------------------------- |
| 1   | Meridian-class cleaning program | Northwind RE | Maple Cleaning      | `cleaning` | $48,000 | `hygiene_threshold_breaches_per_month: 2`, `max_response_min: 20`, `overnight_coverage: true` |
| 2   | HVAC + preventive maintenance   | Northwind RE | Reliable Mechanical | `hvac`     | $15,000 | `max_response_min: 60`, `preventive_schedule: monthly`, `emergency_coverage: 24/7`            |
| 3   | Lobby + after-hours security    | Northwind RE | Cardinal Security   | `security` | $22,000 | `patrol_coverage: 24/7`, `badge_offline_response_min: 30`                                     |

All three are `status=active`. Each covers Northwind Tower only (one location each via `contract_locations`).

## Buildings

| Field       | Value                                                  |
| ----------- | ------------------------------------------------------ |
| ID          | `northwind-tower` (→ `northwind-tower-<org8>` in seed) |
| Name        | Northwind Tower                                        |
| Address     | 200 N Michigan Ave · Chicago                           |
| Kind        | building                                               |
| Floors      | 50                                                     |
| Sqft        | 850,000                                                |
| Displays    | 425                                                    |
| Sensors     | 3,640                                                  |
| Occupancy   | 0.68                                                   |
| Peak today  | 0.88                                                   |
| Latitude    | 41.8858                                                |
| Longitude   | -87.6237                                               |
| Owner org   | Northwind Real Estate                                  |
| Manager org | Northwind Real Estate (self-managed)                   |
| Custom      | true                                                   |

## Zones (~35 total)

Not every floor has zones — only floors with material cleaning needs are modeled. The rest are implied office floors with building-wide routes.

### Ground floor (lobby)

- **Main Lobby** (lobby, `F1-LB`)
- **Reception** (reception, `F1-RC`)
- **Security Desk** (reception, `F1-SD`)
- **Garage Entry** (utility, `F1-GE`)

### Floor 2 (amenities)

- **Women's Restroom** (restroom, `F2-WR`)
- **Men's Restroom** (restroom, `F2-MR`)
- **Cafeteria** (kitchen, `F2-CF`)
- **Fitness Center** (other, `F2-FC`)

### Floor 18 (mid-tower)

- **Women's Restroom** (restroom, `F18-WR`)
- **Men's Restroom** (restroom, `F18-MR`)
- **Kitchenette** (pantry, `F18-KT`)
- **Open Office** (office, `F18-OO`)

### Floor 32 (high-traffic)

- **Women's Restroom East** (restroom, `F32-WR-E`)
- **Men's Restroom East** (restroom, `F32-MR-E`)
- **Women's Restroom West** (restroom, `F32-WR-W`)
- **Men's Restroom West** (restroom, `F32-MR-W`)
- **Break Room** (kitchen, `F32-BR`)
- **Conf Rm Willow** (conference, `F32-CF-WIL`)
- **Conf Rm Oak** (conference, `F32-CF-OAK`)

### Floor 40 (executive)

- **Women's Restroom** (restroom, `F40-WR`)
- **Men's Restroom** (restroom, `F40-MR`)
- **Executive Kitchen** (kitchen, `F40-EK`)
- **Conf Rm Boardroom** (conference, `F40-CF-BD`)
- **Reception** (reception, `F40-RC`)

### Floor 50 (penthouse / events)

- **Women's Restroom** (restroom, `F50-WR`)
- **Men's Restroom** (restroom, `F50-MR`)
- **Event Kitchen** (kitchen, `F50-EK`)
- **Event Space A** (other, `F50-EA`)
- **Event Space B** (other, `F50-EB`)
- **Rooftop Terrace** (other, `F50-RT`)

### Mechanical

- **Sub-basement Utility** (utility, `B1-UT`)
- **Floor 51 Mechanical** (utility, `F51-MECH`)
- **Loading Dock** (utility, `B1-LD`)

## Merlin user accounts (6)

Distributed across all four orgs — this is where the Track G model earns its keep. The cast includes one persona per org kind + one contractor manager to demonstrate the contractor workspace shell that G-3a delivers.

| username     | name          | profile role  | at org              | org role | bio                                                                                                                                                                                         |
| ------------ | ------------- | ------------- | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jamie-hq`   | Jamie Park    | `facility`    | Northwind RE        | admin    | Facility manager. Runs day-to-day ops at Northwind Tower, approves Merlin's proactive suggestions, reviews contractor SLA compliance. Primary FM-side user. Persona = **facility_manager**. |
| `roxana-hq`  | Roxana Sosa   | `facility`    | Maple Cleaning      | admin    | Owner-operator of Maple Cleaning Services. Cares about retaining the Northwind contract, sees SLA compliance from the contractor side. Persona = **contractor_manager**.                    |
| `maria-hq`   | Maria Chen    | `cleaning`    | Maple Cleaning      | member   | Lead custodian on Maple's Northwind crew. Morning restroom sweep is her route. Persona = **worker**.                                                                                        |
| `diego-hq`   | Diego Ramirez | `cleaning`    | Maple Cleaning      | member   | Evening shift Maple crew. Bin sweep + reactive spills. Persona = **worker**.                                                                                                                |
| `darnell-hq` | Darnell Price | `maintenance` | Reliable Mechanical | member   | Reliable's on-site HVAC tech at Northwind. Receives asks on setpoint drift, pressure anomalies. Persona = **worker**.                                                                       |
| `ivan-hq`    | Ivan Kovac    | `security`    | Cardinal Security   | member   | Cardinal's lead guard for Northwind. Lobby + patrol + badge review. Persona = **worker**.                                                                                                   |

When a demo loader flips between personas via the sign-in-as picker:

- Jamie → facility_manager shell (the normal admin-facing Merlin)
- Roxana → contractor_manager shell (contracts dashboard with one contract: the Northwind cleaning one)
- Maria/Diego/Darnell/Ivan → worker shell (today's shifts)

Three contractor orgs → three potential contractor_manager views, but only Maple gets one seeded in this scenario for simplicity. Adding Reliable's and Cardinal's managers would widen the cast to 8 logins without adding meaningfully to the narrative.

## Team roster (8 crew, per contractor org)

team_members rows live at the contractor org they work for (Maple / Reliable / Cardinal). Everyone below is a team_member row; five of them (Maria, Diego, Darnell, Ivan, + the Maple contractor manager Roxana) also have Merlin logins above — those two surfaces are complementary, not duplicative.

### Maple Cleaning Services (4 crew)

| Name          | Role                | Initials | Schedule            |
| ------------- | ------------------- | -------- | ------------------- |
| Maria Chen    | Lead Custodian      | MC       | Mon–Fri 06:00–14:00 |
| Priya Shah    | Custodian           | PS       | Mon–Sat 06:00–14:00 |
| Diego Ramirez | Custodian (evening) | DR       | Mon–Fri 14:00–22:00 |
| Thandi Okafor | Overnight crew      | TO       | Sun–Thu 22:00–06:00 |

### Reliable Mechanical (2 crew)

| Name          | Role        | Initials | Schedule                |
| ------------- | ----------- | -------- | ----------------------- |
| Darnell Price | HVAC Tech   | DP       | Mon–Fri 07:00–15:00     |
| Sofia Patel   | Electrician | SP       | Mon/Wed/Fri 07:00–15:00 |

### Cardinal Security (2 crew)

| Name         | Role           | Initials | Schedule            |
| ------------ | -------------- | -------- | ------------------- |
| Ivan Kovac   | Security Lead  | IK       | Mon–Fri 06:00–14:00 |
| Robin Akande | Lobby / Patrol | RA       | Mon–Sun 14:00–22:00 |

## Routes (4)

All four routes attach to the **Maple Cleaning contract** (contract #1). HVAC + security work don't generate routes in this scenario — they're reactive + on-schedule services without a daily run pattern. That's the common shape: cleaning contracts have dense daily routes, other contracts generate incidents + overrides but not recurring routes.

| #   | Name                                     | Scope           | Contract | Service       | Cadence  | Start | Duration | SLA    | Primary       |
| --- | ---------------------------------------- | --------------- | -------- | ------------- | -------- | ----- | -------- | ------ | ------------- |
| 1   | Morning restroom sweep · Fl 2/18/32      | Northwind Tower | #1 Maple | surface_clean | daily    | 07:00 | 180 min  | 20 min | Maria Chen    |
| 2   | Lunch pre-rush polish · Fl 2/32          | Northwind Tower | #1 Maple | surface_clean | weekdays | 11:15 | 45 min   | 10 min | Priya Shah    |
| 3   | Afternoon bin sweep · Fl 18/32/40/50     | Northwind Tower | #1 Maple | empty_bins    | weekdays | 14:30 | 90 min   | —      | Diego Ramirez |
| 4   | Overnight deep clean · Lobby + Cafeteria | Northwind Tower | #1 Maple | deep_clean    | weekdays | 22:30 | 240 min  | —      | Thandi Okafor |

Substitutes: Priya subs for route 1 when Maria is out; Diego subs for route 2. Route 4 has no sub — escalate to facility manager if Thandi unavailable.

### Route tasks (examples)

New in Track G. Route 1 has ~8 tasks broken down by zone (per_run mopping, restock, daily mirror cleaning) plus a **monthly window cleaning** task on the floor-32 East restroom that only lights up once per month when last_completed_at is stale. Route 4's deep clean includes a **quarterly floor-wax refresh** on the lobby. These are what make the new route_tasks table earn its keep — Merlin schedules them automatically on the right day even though they attach to a daily-cadence parent route.

## Assignments

- **Route 1** → Maria (primary), Priya (substitute)
- **Route 2** → Priya (primary), Maria (substitute)
- **Route 3** → Diego (primary)
- **Route 4** → Thandi (primary)

## Seeded history (last 7 days)

### Route overrides (~8)

- **2 days ago, 11:50** — Merlin reroute on Route 2: "Detected VOC spike Fl 32 East — pulled 20m early, SLA preserved." Source: `merlin`, action: `extra`.
- **3 days ago, 07:15** — Human override on Route 1: "Maria called out sick — reassigned to Priya." Source: `human`, action: `reassign`.
- **4 days ago, 14:45** — Merlin reroute on Route 3: "Floor 40 bins at 94% — pulled from 15:00 slot into 14:45." Source: `merlin`, action: `extra`.
- **5 days ago, 11:30** — Merlin reroute on Route 2: "Lunch arrival +18% vs typical — added Fl 18 restrooms to scope." Source: `merlin`, action: `extra`.
- **6 days ago, 22:00** — Human override: "Event booking F50 ran late — delayed deep clean start to 23:30." Source: `human`, action: `note`.
- **Yesterday, 11:25** — Merlin reroute on Route 2: "Fl 32 East hygiene threshold 15m away — pulled Priya from F18." Source: `merlin`, action: `extra`. _(This is the headline narrative.)_
- **Yesterday, 15:00** — Human override: "Cafeteria spill reported — added to Diego's route." Source: `human`, action: `extra`.
- **Today, 11:30** — _(Active at demo load)_ Merlin reroute on Route 2: currently executing the lunch pre-rush polish pull-ahead.

### Incident actions (~15)

Scattered across the week: approvals on Merlin's proactive suggestions, a few dismissals (false alarms), one escalation (badge reader offline on Fl 41 — routed to Ivan).

## Agentic config (seeded defaults, unchanged from hydrator fallback)

- Persona: `warm`
- Autonomy policy: `approve-critical` (Merlin can auto-handle routine reroutes, asks before anything at SLA boundary)
- Proactive pings: `normal`
- Approval confidence threshold: 75%

Superadmins exploring this demo can tune these from Admin → Agentic; the demo works out of the box with the defaults.

## What loading this demo feels like

1. Click **Load a demo** → Company HQ → **Load →**
2. Demo seeds four orgs + three contracts + the building + 35 zones + 4 routes + 8 team_members + ~20 tasks + history. Page reloads into **Northwind Real Estate** as the active org, with the loader signed in as owner.
3. Landing: facility-manager shell. Sidebar shows "Northwind Tower · 425 displays · 3,640 sensors."
4. Dashboard shows the live lunch-rush reroute in-flight.
5. Admin → Locations shows one building with active rollup counts: `1 building · 35 zones · 4 routes · 3 today · 2 overrides · 1 at risk`
6. User menu shows:
   - Active workspace pill: **Northwind Real Estate (demo)**
   - Persona: **Facility Manager**
   - Sign-in-as dropdown lists Jamie, Roxana, Maria, Diego, Darnell, Ivan
7. Click **Sign in as Roxana** → reload lands on the contractor_manager shell. One contract card: "Meridian-class cleaning program · Maple Cleaning ↔ Northwind RE · cleaning · $48,000/mo · 3 SLA terms · Covers Northwind Tower."
8. Click **Sign in as Maria** → worker shell. "Good day, Maria. · One route on your plate today" with the 07:00 restroom sweep.

The scenario is the showcase for the three-persona shell split Track G delivered: same demo org, three radically different primary surfaces depending on who's signed in.
