# AWS Lambda — AppSync resolvers / BFF logic + app-layer authorization.
# Resolvers open a DB session with the caller's Cognito claims set
# (SET LOCAL request.jwt.claims) so RLS fires as a backstop.
# 🟠 Skeleton — not apply-ready.

variable "environment" { type = string }

locals {
  name = "stratos-${var.environment}"
}

# Resolver code: api/src/resolver.mjs (exported `handler`), bundled to a zip.
# TODO:
# resource "aws_lambda_function" "resolver" {
#   function_name = "${local.name}-resolver"
#   runtime       = "nodejs22.x"
#   architectures = ["arm64"]
#   handler       = "resolver.handler"
#   # filename / s3 from build; DATABASE_URL from Secrets Manager at cold start.
#   # Connects to Aurora via RDS Proxy (pg) or RDS Data API.
# }

# output "resolver_arn" { value = aws_lambda_function.resolver.arn }
