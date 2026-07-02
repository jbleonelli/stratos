# Stratos — Architecture (plan of record)

**Status:** 🟠 Founding spec · 2026-07-02 · nothing deployed yet
**Owner:** JB
**One-liner:** A fully AWS-native building-operations platform, built from
scratch on AWS managed services only.

---

## 1. What this is

Stratos is a **greenfield** building-operations platform on a **fully AWS-native
managed stack** — no Supabase software, no PostgREST. That single constraint
drives the two dominant architectural choices (§5): authorization in the
application layer with an RLS backstop, and a GraphQL data API on AppSync.

---

## 2. Principles

1. **AWS-native managed services only** for platform infrastructure. The only
   non-AWS pieces are external business integrations with no AWS equivalent
   (Stripe for payments).
2. **Authorization in the application layer** (AppSync/Lambda) **with RLS kept in
   the database as a backstop.** Defense in depth.
3. **A single React + Vite SPA** whose only backend seam is a GraphQL client +
   Cognito auth, so the data layer is swappable and testable in isolation.
4. **One coherent domain model** owned in `db/` — schema, `SECURITY DEFINER`
   RPCs, and RLS policies evolve together via forward-only migrations.
5. **Quality is proven, not asserted.** The cross-tenant leak suite and the E2E
   journeys are the definition of "done."
6. **Everything is IaC** (Terraform). Reproducible + per-client stampable.

---

## 3. Target architecture

```mermaid
flowchart TB
  subgraph client [React UI]
    SPA[React + Vite SPA]
    DL[Data layer: GraphQL client + Cognito auth]
  end

  subgraph edge [Edge]
    CF[CloudFront + WAF]
    S3W[S3 - static site]
  end

  subgraph auth [Identity]
    COG[Cognito user pools<br/>custom claims: org_id, platform_role]
  end

  subgraph api [Data + compute]
    APPSYNC[AppSync GraphQL<br/>queries + mutations + subscriptions]
    LR[Lambda resolvers / BFF<br/>app-layer authorization]
  end

  subgraph agents [Agent runtime]
    EB[EventBridge bus = events pipeline]
    SQS[SQS work queue]
    SF[Step Functions - decision loop]
    BR[Bedrock - Claude]
  end

  subgraph data [Data plane]
    AUR[(Aurora Serverless v2<br/>Postgres + RLS backstop + RPCs)]
    S3F[S3 - files/blobs]
  end

  subgraph ext [External]
    STRIPE[Stripe]
    SES[Amazon SES]
  end

  SPA --> CF --> S3W
  SPA --> COG
  SPA --> APPSYNC
  SPA --> S3F
  APPSYNC --> LR --> AUR
  APPSYNC -. subscriptions .-> SPA
  EB --> SQS --> SF
  SF --> BR
  SF --> AUR
  SF -. push .-> APPSYNC
  LR --> STRIPE
  SF --> SES
```

---

## 4. AWS service map

| Concern | **Service** | Notes |
| --- | --- | --- |
| Frontend hosting | **S3 + CloudFront + WAF** | Static SPA at the edge |
| Auth | **Cognito** | Custom claims carry `organization_id`, `platform_role` |
| Data API | **AppSync (GraphQL)** | Flexible query + built-in Cognito authz |
| Realtime | **AppSync subscriptions** | Same service as the data API |
| Compute | **Lambda** | Resolvers + BFF logic |
| Database | **Aurora Serverless v2 (Postgres)** | RLS backstop + `SECURITY DEFINER` RPCs |
| Object storage | **S3** | Presigned URLs |
| Scheduling | **EventBridge Scheduler → Lambda** | IAM-authenticated cron |
| Agent orchestration | **Step Functions + EventBridge + SQS** | Durable, observable, retryable |
| LLM | **Bedrock (Claude)** | Region-pinned inference profiles |
| Email | **Amazon SES** | SPF/DKIM/DMARC |
| Secrets | **Secrets Manager** | ARN references only |
| Observability | **CloudWatch + X-Ray** | Native tracing/alarms |
| IaC | **Terraform** | Per-client stampable modules |

**External (no AWS equivalent):** Stripe (payments).

---

## 5. The two decisions that dominate the build

### 5.1 Authorization: app-layer + RLS backstop

No PostgREST means the SPA cannot talk to the DB directly. Every read/write goes
through **AppSync → Lambda resolvers**, and org/location/contract/platform-admin
scoping becomes **application code**.

**We keep RLS enabled in Aurora anyway** (RLS is a Postgres feature, fully
allowed) as a safety net: resolvers set the Cognito-derived claims into the DB
session, so the same policies still fire. App-layer authz is the mandated shape;
RLS is the last line of defense. See
[`docs/architecture/authorization-and-claim-bridge.md`](docs/architecture/authorization-and-claim-bridge.md).

