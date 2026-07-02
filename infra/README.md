# Infrastructure (Terraform, all-AWS)

Reusable Terraform for the Stratos platform. One module set, instantiated per
environment (`dev`, `staging`, `prod`) and later per isolated client stack.

> 🟠 **Skeleton only.** Module stubs describe intent + key resources; nothing is
> wired for `apply` yet. Fill in as each vertical slice lands (see
> [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §10 build sequence).

## Layout

```
infra/
├── versions.tf      # terraform + provider version pins
├── providers.tf     # aws provider (region from var)
├── backend.tf       # S3 remote state (per-env key)
├── variables.tf     # root inputs (env, region, domain, sizing)
├── main.tf          # wires the modules together
├── clients/         # per-env / per-client tfvars (gitignored)
│   └── example.tfvars
└── modules/
    ├── edge/         # S3 static site + CloudFront + WAF
    ├── cognito/      # user pool + custom claims + pre-token Lambda
    ├── aurora/       # Aurora Serverless v2 Postgres + RLS
    ├── appsync/      # GraphQL API + resolvers + Cognito authz
    ├── lambda/       # resolver / BFF functions
    ├── eventbridge/  # events bus + schedules
    └── stepfunctions/# agent decision loop
```

## Usage (once modules are filled in)

```bash
cd infra
cp clients/example.tfvars clients/dev.tfvars   # fill values
terraform init -backend-config="key=dev.tfstate"
terraform plan  -var-file=clients/dev.tfvars
terraform apply -var-file=clients/dev.tfvars
```

## Conventions

- **State:** S3 backend, one key per env/client, native locking.
- **Auth to AWS:** GitHub OIDC in CI (no long-lived keys).
- **Region is a variable** → per-client residency.
- **Secrets** live in AWS Secrets Manager, referenced by ARN — never in tfvars.
