# Incident Response Policy — Merlin (Adaptiv Systems)

**Version:** 1.1 · **Effective:** June 2026 (infra updated 2026-06-28) · **Owner:** Founding team · **Review:** Annually or after first SEV-1

> **Infrastructure change — 2026-06-28.** Production runs on **AWS** (Lambda/API Gateway + EventBridge + S3/CloudFront + self-host Supabase on EC2). Triage signals are now **CloudWatch logs** + Sentry; mitigations use **IaC re-apply** / **DNS flip** / **EventBridge schedule disable** rather than Vercel controls. Both the prior vendors (managed Supabase, Vercel) remain as warm rollbacks during soak.

---

## 1. Purpose

Define how Adaptiv detects, responds to, and learns from production incidents affecting Merlin availability, data integrity, or security.

## 2. Severity levels

| Level     | Definition                          | Example                                           | Target response                   |
| --------- | ----------------------------------- | ------------------------------------------------- | --------------------------------- |
| **SEV-1** | Production down or active data leak | SPA blank on cold load; cross-tenant data visible | Immediate; rollback within 30 min |
| **SEV-2** | Major feature broken for many users | Auth failure; Stripe webhook not processing       | Same business day                 |
| **SEV-3** | Degraded or single-tenant issue     | One demo org agent stuck                          | Next business day                 |
| **SEV-4** | Minor / cosmetic                    | UI glitch, non-blocking Sentry noise              | Backlog                           |

## 3. Detection

Primary channels:

1. **Sentry** — uncaught API/cron errors (`wrapHandler` on all serverless handlers); frontend `*-data.js` capture sites.
2. **Customer report** — support email / in-app ticket.
3. **CI failure on `main`** — blocks broken deploys; Rollup circular-chunk guard prevents known SPA blank-screen class (2026-05-14 incident).
4. **`/api/health`** — liveness probe (Node runtime + DB round-trip).

Recommended alert wiring (see [`../../operations/sentry-alerts.md`](../../operations/sentry-alerts.md)): Sentry → Slack, metric backstop on error rate.

## 4. Response workflow

```
Detect → Triage (severity) → Mitigate → Communicate → Postmortem → Track follow-ups
```

### 4.1 Triage (first 15 minutes)

- Confirm scope: all users vs one org vs one surface (customer / mobile / platform).
- Check CloudWatch logs (`/aws/lambda/merlin-api-saas`, `/aws/lambda/merlin-cron-saas`) and the Sentry issue cluster.
- If SEV-1/2: assign **Incident Commander** (founder or on-call engineer).

### 4.2 Mitigate

| Action                   | When                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Roll back deploy**     | Bad deploy suspected — re-apply prior bundle (`terraform apply` / `deploy-spa.sh`); flip DNS back to Vercel for a hosting-level failure        |
| **Disable feature flag** | Isolated feature (`experimental` settings in platform)                                                                                         |
| **Pause cron**           | Runaway agent tick or billing job — disable the EventBridge schedule (`cron_state` / console)                                                  |
| **DB restore**           | Data corruption — restore from nightly `pg_dump`/EBS snapshot, or fail over to the paused managed Supabase (sandbox drill first — see runbook) |
| **Rotate secret**        | Credential exposure                                                                                                                            |

Runbook: [`../../operations/runbooks/backup-restore.md`](../../operations/runbooks/backup-restore.md). Prior production incident retro: 2026-05-14 (Rollup TDZ / Node runtime).

### 4.3 Communicate

- **Internal:** Slack or email to stakeholders within 1 hour for SEV-1/2.
- **Customers:** Status message if outage >30 min or data impact; use plain language, ETA, no root-cause speculation until confirmed.

## 5. Postmortem

Required for SEV-1 and SEV-2. Use this template:

### Postmortem template

| Field               | Content                            |
| ------------------- | ---------------------------------- |
| **Date / duration** |                                    |
| **Severity**        | SEV-\_                             |
| **Impact**          | Users/orgs affected                |
| **Timeline**        | Detect → mitigate → resolved (UTC) |
| **Root cause**      | Technical + process                |
| **What went well**  |                                    |
| **What went wrong** |                                    |
| **Action items**    | Owner + due date                   |

Store postmortems in `docs/operations/incidents/` (create on first use) or internal Notion.

## 6. Security incidents

Suspected tenant isolation breach:

1. Stop the bleeding (disable endpoint, revert migration).
2. Preserve evidence (Sentry events, audit log, migration number).
3. Run cross-tenant leak test suite against prod (read-only) to confirm scope.
4. Notify affected customers if PII exposure confirmed.

Track open security items: [`../../operations/security-deferred.md`](../../operations/security-deferred.md).

## 7. Review

After each SEV-1/2, update runbooks and CI guards if the incident class is preventable. Quarterly review of open Sentry alert rules.

**Related:** [Change Management Policy](change-management-policy.md) · [`../../operations/sentry-alerts.md`](../../operations/sentry-alerts.md)
