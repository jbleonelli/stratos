# AWS AppSync — GraphQL data API + realtime subscriptions. Replaces PostgREST
# (flexible query) and Supabase Realtime (subscriptions) in one managed service.
# Cognito user pool as the primary auth provider; per-type/field authz + resolver
# checks enforce tenant scoping.
# 🟠 Skeleton — not apply-ready.

variable "environment" { type = string }

locals {
  name = "stratos-${var.environment}"
}

# Schema of record: api/schema.graphql (events/asks slice implemented;
# resolver in api/src/resolver.mjs). Fields map to the Lambda data source;
# subscriptions (onAskRaised / onEventIngested) are AppSync-native.
#
# TODO:
# resource "aws_appsync_graphql_api" "this" {
#   name                = local.name
#   authentication_type = "AMAZON_COGNITO_USER_POOLS"
#   user_pool_config {
#     user_pool_id   = var.cognito_pool_id
#     default_action = "DENY"
#   }
#   schema = file("${path.module}/../../../api/schema.graphql")
# }
#
# resource "aws_appsync_datasource" "resolver" {
#   type             = "AWS_LAMBDA"
#   lambda_config { function_arn = var.resolver_lambda_arn }
# }
#
# One resolver per Query/Mutation field → the resolver Lambda; subscriptions
# need no data source (published by the listed mutations).

# output "graphql_url" { value = aws_appsync_graphql_api.this.uris["GRAPHQL"] }