### 5.2 Data API: AppSync resolver strategy

AppSync restores the flexible querying the SPA relies on **and** replaces
realtime in one managed service. Resolvers reach Aurora via:

- **RDS Data API** (managed, no connection pooling) for straightforward CRUD, or
- **Lambda resolvers** for complex logic + calling the ported RPCs.

This resolver surface (≈100 tables of reads/writes) **is the bulk of the
project** — budgeted as the rebuild, not a detail.

---

## 6. Components

### 6.1 Frontend

React + Vite SPA. The only backend seam is the data layer: a GraphQL client
(AWS Amplify or urql/Apollo) + Cognito auth. Data access is centralized in React
Query hooks (`queries/*.ts`) so the transport is isolated behind a stable hook
API — components, styles, i18n, and routing never touch AppSync directly.

### 6.2 Auth (Cognito)

User pools with custom attributes for `organization_id` and `platform_role`. A
pre-token-generation Lambda resolves the caller's active org + role at sign-in
and injects them as claims; those claims are mapped into the DB session for the
RLS backstop.

### 6.3 Database (Aurora Serverless v2, Postgres)

The domain model is authored in `db/` as `V1_baseline.sql` (structure + the
`SECURITY DEFINER` RPCs + RLS policies) and evolves via forward-only migrations.
RLS helpers read the injected claims (`db/helpers/`), so policies enforce tenant
isolation as a backstop behind the resolver-layer checks.

### 6.4 Agent runtime

Event-driven and durable by design:

- **EventBridge** is the events bus (devices / webhooks / simulator publish here).
- **SQS** buffers work.
- **Step Functions** runs the durable agent decision loop (act/ask/skip), calls
  **Bedrock**, writes `agent_runs` + action tables, and pushes results to the UI
  via an AppSync mutation/subscription. Spend guard is a state in the machine.

See [`docs/architecture/agent-runtime.md`](docs/architecture/agent-runtime.md).

### 6.5 Storage (S3)

Buckets per concern (ticket photos, branding, CMS). Presigned URLs for
upload/download. Access scoped by key prefix + resolver checks.

### 6.6 Scheduling (EventBridge Scheduler)

Scheduled jobs (SLA sweeps, billing sync, push dispatch, retention prune) run as
EventBridge schedules targeting Lambda, gated by IAM (no shared cron secret —
invocation is AWS-authenticated).

---

## 7. Environments & deployment

- **Terraform**, one reusable module set, instantiated per environment
  (`dev`, `staging`, `prod`) and, later, **per-client isolated stacks**
  (own VPC/DB/domain/region) — residency satisfied per deployment.
- State in S3 with native locking, one key per env/client.
- CI/CD via GitHub Actions → AWS OIDC (no long-lived keys). Manual-approve gate
  on prod.

---

## 8. Seed data (dev / demo / test)

Fresh environments are populated with **deterministic synthetic seed data** —
orgs, users, locations, devices, and sample activity — so development, demos, and
E2E runs start from a known state. See [`docs/data-seed/`](docs/data-seed/).

---

## 9. Acceptance gate

Stratos is "done" for a slice when the **cross-tenant leak suite** and the
**E2E journeys** pass against the AWS stack. These run in CI and block release.
See [`docs/parity/`](docs/parity/).

---

## 10. Build sequence

1. **Foundation** — Terraform baseline, Aurora + `V1_baseline.sql`, RLS proven
   from injected claims.
2. **Identity** — Cognito + claim bridge; prove one policy + one RPC end-to-end.
3. **Vertical slice** — one domain (events/asks) fully through AppSync:
   query + mutation + subscription + authz. Validates the pattern before scaling.
4. **Parity harness** — port leak suite + E2E; wire as CI gates.
5. **Domain-by-domain** — build out the resolver surface; port UI data hooks.
6. **Agent runtime** — EventBridge + SQS + Step Functions + Bedrock.
7. **Storage + email + billing** — S3, SES, Stripe.
8. **Data seed + launch** — one-time import, smoke, cut over DNS.

---

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| App-layer authz leaks tenant data | RLS backstop + leak suite as hard CI gate |
| AppSync resolver sprawl (≈100 tables) | Budget it as the core build; codegen where possible |
| Cognito claim mapping errors | Vertical-slice proof before scaling |
| Aurora cost at low scale | Serverless v2 scale-to-low; review at real load |

---

## 12. Non-goals

- No microservices — Lambda + AppSync + Aurora monolith is right at this scale.
- No multi-region active-active initially (per-client stack covers residency).
