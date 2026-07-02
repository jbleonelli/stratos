# Stratos

A fully AWS-native building-operations platform. Greenfield rebuild of the Merlin
product surface (same functionality, same UI) on AWS managed services only —
**independent of Merlin**: no shared runtime, no database link, no sync. Merlin
data is imported **once** at bootstrap and the cord is cut.

## Why this repo exists

A customer procurement mandate requires the platform to run on **fully
AWS-native managed services** — no Supabase software, no PostgREST. Stratos is
that build, started from scratch.

## Stack (AWS products only)

| Concern | Service |
| --- | --- |
| Frontend hosting | S3 + CloudFront + WAF |
| Auth | Amazon Cognito |
| Data API | AWS AppSync (GraphQL) |
| Realtime | AppSync subscriptions |
| Compute | AWS Lambda |
| Database | Aurora Serverless v2 (PostgreSQL) + RLS backstop |
| Object storage | Amazon S3 |
| Scheduling | EventBridge Scheduler |
| Agent orchestration | Step Functions + EventBridge + SQS |
| LLM inference | Amazon Bedrock (Claude) |
| Email | Amazon SES |
| Secrets | AWS Secrets Manager |
| Observability | CloudWatch + X-Ray |
| IaC | Terraform |

Non-AWS business integrations with no AWS equivalent: **Stripe** (payments).

## Layout

```
stratos/
├── ARCHITECTURE.md    # founding architecture spec — read this first
├── docs/
│   ├── architecture/  # authz claim-bridge, agent runtime deep-dives
│   ├── data-seed/     # one-time Merlin → AWS import (no sync)
│   └── parity/        # acceptance gate: leak suite + E2E journeys
├── infra/             # Terraform (all AWS)
├── api/               # Lambda resolvers / BFF handlers
├── web/               # React + Vite SPA (ported UI, then owned)
└── db/                # baseline schema + fresh migration history
```

## Status

🟠 **Bootstrapping.** Founding architecture + IaC skeleton only. Nothing deployed.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the plan of record.
