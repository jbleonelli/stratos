# One-time bootstrap — creates the S3 bucket that backs Terraform remote state.
#
# The main stack's backend (../backend.tf) points at this bucket, so it must
# exist before `terraform init` there. This root uses LOCAL state on purpose
# (chicken-and-egg): run it once per account, commit nothing sensitive.
#
#   cd infra/bootstrap
#   terraform init
#   terraform apply -var=region=us-east-1
#
# State locking uses S3 native lockfiles (use_lockfile), so no DynamoDB table.

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

variable "bucket_name" {
  type    = string
  default = "stratos-tfstate"
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "stratos"
      Component = "tfstate"
      ManagedBy = "terraform"
    }
  }
}

resource "aws_s3_bucket" "tfstate" {
  bucket = var.bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "bucket_name" { value = aws_s3_bucket.tfstate.id }
