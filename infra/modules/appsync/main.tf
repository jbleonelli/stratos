# AWS AppSync — the GraphQL data API + realtime subscriptions (one managed
# service, no PostgREST). Cognito user pools authenticate every request
# (default ALLOW = authenticated); the resolver Lambda enforces authorization
# and the RLS claim bridge. Schema of record: api/schema.graphql.

variable "environment" { type = string }

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito user pool that authenticates GraphQL requests."
}

variable "resolver_lambda_arn" {
  type        = string
  description = "ARN of the resolver Lambda backing every Query/Mutation field."
}

variable "worker_role_name" {
  type        = string
  description = "Agent worker execution role — granted appsync:GraphQL on publishAgentActivity + read of the URL parameter."
}

locals {
  name = "stratos-${var.environment}"

  # Every Query/Mutation field routes to the resolver Lambda. Subscriptions are
  # AppSync-native (published by raiseAsk / ingestEvent) and need no resolver.
  fields = {
    "Query.organization"   = { type = "Query", field = "organization" }
    "Query.events"         = { type = "Query", field = "events" }
    "Query.asks"           = { type = "Query", field = "asks" }
    "Mutation.raiseAsk"    = { type = "Mutation", field = "raiseAsk" }
    "Mutation.answerAsk"   = { type = "Mutation", field = "answerAsk" }
    "Mutation.ingestEvent" = { type = "Mutation", field = "ingestEvent" }
  }

  # Forward field, args, and Cognito identity to the Lambda in the shape the
  # handler expects (event.info / event.arguments / event.identity).
  request_template = <<-VTL
    {
      "version": "2018-05-29",
      "operation": "Invoke",
      "payload": {
        "info": {
          "parentTypeName": "$context.info.parentTypeName",
          "fieldName": "$context.info.fieldName"
        },
        "arguments": $util.toJson($context.arguments),
        "identity": $util.toJson($context.identity)
      }
    }
  VTL

  response_template = "$util.toJson($context.result)"

  # publishAgentActivity is a NONE-data-source passthrough: it just echoes the
  # input back as the mutation result, which AppSync delivers to
  # onAgentActivity subscribers. No DB, no Lambda.
  publish_request_template = <<-VTL
    {
      "version": "2017-02-28",
      "payload": $util.toJson($context.arguments.input)
    }
  VTL
}

data "aws_region" "current" {}

resource "aws_appsync_graphql_api" "this" {
  name                = local.name
  authentication_type = "AMAZON_COGNITO_USER_POOLS"

  user_pool_config {
    user_pool_id   = var.cognito_user_pool_id
    aws_region     = data.aws_region.current.name
    default_action = "ALLOW"
  }

  # The agent runtime authenticates with SigV4 to publish activity.
  additional_authentication_provider {
    authentication_type = "AWS_IAM"
  }

  schema = file("${path.module}/../../../api/schema.graphql")
}

# Service role AppSync assumes to invoke the resolver Lambda.
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["appsync.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "invoke" {
  name               = "${local.name}-appsync-invoke"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "invoke" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [var.resolver_lambda_arn]
  }
}

resource "aws_iam_role_policy" "invoke" {
  name   = "invoke-resolver"
  role   = aws_iam_role.invoke.id
  policy = data.aws_iam_policy_document.invoke.json
}

resource "aws_appsync_datasource" "resolver" {
  api_id           = aws_appsync_graphql_api.this.id
  name             = "resolver_lambda"
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.invoke.arn

  lambda_config {
    function_arn = var.resolver_lambda_arn
  }
}

resource "aws_appsync_resolver" "field" {
  for_each = local.fields

  api_id            = aws_appsync_graphql_api.this.id
  type              = each.value.type
  field             = each.value.field
  data_source       = aws_appsync_datasource.resolver.name
  request_template  = local.request_template
  response_template = local.response_template
}

# ── Agent activity fan-out (NONE data source, IAM-only mutation) ────────────

resource "aws_appsync_datasource" "publish" {
  api_id = aws_appsync_graphql_api.this.id
  name   = "agent_publish"
  type   = "NONE"
}

resource "aws_appsync_resolver" "publish" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "publishAgentActivity"
  data_source       = aws_appsync_datasource.publish.name
  request_template  = local.publish_request_template
  response_template = local.response_template
}

# The worker resolves this at runtime (avoids a lambda↔appsync module cycle:
# the parameter NAME is static, so the Lambda module can reference it without
# depending on this module).
resource "aws_ssm_parameter" "graphql_url" {
  name  = "/stratos/${var.environment}/appsync/graphql-url"
  type  = "String"
  value = aws_appsync_graphql_api.this.uris["GRAPHQL"]
}

data "aws_iam_policy_document" "worker_publish" {
  statement {
    sid       = "PublishActivity"
    actions   = ["appsync:GraphQL"]
    resources = ["${aws_appsync_graphql_api.this.arn}/types/Mutation/fields/publishAgentActivity"]
  }
  statement {
    sid       = "ReadGraphqlUrl"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.graphql_url.arn]
  }
}

resource "aws_iam_role_policy" "worker_publish" {
  name   = "agent-appsync-publish"
  role   = var.worker_role_name
  policy = data.aws_iam_policy_document.worker_publish.json
}

output "graphql_url" { value = aws_appsync_graphql_api.this.uris["GRAPHQL"] }
output "realtime_url" { value = aws_appsync_graphql_api.this.uris["REALTIME"] }
output "api_id" { value = aws_appsync_graphql_api.this.id }
