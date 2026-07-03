# Change Management Policy — Merlin (Adaptiv Systems)

**Version:** 1.1 · **Effective:** June 2026 (deploy pipeline updated 2026-06-28) · **Owner:** Founding team · **Review:** Annually

> **Infrastructure change — 2026-06-28.** Production moved off Vercel onto our **AWS** account. Deploy is no longer Vercel auto-deploy; it is an explicit IaC apply (`node infra/aws-compute/build.mjs` + `terraform apply` for Lambda/API, `infra/aws-compute/deploy-spa.sh` for the SPA → S3/CloudFront). Secrets live in **AWS Secrets Manager**. Rollback is a **DNS flip** (or `terraform apply` of the prior bundle), not a Vercel rollback. A GitHub Actions deploy is a near-term follow-up.

---

## 1. Purpose

Describe how code, schema, and configuration changes reach Merlin production safely and traceably.

## 2. Production branch

- **`main`** is the production branch.
- Merging to `main` is the release gate; production is deployed to **AWS** via an explicit IaC apply (see banner) after CI passes — a GitHub Actions pipeline will automate this.
- No direct pushes to `main` that bypass review (solo founder: self-review via PR still required for audit trail).

## 3. Change workflow

```
Feature branch → Pull Request → CI gates → Review → Merge to main → IaC apply (Lambda/API + SPA) to AWS
```

Every PR uses [`.github/pull_request_template.md`](../../../.github/pull_request_template.md):

- Summary and risk level (low / medium / high)
- Test plan checklist (`npm run build`, i18n lint, money-path guards, preview verification)
- Rollback note for medium/high risk changes

## 4. CI gates (blocking)

| Job                           | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `build`                       | Vite production bundle; fails on Rollup circular-chunk warnings |
| `typecheck (api)`             | `tsc --noEmit` on all API TypeScript                            |
| `typecheck (frontend opt-in)` | `@ts-check` modules only                                        |
| `lint-i18n`                   | Missing translation keys                                        |
| `lint-rls`                    | Client reads must carry org scope signal                        |
| `lint-js`                     | ESLint (`no-undef`, `rules-of-hooks` = error)                   |
| `test`                        | Vitest (cross-tenant leak, money-path guards, smoke, units)     |
| `e2e`                         | Playwright hermetic journeys (stub Supabase)                    |
| `audit (npm)`                 | Dependency vulnerabilities (informational)                      |
| `lint-deadcode`               | Knip (informational today; ratchet planned)                     |

Docs-only PRs skip CI via path filter (`docs/**`, `**/*.md`).

## 5. Schema migrations

Database changes:

1. Forward-only SQL in `supabase/migrations/NNN_topic.sql` — never edit applied migrations.
2. Explicit `GRANT` pattern per [`../../operations/migration-grant-pattern.md`](../../operations/migration-grant-pattern.md).
3. RLS enabled on new tenant-scoped tables.
4. Cross-tenant leak suite updated when new tables expose org-scoped data.
5. High-risk migrations (RLS shape, payments, auth): require explicit rollback note in PR.

Apply to production Supabase via controlled process (founder-run or CI deploy hook); never run untested SQL against prod.

## 6. Environment & secrets

- Production secrets live in **AWS Secrets Manager** (loaded into Lambda at cold start; never in the bundle or git).
- Secret rotation: update the Secrets Manager secret value; the next Lambda cold start picks it up. Document in PR.

## 7. Emergency changes

SEV-1 may require hotfix directly on `main`:

1. Minimal fix PR with `[hotfix]` prefix.
2. CI must pass before merge (or document why skipped with post-incident follow-up).
3. Postmortem within 48 hours.

Prefer a **rollback** over an untested hotfix when a last-known-good exists: re-deploy the prior bundle (`terraform apply` of the previous artifact / re-run `deploy-spa.sh` on the prior build), or for a hosting-level issue, flip DNS back to the prior target.

## 8. Configuration changes (non-code)

| Change type             | Process                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth templates | Version in [`../../operations/auth-email-templates.md`](../../operations/auth-email-templates.md); paste to dashboard             |
| DNS (SPF/DKIM/DMARC)    | Follow [`../../operations/email-deliverability.md`](../../operations/email-deliverability.md); never tighten without staging test |
| Stripe products/prices  | Runbooks in [`../../operations/runbooks/`](../../operations/runbooks/)                                                            |
| Sentry alert rules      | Document in [`../../operations/sentry-alerts.md`](../../operations/sentry-alerts.md)                                              |

## 9. Records

- Git history + GitHub PRs = change audit trail.
- Platform impersonation logged in `platform_audit_log`.
- Dependabot PRs = automated dependency change record.

**Related:** [Information Security Policy](information-security-policy.md) · [`../../operations/engineering-maturity.md`](../../operations/engineering-maturity.md)
