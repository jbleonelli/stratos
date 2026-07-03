# Meridian — Multi-Building Reference

The canonical demo tenant for Merlin. **As of 2026-05-13**, the Meridian organization spans three buildings under one tenant:

| Building                              | Slug  | Variant                | Description                                                                    |
| ------------------------------------- | ----- | ---------------------- | ------------------------------------------------------------------------------ |
| **Meridian HQ**                       | `hq`  | (default office tower) | 50-floor commercial office tower in San Francisco — the original flagship demo |
| **Meridian Distribution Center East** | `mde` | `warehouse`            | Cold-chain warehouse — cold-chain agent persona, refrigeration monitoring      |
| **Meridian Health Clinic**            | `mhc` | `healthcare`           | Healthcare clinic — pharmacy-temp agent persona, hygiene-compliance focus      |

`locations.variant` is the sub-typing mechanism (added in migrations 104-112). `profiles.preferences.default_building_id` controls which building a user lands on first.

**This doc is the deep reference for Meridian HQ** (the original tower). For the warehouse and healthcare demos, see:

- [`../guides/demos/meridian-distribution-east.md`](../guides/demos/meridian-distribution-east.md)
- [`../guides/demos/meridian-health-clinic.md`](../guides/demos/meridian-health-clinic.md)

---

## Meridian HQ — Building & Fleet Reference

The original 50-floor commercial office tower in San Francisco, fully instrumented with Adaptiv-manufactured devices. The remainder of this document describes the HQ building, the floor-by-floor room schedule, and the sensor fleet. Source of truth for any question that starts "how many restrooms / meeting rooms / devices in HQ…".

## Building

| Field         | Value                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| Name          | Meridian HQ                                                                |
| Address       | 245 Bryant St · San Francisco, CA                                          |
| Kind          | Commercial office tower                                                    |
| Floors        | 50 above ground                                                            |
| Footprint     | ~780,000 sqft total · ~15,600 sqft per floor                               |
| Workspace org | `Meridian HQ` (`d3fd4aec-96a3-4907-b8ca-8992d2d52674`, kind `real_estate`) |
| Location id   | `hq`                                                                       |

HQ is one of three buildings under the Meridian tenant (see top of doc). MDE (warehouse) and MHC (healthcare clinic) are real seeded buildings as of 2026-05-13 (migrations 104-112), no longer just static recipes in `custom-locations.js`.

**FEB** (First Empire Bank, 581-branch ecosystem) and **IMF** (International Monetary Fund, 2-building ecosystem) are also real seeded tenants now; IMF is internal-only (migrations 117-125).

## Floor schedule

Standard floor template: **4 restrooms per floor (2 men + 2 women)**,
laid out by quadrant. Diagonal pairs share gender — walk either NW or
SE from the elevator core for women's, NE or SW for men's. Restrooms
are named:

```
Floor {N} NW Restroom (W)    ← women's, northwest quadrant
Floor {N} NE Restroom (M)    ← men's,   northeast quadrant
Floor {N} SW Restroom (M)    ← men's,   southwest quadrant
Floor {N} SE Restroom (W)    ← women's, southeast quadrant
```

Meeting rooms are tree-themed (`Sycamore`, `Alder`, `Birch`, `Cypress`,
`Elm`, `Fir`, `Pine`, `Maple`, `Oak`, `Cedar`) with names varying per
floor so each room is uniquely identifiable. Density rises with floor
band — high-rise floors get more meeting rooms (premium space).

| Floor band                 | Floors | Restrooms / floor | Meeting rooms / floor | Special rooms                                  |
| -------------------------- | ------ | ----------------- | --------------------- | ---------------------------------------------- |
| **1** Public lobby         | 1      | 4                 | —                     | Grand Lobby + Loading Dock + Mailroom          |
| **2** Amenity              | 1      | 4                 | —                     | Cafeteria + Coffee Bar + Auditorium            |
| **3–9** Low-rise           | 7      | 4                 | 2                     | —                                              |
| **10–17** Mid-rise         | 8      | 4                 | 3                     | —                                              |
| **18** Training & infra    | 1      | 4                 | 3 (training)          | Server Room 18                                 |
| **19–36** Mid-high office  | 18     | 4                 | 3                     | —                                              |
| **37–49** High-rise office | 13     | 4                 | 4 (premium)           | —                                              |
| **50** Executive           | 1      | 4 (exec)          | 3 conference          | Boardroom + Executive Lounge + Investor Lounge |

