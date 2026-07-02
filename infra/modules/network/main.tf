# Networking foundation — a private VPC for the data plane.
#
# Aurora is VPC-private (no public access); the resolver Lambda runs in the same
# private subnets and reaches it over the DB security group. Secrets Manager is
# reached through an interface VPC endpoint, so no NAT gateway is required for the
# Lambda cold-start credential fetch.

variable "environment" { type = string }

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "az_count" {
  type        = number
  default     = 2
  description = "Number of AZs to spread private subnets across (Aurora needs >= 2)."
}

locals {
  name = "stratos-${var.environment}"
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_region" "current" {}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.name }
}

# Private, isolated subnets — Aurora + Lambda. No internet gateway / NAT.
resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${local.name}-private-${count.index}" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-private" }
}

resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── Security groups ─────────────────────────────────────────────────────────

# Lambda (and other compute) egress-only; identified as a source for the DB.
resource "aws_security_group" "lambda" {
  name        = "${local.name}-lambda"
  description = "Resolver Lambda ENIs"
  vpc_id      = aws_vpc.this.id

  egress {
    description = "All egress (DB + VPC endpoints)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-lambda" }
}

# Aurora — accepts Postgres only from the Lambda SG.
resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "Aurora Serverless v2 cluster"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Postgres from Lambda"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  tags = { Name = "${local.name}-db" }
}

# Interface VPC endpoints (Secrets Manager) — HTTPS from Lambda.
resource "aws_security_group" "endpoints" {
  name        = "${local.name}-vpce"
  description = "Interface VPC endpoints"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "HTTPS from Lambda"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  tags = { Name = "${local.name}-vpce" }
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true

  tags = { Name = "${local.name}-secretsmanager" }
}

# ── Outputs ─────────────────────────────────────────────────────────────────

output "vpc_id" { value = aws_vpc.this.id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
output "lambda_security_group_id" { value = aws_security_group.lambda.id }
output "db_security_group_id" { value = aws_security_group.db.id }
