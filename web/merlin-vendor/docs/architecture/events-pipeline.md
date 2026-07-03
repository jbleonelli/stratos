# Events Pipeline — Unified Ingest & Agent Processing

**Status:** 🟢 Shipped (2026-05-27, migrations 165–168). The `events` table is
the canonical signal layer; `useEventsForBuilding` + `resolveEvent` read it,
`useMerlinAsks` is an events adapter, and `writeAgentRun` side-emits events.
Demo-replay was cut over to emit events in migration 169; see
[../operations/demo-replay.md](../operations/demo-replay.md).
**See also:** [message-event-stack.md](message-event-stack.md) for the
pre-unification landscape this replaced.

---

## Why

The customer app reads from three independent stores (`agent_runs`,
`merlin_asks`, simulator `incidents`) and surfaces have to bridge them
ad-hoc. That makes every new feature a hunt for which stream to merge.

Goal: **one canonical "events" table**. Every signal — from a real device,
a web service webhook, or the simulator — lands there in the same shape.
Agents read events on their cron tick, decide, and stamp the events with
the resulting `agent_run_id`. Surfaces read `events` (joined to
`agent_runs` for the decision when needed).

---

## Stores after this lands

| Store                                  | Role                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`events`** (new)                     | Incoming signal stream. One row per observation from any source. The new source-of-truth for "what is happening."                                                                                                        |
| **`agent_runs`** (existing)            | Agent decision log. Stays exactly as it is — `decision` ∈ `act` / `ask` / `skip` / `error`, `ask_resolution`, etc. Backlinks an event via `agent_runs.event_ids` (jsonb array — one decision can cover multiple events). |
| **Per-agent action tables** (existing) | Audit of side-effects when `decision='act'`. Unchanged.                                                                                                                                                                  |
| ~~`merlin_asks`~~                      | Deprecated after phase 3. New code doesn't read or write it.                                                                                                                                                             |
| ~~`simulator.incidents` (in-memory)~~  | Deprecated after phase 1 — simulator writes to `events` instead.                                                                                                                                                         |

---

## `events` schema

```sql
create table events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id     text references locations(id) on delete set null,

  -- where did the signal come from
  source_kind     text not null check (source_kind in ('device','web_service','simulator')),
  source_ref      text not null,                       -- 'device:dev_abc123' | 'web:resend' | 'sim:water_leak'

  -- what is the signal
  kind            text not null,                       -- 'water_leak' | 'voc_spike' | 'badge_deny' | ...
  severity        text not null check (severity in ('info','medium','high','critical')) default 'medium',
  payload         jsonb not null default '{}'::jsonb,  -- normalized + raw fields

  -- idempotency for retry-prone sources
  external_id     text,                                -- supplied by source; dedupes retries

  -- agent processing
  processed_by_agent_id text,                          -- which agent claimed it; null = pending
  processed_at    timestamptz,
  agent_run_id    uuid references agent_runs(id) on delete set null,

  -- terminal state
  resolved        boolean not null default false,
  resolved_at    timestamptz,
  resolved_reason text,                                -- 'agent_acted' | 'auto_signal_cleared' | 'human_dismissed'

  created_at      timestamptz not null default now()
);

create unique index events_org_external_idx
  on events (organization_id, external_id)
  where external_id is not null;

create index events_org_location_created_idx
  on events (organization_id, location_id, created_at desc);

create index events_pending_idx
  on events (organization_id, kind, created_at)
  where processed_at is null;

alter table events enable row level security;

create policy events_read on events for select
  using (organization_id = current_user_org() or is_platform_admin());

-- Writes come from the ingest API via service role (bypasses RLS).
-- A separate policy lets in-app code (simulator stub) write to its own org.
create policy events_write_own on events for insert
  with check (organization_id = current_user_org());
```

`agent_runs` gets one new column:

```sql
alter table agent_runs add column event_ids uuid[];
create index agent_runs_event_ids_gin_idx on agent_runs using gin (event_ids);
```

This lets a single decision cover multiple correlated events.

---

## `device_keys` schema