Total rooms across 50 floors:

| Type                                  | Count   | Derivation                                                       |
| ------------------------------------- | ------- | ---------------------------------------------------------------- |
| Restrooms                             | 200     | 50 × 4                                                           |
| Meeting / conference / training rooms | 154     | (7 × 2) + (8 × 3) + (1 × 3) + (18 × 3) + (13 × 4) + (1 × 3)      |
| Special public-facing rooms           | 6       | Lobby, Loading Dock, Mailroom, Cafeteria, Coffee Bar, Auditorium |
| Special restricted rooms              | 4       | Server Room 18, Boardroom, Executive Lounge, Investor Lounge     |
| **Total rooms with an SDC**           | **360** |                                                                  |

## Service zones + routes (migration 089, 2026-05-11)

The `building_zones` and `routes` tables drive the building's service operations — what gets cleaned / inspected / patrolled, when, and by whom. Migration 089 filled both out so every floor has zones and the route catalog covers all 50 floors.

### Zones — 208 total across 50 floors

Every previously-empty floor gets a baseline 4-zone set (Women's Restroom, Men's Restroom, Pantry, Hallway). Specific floors layer specials on top:

| Floor                       | Specials                              | Zone count |
| --------------------------- | ------------------------------------- | ---------- |
| Floor 1 (Lobby)             | + Lobby · Loading Dock · Mailroom     | 7          |
| Floor 2 (Amenity)           | + Cafeteria · Coffee Bar · Auditorium | 7          |
| Floor 18 (Training & infra) | + Server Room                         | 5          |
| Floor 50 (Executive)        | + Boardroom · Executive Lounge        | 6          |
| Floors 3–17, 19–32, 33–49   | baseline 4-zone set                   | 4 each     |

Pre-migration-089 zones on Floors 2, 18, 32 (from migration 008's earlier seed) are preserved untouched.

### Routes — 23 total

Two demo routes from migration 009 (Morning restroom sweep across Fl 2/18/32, Afternoon bin sweep across Fl 18/32) are kept intact since downstream tables reference them. Migration 089 adds 21 multi-floor routes distributing across the existing 10-person Meridian crew:

| Service type      | Count | Example routes                                                                                                                                                                                            |
| ----------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Surface clean** | 5     | Lobby morning detail · Fl 1; Morning restroom sweep · Low-rise (Fl 3-17); Morning restroom sweep · Mid-rise (Fl 19-36); Morning restroom sweep · High-rise (Fl 37-50); Cafeteria midday turnaround · Fl 2 |
| **Deep clean**    | 6     | Cafeteria pre-open · Fl 2; Boardroom + executive prep · Fl 50; Overnight rotations (Mon Low-rise / Tue Mid-rise / Wed Mid-high / Thu High-rise)                                                           |
| **Empty bins**    | 2     | Afternoon bin sweep · Low-rise (Fl 1-17) and High-rise (Fl 33-50)                                                                                                                                         |
| **Restock**       | 2     | Consumable restock · Low-rise (Fl 1-25) and High-rise (Fl 26-50)                                                                                                                                          |
| **Inspection**    | 3     | HVAC weekly walkthrough · all floors; Electrical M/W/F; Restroom plumbing biweekly Tu/Th                                                                                                                  |
| **Patrol**        | 3     | Morning building open patrol; Lobby daytime patrol · Fl 1; Overnight floor patrol · all floors                                                                                                            |

Crew distribution:

| Crew member   | Team                     | Primary on                                                                |
| ------------- | ------------------------ | ------------------------------------------------------------------------- |
| Maria Chen    | cleaning (lead)          | Cafeteria pre-open + boardroom prep + high-rise morning sweep             |
| Priya Shah    | cleaning                 | Lobby morning + low-rise + mid-rise morning sweeps + restock (low & high) |
| Diego Ramirez | cleaning                 | Afternoon bin sweeps (low & high) + cafeteria midday                      |
| Thandi Okafor | cleaning (overnight)     | Mon/Tue/Wed/Thu overnight deep-clean rotations                            |
| Darnell Price | maintenance (HVAC)       | HVAC weekly walkthrough                                                   |
| Sofia Patel   | maintenance (electrical) | Electrical M/W/F inspection                                               |
| Marcus Lee    | maintenance (plumber)    | Restroom plumbing Tu/Th                                                   |
| Ivan Kovac    | security (lead)          | Morning building open patrol                                              |
| Robin Akande  | security (lobby)         | Lobby daytime patrol                                                      |
| Yusuf Habib   | security (overnight)     | Overnight all-floor patrol                                                |

Route → zone wiring: each route's `route_zones` resolves to the relevant building_zones (e.g. HVAC inspection touches every `hallway` zone; restroom plumbing touches every `restroom` zone; the deep-clean rotations touch every zone in their floor range).

### Multi-contractor coverage (migration 092, 2026-05-11)

In addition to Meridian's in-house crew + routes above, **three external contractors hold active contracts on Meridian HQ**:

| Contractor org               | Discipline           | Routes on Meridian                            |
| ---------------------------- | -------------------- | --------------------------------------------- |
| ShineRight Cleaning Services | overnight deep-clean | 2 (low-rise + high-rise rotations on Tue/Thu) |
| NorthStar Maintenance        | HVAC + plumbing      | 2 (weekly HVAC + bi-weekly plumbing)          |
| GuardWatch Security          | patrols              | 2 (overnight all-floor + lobby daytime)       |

Plus the existing SparkleCo contract (general cleaning, daily). Lily Park (Meridian FM) sees 4 active contractors total. Contractor-side routes carry `contract_id` and are stamped with Meridian's `organization_id` (per migration 090's RLS shape) so they're visible to both parties. See [../guides/contractor.md](../guides/contractor.md) for the contractor-side view.

