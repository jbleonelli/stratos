# Stratos

A fully AWS-native building-operations platform, built from scratch on AWS
managed services only.

## Why this repo exists

Stratos runs on **fully AWS-native managed services** — no Supabase software, no
PostgREST. That constraint shapes the whole architecture: authorization moves
into the application layer (AppSync/Lambda) with RLS kept as a database backstop,
and the data API is GraphQL over AppSync.

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
│   ├── data-seed/     # deterministic seed data for dev / demo / E2E
│   └── parity/        # acceptance gate: leak suite + E2E journeys
├── infra/             # Terraform (all AWS)
├── api/               # Lambda resolvers / BFF handlers
├── web/               # React + Vite SPA
└── db/                # schema, RPCs, RLS + migration history
```

## Status

🟠 **Bootstrapping.** Founding architecture + IaC skeleton only. Nothing deployed.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the plan of record.
