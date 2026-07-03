# Subprocessors — Merlin (Adaptiv Systems)

**Purpose:** Index of third parties that process customer or platform data. Attach DPA / SOC 2 PDFs here as they are collected for enterprise deals.

**Last updated:** 2026-06-28 (post AWS migration)

> **⚠️ Architecture change — 2026-06-28.** Merlin migrated off managed Supabase + Vercel onto our own **AWS** account (`us-east-1`): the Supabase stack is now **self-hosted** on AWS EC2, and compute/API/crons/frontend run on AWS Lambda + API Gateway + EventBridge + S3/CloudFront. **Net effect on this register: AWS is now the primary infrastructure subprocessor for all tenant data; Supabase Inc. and Vercel are no longer in the live data path** (managed Supabase is a paused rollback; the Vercel project is being retired). ⚖️ Confirm whether existing customer DPAs require subprocessor-change notification before externalizing this.

---

## Subprocessor register

| Vendor        | Role                                                                            | Data processed                                                                                        | DPA / SOC 2                                                                         | Status                                                                 |
| ------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **AWS**       | Cloud infrastructure — compute, database, storage, CDN, LLM inference (Bedrock) | **All tenant operational data + auth + storage + request processing** (us-east-1; Bedrock per-region) | [AWS DPA](https://aws.amazon.com/compliance/data-privacy/) · SOC 1/2/3 via Artifact | ✅ **Primary host since 2026-06-28** — collect Artifact reports for DD |
| **Supabase**  | ~~Managed DB/Auth/Storage/Realtime~~ → now **self-hosted OSS on AWS**           | None ongoing — managed instance paused as rollback only                                               | [Supabase DPA](https://supabase.com/legal/dpa)                                      | ⚪ No longer a live data processor (paused rollback)                   |
| **Vercel**    | ~~Hosting, serverless API, crons~~ → **being retired**                          | None ongoing — project paused, DNS + crons moved to AWS                                               | [Vercel DPA](https://vercel.com/legal/dpa)                                          | ⚪ Out of data path; retire after soak                                 |
| **Stripe**    | Payments, subscriptions                                                         | Billing identity, payment methods                                                                     | [Stripe DPA](https://stripe.com/legal/dpa) · SOC reports in dashboard               | ✅ Available in Stripe dashboard                                       |
| **Resend**    | Transactional email                                                             | Email addresses, auth email content                                                                   | Resend DPA                                                                          | 🟡 Download to `resend/`                                               |
| **Anthropic** | LLM inference                                                                   | Prompts/context for agents & chat (org-scoped)                                                        | [Anthropic commercial terms](https://www.anthropic.com/legal)                       | 🟡 Review data processing terms per deal                               |
| **Sentry**    | Error monitoring                                                                | Stack traces, user id metadata in error context                                                       | [Sentry DPA](https://sentry.io/legal/dpa/)                                          | 🟡 Download to `sentry/`                                               |
| **Notion**    | CRM sync (optional cron)                                                        | Lead/contact mirror if enabled                                                                        | Notion DPA                                                                          | 🟡 If CRM sync used in prod                                            |
| **GitHub**    | Source code hosting                                                             | Code only (no customer DB)                                                                            | GitHub DPA                                                                          | ✅ Org settings                                                        |

## Folder layout

```
subprocessors/
  README.md          ← this register
  supabase/          ← DPA PDF, SOC 2 report
  vercel/
  stripe/
  resend/
  anthropic/
  sentry/
```

## Instructions

1. Before enterprise procurement, download each vendor's current DPA and latest SOC 2 / security whitepaper.
2. Redact account-specific IDs if sharing externally.
3. Update the Status column when PDFs land in vendor subfolders.
4. Supabase **Team** tier ($599/mo) provides SOC 2 inheritance — trigger at first enterprise SOC 2 ask or ~10 paying tenants (see [`../../operations/100-tenants-readiness.md`](../../operations/100-tenants-readiness.md)).

**Related:** [Information Security Policy](../policies/information-security-policy.md) · [`../../operations/security-deferred.md`](../../operations/security-deferred.md)
