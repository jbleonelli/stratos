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

variable "enable_simulator" {
  type        = bool
  default     = false
  description = "Deploy the scheduled signal simulator that drives the agent loop with synthetic events. Off by default (no cost)."
}

variable "simulator_schedule" {
  type        = string
  default     = "rate(5 minutes)"
  description = "EventBridge schedule expression for the simulator tick (rate() or cron())."
}

variable "simulator_signals_per_tick" {
  type        = number
  default     = 1
  description = "Synthetic signals emitted per simulator tick."
}

variable "cognito_user_pool_id" {
  type        = string
  default     = ""
  description = "Cognito user pool id — enables inviteOrgMember to AdminCreateUser when set."
}

variable "cognito_user_pool_arn" {
  type        = string
  default     = ""
  description = "Cognito user pool ARN for resolver IAM (AdminCreateUser / AdminGetUser)."
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
  }, var.cognito_user_pool_id != "" ? { COGNITO_USER_POOL_ID = var.cognito_user_pool_id } : {})

  cognito_user_pool_arn = var.cognito_user_pool_arn != "" ? var.cognito_user_pool_arn : (
    var.cognito_user_pool_id != ""
    ? "arn:aws:cognito-idp:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:userpool/${var.cognito_user_pool_id}"
    : ""
  )

  # The simulator records synthetic events and emits signals onto the same bus.
  simulator_env = merge(local.resolver_env, {
    SIGNALS_PER_TICK = tostring(var.simulator_signals_per_tick)
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

# inviteOrgMember → Cognito AdminCreateUser when COGNITO_USER_POOL_ID is set.
data "aws_iam_policy_document" "cognito_admin" {
  statement {
    actions = [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminGetUser",
      "cognito-idp:AdminSetUserPassword",
      "cognito-idp:AdminDeleteUser",
    ]
    resources = [local.cognito_user_pool_arn]
  }
}

resource "aws_iam_role_policy" "cognito_admin" {
  name   = "cognito-admin-invites"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.cognito_admin.json
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

  environment { variables = merge(local.db_env, var.cognito_user_pool_id != "" ? { COGNITO_USER_POOL_ID = var.cognito_user_pool_id } : {}) }

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

# ── Signal simulator (scheduled; drives the agent loop for demos/load) ───────
# Off by default. When enabled, a scheduled EventBridge rule ticks the simulator
# Lambda, which records synthetic events against seeded devices and PutEvents
# signals onto the agent bus — the same front door the resolver uses. Reuses the
# shared role (DB secret + VPC + events:PutEvents); no Bedrock.

resource "aws_cloudwatch_log_group" "simulator" {
  count             = var.enable_simulator ? 1 : 0
  name              = "/aws/lambda/${local.name}-simulator"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "simulator" {
  count            = var.enable_simulator ? 1 : 0
  function_name    = "${local.name}-simulator"
  role             = aws_iam_role.this.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "simulator.handler"
  filename         = data.archive_file.bundle.output_path
  source_code_hash = data.archive_file.bundle.output_base64sha256
  timeout          = 30
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment { variables = local.simulator_env }

  depends_on = [
    aws_iam_role_policy_attachment.basic,
    aws_iam_role_policy_attachment.vpc,
    aws_cloudwatch_log_group.simulator,
  ]
}

resource "aws_cloudwatch_event_rule" "simulator" {
  count               = var.enable_simulator ? 1 : 0
  name                = "${local.name}-simulator-tick"
  description         = "Ticks the Stratos signal simulator."
  schedule_expression = var.simulator_schedule
}

resource "aws_cloudwatch_event_target" "simulator" {
  count     = var.enable_simulator ? 1 : 0
  rule      = aws_cloudwatch_event_rule.simulator[0].name
  target_id = "simulator"
  arn       = aws_lambda_function.simulator[0].arn
}

resource "aws_lambda_permission" "simulator" {
  count         = var.enable_simulator ? 1 : 0
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.simulator[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.simulator[0].arn
}

output "resolver_arn" { value = aws_lambda_function.resolver.arn }
output "resolver_name" { value = aws_lambda_function.resolver.function_name }
output "migrate_name" { value = aws_lambda_function.migrate.function_name }
output "agent_worker_arn" { value = aws_lambda_function.agent_worker.arn }
output "agent_worker_name" { value = aws_lambda_function.agent_worker.function_name }
output "simulator_name" {
  description = "Simulator function name when enabled, else empty."
  value       = var.enable_simulator ? aws_lambda_function.simulator[0].function_name : ""
}
output "role_name" {
  description = "Shared Lambda execution role — the eventbridge module attaches the SQS receive policy to it."
  value       = aws_iam_role.this.name
}
