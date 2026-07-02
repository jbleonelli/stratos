# AWS AppSync — GraphQL data API + realtime subscriptions. Replaces PostgREST
# (flexible query) and Supabase Realtime (subscriptions) in one managed service.
# Cognito user pool as the primary auth provider; per-type/field authz + resolver
# checks enforce tenant scoping.
# 🟠 Skeleton — not apply-ready.

variable "environment" { type = string }

locals {
  name = "stratos-${var.environment}"
}

# TODO:
# resource "aws_appsync_graphql_api" "this" {
#   name                = local.name
#   authentication_type = "AMAZON_COGNITO_USER_POOLS"
#   user_pool_config {
#     user_pool_id = var.cognito_pool_id
#     default_action = "DENY"
#   }
#   # schema from ../../schema.graphql
# }
#
# Data sources: Lambda resolver (var.resolver_lambda) and/or RDS Data API.
# Resolvers: queries/mutations → Lambda; subscriptions for live UI updates.

# output "graphql_url" { value = aws_appsync_graphql_api.this.uris["GRAPHQL"] }
