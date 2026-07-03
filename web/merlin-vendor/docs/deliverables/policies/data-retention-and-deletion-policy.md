# Data Retention & Tenant Deletion Policy — Merlin (Adaptiv Systems)

**Version:** 1.0 · **Effective:** June 2026 · **Owner:** Founding team · **Review:** Before first EU enterprise contract

---

## 1. Purpose

State what customer data Merlin retains, for how long, and what deletion capabilities exist today versus planned.

## 2. Data locations

| Store             | Contents                                                         | Provider                                   |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Supabase Postgres | Operational data, auth users, audit logs                         | Supabase (EU/US region per project config) |
| Supabase Storage  | Ticket photos, uploads, demo PDFs                                | Supabase                                   |
| Stripe            | Payment methods, invoices, subscription history                  | Stripe                                     |
| Sentry            | Error events, stack traces (may include request metadata)        | Sentry                                     |
| Resend            | Email delivery logs                                              | Resend                                     |
| Anthropic         | **No persistent customer store** — prompts processed per request | Anthropic                                  |

## 3. Retention periods

| Data type                   | Retention                                   | Notes                                   |
| --------------------------- | ------------------------------------------- | --------------------------------------- |
| **Operational records**     | Life of tenant + soft-delete period         | Tickets, events, agent_runs, devices    |
| **Auth users**              | Until org admin removes user or org deleted | Supabase Auth                           |
| **Platform audit log**      | Indefinite (platform admin actions)         | Impersonation, billing ops              |
| **Database backups (PITR)** | Per Supabase plan (7 days on Pro)           | Point-in-time recovery                  |
| **Sentry errors**           | Per Sentry project settings                 | Scrub PII in before-send where possible |
| **Stripe billing**          | Per Stripe retention / legal requirements   | Customer can export via Stripe portal   |

## 4. Tenant offboarding (current process)

When a customer contract ends:

1. **Commercial:** cancel Stripe subscription (Customer Portal or platform admin).
2. **Access:** deactivate org users via Admin / platform tenant tools.
3. **Data:** today org rows may be **soft-deleted** or archived manually — **hard purge is not fully automated** (see gaps below).
4. **Backups:** PITR copies may retain deleted data until backup window expires.

Document each offboarding in internal CRM / Notion with date and actions taken.

## 5. User deletion

- Org admins can remove users from an organization (membership revoked; RLS blocks access immediately).
- Supabase Auth user record may persist until explicit auth user deletion — process varies by whether user belongs to multiple orgs.

## 6. GDPR / data subject requests

| Right                     | Status                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Access / export**       | Partial — no self-serve GDPR export UI; manual export possible via SQL + support                                          |
| **Rectification**         | Supported via in-app edit flows                                                                                           |
| **Erasure (hard delete)** | **Deferred** — tracked in [`../../reference/deferred.md`](../../reference/deferred.md); required before EU enterprise GTM |
| **Portability**           | Not automated                                                                                                             |

Target: implement org-scoped export + hard-delete RPC before first EU enterprise pilot. Estimate: 1–2 weeks engineering.

## 7. Demo & test data

- Demo orgs (Meridian, FEB, IMF, etc.) use synthetic or anonymized operational patterns; demo replay avoids live LLM spend.
- CI cross-tenant leak tests use read-only prod credentials as Lisa@SparkleCo — no destructive writes without `ALLOW_DESTRUCTIVE`.

## 8. Customer responsibilities

Customers control who they invite, what operational data they enter, and contractor access via contracts and roles. Adaptiv secures the platform layer (RLS, auth, encryption at rest via Supabase).

## 9. Policy updates

Review when: (a) GDPR export/delete ships, (b) Supabase region or DPA changes, (c) new storage class added (e.g. document uploads v2).

**Related:** [Information Security Policy](information-security-policy.md) · [`../../operations/runbooks/backup-restore.md`](../../operations/runbooks/backup-restore.md)