```sql
create table device_keys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  device_id       text references devices(id) on delete cascade,   -- nullable for web-service keys
  label           text,                                              -- 'HQ floor-32 IAQ probe' | 'Resend webhook'
  key_hash        text not null unique,                              -- sha256 of the secret
  key_prefix      text not null,                                     -- first 8 chars of the secret, for UI display
  scope           jsonb not null default '{}'::jsonb,                -- { kinds: [...], location_prefix: 'hq-fl-32' }
  last_seen_at    timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

alter table device_keys enable row level security;

create policy device_keys_read on device_keys for select
  using (organization_id = current_user_org() or is_platform_admin());

create policy device_keys_admin on device_keys for all
  using (is_platform_admin()) with check (is_platform_admin());
```

Provisioning a new key returns the full secret ONCE; only the hash + prefix
are stored. UI shows the prefix on the device list so operators can recognize
keys without revealing them.

---

## Ingest API

`POST /api/events/ingest`

```http
POST /api/events/ingest
Headers:
  X-Device-Key: dvc_<32-char-secret>
  Content-Type: application/json
Body:
  {
    "kind": "voc_spike",
    "severity": "high",
    "location_id": "hq-fl-32",            // optional; falls back to key.scope.location_prefix
    "payload": { "tvoc_ppb": 1240, "baseline": 320 },
    "external_id": "dev-abc-1779862834"   // optional idempotency key
  }

Response 201:
  { "event_id": "<uuid>", "received_at": "2026-05-27T08:30:12Z" }

Response 200 (idempotent replay):
  { "event_id": "<existing-uuid>", "received_at": "...", "dedup": true }
```

Flow:

1. Hash `X-Device-Key` → look up `device_keys` row. Reject if missing, revoked, or expired.
2. Rate-limit per key (in-process token bucket for v1: 100 req/min, burst 20).
3. Validate body — `kind` required, `severity` in enum, `payload` is JSON object,
   `location_id` (if supplied) starts with key's `scope.location_prefix`.
4. If `external_id` supplied and `(organization_id, external_id)` already exists,
   return the existing row with `dedup: true`.
5. Insert event with `source_kind`, `source_ref` derived from the key's row.
6. Fire-and-forget update `device_keys.last_seen_at`.
7. Return 201 with the new event id.

`POST /api/events/ingest/batch` — same auth, accepts `{ events: [...] }` (up
to 50 per call). Returns `{ results: [{ event_id, dedup? }, ...] }`. Saves
HTTP overhead for devices that buffer.

`POST /api/events/heartbeat` — just updates `device_keys.last_seen_at`. Lets
the platform UI show "device offline" without requiring a real event.

---

## Agent processing model

Agents stay on the existing cron cadence (every 5 min, configurable per
agent). On each tick the agent:

1. Reads all `events` for its `kind`s where `processed_at IS NULL` and
   `organization_id = ${tenant}` since last tick.
2. **One LLM call** (Haiku) sees the batch: "Here are 12 events that
   happened. Decide what to do for each / collectively." Cost stays flat —
   ~1 Haiku call per agent per tick regardless of event volume.
3. For each decision the agent makes:
   - Writes 1 `agent_runs` row with `event_ids = [array of source events]`.
   - Stamps every source event with `processed_at = now()`,
     `processed_by_agent_id = self.agent_id`, `agent_run_id = run.id`.
4. Critical events (`severity = 'critical'`) can trigger an out-of-band
   immediate tick via a Postgres trigger + `pg_net` call to the agent
   endpoint. Bounded number of critical events / day → bounded cost.

**Cheap pre-filter before LLM:**
Agent code applies deterministic rules before invoking Haiku. Examples:

- "VOC spike on floor with open-window flag set" → auto-skip
- "Same alert kind fired within 3 min and already has an open agent_run" →
  attach as additional event_id to that run instead of a new decision.
- "Severity=info AND tenant has 'suppress info' preference" → skip.

Goal: ≥80% of events resolved without an LLM call. Only ambiguous /
correlated / first-of-kind events hit the model.

---

## Surface migration

Surfaces switch from "merge two streams" to "read events":

