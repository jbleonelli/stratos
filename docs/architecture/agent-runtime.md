# Agent runtime — EventBridge + SQS + Step Functions

**Status:** 🟠 Design · 2026-07-02

This is the one area we deliberately **re-architect** rather than port. Merlin
runs agents on a Postgres cron that polls an `events` table. Greenfield on AWS
lets us make this durable, observable, and retryable with native primitives.

---

## Mapping Merlin concepts to AWS

| Merlin | Stratos (AWS-native) |
| --- | --- |
| `events` table (canonical signal layer) | **EventBridge bus** + `events` table of record in Aurora |
| Agent cron tick (per-minute poll) | **EventBridge Scheduler** + event-driven triggers |
| Decision loop in handler code | **Step Functions** state machine |
| `agent_runs` (decision log) | Aurora `agent_runs` (unchanged shape) |
| Per-agent action tables | Aurora (unchanged) |
| Claude call | **Bedrock** invoke (a state) |
| Spend guard | a **guard state** before the Bedrock invoke |

---

## Flow

```mermaid
flowchart LR
  subgraph ingest [Signal sources]
    DEV[Devices]
    WH[Webhooks]
    SIM[Simulator]
  end

  DEV --> EB[EventBridge bus]
  WH --> EB
  SIM --> EB

  EB --> RULE[Rule: route by kind/severity]
  RULE --> SQS[SQS work queue]
  SQS --> SF

  subgraph SF [Step Functions: agent decision loop]
    G[Spend-guard check] --> DECIDE{decision}
    DECIDE -->|needs LLM| BR[Bedrock - Claude]
    BR --> WRITE[Write agent_run + action]
    DECIDE -->|deterministic| WRITE
    WRITE --> PUSH[AppSync mutation - push to UI]
  end

  WRITE --> AUR[(Aurora)]
  PUSH -. subscription .-> UI[SPA]
```

## Why Step Functions over a cron

- **Durable & retryable** — a stuck tick can't silently stall the whole loop;
  each step retries with backoff and surfaces failures to CloudWatch.
- **Observable** — every execution is a visual trace; no guessing what an agent
  did on a given tick.
- **Spend guard as a first-class state** — the per-org hourly/daily Bedrock cost
  cap gates the Bedrock invoke explicitly; a breach short-circuits to `skip`.
- **Fan-out** — EventBridge rules route by `kind`/`severity` to different agents
  without a monolithic poller.

## Events model

- **EventBridge** is the transport (at-least-once, decoupled ingest).
- Aurora keeps an `events` table of record for query/audit and for the UI's
  event feed (ported from Merlin), written by the resolver/consumer.
- Idempotency via `external_id` (as in Merlin) to dedupe retry-prone sources.

## Scheduling (non-agent crons)

SLA sweeps, billing sync, push dispatch, retention prune → **EventBridge
Scheduler** targeting Lambda, IAM-authenticated (no shared cron secret).

## Open questions

- Standard vs Express Step Functions (cost/latency per tick volume).
- Whether high-frequency simulator ticks go direct SQS→Lambda (cheaper) and only
  real decisions enter Step Functions.
- EventBridge Pipes to connect the bus → SQS → target with less glue.
