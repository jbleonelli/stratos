# Access Control Policy — Merlin (Adaptiv Systems)

**Version:** 1.1 · **Effective:** June 2026 (infra updated 2026-06-28) · **Owner:** Founding team · **Review:** Quarterly

> **Infrastructure change — 2026-06-28.** Production runs in our own **AWS** account (`us-east-1`): self-hosted Supabase on EC2 + Lambda/API Gateway/EventBridge + S3/CloudFront. AWS IAM is now the primary production access surface; secrets live in **AWS Secrets Manager**. Vercel + managed Supabase are out of the live path (retiring / paused rollback).

---

## 1. Purpose

Define who may access Merlin production systems, required authentication controls, and how access is reviewed.

## 2. Production systems inventory

| System                                            | Purpose                                                            | Access model                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| **AWS** (account `112039069587`)                  | All production infra — compute, DB, storage, CDN, secrets, Bedrock | IAM users/roles; MFA required; least-privilege policies      |
| **GitHub** (`adaptiv-systems/merlin` or org repo) | Source code, CI, Dependabot                                        | Org members; MFA required                                    |
| **Self-host Supabase** (on AWS EC2)               | Postgres, Auth, Storage, Realtime                                  | Reached via AWS (SSH/SSM + Kong); `service_role` server-only |
| **Stripe**                                        | LIVE subscriptions, billing                                        | Named dashboard admins                                       |
| **DNS / email** (`adaptiv.systems`)               | SPF, DKIM, DMARC, Resend SMTP · CloudFront aliases                 | Named DNS admins (Route 53)                                  |
| **Sentry**                                        | Error monitoring                                                   | Named project members                                        |
| **Anthropic / Bedrock**                           | Claude inference (via Amazon Bedrock)                              | AWS IAM (Bedrock); no standalone prod API key                |
| **Resend**                                        | Transactional email                                                | API key in AWS Secrets Manager                               |
| **Vercel** (retiring)                             | Former host — crons disabled, DNS moved                            | Named project admins (until retired)                         |

## 3. Authentication requirements

- **MFA required** on GitHub organization membership.
- **MFA required** on AWS, Stripe, and (until retired) Vercel accounts with production access.
- **No shared credentials** — each admin uses individual accounts; break-glass credentials (if any) stored in a team password manager with access log.
- **Supabase `service_role`** is never embedded in frontend code, mobile apps, or client-side tests.

## 4. Role separation (current stage)

At solo-founder / small-team scale:

- **Platform admin** (`adaptiv` org, `/platform` shell) — tenant lifecycle, billing, impersonation (audit-logged).
- **Customer org admins** — org-scoped via Supabase Auth + RLS; cannot access other tenants without platform impersonation.
- **CI** — GitHub Actions uses repository secrets (`VITE_*`, `TEST_LISA_*`); no human prod DB write access from CI except read-only leak tests.

When engineer #2+ joins: add [`CODEOWNERS`](../../../.github/CODEOWNERS) requiring review on `supabase/migrations/`, `api/_lib/stripe*`, and `.github/workflows/`.

## 5. Internal access inventory

Maintain a living list (Notion or internal doc) of:

| Person          | AWS | GitHub | Stripe | Notes         |
| --------------- | --- | ------ | ------ | ------------- |
| _(named admin)_ | ✓   | ✓      | ✓      | Founding team |

Update within 5 business days of any joiner or leaver.

## 6. Offboarding

When someone loses production access:

1. Remove from AWS (IAM user/role), GitHub org, Stripe, Sentry (and Vercel team until it's retired).
2. Rotate any shared secret they could have accessed (document in incident log if rotation is deferred with rationale).
3. Review `platform_audit_log` for impersonation sessions in the prior 90 days.

## 7. Customer access

End users authenticate via Supabase Auth (email/password, magic link). Session tokens are scoped by RLS; org switching uses separate storage keys per app shell (customer / worker / platform / mobile).

## 8. Review cadence

- **Quarterly:** verify admin inventory matches reality; confirm MFA still enabled.
- **Before enterprise deal:** attach subprocessor SOC 2 reports; confirm Supabase Team tier if customer requires vendor SOC 2 inheritance.

**Related:** [Information Security Policy](information-security-policy.md) · [`../../operations/migration-grant-pattern.md`](../../operations/migration-grant-pattern.md)