## Adaptiv sensor fleet

Three device classes installed in the building today, all Adaptiv-
manufactured. Each class has a profile under `api/devices/profiles/`
that drives its simulator behaviour and a panel under
`DeviceDetailPage.jsx` that renders its detail page.

### Smart Display Classic (SDC)

| Field            | Value                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| SKU              | `ADX-SDC-V1`                                                                                                           |
| Model            | SDC-V1                                                                                                                 |
| Form factor      | 7" e-ink panel · 4 physical side buttons · embedded NFC reader                                                         |
| Backhaul         | LTE                                                                                                                    |
| Power            | 3-year autonomy on swappable lithium pack                                                                              |
| Firmware update  | Manual on-site only (no OTA, no BLE)                                                                                   |
| Install modes    | Restroom · Meeting room                                                                                                |
| Events emitted   | `rating`, `request_pressed`, `cleaner_check_in`, `cleaner_check_out`, `request_resolved` (server-derived), `heartbeat` |
| Profile category | Smart Displays                                                                                                         |

**SDC fleet in Meridian HQ: 360 devices** — one per room.

| Mode         | Count | Where                                                                                                                           |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| Restroom     | 200   | Every restroom on every floor                                                                                                   |
| Meeting room | 160   | Every meeting / conference / training room + every special public-facing space (lobby, dock, cafeteria, etc.) + executive areas |

External-id sequence: `SDC-000001` through `SDC-000360`, ordered by
floor (asc) then by room layout (restrooms before meeting rooms before
specials).

### People Counter Basic (PCB)

| Field                    | Value                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| SKU (BLE variant)        | `ADX-PCB-V1B`                                                                                  |
| SKU (manual variant)     | `ADX-PCB-V1L`                                                                                  |
| Model                    | PCB-V1B (BLE-updatable) · PCB-V1L (manual-only)                                                |
| Form factor              | PIR (passive infrared) — motion-only, no camera, no audio                                      |
| Backhaul                 | LTE                                                                                            |
| Power                    | 3-year autonomy on swappable lithium pack                                                      |
| Firmware update          | V1B: BLE-updatable from a service tablet · V1L: manual on-site only                            |
| Reporting modes          | Interval (periodic count snapshot) · Threshold (fires when count crosses a programmable value) |
| Operator-editable config | Threshold value · reporting_mode · reporting_interval_min                                      |
| Events emitted           | `count_threshold`, `count_report`, `heartbeat`                                                 |
| Profile category         | Occupancy Sensors                                                                              |

