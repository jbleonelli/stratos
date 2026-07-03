# AWS export runbook

> **✅ DONE 2026-06-28 — this happened.** Merlin left Supabase + Vercel for our own AWS account (data → self-host Supabase on EC2; compute → Lambda + API Gateway + EventBridge + S3/CloudFront). See [`../operations/aws-migration.md`](../operations/aws-migration.md) and [`infra/aws-compute/README.md`](../../infra/aws-compute/README.md). This doc is kept as the original service-by-service mapping / rationale; the actual approach (self-host Supabase rather than a native rebuild) differs from the "leave Supabase" framing below.

**Status: 🟢 superseded by the executed migration (2026-06-28).** Originally written as the "if we ever need to leave Supabase + Vercel" reference.

## When to actually do this

Don't act on this runbook unless one of:

1. **Supabase monthly spend crosses ~$200**. Today free + Pro covers everything; below the crossover, AWS isn't cheaper.
2. **A customer's procurement explicitly requires AWS** (BAA for HIPAA, FedRAMP, data-residency edge cases). Supabase has SOC 2 inheritance via Team tier ($599/mo) but some enterprise customers refuse anything that isn't AWS native.
3. **You hit a Supabase hard limit**: DB > 500GB, realtime > 500 concurrent connections, edge function timeouts you can't work around.
4. **You want AWS-specific services in the agent runtime**: Step Functions for orchestration, Bedrock for in-region Claude, EventBridge for fan-out.

## Stack equivalence map

| Today (Supabase + Vercel)                | On AWS                                                                                  | Notes                                                                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Postgres                        | **RDS PostgreSQL** (Aurora Serverless v2 for elasticity, or RDS t4g.micro for cheapest) | RLS works identically on RDS. The catch: Supabase's `current_setting('request.jwt.claim.sub')` pattern relies on PostgREST setting these. On AWS you need a Lambda authorizer that injects JWT claims into each connection.           |
| Supabase Auth                            | **Amazon Cognito**                                                                      | Free for first 50K MAU. JWT shape differs (Cognito sub = UUID, not Supabase user_id). Existing users need migration. Custom attributes for `is_platform_admin`, `organization_id`.                                                    |
| Supabase Realtime                        | **AppSync GraphQL Subscriptions** or **API Gateway WebSockets**                         | Most expensive piece of the migration. Every `subscribeToChanges` callsite is already routed through [src/app/realtime-channel.js](../../src/app/realtime-channel.js) — swap the implementation in that one file when the time comes. |
| Supabase Storage                         | **S3**                                                                                  | Mechanical. Update upload URLs + signed-URL generation.                                                                                                                                                                               |
| Supabase Edge Functions                  | **Lambda** (Node.js runtime)                                                            | Not heavily used today. Migration is trivial.                                                                                                                                                                                         |
| Vercel Hosting                           | **S3 + CloudFront** OR **Amplify Hosting**                                              | Build to `dist/`, upload to S3, invalidate CloudFront.                                                                                                                                                                                |
| Vercel Serverless Functions (`api/*.ts`) | **Lambda + API Gateway HTTP API**                                                       | Per-file mapping. `req.headers['x-vercel-ip-*']` → CloudFront edge headers. `@vercel/node` types → `aws-lambda` types.                                                                                                                |
| Vercel Cron                              | **EventBridge Scheduler → Lambda**                                                      | Same cron expression, different target.                                                                                                                                                                                               |
| Vercel env vars                          | **Secrets Manager** or **SSM Parameter Store**                                          | Lambda reads at cold start.                                                                                                                                                                                                           |
| Resend (email)                           | **SES** (or keep Resend)                                                                | Resend works fine; only swap if cost or compliance forces it.                                                                                                                                                                         |
| Stripe                                   | Stripe                                                                                  | No change.                                                                                                                                                                                                                            |
| Route 53                                 | Route 53                                                                                | Already there.                                                                                                                                                                                                                        |
| Sentry                                   | Sentry                                                                                  | No change.                                                                                                                                                                                                                            |

