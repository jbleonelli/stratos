# IMF × ABM — Cleaning Intelligence Loop

**Status:** design (2026-06-06). The first Merlin deployment driven by _real_ Adaptiv
devices instead of the demo simulator. Use this as the reference for grounding Merlin's
cleaning model in a live operation.

## The real-world setup

- **IMF** (International Monetary Fund) — the building owner/manager. Two towers: **HQ1** and **HQ2**.
- **ABM** — the cleaning contractor doing the work. (In Merlin terms: ABM = a _contractor_ org, IMF = the _manager_ org, with a contract between them — the SparkleCo↔Meridian model, but real.)
- Adaptiv devices stream live through `POST /api/devices/uplink` (MessageV3 + `X-Device-Key`).
- **Device inventory (live):** 174 `smart_display_classic` + 49 `people_counter_basic` = 223 devices.
- **Granularity (asymmetric — this drives the design):**
  - **HQ2** — one people counter **and** one smart display per bathroom → full sensing.
  - **HQ1** — smart display only, **no** people counter → no demand signal.

## The Smart Display is a two-way touchpoint

It both _emits_ events and _displays_ intelligence back to occupants:

| Screen                                                           | Direction | Meaning                                 | Event                                                               |
| ---------------------------------------------------------------- | --------- | --------------------------------------- | ------------------------------------------------------------------- |
| Home — "Last cleaned on…"                                        | **out**   | public proof-of-service                 | derived on-device from crew sign-outs                               |
| Requests (Toilet paper / Hand soap / Paper towels / Maintenance) | **in**    | occupant restock/maintenance request    | `request_pressed` → `button_1..4` (1=TP, 2=soap, 3=towels, 4=maint) |
| Rate our service (★1–4)                                          | **in**    | occupant CSAT                           | rating event (wired)                                                |
| Signed-out — "SIGN-OUT COMPLETE"                                 | **in**    | crew finished a clean (distinct action) | `badge_scan` sign-out                                               |
| Maintenance / Setup                                              | —         | device state                            | `device_keepalive`                                                  |

Key consequence: **the display computes "last cleaned" locally** → Merlin is **inbound-only**.
No device write-back channel is needed; Merlin ingests events and acts on the ABM side.

## The three signals (grounded in live payloads)

| Signal       | Event             | Payload                                         | Cleaning meaning                                                 | Coverage     |
| ------------ | ----------------- | ----------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| **Demand**   | `count_report`    | `{count_abs, count_delta}`                      | footfall accumulating between cleans                             | **HQ2 only** |
| **Proof**    | `badge_scan`      | `{badge_uid}` + sign-in/**sign-out** (distinct) | crew presence; in→out = clean **duration**; sign-out = "cleaned" | HQ1 + HQ2    |
| **Incident** | `request_pressed` | `{button: 1..4}`                                | restock (TP/soap/towels) or maintenance                          | HQ1 + HQ2    |
| **Quality**  | rating            | ★1–4                                            | occupant CSAT                                                    | HQ1 + HQ2    |

## The data model — introduce a _bathroom_ entity (P1, foundational)

Today events carry a **floor-level** `location_id` (`imf-hq1-f3`) with many devices per floor, and
there is **no bathroom-level entity**. To do per-bathroom cleaning — and to pair an HQ2 counter with
its display — we need one:

```
location  kind='restroom'  (child of the floor)   e.g. imf-hq2-f2-rw
  ├─ display  device SDG00xxx   (HQ1 + HQ2)
  └─ counter  device CTR00xxx   (HQ2 only)
```

Per-bathroom **derived state** (the core object the agent reasons over):

```
restroom
  ├─ last_cleaned_at       ← latest crew sign-out (badge_scan)         [HQ1+HQ2]
  ├─ cleaning_in_progress  ← sign-in with no sign-out yet              [HQ1+HQ2]
  ├─ clean_duration        ← sign-in → sign-out span                  [HQ1+HQ2]
  ├─ usage_since_clean     ← Σ count_delta since last sign-out         [HQ2 only]
  ├─ open_requests         ← unanswered request_pressed (per type)     [HQ1+HQ2]
  ├─ csat                  ← rolling rating average                    [HQ1+HQ2]
  └─ sla_status            ← cleaned on time? request answered in time?
```

## What the Cleaning agent decides (two input profiles, same agent)

- **HQ2 (demand-driven):** `usage_since_clean > K entries` → propose/dispatch a sweep.
- **HQ1 (frequency-driven):** `now − last_cleaned_at > N hours` → overdue → dispatch.
- **Both (request-driven):** open `Toilet paper`/`soap`/`towels` request → dispatch a restock;
  `Maintenance` request → escalate to facilities.
- **Verify:** crew sign-out closes the loop — marks cleaned, clears requests, records duration.
- **Missing-tap = breach:** if a restroom is overdue and _no_ sign-out arrives, that absence is the
  SLA-breach signal (the public "last cleaned" board going stale is the same signal occupants see).

## The closed loop

```
occupant / footfall ─▶ Smart Display ─▶ events ─▶ Merlin (cleaning agent)
                                                      │ decide: restock / demand-clean / frequency / escalate
                                                      ▼
                                            dispatch ABM crew
                                                      │ crew cleans + NFC sign-out
                                                      ▼
                              display updates "last cleaned" locally
                                                      │
                                  ABM / IMF performance report
                                  (SLA adherence · response time · CSAT · footfall)
```

## Mapping to existing Merlin primitives

| Concept                       | Merlin primitive                    | State today                                              |
| ----------------------------- | ----------------------------------- | -------------------------------------------------------- |
| ABM                           | contractor org                      | to create                                                |
| IMF↔ABM agreement             | `contracts` + cleaning SLAs         | to create                                                |
| Cleaning intelligence         | the Cleaning agent                  | exists, but reads routes/SLAs/incidents — **not events** |
| Restock / maintenance request | event → ask/dispatch                | needs wiring                                             |
| Performance reporting         | `contract_reports` (ReportsSection) | exists                                                   |
| Per-bathroom state            | —                                   | **missing (P1)**                                         |

## SLAs (the ABM contract)

- **Frequency:** each restroom cleaned every _N_ hours (per building/floor tier).
- **Response:** answer a restock/maintenance request within _M_ minutes.
- **Demand (HQ2):** clean after _K_ entries since last clean.
- **Quality:** rolling CSAT ≥ target.

## Build phases

- **P1 — Data model:** restroom entities under each floor; map display (+counter in HQ2) to each;
  derive per-restroom state from the event streams.
- **P2 — Agent:** rewire the Cleaning agent's `gatherInputs` to read the restroom state (events),
  **IMF-gated** (`variant`/org check) so Meridian's cleaning agent is untouched.
- **P3 — Contractor:** ABM as a contractor org + IMF↔ABM contract + the four SLAs above.
- **P4 — Surfaces:** a restroom board (live state per bathroom), ABM's prioritized daily plan,
  and the performance report — all on live data.

## Open items / to confirm

- **Rating event shape** — ratings are wired but didn't appear in the 24h sample; confirm the event
  `kind`/payload so P1 can aggregate CSAT.
- **Counter↔display pairing** — both currently point only to the floor; P1 needs the per-restroom
  link (naming convention, install metadata, or a manual map).
- **Sign-in vs sign-out discriminator** — confirm the exact field on `badge_scan` that distinguishes
  the two (we know they're distinguishable; we need the key to derive duration).
