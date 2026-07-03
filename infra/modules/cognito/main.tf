# Amazon Cognito — identity.
#
# A user pool whose pre-token-generation Lambda injects the organization_id and
# platform_role claims (resolved from the DB via resolve_login_claims). Those
# claims feed the app-layer authz checks and the RLS claim bridge. The SPA uses a
# public (no-secret) SRP client. See docs/architecture/authorization-and-claim-bridge.md.

variable "environment" { type = string }

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnets for the pre-token Lambda ENIs."
}

variable "security_group_id" {
  type        = string
  description = "Lambda security group (egress to DB + VPC endpoints)."
}

variable "db_secret_arn" {
  type        = string
  description = "Secrets Manager ARN of the Aurora master credentials."
}

variable "db_host" { type = string }
variable "db_name" { type = string }
variable "db_port" {
  type    = number
  default = 5432
}

variable "lambda_dist_dir" {
  type        = string
  default     = ""
  description = "Directory holding the built Lambda bundles (npm run build in api/). Defaults to ../../../api/dist."
}

variable "log_retention_days" {
  type    = number
  default = 14
}

locals {
  name     = "stratos-${var.environment}"
  dist_dir = var.lambda_dist_dir != "" ? var.lambda_dist_dir : "${path.module}/../../../api/dist"
}

# ── Pre-token-generation Lambda ─────────────────────────────────────────────

data "archive_file" "pre_token" {
  type        = "zip"
  source_dir  = local.dist_dir
  output_path = "${path.module}/.build/pre-token.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "pre_token" {
  name               = "${local.name}-pre-token"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# Basic execution (logs) + VPC networking (ENIs in the private subnets).
resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.pre_token.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.pre_token.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "read_secret" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.db_secret_arn]
  }
}

resource "aws_iam_role_policy" "read_secret" {
  name   = "read-db-secret"
  role   = aws_iam_role.pre_token.id
  policy = data.aws_iam_policy_document.read_secret.json
}

resource "aws_cloudwatch_log_group" "pre_token" {
  name              = "/aws/lambda/${local.name}-pre-token"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "pre_token" {
  function_name    = "${local.name}-pre-token"
  role             = aws_iam_role.pre_token.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "pre-token.handler"
  filename         = data.archive_file.pre_token.output_path
  source_code_hash = data.archive_file.pre_token.output_base64sha256
  timeout          = 10
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = var.db_secret_arn
      DB_HOST       = var.db_host
      DB_NAME       = var.db_name
      DB_PORT       = tostring(var.db_port)
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.basic,
    aws_iam_role_policy_attachment.vpc,
    aws_cloudwatch_log_group.pre_token,
  ]
}

resource "aws_lambda_permission" "cognito_pre_token" {
  statement_id  = "AllowCognitoPreToken"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_token.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.this.arn
}

resource "aws_lambda_function" "post_confirmation" {
  function_name    = "${local.name}-post-confirmation"
  role             = aws_iam_role.pre_token.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "post-confirmation.handler"
  filename         = data.archive_file.pre_token.output_path
  source_code_hash = data.archive_file.pre_token.output_base64sha256
  timeout          = 10
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = var.db_secret_arn
      DB_HOST       = var.db_host
      DB_NAME       = var.db_name
      DB_PORT       = tostring(var.db_port)
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.basic,
    aws_iam_role_policy_attachment.vpc,
    aws_cloudwatch_log_group.post_confirmation,
  ]
}

resource "aws_cloudwatch_log_group" "post_confirmation" {
  name              = "/aws/lambda/${local.name}-post-confirmation"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.this.arn
}

# ── User pool + client ──────────────────────────────────────────────────────

resource "aws_cognito_user_pool" "this" {
  name                     = local.name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Dynamic claims come from the pre-token Lambda; the attributes let an operator
  # also pin a value directly on a user if needed.
  schema {
    name                     = "organization_id"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false
    string_attribute_constraints {
      min_length = 0
      max_length = 64
    }
  }

  schema {
    name                     = "platform_role"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false
    string_attribute_constraints {
      min_length = 0
      max_length = 64
    }
  }

  lambda_config {
    pre_token_generation = aws_lambda_function.pre_token.arn
    post_confirmation    = aws_lambda_function.post_confirmation.arn
  }
}

resource "aws_cognito_user_pool_client" "spa" {
  name         = "${local.name}-spa"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false # public SPA client (PKCE/SRP)
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}

output "user_pool_id" { value = aws_cognito_user_pool.this.id }
output "user_pool_arn" { value = aws_cognito_user_pool.this.arn }
output "user_pool_client_id" { value = aws_cognito_user_pool_client.spa.id }
output "pre_token_lambda_arn" { value = aws_lambda_function.pre_token.arn }
output "pre_token_lambda_name" { value = aws_lambda_function.pre_token.function_name }
output "post_confirmation_lambda_arn" { value = aws_lambda_function.post_confirmation.arn }
output "post_confirmation_lambda_name" { value = aws_lambda_function.post_confirmation.function_name }
