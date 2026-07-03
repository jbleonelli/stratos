# AWS migration via SST (Path 1 / Approach C)

> ## ⛔ SUPERSEDED — historical only
>
> This early plan proposed migrating compute to AWS via **SST** while keeping **managed Supabase** as the data plane. **Neither held.** What actually shipped (2026-06-28): the data layer moved to a **self-hosted Supabase** stack on AWS, and compute moved via **Terraform** (not SST) — Lambda + API Gateway + EventBridge + S3/CloudFront. Both are **live in prod**.
>
> For the real architecture and runbooks see: [`../operations/aws-migration.md`](../operations/aws-migration.md) (plan of record + status), [`../operations/aws-cutover-runbook.md`](../operations/aws-cutover-runbook.md) (data cutover), and [`infra/aws-compute/README.md`](../../infra/aws-compute/README.md) (compute cutover). Kept here only for the decision trail.

**Status:** superseded (was: proposed 2026-05-16). Superseded by the Terraform + self-host implementation, live 2026-06-28.
**Track:** infra / hosting
**Author:** JB + Claude, 2026-05-16

> Merlin runs on Vercel + Supabase today. This doc captures the plan for moving the hosting and serverless compute from Vercel to AWS while keeping Supabase as the data plane. The chosen approach uses [SST](https://sst.dev) v3 as the IaC framework, provisioning one CloudFront + S3 + Lambda stack for both the SPA and the 70 `api/*.ts` handlers.

## Why this exists

The driver is procurement / enterprise-sales optics — "hosted on AWS" reads cleaner to enterprise buyers and auditors than "hosted on Vercel," even though Vercel itself runs on AWS. Cost is not the reason (Vercel+Supabase is cheap at our current scale; AWS is comparable or slightly higher until traffic grows). Vendor lock-in concerns are real but secondary — most of it could be insulated incrementally without a cloud change.

Supabase stays put. The RLS model (361 policies across 56 tables) is our security posture and not a candidate for rewrite.

---

## What's chosen, and what was rejected

**Chosen: Approach C — SST for both SPA and API.**

One IaC file (`sst.config.ts`) describes the entire stack. SST v3 compiles to Pulumi under the hood, which calls the same AWS provider plugins Terraform uses. Resources are real AWS resources; the only thing tool-specific is the state representation.

| Rejected approach                                   | Why                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Amplify Hosting (SPA) + CDK or SST for API**   | Two systems to operate. Amplify is a better ergonomic fit for SPAs in isolation, but it has no native model for our 70 `api/*.ts` files — its Compute layer is designed for SSR frameworks (Next.js, Nuxt, SvelteKit), not raw serverless functions. Pulling in a second IaC tool just for the API increases ops surface area. |
| **B. Amplify Hosting + Amplify Functions**          | Amplify Gen 2 Functions work fine for a handful of endpoints; they get awkward at 70.                                                                                                                                                                                                                                          |
| **D. Refactor Vite → Next.js, host on Amplify SSR** | 79k LOC of React would need to be re-shaped to Next.js routing conventions. Not Path 1; not justified by procurement alone.                                                                                                                                                                                                    |
| **Terraform-only**                                  | Over-tooled for our footprint. ~1,000+ lines of HCL to do what SST does in ~200, plus we'd build our own bundling pipeline and preview-env machinery. Right answer for an ops team that already knows it; not our situation.                                                                                                   |

We can migrate SST → Terraform later if the team grows or compliance demands it. The cost is ~1.5–2 weeks for our resource count (rewrite config + `terraform import` every resource). The AWS resources themselves are durable; only the controller changes.

---

## Target AWS architecture

### Services used

| AWS service               | Role                                                            | Region                                |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| **CloudFront**            | CDN; routes `/api/*` to Lambda, everything else to S3           | global edges, us-east-1 control plane |
| **S3**                    | Hosts Vite `dist/` output (HTML + assets)                       | us-east-1                             |
| **Lambda**                | 70 `api/*.ts` handlers, one function per file                   | us-east-1                             |
| **Lambda Function URLs**  | Native HTTPS endpoint per function (no API Gateway tax)         | us-east-1                             |
| **EventBridge Scheduler** | Daily data-source overage cron                                  | us-east-1                             |
| **CloudWatch Logs**       | Lambda invocation logs, retention 30 days                       | us-east-1                             |
| **Route 53**              | DNS for `merlin.adaptiv.systems`                                | global                                |
| **ACM**                   | TLS certificate for CloudFront                                  | us-east-1 (required for CloudFront)   |
| **Secrets Manager**       | `SUPABASE_*`, `STRIPE_*`, `RESEND_*`, `ANTHROPIC_*`, `SENTRY_*` | us-east-1                             |
| **IAM**                   | Lambda execution roles, deploy role for GitHub Actions          | global                                |

### What stays on Supabase (unchanged)

- Postgres (all 127 migrations, all data)
- Auth (signin flows, JWT, OAuth, password reset emails)
- Realtime (WebSocket subscriptions via `realtime-channel.js`)
- Storage (PDFs, user uploads, public/screenshots if we move them there later)
- RLS policies (all 361 of them)
- Database functions / RPCs (`count_data_sources`, `is_platform_admin`, etc.)

### Topology

```
                                  User
                                   │
                                   ▼
                  ┌──────────────────────────────┐
                  │  Route 53                    │
                  │  merlin.adaptiv.systems      │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │  CloudFront + ACM cert       │
                  └──────┬────────────────┬──────┘
                         │ /assets/*      │ /api/*
                         │ /  (SPA)       │
                         ▼                ▼
                  ┌──────────────┐    ┌──────────────────┐
                  │ S3 bucket    │    │ Lambda functions │
                  │ Vite dist/   │    │ (Function URLs)  │
                  └──────────────┘    └────────┬─────────┘
                                               │
                                  ┌────────────┴───────────────┐
                                  ▼                            ▼
                       ┌──────────────────┐        ┌──────────────────────┐
                       │ Secrets Manager  │        │ CloudWatch Logs       │
                       └──────────────────┘        └──────────────────────┘
                                  │
                                  ▼
                       ┌─────────────────────────────────────┐
                       │ Supabase (Postgres / Auth / Realtime)│
                       │ Stripe / Resend / Anthropic / Sentry │
                       └─────────────────────────────────────┘

      ┌─────────────────────┐
      │ EventBridge cron    │──▶ Lambda: daily data-source overage
      │ (daily 03:00 UTC)   │
      └─────────────────────┘
```

### CloudFront routing rules

- `/api/*` → Lambda Function URL origin (per-function origin group, or one router Lambda — TBD in phase 1).
- `/assets/*` → S3 origin, `Cache-Control: public, max-age=31536000, immutable`.
- `/*` → S3 origin, falls through to `/index.html` for SPA deep-links, `Cache-Control: no-store` on `index.html` (prevents stale-chunk regression — same defense as the May 14 outage memo).
- Geo headers (`CloudFront-Viewer-Country`, `CloudFront-Viewer-City`, `CloudFront-Viewer-Latitude`, `CloudFront-Viewer-Longitude`) forwarded to Lambdas via origin request policy. Replaces `x-vercel-ip-*`.

---

## What changes in the repo

### New files

| File                                    | Purpose                                                           | Approx size |
| --------------------------------------- | ----------------------------------------------------------------- | ----------- |
| `sst.config.ts`                         | Root stack definition: StaticSite + Function-per-file glob + Cron | ~200 lines  |
| `.github/workflows/deploy.yml`          | `sst deploy --stage prod` on main; `--stage pr-N` on PRs          | ~60 lines   |
| `docs/operations/aws-deploy-runbook.md` | New deploy/rollback procedure (replaces Vercel docs)              | ~150 lines  |

### Modified files

- `package.json` — add `sst`, `@aws-sdk/*` (subset), `@types/aws-lambda`. Remove `@vercel/node`.
- `vercel.json` — deleted.
- `api/sessions/record.ts` — swap `x-vercel-ip-*` reads for `cloudfront-viewer-*`. Keep both during cutover window.
- ~3–5 `api/*.ts` files with Vercel-specific `req.query` / `req.body` shapes — small adapter shims (most already use Web Standard Request/Response, which works on both).

### Unchanged

- All 127 migrations, all RLS policies, all RPCs.
- Entire `src/` directory (79k LOC) — no React or component code touched.
- Stripe / Resend / Sentry / Anthropic integration code — only the **destination URL** changes (Stripe webhook in Dashboard, Supabase Auth allowed redirects, Sentry trace propagation targets).

---

## Q1 — Can we keep Vercel running in parallel to play with the AWS version?

**Yes. This is strongly recommended for the migration period, not just possible.** Concrete pattern:

1. The Vercel project stays as-is, accessible at its `merlin-three.vercel.app` URL (the existing Vercel subdomain).
2. The new AWS deploy goes to a staging URL — e.g. `aws.adaptiv.systems` or `merlin-aws.adaptiv.systems`. Pick now; reserve the DNS record before phase 1.
3. **Both pull from the same Supabase project.** Data is shared. No fork, no sync. The Supabase URL + keys are identical in both deployments' env vars.
4. You can use both simultaneously — sign in on Vercel in one tab, AWS in another, both see the same data.
5. **Production cutover** = flipping the `merlin.adaptiv.systems` DNS record from Vercel → CloudFront. The Vercel deployment continues working at its `.vercel.app` URL as an instant rollback target.
6. Pause (don't delete) the Vercel project for at least 30 days post-cutover. If anything goes wrong, reverting DNS = back on Vercel in under 5 minutes (TTL permitting; pre-lower it to 300s the day before).

### Things to coordinate during the parallel period

- **Stripe webhooks.** Stripe supports multiple webhook destinations on the same account. During parallel-run, configure both Vercel and CloudFront URLs as webhook receivers. Both will get events; both must handle idempotency (our handler already does, keyed on Stripe event ID). After cutover, delete the Vercel destination.
- **Supabase Auth redirect URLs.** Add the AWS CloudFront domain to the allowed list before deploying anything that needs signin. Keep the Vercel domain in the list during the parallel period.
- **The daily overage cron should fire from ONE place.** Run it on Vercel until cutover, then on EventBridge after. Easy: don't enable the EventBridge schedule until Phase 3 of the migration plan. Double-firing isn't catastrophic (idempotent ledger writes), but it's avoidable noise.
- **Resend (outbound email)** has no source-side coordination — works the same from either origin.
- **Sentry** captures errors from both deploys. Tag environments distinctly: `environment: vercel-prod` vs `environment: aws-staging`. Useful for diffing error rates between the two during the parallel period.

There's no fundamental time limit on the parallel period. The only cost is Vercel's monthly bill continuing to run. Most teams cut over within 2–4 weeks of finishing phase 1.

---

## Q2 — Will adding new functionality to Merlin be as fast on SST as it is today?

**Short answer: slightly slower on day 1, equivalent within 2 weeks, with some things actually faster.**

### What stays exactly the same

- `npm run dev` (Vite) for the frontend — same command, same hot reload, no change.
- The mental model of `api/foo.ts` = "this file is a serverless endpoint at `/api/foo`." SST picks up new files via a glob in `sst.config.ts`; we wire that once in phase 1, then adding a new endpoint is just creating the file.
- Adding migrations in `supabase/migrations/` — completely unchanged. Supabase project doesn't know it has a new front-door.
- The git-push → preview-URL → smoke-test → squash-merge → production loop. Same workflow, different backend. GitHub Actions replaces the Vercel auto-build.
- All CI gates (build / test / typecheck / i18n-lint / knip) keep working as-is.

### What's slower

- **Deploy time.** Vercel deploys our app in ~90 seconds end-to-end. SST/Pulumi deploys take 3–6 minutes for incremental changes (Lambda updates only), longer (~10–15 min) for changes that touch CloudFront configuration. CloudFront is slow by nature, not SST. **Net: about 3 minutes extra per deploy cycle.**
- **Local API testing.** Today: `vercel dev` runs the whole stack locally including API. After: `sst dev` proxies live Lambda invocations to your laptop — close but not identical. First-time setup requires AWS credentials and a personal dev stage (~15 min onboarding step that doesn't exist with Vercel).
- **Cold starts on rarely-hit endpoints.** Vercel cold-starts are ~200–500ms. Lambda cold-starts for our SDK-heavy handlers (Anthropic, Stripe) are 1–3s. Provisioned concurrency on the three hot paths (`/api/chat`, `/api/stripe/webhook`, `/api/agents/tick`) erases this for the routes that matter; ~$45/mo total. The 67 cold-friendly routes can stay cold.

### What's faster or better

- **Log search.** CloudWatch Logs Insights is more powerful than Vercel's log UI once you're used to the query language. "All 5xx in the last hour grouped by handler" is one CWL query. Vercel's log search is basic.
- **Cost observability.** AWS billing is line-item per service. Vercel's plan tier is opaque past a certain point.
- **CDN control.** Direct CloudFront cache rules let you ship edge-level optimizations Vercel abstracts away. Probably won't matter day 1; matters when we need it.

### What's just different (no speed change)

- **Secrets management.** Today: Vercel env vars UI. After: `sst secret set FOO bar` from CLI, or AWS Console → Secrets Manager. Same difficulty, different muscle memory.
- **Rolling back a bad deploy.** Today: Vercel UI → "Promote previous deployment" (one click). After: `sst deploy --stage prod` with a previous git ref OR maintain a Lambda alias and flip it. Slightly more deliberate. Worth scripting a `rollback.sh` early.

### Net assessment for a typical feature ship

Walking through a representative task — **"Add a new agent type":**

| Step                                       | Today (Vercel) | After (SST/AWS)                 |
| ------------------------------------------ | -------------- | ------------------------------- |
| 1. New migration in `supabase/migrations/` | same           | same                            |
| 2. New `api/agents/<name>.ts` handler      | same           | same (SST picks it up via glob) |
| 3. UI strip in `Agentic.jsx`               | same           | same                            |
| 4. `git push` → preview URL                | 90s            | ~4 min                          |
| 5. Smoke-test on preview URL               | same           | same                            |
| 6. Squash-merge → production               | 90s            | ~4 min                          |
| **Total deploy overhead per feature**      | ~3 min total   | ~12 min total                   |

For a feature that takes 4 hours of coding plus 5 deploy cycles, the difference is 9 deploy-minutes added — about 4% overhead. Not nothing. Not crippling.

The honest answer: **we'll feel the slowness for the first 2 weeks**, especially around iterative debugging. After that, the muscle memory adapts and the dev loop feels normal. The deploy-time gap is the single biggest day-to-day difference, and it's a constant 3-min tax, not a multiplier.

---

## Phased plan

### Phase 0 — Decisions and prep (1–2 days)

1. **AWS account structure.** Single account, or org with prod + staging accounts? Recommend: org with 2 accounts (cheap, clean blast-radius separation).
2. **Region.** Default `us-east-1` (required for CloudFront ACM cert, lowest latency to Supabase project which is also us-east-1).
3. **DNS.** Route 53 (recommended for ACM auto-renewal) or keep current registrar with a CNAME to CloudFront?
4. **Reserve staging URL** — `aws.adaptiv.systems`, `merlin-aws.adaptiv.systems`, or similar. Decide now.
5. **Billing alerts** at $50 / $200 / $500 thresholds.

### Phase 1 — Parallel deploy at staging URL (3–5 days)

1. Add `sst.config.ts` describing the full stack. Wire `Function` per `api/*.ts` file via glob. Wire `StaticSite` for `dist/`. Wire `Cron` for the overage job (initially disabled).
2. Move env vars into SST secrets / Secrets Manager. Verify all 5 secret groups (Supabase, Stripe, Resend, Anthropic, Sentry).
3. Set up `aws.adaptiv.systems` (or chosen subdomain) as a CNAME / alias to the CloudFront distribution. ACM cert auto-provisions.
4. Deploy. Smoke-test golden paths: signin, agent tick fires, Stripe checkout (TEST mode), webhook receipt, chat (fast + thoughtful), realtime updates, PDF generation, demo send, multi-building scoping.
5. Add GitHub Actions: `sst deploy --stage pr-<number>` on PR open/update, `sst deploy --stage prod` on push to `main`. Add a `destroy-pr-stage.yml` to tear down per-PR stages on close.

### Phase 2 — Production cutover (2–3 days)

1. **Code changes (small):**
   - One-line swap in [api/sessions/record.ts](api/sessions/record.ts) — read `cloudfront-viewer-*` headers. Keep `x-vercel-ip-*` fallback for the cutover window.
   - Delete `vercel.json`, remove `@vercel/node` from devDeps.
   - Add adapter shims to any `api/*.ts` files using Vercel-specific `req.query` / `req.body` shapes (expect 3–5 files).
2. **External wires:**
   - Stripe webhook destinations (TEST + LIVE): add CloudFront URL as a second endpoint. Verify 24h of clean event delivery to AWS before disabling Vercel destination.
   - Supabase Auth: add CloudFront domain to allowed redirect URLs (keep Vercel domain temporarily).
   - Sentry: add CloudFront domain to `tracePropagationTargets`.
3. **DNS cutover** on `merlin.adaptiv.systems`: lower TTL to 300s 24h ahead, flip alias to CloudFront. Vercel keeps running on `.vercel.app` URL as rollback target.
4. **Watch for 24h:** CloudWatch metrics, Sentry error rates by environment tag, Stripe webhook delivery status.

### Phase 3 — Cleanup (1–2 days)

1. Enable EventBridge cron for daily overage. Disable Vercel cron in `vercel.json` (already deleted in phase 2). Verify next-day fire.
2. Decommission Vercel: pause project (don't delete) for 30 days. Plan delete date.
3. Update `docs/operations/` — new deploy runbook, new rollback procedure, CloudWatch dashboard links to bookmark.
4. Remove the orphaned `merlin-three.vercel.app` Stripe sandbox webhook (noted as cleanup item from May 14 memo).
5. Remove the temporary staging CNAME if not needed for future preview ops.

---

## Risks

1. **Lambda cold starts on hot paths.** Mitigate with provisioned concurrency on `/api/chat`, `/api/stripe/webhook`, `/api/agents/tick` (~$45/mo combined).
2. **CloudFront cache busting on `index.html`.** Set `Cache-Control: no-store` on `index.html`, long max-age + immutable on `/assets/*`. SST's `StaticSite` default behavior — verify before launch. This is the same regression that caused the May 14 outage; the structural defense is the cache header, not a manualChunks rule.
3. **Stripe webhook URL flip.** Run dual-destinations during parallel period; cut over only after 24h clean delivery on the AWS endpoint. Stripe retries failed deliveries for ~3 days — won't lose events but you'll see delays if a flip is botched.
4. **PDF font bundling.** `pdf-lib` is fine on Lambda but the font files in `public/fonts/` need to be either bundled into the Lambda or fetched from S3. SST handles bundling via asset imports; verify in phase 1 staging that the PDF demo invite renders identically to today.
5. **AWS credentials for dev onboarding.** First-time `sst dev` requires per-user AWS creds. Document the IAM policy + setup steps in the deploy runbook. Use IAM Identity Center (SSO) if we ever onboard a second person.
6. **Future Terraform migration door.** Keep open by: (a) explicit resource names in `sst.config.ts` (not auto-generated), (b) secrets in Secrets Manager directly (not SST's secrets wrapper), (c) explicit IAM policies rather than SST Linked Resources. ~10% extra verbosity, substantial future portability.

---

## Cost ballpark

At current traffic, monthly estimate:

| Line item                                             | Estimate       |
| ----------------------------------------------------- | -------------- |
| CloudFront (50 GB transfer + 10M requests)            | $5–10          |
| Lambda (10M invocations, avg 200ms)                   | $3–5           |
| Lambda provisioned concurrency (3 functions × 1 unit) | $40–50         |
| S3 (storage + requests)                               | $1–2           |
| CloudWatch Logs (30-day retention)                    | $5–10          |
| Route 53 (hosted zone + queries)                      | $1–2           |
| Secrets Manager (5 secrets)                           | $2             |
| ACM cert                                              | free           |
| **Total**                                             | **~$60–80/mo** |

Comparable to Vercel Pro. Does not include AWS Support plan (Basic is free; Developer Support is $29/mo if we want it).

---

## Open decisions before kickoff

1. **DNS:** Route 53 or keep current registrar?
2. **AWS account structure:** single account or org (prod + staging accounts)?
3. **Staging URL:** `aws.adaptiv.systems`, `merlin-aws.adaptiv.systems`, or other?
4. **Provisioned concurrency on which Lambdas?** Default recommendation: `/api/chat`, `/api/stripe/webhook`, `/api/agents/tick`. Confirm or adjust based on actual cold-start sensitivity once measured.
5. **GitHub Actions vs alternative CI?** Default: GitHub Actions (already in use for CI gates).