## Monthly cost estimate (low scale, 1-10 paying tenants)

| Service                                             | Cost           |
| --------------------------------------------------- | -------------- |
| RDS PostgreSQL t4g.micro (1-yr Reserved, Single-AZ) | ~$13           |
| RDS storage (20GB gp3)                              | ~$2            |
| S3 hosting for SPA                                  | ~$1            |
| CloudFront                                          | ~$2            |
| Lambda + API Gateway                                | $0 (free tier) |
| Cognito (≤50K MAU)                                  | $0             |
| AppSync (realtime subscriptions, low concurrency)   | ~$5            |
| SES (≤62K emails/mo from EC2/Lambda)                | $0             |
| EventBridge Scheduler                               | $0             |
| Route 53                                            | $0.50          |
| CloudWatch Logs + metrics                           | ~$2            |
| Data transfer                                       | ~$2            |
| **Total**                                           | **~$28-35/mo** |

For comparison, today's Supabase Free + Vercel Hobby = $0/mo. Supabase Pro + Vercel Pro = $45/mo. AWS gets cheaper than Supabase + Vercel only at meaningful scale (Supabase Team tier $599/mo or compute add-ons).

## Engineering timeline (solo, full-time)

| Track                            | Effort    | Notes                                                                                                                                                                                                                                          |
| -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend → S3 + CloudFront       | 2-3 days  | Trivial. GitHub Action uploads `dist/` to S3, invalidates CloudFront. ACM cert for the domain.                                                                                                                                                 |
| API routes (`api/*.ts`) → Lambda | 1 week    | Each route becomes a Lambda. Wrap with the @vercel/node-to-aws-lambda adapter or rewrite handlers. CORS at API Gateway.                                                                                                                        |
| Supabase Auth → Cognito          | 2 weeks   | **Biggest lift.** New JWT shape; rewire `is_platform_admin()` / `current_user_org()` to parse Cognito claims. Password reset, magic link, MFA. User migration: dump Supabase `auth.users` → CSV → Cognito bulk-import (passwords need re-set). |
| Postgres RLS on RDS              | 3-4 days  | RLS itself works. The catch: Lambda authorizer that sets `request.jwt.claim.sub` per connection. Or rewrite RLS policies to read JWT claims from `current_setting('app.user_id')` after a `set_config` call in each Lambda handler.            |
| Realtime → AppSync               | 2-3 weeks | All callsites already route through `realtime-channel.js`; replace the Supabase impl in that one file with AppSync subscriptions. Then re-validate every notification flow.                                                                    |
| Migration tooling                | 2-3 days  | Flyway or `psql` scripts. CI/CD runs migrations on PR merge.                                                                                                                                                                                   |
| Cron → EventBridge               | 2 days    | Translate `vercel.json` crons.                                                                                                                                                                                                                 |
| CI/CD on AWS                     | 2-3 days  | GitHub Actions → CodeBuild or extend GH Actions with AWS deploy steps.                                                                                                                                                                         |
| Data migration + cutover         | 3-4 days  | `pg_dump` Supabase → restore RDS. User migration. DNS flip with rollback plan.                                                                                                                                                                 |
| Buffer for surprises             | 1-2 weeks | There are always surprises (esp. with realtime + RLS edge cases).                                                                                                                                                                              |

**Realistic total: 6-10 weeks** full-time.

## What's already AWS-ready

These investments mean the future port is smaller:

