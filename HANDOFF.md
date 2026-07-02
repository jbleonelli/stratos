# HANDOFF — start here (agent onboarding)

> **If you are an AI agent reading this after a Cursor restart: read this file
> first, then [`ARCHITECTURE.md`](ARCHITECTURE.md). It contains everything you
> need to pick up where the last session left off.**

Last updated: 2026-07-02

---

## 1. What Stratos is

A **greenfield**, **fully AWS-native** building-operations platform — built from
scratch on AWS managed services only (no Supabase software, no PostgREST). That
one constraint drives the whole architecture: authorization lives in the
application layer (AppSync/Lambda) with RLS kept in the database as a backstop,
and the data API is GraphQL on AppSync.

## 2. Where things live

- **This repo (Stratos):** `…/DESIGN/WORK/CODING/STRATOS`
  Remote: `https://github.com/jbleonelli/stratos` (branch `main`).

> ⚠️ **Workspace note:** This doc assumes Cursor is open **with STRATOS as the
> workspace root**. If shell `pwd` / `git status` point somewhere else, the
> workspace didn't switch — re-open the STRATOS folder, otherwise git and the
> sandbox will operate on the wrong repo.

## 3. Current state (as of 2026-07-02)

**Founding scaffold committed + pushed** (root commit, 23 files). Nothing is
deployed. `infra/` is a **skeleton** (intent + sketched resources, not
`apply`-ready); `web/`, `api/` are placeholder READMEs.

