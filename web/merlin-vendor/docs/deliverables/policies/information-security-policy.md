# Information Security Policy — Merlin (Adaptiv Systems)

**Version:** 1.1 · **Effective:** June 2026 (infra updated 2026-06-28) · **Owner:** Founding team · **Review:** Annually or before enterprise procurement

> **Infrastructure change — 2026-06-28.** Merlin migrated onto our own **AWS** account (`us-east-1`). Data + auth + storage now run on a **self-hosted Supabase** stack on EC2; compute/API/crons on **Lambda + API Gateway + EventBridge**; frontend on **S3 + CloudFront**. Server-side secrets now live in **AWS Secrets Manager** (was Vercel env vars). Backups are nightly `pg_dump`→S3 + EBS snapshots (was Supabase managed PITR). References to Vercel / managed Supabase below should be read in this light.

---

## 1. Purpose

This policy describes how Adaptiv Systems protects Merlin customer data, platform credentials, and production infrastructure. It is intended for investor due diligence and enterprise security questionnaires — not a full ISO 27001 ISMS.

## 2. Scope

Applies to:

- Merlin production (`merlin.adaptiv.systems`, `mobile.adaptiv.systems`)
- Self-hosted Supabase on AWS EC2 (tenant data, auth, storage, realtime)
- AWS Lambda + API Gateway (serverless API), EventBridge (crons), S3 + CloudFront (frontend) — all in our AWS account, `us-east-1`
- Third-party subprocessors listed in [`../subprocessors/README.md`](../subprocessors/README.md)

Applies to all individuals with production access (employees, contractors with admin credentials).

## 3. Security principles

1. **Tenant isolation first** — multi-tenant data is separated by Postgres Row-Level Security (RLS) on every tenant-scoped table; cross-tenant access is regression-tested in CI.
2. **Least privilege** — database RPCs, storage policies, and admin tools grant the minimum access required; June 2026 hardening (migrations 257–259) revoked over-broad `PUBLIC` execute grants.
3. **Secrets stay server-side** — LLM keys, Stripe secrets, and service-role credentials exist only in AWS Secrets Manager (loaded into Lambda at cold start) and the self-host Supabase vault; never in the browser bundle.
4. **Make failures visible** — Sentry captures API/cron handler errors and frontend data-layer failures; silent empty states are discouraged.
5. **Change through CI** — production deploys flow through `main` with automated gates (see Change Management Policy).

## 4. Data classification

| Class                    | Examples                                             | Handling                                                                       |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Customer operational** | Building events, tickets, schedules, agent decisions | RLS-scoped in Supabase; encrypted at rest by Supabase                          |
| **Customer PII**         | User email, name, org membership                     | Supabase Auth + RLS; not sent to Anthropic except as required for chat context |
| **Payment**              | Stripe customer IDs, subscription state              | Stripe-hosted; Merlin stores references only                                   |
| **Platform secrets**     | API keys, service role, webhook secrets              | AWS Secrets Manager; access limited to named admins + the Lambda exec role     |
| **Public marketing**     | Docs CMS, marketplace content                        | Non-sensitive; still version-controlled                                        |

Building operational data sent to Anthropic for agent/chat features is scoped to the authenticated user's org and location access. See architecture canon: [`../../architecture/building-ops-model.md`](../../architecture/building-ops-model.md).

## 5. Access control

Production access is governed by the [Access Control Policy](access-control-policy.md): MFA on identity providers, named admin inventory, quarterly review.

Developers do not receive Supabase `service_role` in local `.env` for routine work; local dev uses publishable keys against dev/staging projects where applicable.

## 6. Vulnerability & dependency management

- **Dependabot** opens PRs for npm minor/patch advisories.
- **CI `npm audit`** runs on every PR (informational; high/critical tracked).
- **Security backlog** tracked in [`../../operations/security-deferred.md`](../../operations/security-deferred.md) with severity and unblock signals.

## 7. Incident response

Security and availability incidents follow the [Incident Response Policy](incident-response-policy.md): Sentry alert → triage → rollback/contain → customer comms if needed → postmortem.

## 8. Business continuity

- **Backups:** nightly `pg_dump` → versioned S3 bucket + EBS volume snapshots (DLM, every 12h) on the self-host. EC2 auto-recovery keeps the instance + EBS + EIP on host failure. (Was Supabase managed PITR pre-2026-06-28; the paused managed instance remains a warm rollback during soak.)
- Restore procedure: [`../../operations/runbooks/backup-restore.md`](../../operations/runbooks/backup-restore.md).
- A documented sandbox restore drill is scheduled (see Technical Appendix known gaps).

## 9. Subprocessors

Merlin relies on audited third parties (Supabase, Vercel, Stripe, Resend, Anthropic, Sentry). DPAs and SOC 2 reports are collected in [`../subprocessors/`](../subprocessors/).

## 10. Policy review

Review this policy when: (a) first enterprise deal requires updated artifacts, (b) Supabase Team / Vercel Enterprise tier is adopted, or (c) a material security incident occurs.

**Related:** [`../Merlin-Technical-Appendix.md`](../Merlin-Technical-Appendix.md) · [`../../operations/code-preparedness.md`](../../operations/code-preparedness.md)
