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

output "graphql_url" { value = aws_appsync_graphql_api.this.uris["GRAPHQL"] }
output "realtime_url" { value = aws_appsync_graphql_api.this.uris["REALTIME"] }
output "api_id" { value = aws_appsync_graphql_api.this.id }
