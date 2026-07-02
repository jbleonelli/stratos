# GitHub Actions → AWS via OIDC (no long-lived keys).
#
# A standalone Terraform root (local state) applied once per account. It creates
# the GitHub OIDC identity provider and a deploy role that only the Stratos repo
# can assume. The CI `deploy` workflow assumes this role with
# aws-actions/configure-aws-credentials, then runs terraform.
#
#   terraform -chdir=infra/github-oidc init
#   terraform -chdir=infra/github-oidc apply -var 'github_repo=jbleonelli/stratos'
#
# Output `deploy_role_arn` → set it as the repo variable AWS_DEPLOY_ROLE_ARN.

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "github_repo" {
  type        = string
  description = "owner/repo allowed to assume the deploy role."
  default     = "jbleonelli/stratos"
}

variable "allowed_ref" {
  type        = string
  description = "Git ref pattern permitted to assume the role (tighten in prod)."
  default     = "ref:refs/heads/main"
}

variable "role_name" {
  type    = string
  default = "stratos-github-deploy"
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "stratos"
      ManagedBy = "terraform"
      Component = "github-oidc"
    }
  }
}

# The GitHub OIDC provider is a per-account singleton. If it already exists,
# import it (terraform import aws_iam_openid_connect_provider.github <arn>)
# instead of creating a duplicate.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # IAM validates GitHub's OIDC token against trusted CAs; the thumbprint is no
  # longer used for verification but the argument is still required.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:${var.allowed_ref}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = var.role_name
  assume_role_policy   = data.aws_iam_policy_document.assume.json
  max_session_duration = 3600
}

# Deploy permissions: the union of services the stack provisions, scoped to
# us-east-1. Broad by design (Terraform manages everything); tighten per-service
# once the resource set stabilises.
data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "StratosDeployUsEast1"
    effect = "Allow"
    actions = [
      "ec2:*", "rds:*", "s3:*", "secretsmanager:*", "iam:*", "logs:*",
      "kms:*", "acm:*", "application-autoscaling:*", "cloudwatch:*",
      "lambda:*", "appsync:*", "cognito-idp:*", "cognito-identity:*",
      "cloudfront:*", "wafv2:*",
      "sqs:*", "states:*", "events:*", "scheduler:*", "bedrock:*",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["us-east-1"]
    }
  }

  # Global-endpoint reads Terraform needs regardless of region.
  statement {
    sid       = "GlobalReads"
    effect    = "Allow"
    actions   = ["sts:GetCallerIdentity", "iam:ListRoles", "iam:GetRole"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "stratos-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

output "deploy_role_arn" {
  description = "Set as the repo variable AWS_DEPLOY_ROLE_ARN for the deploy workflow."
  value       = aws_iam_role.deploy.arn
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}