| Surface                     | Before                                                    | After                                                     |
| --------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Activity                    | `useMerlinAsks` + `incidents`                             | `useEventsForBuilding(buildingId, { resolved: false })`   |
| Hypervisor 3D · MERLIN      | `usePendingAsksByLocation` + `incidents` (bridge PR #735) | `useEventsForBuilding(buildingId, { processing: 'ask' })` |
| My day attention            | `usePendingAsksByLocation` top 3                          | Same hook as Hypervisor MERLIN, sliced top 3              |
| Hypervisor 3D · Agents Live | `useLiveAgentRuns`                                        | Unchanged — agents still write agent_runs                 |
| MessageDrawer               | `type='agent_run'` only                                   | Add `type='event'` for raw event inspection               |

`useLatestAgentActions` and `useRecentResolvedAgentRuns` stay — they read
`agent_runs`, which is unchanged.

---

## Phasing

### Phase 1 — Foundation (this week)

- Migration 165: `events` table + indexes + RLS.
- Migration 166: `device_keys` table + RLS.
- Migration 167: `agent_runs.event_ids` column + index.
- Ingest API endpoints (`/api/events/ingest`, `/batch`, `/heartbeat`).
- Update simulator to write to `events` (in addition to in-memory for
  backward compat; surfaces still read the array for now).

### Phase 2 — Agent consumption

- Pre-filter + batched processing in each agent endpoint.
- Critical-severity Postgres trigger → out-of-band agent fire.
- `agent_runs.event_ids` populated by every new agent decision.

### Phase 3 — Surface cutover

- New hook: `useEventsForBuilding(buildingId, options)`.
- Rewrite Activity, Hypervisor (Merlin mode), My day attention to use it.
- Drop simulator's in-memory array. Drop PR #735's incident-bridge in
  Hypervisor.

### Phase 4 — Legacy cleanup

- Deprecate `merlin_asks` (read-only first, then schema removal).
- `/platform` UI for `device_keys` (provisioning, rotation, scope, last-seen).
- Public docs: `docs/integrations/events-api.md` for device firmware authors.

### Phase 5 — Real integrations

- First real device firmware POSTs to `/api/events/ingest`. Zero code change
  on the consumer side; the surfaces already handle it.

---

## Cost model (recap)

Haiku call ceiling stays the same as today:

| Pattern              | Calls / day (typical tenant)             |
| -------------------- | ---------------------------------------- |
| Cron batch (today)   | ~2,000                                   |
| + critical fast-path | + ~50 bounded                            |
| + pre-filter         | net ~200–500 (most events never hit LLM) |

Events table writes are cheap. Realtime broadcasts on every INSERT — fine
at expected volume (~10k events/day per busy tenant) but worth monitoring
before phase 3.

---

## Open decisions

1. **`kind` enum vs free-text.** Starting free-text; agents only consume
   what they recognize. Later we can add a registry table + CHECK constraint
   if it becomes useful.
2. **Resolution lifecycle.** `resolved` + `resolved_reason` is a single
   terminal state. Open question whether to track agent-acted vs
   signal-cleared separately — leaning toward yes via `resolved_reason`.
3. **Realtime cost.** Every event INSERT broadcasts. Measure before phase 3
   and add a subscription filter (per-org / per-location) if needed.
4. **Webhook signing for web-service keys.** Per-integration glue — Slack
   verifies `X-Slack-Signature`, Resend has its own scheme. Not in v1; key
   alone is enough to start.
5. **Drop `agent_runs.inputs`?** Today it carries a denormalized signal
   summary. Once events become canonical, `inputs` is redundant. Migration-
   light to drop; keep until phase 3 to avoid breaking the current cron code.

---

## Quick rule (post-unification)

1. **Did a signal come in?** Source writes an event.
2. **What did the agent decide?** Read `agent_runs` for the row joined via
   `event_ids`.
3. **What was the side-effect?** Read the per-agent action table referenced
   by `agent_runs.action_payload`.
4. **What does the operator see?** Surfaces read events, joined to
   `agent_runs` for decision metadata.

One source of truth for "what happened," one place where decisions live, one
audit log for side-effects.