**🟢 NEW — claim-bridge proof is green** (`db/`). The single biggest risk (does
RLS still isolate tenants once PostgREST's automatic JWT injection is gone?) is
**retired with a runnable test**:

- `db/helpers/001_authz.sql` — RLS authz helpers reading `request.jwt.claims`
  (`current_user_org()`, `is_platform_admin()`, `has_location_access()`).
  `organization_id` / `platform_role` come straight from the Cognito claim
  (resolved by the pre-token-gen Lambda).
- `db/proof/` — a minimal org-scoped schema with the standard RLS policy shapes +
  a 10-test cross-tenant leak suite on **PGlite (real Postgres in WASM, no
  Docker)**. Proves isolation in both modes: app-layer-on, and app-layer-bypassed
  (the DB backstop catches a simulated resolver bug). `cd db/proof && npm install
  && npm test` → 10/10 green. Not yet committed.

The bridge pattern proven: `BEGIN; SET LOCAL ROLE stratos_resolver; SET LOCAL
request.jwt.claims = '{…}'; <query>; COMMIT` — queried as a non-privileged role so
RLS genuinely fires.

**🟢 V1 baseline slice landed** (`db/V1_baseline.sql` + `db/seed/dev.sql`):
the authored identity/org core (organizations, profiles, organization_members,
locations, user_location_grants) + the events/asks domain (devices, events, asks,
agent_runs), with full RLS read/write policies and the slice's SECURITY DEFINER
RPCs (`self_serve_create_org`, `set_active_org`, `ingest_event`, `raise_ask`,
`answer_ask`). Proven at the DB layer by `db/proof/baseline.test.mjs`. DB suite
**22/22 green** (`cd db/proof && npm test`).

**🟢 NEW — AppSync resolver slice landed** (`api/`): the real Lambda resolver for
events/asks — `api/schema.graphql` (SDL incl. subscriptions) + `api/src/`
(`resolver.mjs` dispatch → app-layer authz → claim bridge; `pg-client.mjs` prod
connection). Proven by `api/test/resolver.test.mjs` running the actual handler
against `db/V1_baseline.sql` on PGlite with AppSync-style Cognito events
(queries, mutations, idempotency, cross-tenant refusal, unauth/no-org rejection).
This is the first proof of the resolver→claim-bridge path *above* the DB.
Subscriptions are AppSync-native (published by `raiseAsk`/`ingestEvent`).

**🟢 Terraform foundation landed** (`infra/`): `modules/network` (private VPC,
subnets, SGs, Secrets Manager endpoint) + `modules/aurora` (Serverless v2 cluster
+ Secrets Manager creds) + `bootstrap/` (tfstate S3 bucket). `terraform validate`
passes for root + bootstrap.

**🟢 NEW — Cognito + pre-token claim bridge landed**: `infra/modules/cognito`
(user pool, custom attrs, SPA SRP client, pre-token-generation Lambda in the VPC
with Secrets Manager access) + `api/src/pre-token.mjs` (the handler) +
`public.resolve_login_claims(sub)` in `db/V1_baseline.sql` (BYPASSRLS-owned
lookup that computes `organization_id`/`platform_role` before any claims exist).
This is the **input side** of the claim bridge (Cognito → token → RLS). Proven by
`api/test/pre-token.test.mjs`. `api` handlers bundle via `npm run build` (esbuild)
→ `dist/`, which the cognito module zips.

**🟢 NEW — resolver on AWS + migration path landed**: `infra/modules/lambda`
(resolver Lambda + a schema-migration Lambda, in-VPC, Secrets Manager access) and
`infra/modules/appsync` (GraphQL API with Cognito auth, a Lambda data source, and
a resolver per Query/Mutation field). `api/src/migrate.mjs` + `migrate-core.mjs`
apply the `db/` slices to Aurora once each (tracked in `public.schema_migrations`,
seed gated by `applySeed`); `api/src/pg-client.mjs` now builds its connection from
the Secrets Manager secret at cold start (genuinely deployable). `V1_baseline.sql`
grants `stratos_resolver` to the connecting master role so `SET ROLE` works.
The events/asks slice is now deployable **end-to-end**. API suite **18/18 green**;
DB suite **22/22**; `terraform validate` passes (root + bootstrap).

**🟢 NEW — edge delivery + web SPA landed**: `infra/modules/edge` (private S3
origin + CloudFront with OAC + WAFv2 managed rules & rate limit; us-east-1
provider alias for the CloudFront-scoped WAF/ACM) and `web/` — a React + Vite +
TypeScript SPA. Cognito sign-in via the Amplify Authenticator; an events/asks
dashboard (raise/answer asks, ingest events) over the AppSync GraphQL endpoint
with live subscriptions. All data access goes through React Query hooks in
`web/src/queries/` over a single Amplify seam (`web/src/api/client.ts`).
`web` build (typecheck + Vite) passes; `terraform validate` passes with edge.
Not yet committed.

Committed (root commit):

```
ARCHITECTURE.md                                  # plan of record — read after this
README.md
docs/architecture/authorization-and-claim-bridge.md
docs/architecture/agent-runtime.md
docs/data-seed/README.md                         # dev/demo/test seed-data plan
docs/parity/README.md                            # acceptance gate
infra/ (Terraform: root + modules/{edge,cognito,aurora,appsync,lambda,
        eventbridge,stepfunctions})
web/README.md  api/README.md  db/README.md       # placeholders
```

**🟢 NEW — live smoke test passed + CI hardened + agent runtime slice landed**:
- **Live smoke test** — a `dev` stack was applied to real AWS (backend-only,
  `enable_edge=false`), migrated (`applySeed`), exercised (tenant-isolated reads,
  an RPC write, a cross-tenant denial, AppSync `UnauthorizedException` on an
  unauthenticated call), then destroyed. Added `enable_edge` toggle for
  backend-only stacks.
- **CI hardening** — `.github/workflows/ci.yml` now gates the web build, the
  Lambda bundle build, and `terraform fmt`/`validate` (all roots) alongside the
  DB + API suites. `infra/github-oidc/` provisions a repo-scoped OIDC deploy
  role; `.github/workflows/deploy.yml` is a manual (plan-by-default) deploy.
- **Agent runtime (build sequence step 6), first slice** — `db/migrations/
  002_agent_runtime.sql` (spend budget + `agent_run_allowed`/`record_agent_run`/
  `agent_raise_ask`), `api/src/agent-{core,worker}.mjs` (deterministic policy +
  spend guard + system write path, proven by `api/test/agent.test.mjs`), and
  `infra/modules/{eventbridge,stepfunctions}` + the worker in `modules/lambda`
  (bus → SQS → worker; Standard state machine). API suite **26/26**;
  `terraform validate` passes. Bedrock invoke + AppSync push are the next gaps.

## 4. The decisions already made (don't re-litigate)

| Topic | Decision |
| --- | --- |
| Cloud | AWS-native managed services only. Non-AWS exception: Stripe (payments). |
| Auth | Amazon Cognito; custom claims `organization_id`, `platform_role`; pre-token-gen Lambda resolves active org/role. |
| Data API | AWS AppSync (GraphQL) — data API + realtime in one service (no PostgREST). |
| Authorization | App-layer in Lambda resolvers **+ RLS kept in Aurora as a backstop** via a Cognito→`request.jwt.claims` bridge. |
| Database | Aurora Serverless v2 (Postgres). Schema authored in `db/V1_baseline.sql` (structure + ~100 `SECURITY DEFINER` RPCs + RLS policies), evolving via forward-only migrations. |
| Agent runtime | EventBridge (bus) + SQS + Step Functions (decision loop) + Bedrock. Spend guard = a state in the machine. |
| Storage | S3 + presigned URLs. |
| Scheduling | EventBridge Scheduler → Lambda (IAM-auth, no shared cron secret). |
| Email | Amazon SES. |
| IaC | Terraform, one module set, stamped per env and per isolated client stack. |
| UI | React + Vite SPA; the only backend seam is a GraphQL client + Cognito behind React Query hooks. |
| Observability | CloudWatch + X-Ray. |

Full rationale: `ARCHITECTURE.md` §5, and the two deep-dives in
`docs/architecture/`.

## 5. Build sequence (from ARCHITECTURE.md §10)

1. **Foundation** — Terraform baseline; Aurora + `db/V1_baseline.sql`; prove RLS
   fires from injected claims. ← *RLS-from-claims ✅ proven; `V1_baseline.sql`
   core slice ✅ landed; Terraform `network` + `aurora` + tfstate `bootstrap`
   ✅ landed (validate passes); remaining: growing the schema surface.*
2. **Identity** — Cognito + claim bridge; prove one RLS policy + one RPC E2E.
   ← *Cognito module + pre-token-gen Lambda (`resolve_login_claims`) ✅ landed and
   unit-proven; remaining: run it against a real user pool + Aurora.*
3. **Vertical slice** — one domain (events/asks) fully through AppSync
   (query + mutation + subscription + authz). ← *✅ DONE. Resolver + SDL proven
   in `api/` and deployed by `infra/modules/{lambda,appsync}` behind Cognito, with
   a migration Lambda applying the schema to Aurora.*
4. **Acceptance harness** — cross-tenant leak suite + E2E; wire as CI gates.
5. **Domain-by-domain** — build the resolver surface + UI data hooks.
6. **Agent runtime** — EventBridge + SQS + Step Functions + Bedrock.
7. **Storage + email + billing** — S3, SES, Stripe.
8. **Seed + launch** — load seed data, smoke, DNS cutover.

## 6. Immediate next steps (pick one)

- ✅ **Claim-bridge proof** — DONE (`db/helpers` + `db/proof`, 10/10 green). This
  was the single biggest risk; it's retired. **First follow-up: commit it.**
- ✅ **Schema baseline (core slice)** — DONE. `db/V1_baseline.sql` (identity +
  events/asks) + `db/seed/dev.sql`, proven by `db/proof/baseline.test.mjs`.
- **Grow the schema surface:** add the next domains to `V1_baseline.sql` (or split
  into `db/migrations/`), each with RLS policies + RPCs + baseline-test coverage.
  Reuse the org+location policy shapes already established. ← **NEXT**
- ✅ **Vertical slice (step 3)** — DONE at the code layer. `api/` holds the
  AppSync SDL + Lambda resolver (query + mutation + subscription + authz), proven
  by `api/test/resolver.test.mjs` (10/10). Remaining: Terraform wiring.
- ✅ **Foundation module** — DONE. `infra/modules/network` (private VPC, subnets,
  SGs, Secrets Manager endpoint) + `infra/modules/aurora` (Serverless v2 cluster,
  subnet group, Secrets Manager creds) + `infra/bootstrap` (tfstate S3 bucket).
  `terraform validate` passes for root + bootstrap.
- ✅ **Cognito module** — DONE. `infra/modules/cognito` (user pool + SPA client +
  pre-token-gen Lambda) + `api/src/pre-token.mjs` + `resolve_login_claims`.
- ✅ **Resolver on AWS + migration path** — DONE. `infra/modules/{lambda,appsync}`
  deploy the resolver behind Cognito-authed AppSync; `api/src/migrate.mjs` applies
  the `db/` schema to Aurora (tracked, idempotent, seed-gated).
- ✅ **Edge + web SPA** — DONE. `infra/modules/edge` (S3 + CloudFront + WAF) and
  `web/` (React/Vite SPA: Cognito auth + events/asks dashboard over AppSync).
- **Live smoke test on real AWS:** `terraform apply` a `dev` stack, invoke the
  migrate Lambda with `applySeed`, publish the SPA to the edge bucket, then sign
  in and confirm the dashboard + tenant isolation end-to-end. ← **NEXT**
- **CI hardening:** add `terraform fmt -check`/`validate` and the `api`/`web`
  builds to `.github/workflows` so infra + bundles are gated too.
- **Grow the domain:** extend `db/V1_baseline.sql` (or `db/migrations/`) +
  `api/schema.graphql` + the resolver dispatch + `web/` hooks, each covered by
  the suites.
- **Grow the schema surface:** add the next domains to `V1_baseline.sql` (or split
  into `db/migrations/`), each with RLS policies + RPCs + baseline-test coverage,
  and extend `api/schema.graphql` + the resolver to match.
- ✅ **Leak suite in CI** — DONE (`.github/workflows/leak-suite.yml`, workflow
  `ci`; runs the DB + API suites on any `db/**` or `api/**` change).

Recommended order: live smoke test on a real `dev` stack (apply + migrate +
publish SPA) → CI hardening → grow schema/resolver/UI domain-by-domain.

## 7. Conventions & guardrails

- **Secrets** → AWS Secrets Manager (ARN refs). Never commit `.env`/`.tfvars`
  (already gitignored).
- **Terraform:** `region` is a variable (per-client residency); state in S3 with
  native locking, one key per env/client.
- **CI auth to AWS:** GitHub OIDC, no long-lived keys (to be set up).
- **Acceptance is the definition of done:** leak suite + the E2E journeys green
  in CI.

## 8. How to resume

Say something like: *"Read HANDOFF.md and continue — start on the schema
baseline"* (or whichever step 6 item). I'll re-read this + `ARCHITECTURE.md` and
proceed.
