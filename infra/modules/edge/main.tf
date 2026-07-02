# Edge — S3 static site + CloudFront + WAF. Serves the React SPA.
# 🟠 Skeleton — not apply-ready.

variable "environment" { type = string }
variable "domain" {
  type    = string
  default = ""
}

locals {
  name = "stratos-${var.environment}"
}

# TODO:
# resource "aws_s3_bucket" "spa" { bucket = "${local.name}-spa" }
#
# resource "aws_cloudfront_distribution" "spa" {
#   # OAC to the private S3 bucket; SPA fallback to index.html on 404.
#   web_acl_id = aws_wafv2_web_acl.edge.arn
#   # ACM cert for var.domain (must be in us-east-1 for CloudFront).
# }
#
# resource "aws_wafv2_web_acl" "edge" {
#   scope = "CLOUDFRONT"
#   # AWS managed rule groups (common, bad inputs) + rate limiting.
# }

# output "distribution_id" { value = aws_cloudfront_distribution.spa.id }
# output "spa_bucket"      { value = aws_s3_bucket.spa.bucket }