**PCB fleet in Meridian HQ: 411 devices** — one per SDC room (1:1
occupancy pairing) plus extras at high-traffic choke points.

| Placement                    | Count   | Notes                                                        |
| ---------------------------- | ------- | ------------------------------------------------------------ |
| Room-paired (1:1 with SDCs)  | 360     | Every room with an SDC also has a PCB on the same rule       |
| Per-floor elevator vestibule | 50      | One per floor — counts elevator-bank traffic; no SDC partner |
| Lobby Turnstiles (Floor 1)   | 1       | Single PCB aggregating lobby turnstile entries               |
| **Total**                    | **411** |                                                              |

External-id sequence: `PCB-000001` through `PCB-000411`, ordered by
floor (asc) then by room within floor.

**Variant distribution (60 / 40):**

- BLE-updatable (PCB-V1B): ~245 devices
- Manual-only (PCB-V1L): ~166 devices

**Default per-device config** (operator-editable from DeviceDetailPage's
Configuration card):

- ~70% interval mode, ~30% threshold mode
- Reporting interval ∈ {15, 30, 60} minutes
- Threshold value scales by location category via `THRESHOLD_BY_KIND`
  in the seed (Server Room ≈ 5, Restrooms ≈ 25, Meeting rooms ≈ 20,
  Lounges ≈ 20, Lobby ≈ 60, Turnstiles ≈ 100, Cafeteria ≈ 120,
  Auditorium ≈ 200), with light per-device jitter so values aren't
  all identical.

### Smart Logger Basic (SLB)

| Field                    | Value                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| SKU                      | `ADX-SLB-V1`                                                                                                               |
| Model                    | SLB-V1                                                                                                                     |
| Form factor              | 6-button NFC service logger · 2 fixed buttons (Begin / End Service) + 4 operator-configurable service buttons · no display |
| Backhaul                 | LTE                                                                                                                        |
| Power                    | 3-year autonomy on swappable lithium pack                                                                                  |
| Firmware update          | Manual on-site only                                                                                                        |
| Operated by              | Crews — cleaning + security (NOT occupants)                                                                                |
| Scenarios                | `cleaning` (badge pool 001–006) · `security` (badge pool 007–010)                                                          |
| Operator-editable config | 4 service-button labels + codes (per device)                                                                               |
| Events emitted           | `service_started`, `service_completed`, `heartbeat`                                                                        |
| Profile category         | Activity Loggers                                                                                                           |

**SLB fleet in Meridian HQ: 16 devices** — placement is sparse and
deliberate, sized to crew route density rather than 1:1 with rooms.

| Placement                 | Scenario | Count  | Devices                                                                   |
| ------------------------- | -------- | ------ | ------------------------------------------------------------------------- |
| Loading Dock (Floor 1)    | cleaning | 1      | Primary cleaning crew check-in point                                      |
| Service elevator landings | cleaning | 12     | F4, F8, F12, F16, F20, F24, F28, F32, F36, F40, F44, F48 — every 4 floors |
| Lobby (Floor 1)           | security | 1      | Security desk shift logging                                               |
| Server Room 18            | security | 1      | Restricted-access logging                                                 |
| Boardroom (Floor 50)      | security | 1      | Executive-floor patrol logging                                            |
| **Total**                 |          | **16** |                                                                           |

External-id sequence: `SLB-000001` through `SLB-000016`.

