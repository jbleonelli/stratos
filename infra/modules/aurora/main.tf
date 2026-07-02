# Aurora Serverless v2 (PostgreSQL) — data plane.
# Keeps the ported schema + ~100 RPCs + RLS policies (RLS = the DB backstop for
# the app-layer authorization model). See docs/architecture/authorization-and-claim-bridge.md
# 🟠 Skeleton — resources sketched, not apply-ready.

variable "environment" { type = string }
variable "db_min_capacity" { type = string }
variable "db_max_capacity" { type = string }

locals {
  name = "stratos-${var.environment}"
}

# TODO:
# resource "aws_rds_cluster" "this" {
#   engine             = "aurora-postgresql"
#   engine_mode        = "provisioned"
#   engine_version     = "16.4"
#   database_name      = "stratos"
#   master_username    = "stratos_admin"
#   manage_master_user_password = true          # → Secrets Manager
#   serverlessv2_scaling_configuration {
#     min_capacity = var.db_min_capacity
#     max_capacity = var.db_max_capacity
#   }
#   # VPC-private; access only via Lambda/RDS Data API.
# }
#
# resource "aws_rds_cluster_instance" "this" {
#   cluster_identifier = aws_rds_cluster.this.id
#   instance_class     = "db.serverless"
#   engine             = aws_rds_cluster.this.engine
# }

# output "cluster_arn"               { value = aws_rds_cluster.this.arn }
# output "credentials_secret_arn"    { value = aws_rds_cluster.this.master_user_secret[0].secret_arn }
