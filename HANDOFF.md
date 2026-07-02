# HANDOFF — start here (agent onboarding)

> **If you are an AI agent reading this after a Cursor restart: read this file
> first, then [`ARCHITECTURE.md`](ARCHITECTURE.md). It contains everything you
> need to pick up where the last session left off.**

Last updated: 2026-07-02

---

## 1. What Stratos is

A **greenfield** rebuild of the **Merlin** building-operations platform on a
**fully AWS-native managed stack** — driven by a customer **procurement mandate**
(no Supabase software, no PostgREST). Same functionality, same UI.

**Independence is a hard rule.** No shared runtime, no DB link, no sync with
Merlin. Merlin is a **reference spec** (UI + functionality) and a **one-time data
source** (imported once at bootstrap, then the cord is cut). Copying Merlin's UI
source, DB schema, and test suites as a *starting point* is allowed and expected;
runtime coupling is not.

## 2. Where things live

- **This repo (Stratos):** `…/DESIGN/WORK/CODING/STRATOS`
  Remote: `https://github.com/jbleonelli/stratos` (branch `main`).
- **Merlin (reference only, do NOT modify):**
  `…/DESIGN/WORK/CLAUDE/PROJECTS/MERLIN`
  Use it read-only to copy UI source, schema, RPCs, RLS policies, and test suites.

> ⚠️ **Workspace note:** This doc assumes Cursor is now open **with STRATOS as the
> workspace root**. If shell `pwd` / `git status` show Merlin instead, the
> workspace didn't switch — stop and re-open the STRATOS folder, otherwise git
> and the sandbox will operate on the wrong repo.

## 3. Current state (as of 2026-07-02)

**Founding scaffold committed + pushed** (root commit, 23 files). Nothing is
deployed. Everything below `infra/` is a **skeleton** (intent + sketched
resources, not `apply`-ready); `web/`, `api/`, `db/` are placeholder READMEs.

Committed:

```
ARCHITECTURE.md                                  # plan of record — read after this
README.md
docs/architecture/authorization-and-claim-bridge.md
docs/architecture/agent-runtime.md
docs/data-seed/README.md                         # one-time Merlin import plan
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
| Data API | AWS AppSync (GraphQL) — replaces PostgREST **and** Supabase Realtime. |
| Authorization | App-layer in Lambda resolvers (the mandate) **+ RLS kept in Aurora as a backstop** via a Cognito→`request.jwt.claims` bridge. |
| Database | Aurora Serverless v2 (Postgres). Schema = one-time snapshot of Merlin → `db/V1_baseline.sql`, then evolves independently. Keep the ~100 `SECURITY DEFINER` RPCs + RLS policies. |
| Agent runtime | EventBridge (bus) + SQS + Step Functions (decision loop) + Bedrock. Spend guard = a state in the machine. |
| Storage | S3 + presigned URLs. |
| Scheduling | EventBridge Scheduler → Lambda (IAM-auth, no shared cron secret). |
| Email | Amazon SES. |
| IaC | Terraform, one module set, stamped per env and per isolated client stack. |
| UI | **Ported** from Merlin, then owned. Only the data layer changes (`supabase-js` → GraphQL client + Cognito). NOT a rewrite. |
| Observability | CloudWatch + X-Ray. |

Full rationale: `ARCHITECTURE.md` §5, and the two deep-dives in
`docs/architecture/`.

## 5. Build sequence (from ARCHITECTURE.md §10)

1. **Foundation** — Terraform baseline; Aurora + `db/V1_baseline.sql`; prove RLS
   fires from injected claims. ← **NEXT**
2. **Identity** — Cognito + claim bridge; prove one RLS policy + one RPC E2E.
3. **Vertical slice** — one domain (events/asks) fully through AppSync
   (query + mutation + subscription + authz). Validate before scaling.
4. **Parity harness** — port cross-tenant leak suite + E2E; wire as CI gates.
5. **Domain-by-domain** — build the resolver surface; port UI data hooks.
6. **Agent runtime** — EventBridge + SQS + Step Functions + Bedrock.
7. **Storage + email + billing** — S3, SES, Stripe.
8. **Data seed + launch** — one-time import, smoke, DNS cutover.

## 6. Immediate next steps (pick one)

- **Foundation module:** flesh out `infra/modules/aurora` + a VPC/networking base
  and the S3 tfstate backend so `terraform init/plan` runs.
- **Schema baseline:** define the `db/V1_baseline.sql` extraction procedure from
  Merlin (structure + RPCs + RLS helpers) and land the RLS helper functions.
- **Claim-bridge proof:** a minimal Lambda that opens an Aurora tx with
  `SET LOCAL request.jwt.claims`, plus a test proving RLS blocks cross-tenant
  reads (both app-layer-on and app-layer-bypassed modes).

Recommended order: schema baseline → claim-bridge proof → foundation module,
because the authz proof is the single biggest risk to retire.

## 7. Conventions & guardrails

- **Secrets** → AWS Secrets Manager (ARN refs). Never commit `.env`/`.tfvars`
  (already gitignored). Merlin has a `Merlin keys.txt` and `.env*` files — never
  copy secrets across.
- **Terraform:** `region` is a variable (per-client residency); state in S3 with
  native locking, one key per env/client.
- **CI auth to AWS:** GitHub OIDC, no long-lived keys (to be set up).
- **Parity is the definition of done:** leak suite + 7 E2E journeys green in CI.

## 8. How to resume

Say something like: *"Read HANDOFF.md and continue — start on the schema
baseline"* (or whichever step 6 item). I'll re-read this + `ARCHITECTURE.md` and
proceed.