**Default per-device button sets** (operator-editable from
DeviceDetailPage's Configuration card):

| Scenario   | Buttons                                                      |
| ---------- | ------------------------------------------------------------ |
| `cleaning` | Restroom check · Floor sweep · Trash collection · Deep clean |
| `security` | Patrol · Incident check · Escort · Lockup                    |

**Crew member roster** (10 members seeded into `team_members` by migration
043, badge UIDs `BADGE-CRW-001` through `BADGE-CRW-010`):

| Range   | Team     | Names                                                                                  |
| ------- | -------- | -------------------------------------------------------------------------------------- |
| 001–006 | cleaning | Maria Lopez (Lead), Carlos Mendez, Aisha Patel, James Okafor, Sofia Rossi, Daniel Park |
| 007–010 | security | Marcus Hill (Supervisor), Priya Iyer, Liam O'Brien, Yuki Tanaka                        |

A `service_started` event picks the badge from the device's scenario pool;
the matching `service_completed` re-uses the originating badge so start /
end pairs stay self-consistent.

## Operating windows (simulator regimes)

The simulator (`api/devices/seed-events.js`) runs three regimes, all in
`America/New_York` and DST-aware:

| Regime      | When                                                 | What fires                                                                                                                                                                                                                                                                            |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FULL**    | Mon–Fri 08:00–19:00                                  | Full mix — occupants emitting button presses + ratings on SDCs, PCBs reporting, security crews using SLBs (light)                                                                                                                                                                     |
| **CLEANER** | Mon–Fri 06:00–08:00 (prep) and 19:00–23:00 (cleanup) | Cleaner badge taps for SDCs · PIR motion (mostly count_report) for PCBs · cleaning crews active on SLBs (the primary use case)                                                                                                                                                        |
| **CLOSED**  | Weekends + 23:00–06:00 weeknights                    | No active events. Heartbeats still fire (every device beats once per 24h regardless of regime). Open visits drain via cleaner_check_out so nothing is left dangling overnight (note: open SLB sessions are NOT auto-drained — service crews are expected to badge out before leaving) |

Per-org cadence for active events lives in
`merlin_config.device_seed_settings.frequency_min` (default 5 min;
operator-editable from **Agentic → Emulator**).

## Roles & access (Meridian HQ today)

Five roles ship in `roles.js`. PCB visibility was added on 2026-04-26
to all but Security; SLB visibility added on the same day:

| Role                 | Sees SDCs? | Sees PCBs? | Sees SLBs? |
| -------------------- | ---------- | ---------- | ---------- |
| Super Admin          | ✓          | ✓          | ✓          |
| Facility Manager     | ✓          | ✓          | ✓          |
| Cleaning Services    | ✓          | ✓          | ✓          |
| Building Maintenance | ✓          | ✓          | ✗          |
| Building Security    | ✗          | ✗          | ✓          |

Security gets SLBs (they operate the security-scenario pucks) but stays
out of the occupancy-sensor and smart-display lanes — those aren't
security devices. Maintenance gets SDC/PCB but not SLB — they don't
operate service loggers. Could revisit if responsibilities shift.

## Reseeding

Both seed scripts are idempotent on `(organization_id, external_id)`,
so re-running them after adjusting the floor model rewrites in place
without dupes. The current seed scripts:

- `scripts/seed-meridian-hq-displays.mjs` — 360 SDCs
- `scripts/seed-meridian-hq-people-counters.mjs` — 411 PCBs
- `scripts/seed-meridian-hq-smart-loggers.mjs` — 16 SLBs

All three require `SUPABASE_URL` and `SUPABASE_SECRET_KEY` env vars and
the `organizations`, `locations`, and `devices` tables to exist
(through migration 043).

If the floor model changes structurally (e.g., 6 restrooms per floor
instead of 4), the safer path is to delete then reseed — preserving
old `external_id`s with new room labels gets confusing because the
simulator's count-scaling and the firehose's titles will reference
labels that don't match what's installed.

## Pointers

- Schema reference for device-related tables: `supabase/migrations/040_device_events.sql`, `042_people_counter_basic.sql`, and `043_smart_logger_basic.sql`
- Per-class behaviour: `api/devices/profiles/smart-display-classic.js`, `api/devices/profiles/people-counter-basic.js`, `api/devices/profiles/smart-logger-basic.js`
- Detail page rendering: `src/app/DeviceDetailPage.jsx` (dispatches by `device.kind`)
- Building picker count derivation: `src/app/devices-store.js` `useFleetCountsByLocation`
- Simulator orchestrator: `api/devices/seed-events.js`
- Device profile selection UI: `src/app/Agentic.jsx` `DeviceSeedSimulatorCard`
