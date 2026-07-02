# Aurora Serverless v2 (PostgreSQL) — the data plane.
#
# Holds the schema, RPCs, and RLS policies (RLS is the DB backstop for the
# app-layer authorization model — see docs/architecture/authorization-and-claim-bridge.md).
# VPC-private: reachable only from the resolver Lambda via the DB security group.
# Master credentials are managed by RDS and stored in Secrets Manager.

variable "environment" { type = string }
variable "db_min_capacity" { type = string }
variable "db_max_capacity" { type = string }

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for the DB subnet group (>= 2 AZs)."
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "Security groups attached to the cluster (the DB SG)."
}

variable "engine_version" {
  type    = string
  default = "16.6"
}

variable "deletion_protection" {
  type    = bool
  default = false
}

locals {
  name = "stratos-${var.environment}"
}

resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = var.subnet_ids
  tags       = { Name = local.name }
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = local.name
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.engine_version
  database_name      = "stratos"

  master_username             = "stratos_admin"
  manage_master_user_password = true # → AWS Secrets Manager

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.vpc_security_group_ids
  storage_encrypted      = true

  serverlessv2_scaling_configuration {
    min_capacity = var.db_min_capacity
    max_capacity = var.db_max_capacity
  }

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = "${local.name}-final"

  lifecycle {
    ignore_changes = [engine_version] # allow AWS auto-minor-version upgrades
  }
}

resource "aws_rds_cluster_instance" "this" {
  identifier          = "${local.name}-0"
  cluster_identifier  = aws_rds_cluster.this.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.this.engine
  engine_version      = aws_rds_cluster.this.engine_version
  publicly_accessible = false
}

output "cluster_arn" { value = aws_rds_cluster.this.arn }
output "cluster_endpoint" { value = aws_rds_cluster.this.endpoint }
output "reader_endpoint" { value = aws_rds_cluster.this.reader_endpoint }
output "database_name" { value = aws_rds_cluster.this.database_name }
output "port" { value = aws_rds_cluster.this.port }
output "credentials_secret_arn" {
  value = aws_rds_cluster.this.master_user_secret[0].secret_arn
}
