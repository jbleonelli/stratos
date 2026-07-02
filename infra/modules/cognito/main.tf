# Amazon Cognito — identity. Custom claims (organization_id, platform_role) feed
# the app-layer authz + the RLS claim bridge. A pre-token-generation Lambda
# resolves the active org/role at sign-in and on org switch.
# 🟠 Skeleton — not apply-ready.

variable "environment" { type = string }

locals {
  name = "stratos-${var.environment}"
}

# TODO:
# resource "aws_cognito_user_pool" "this" {
#   name = local.name
#   schema { name = "organization_id" attribute_data_type = "String" mutable = true }
#   schema { name = "platform_role"   attribute_data_type = "String" mutable = true }
#   lambda_config { pre_token_generation = var.pre_token_lambda_arn }
#   # MFA, password policy, account recovery configured here.
# }
#
# resource "aws_cognito_user_pool_client" "spa" {
#   user_pool_id = aws_cognito_user_pool.this.id
#   # PKCE public client for the SPA; no secret.
# }

# output "user_pool_id" { value = aws_cognito_user_pool.this.id }