1. **Realtime is abstracted.** [src/app/realtime-channel.js](../../src/app/realtime-channel.js) — every subscription routes through `subscribeToChanges()`. On AWS, swap the implementation to AppSync; callsites unchanged.
2. **Auth is hook-abstracted.** [src/app/auth.js](../../src/app/auth.js)'s `useSession()`, `getSession()`, `logout()` are the only surface most components see. The Supabase-specific JWT parsing is contained inside auth.js — Cognito swap is contained there too.
3. **API routes are TypeScript with no Vercel-specific runtime APIs** beyond a few `x-vercel-ip-*` headers (used in `api/sessions/record.ts`). All can be lifted to Lambda directly.
4. **Migrations are vanilla Postgres SQL.** `supabase/migrations/*.sql` files apply cleanly to any Postgres via `psql`. No `pg_temp` or Supabase extensions.
5. **No supabase storage usage in critical paths.** Avatars + briefing media are the only consumers; both could be served from S3 + CloudFront without app changes (sign on the server side, return signed URLs).

## What's NOT AWS-ready yet (still to abstract)

If the goal is reducing porting friction further:

1. **Direct `supabase.from(...).select()` calls everywhere.** These should ideally route through a thin data layer that hides the supabase-js client. The migration cost: every read/write callsite (~hundreds). Probably not worth doing unless the port is imminent.
2. **Storage upload URLs are Supabase-specific.** A handful of callsites use `supabase.storage.from(...)` — bigger refactor.
3. **GoTrue-specific behaviors**: Supabase Auth allows direct password sign-in + emails. Cognito's hosted UI is a different model; we'd need to write our own sign-in / reset flows backed by Cognito's API (probably easier than today's mix anyway).

## Phased migration recipe (when the time comes)

If we actually port, do it in order:

1. **Phase 1 — Frontend off Vercel (2-3 days, ~$3/mo).** Build to S3, serve via CloudFront. Keep Supabase + Vercel API routes. Zero risk: rollback is a DNS flip.
2. **Phase 2 — API routes to Lambda (1 week, +$0).** Each route becomes a Lambda function behind API Gateway. Switch in batches: low-risk reads first (`/api/agents/_shared` reads), then mutations, then webhooks. Cron jobs migrate alongside.
3. **Phase 3 — Postgres to RDS (1 week, +$15).** Dual-write phase: app writes to both Supabase AND RDS for ~3 days, then reads from RDS. RLS migrated via `psql`. Decommission Supabase Postgres after a soak.
4. **Phase 4 — Auth to Cognito (2 weeks, +$0).** Big one. User migration first (bulk import to Cognito with force-password-reset on first login). Then switch all auth.js callsites. Run both auth backends for a week with feature-flagged routing.
5. **Phase 5 — Realtime to AppSync (2-3 weeks, +$5-10).** Swap the implementation in `realtime-channel.js`. All callsites already route through it.
6. **Phase 6 — Storage to S3 (3 days, +$1).** Last because it's the lowest risk.
7. **Phase 7 — Decommission Supabase (1 day).** Cancel the project.

Each phase has a rollback: revert the relevant `realtime-channel.js` impl, point DNS back at Vercel, re-enable Supabase Auth in `auth.js`.

## Things to remember when it's time

- **Supabase RLS uses `auth.uid()` and `auth.jwt()`.** On RDS these helpers don't exist. Rewrite to read from `current_setting('request.jwt.claim.sub')` — and set that claim via a Lambda authorizer or in each handler's connection prelude.
- **Supabase Auth's password reset flow has its own state machine.** Cognito's is different. The Adaptiv-branded email templates ([docs/operations/auth-email-templates.md](../operations/auth-email-templates.md)) need re-pasting into Cognito's Lambda triggers (Cognito uses Lambda hooks for email customization, not a templates UI).
- **Supabase Realtime delivers ALL columns** of the changed row in `payload.new`. AppSync subscriptions deliver what the subscription query specifies. If we ever rely on a column that the subscription doesn't ask for, the AppSync version will deliver `undefined`.
- **Cognito's free tier is generous, but custom domains cost $80/mo per domain.** For low-traffic auth, use the default Cognito hosted UI URL or proxy it through CloudFront.
- **RDS doesn't have built-in connection pooling.** Add PgBouncer in front (or use RDS Proxy at +$15/mo) before Lambda concurrency takes you to connection limits.
