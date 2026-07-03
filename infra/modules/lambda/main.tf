# AWS Lambda — the AppSync resolver + the schema migration runner.
#
# Both run in the private VPC, connect to Aurora as the DB master (from Secrets
# Manager), and downgrade to stratos_resolver per request. The resolver enforces
# app-layer authz and sets request.jwt.claims so RLS fires as the backstop.
# Handlers are bundled by api/build.mjs into api/dist and zipped here.

variable "environment" { type = string }

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnets for the Lambda ENIs."
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
  description = "Directory holding the built Lambda bundles (npm run build in api/)."
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "bedrock_model_id" {
  type        = string
  default     = ""
  description = "Overrides the agent reasoner's Bedrock model id (BEDROCK_MODEL_ID). Empty → the code default."
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  name     = "stratos-${var.environment}"
  dist_dir = var.lambda_dist_dir != "" ? var.lambda_dist_dir : "${path.module}/../../../api/dist"

  # Static names/ARNs the eventbridge/appsync modules also derive from
  # `environment`. Referencing them by their deterministic name here — rather
  # than a module output — keeps this module free of a dependency cycle.
  event_bus_name = "stratos-${var.environment}-events"
  event_bus_arn  = "arn:aws:events:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:event-bus/${local.event_bus_name}"

  db_env = {
    DB_SECRET_ARN = var.db_secret_arn
    DB_HOST       = var.db_host
    DB_NAME       = var.db_name
    DB_PORT       = tostring(var.db_port)
  }

  # The resolver emits a signal onto the agent bus on ingestEvent.
  resolver_env = merge(local.db_env, {
    EVENT_BUS_NAME = local.event_bus_name
  })

  # The agent worker publishes activity to AppSync; it looks up the GraphQL URL
  # from this SSM parameter (written by the appsync module). Using the static
  # parameter name here avoids a lambda↔appsync dependency cycle. A non-empty
  # bedrock_model_id overrides the reasoner's model (else the code default).
  worker_env = merge(
    local.db_env,
    { APPSYNC_URL_PARAM = "/stratos/${var.environment}/appsync/graphql-url" },
    var.bedrock_model_id != "" ? { BEDROCK_MODEL_ID = var.bedrock_model_id } : {},
  )
}

data "archive_file" "bundle" {
  type        = "zip"
  source_dir  = local.dist_dir
  output_path = "${path.module}/.build/api.zip"
}

# ── Shared IAM role (logs + VPC ENIs + read the DB secret) ──────────────────

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "${local.name}-resolver"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.this.name
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
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.read_secret.json
}

# The agent worker reasons via Bedrock on the act path.
data "aws_iam_policy_document" "bedrock" {
  statement {
    actions   = ["bedrock:InvokeModel"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "bedrock" {
  name   = "invoke-bedrock"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.bedrock.json
}

# The resolver emits ingested events onto the agent bus.
data "aws_iam_policy_document" "put_events" {
  statement {
    actions   = ["events:PutEvents"]
    resources = [local.event_bus_arn]
  }
}

resource "aws_iam_role_policy" "put_events" {
  name   = "emit-agent-signals"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.put_events.json
}

# ── Resolver function (invoked by AppSync) ──────────────────────────────────

resource "aws_cloudwatch_log_group" "resolver" {
  name              = "/aws/lambda/${local.name}-resolver"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "resolver" {
  function_name    = "${local.name}-resolver"
  role             = aws_iam_role.this.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "resolver.handler"
  filename         = data.archive_file.bundle.output_path
  source_code_hash = data.archive_file.bundle.output_base64sha256
  timeout          = 30
  memory_size      = 512

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment { variables = local.resolver_env }

  depends_on = [
    aws_iam_role_policy_attachment.basic,
    aws_iam_role_policy_attachment.vpc,
    aws_cloudwatch_log_group.resolver,
  ]
}

# ── Migration runner (invoked manually / on deploy) ─────────────────────────

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/aws/lambda/${local.name}-migrate"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "migrate" {
  function_name    = "${local.name}-migrate"
  role             = aws_iam_role.this.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "migrate.handler"
  filename         = data.archive_file.bundle.output_path
  source_code_hash = data.archive_file.bundle.output_base64sha256
  timeout          = 120
  memory_size      = 512

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment { variables = local.db_env }

  depends_on = [
    aws_iam_role_policy_attachment.basic,
    aws_iam_role_policy_attachment.vpc,
    aws_cloudwatch_log_group.migrate,
  ]
}

# ── Agent worker (invoked by SQS from the EventBridge work queue) ───────────
# The decision-loop executor: spend guard → decide → record_agent_run →
# agent_raise_ask. Same in-VPC role (logs, ENIs, DB secret); the SQS receive
# policy + event-source mapping live in the eventbridge module (it owns the
# queue).

resource "aws_cloudwatch_log_group" "agent_worker" {
  name              = "/aws/lambda/${local.name}-agent-worker"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "agent_worker" {
  function_name    = "${local.name}-agent-worker"
  role             = aws_iam_role.this.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "agent-worker.handler"
  filename         = data.archive_file.bundle.output_path
  source_code_hash = data.archive_file.bundle.output_base64sha256
  timeout          = 60
  memory_size      = 512

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment { variables = local.worker_env }

  depends_on = [
    aws_iam_role_policy_attachment.basic,
    aws_iam_role_policy_attachment.vpc,
    aws_cloudwatch_log_group.agent_worker,
  ]
}

output "resolver_arn" { value = aws_lambda_function.resolver.arn }
output "resolver_name" { value = aws_lambda_function.resolver.function_name }
output "migrate_name" { value = aws_lambda_function.migrate.function_name }
output "agent_worker_arn" { value = aws_lambda_function.agent_worker.arn }
output "agent_worker_name" { value = aws_lambda_function.agent_worker.function_name }
output "role_name" {
  description = "Shared Lambda execution role — the eventbridge module attaches the SQS receive policy to it."
  value       = aws_iam_role.this.name
}
