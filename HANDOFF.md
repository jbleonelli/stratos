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
   fires from injected claims. ← *RLS-from-claims is ✅ proven in `db/proof`;
   remaining: `V1_baseline.sql` + Terraform.*
2. **Identity** — Cognito + claim bridge; prove one RLS policy + one RPC E2E.
3. **Vertical slice** — one domain (events/asks) fully through AppSync
   (query + mutation + subscription + authz). Validate before scaling.
4. **Acceptance harness** — cross-tenant leak suite + E2E; wire as CI gates.
5. **Domain-by-domain** — build the resolver surface + UI data hooks.
6. **Agent runtime** — EventBridge + SQS + Step Functions + Bedrock.
7. **Storage + email + billing** — S3, SES, Stripe.
8. **Seed + launch** — load seed data, smoke, DNS cutover.

## 6. Immediate next steps (pick one)

- ✅ **Claim-bridge proof** — DONE (`db/helpers` + `db/proof`, 10/10 green). This
  was the single biggest risk; it's retired. **First follow-up: commit it.**
- **Schema baseline:** author `db/V1_baseline.sql` (structure + ~100
  `SECURITY DEFINER` RPCs + all RLS policies), reusing the helper functions
  already landed in `db/helpers/001_authz.sql`. ← **NEXT (biggest)**
- **Foundation module:** flesh out `infra/modules/aurora` + a VPC/networking base
  and the S3 tfstate backend so `terraform init/plan` runs.
- **Wire the leak suite into CI** (GitHub Actions: `node --test` in `db/proof`) so
  the backstop stays proven as the schema grows.

Recommended order: commit the proof → schema baseline → foundation module. The
proof's helpers + policy shapes are the template the baseline should follow.

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
