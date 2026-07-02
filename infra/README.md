# Infrastructure (Terraform, all-AWS)

Reusable Terraform for the Stratos platform. One module set, instantiated per
environment (`dev`, `staging`, `prod`) and later per isolated client stack.

> 🟢 **Apply-ready:** `network` (private VPC) + `aurora` (Serverless v2, creds in
> Secrets Manager) + `cognito` (user pool + SPA client + pre-token-generation
> Lambda that injects the org/role claims).
> 🟠 The remaining modules are skeletons, filled in as each vertical slice lands
> (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §10 build sequence).
>
> `terraform validate` passes for both the root stack and `bootstrap/`.

## Layout

```
infra/
├── versions.tf      # terraform + provider version pins
├── providers.tf     # aws provider (region from var)
├── backend.tf       # S3 remote state (per-env key)
├── variables.tf     # root inputs (env, region, domain, cidr, sizing)
├── outputs.tf       # vpc / subnets / db endpoint + credentials secret ARN
├── main.tf          # wires the modules together
├── bootstrap/       # one-time: creates the S3 tfstate bucket (local state)
├── clients/         # per-env / per-client tfvars (gitignored)
│   └── example.tfvars.example
└── modules/
    ├── network/      # 🟢 VPC + private subnets + SGs + Secrets Mgr endpoint
    ├── aurora/       # 🟢 Aurora Serverless v2 Postgres + RLS + Secrets Manager
    ├── cognito/      # 🟢 user pool + SPA client + pre-token-gen Lambda
    ├── edge/         # S3 static site + CloudFront + WAF
    ├── appsync/      # GraphQL API + resolvers + Cognito authz
    ├── lambda/       # resolver / BFF functions
    ├── eventbridge/  # events bus + schedules
    └── stepfunctions/# agent decision loop
```

## Usage

```bash
# 0. one-time per account: create the remote-state bucket
cd infra/bootstrap
terraform init && terraform apply -var=region=us-east-1

# 1. build the Lambda bundles the cognito module deploys (api/dist)
cd ../api && npm ci && npm run build && cd ../infra

# 2. the platform stack, per env/client
cp clients/example.tfvars.example clients/dev.tfvars   # fill values
terraform init -backend-config="key=dev.tfstate"
terraform plan  -var-file=clients/dev.tfvars
terraform apply -var-file=clients/dev.tfvars
```

Offline check (no AWS creds needed):

```bash
cd infra && terraform init -backend=false && terraform validate
```

## Conventions

- **State:** S3 backend, one key per env/client, native locking.
- **Auth to AWS:** GitHub OIDC in CI (no long-lived keys).
- **Region is a variable** → per-client residency.
- **Secrets** live in AWS Secrets Manager, referenced by ARN — never in tfvars.
