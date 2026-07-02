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

variable "enable_nat" {
  type        = bool
  default     = false
  description = <<-DESC
    Give the private subnets internet egress via a NAT gateway. Required for the
    agent worker's outbound calls that have no PrivateLink — notably the AppSync
    data endpoint (push-to-UI); Bedrock/SSM also ride it. Off by default to avoid
    idle NAT cost; turn on for the live agent loop.
  DESC
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

# ── Optional internet egress (NAT) ──────────────────────────────────────────
# A single-AZ NAT gateway in a public subnet, fronted by an internet gateway.
# When enabled, the private route table default-routes to it, giving Lambda
# outbound access to services without PrivateLink (AppSync data plane, etc.).

resource "aws_internet_gateway" "this" {
  count  = var.enable_nat ? 1 : 0
  vpc_id = aws_vpc.this.id
  tags   = { Name = local.name }
}

resource "aws_subnet" "public" {
  count             = var.enable_nat ? 1 : 0
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, 100)
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "${local.name}-public-0" }
}

resource "aws_route_table" "public" {
  count  = var.enable_nat ? 1 : 0
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-public" }
}

resource "aws_route" "public_internet" {
  count                  = var.enable_nat ? 1 : 0
  route_table_id         = aws_route_table.public[0].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this[0].id
}

resource "aws_route_table_association" "public" {
  count          = var.enable_nat ? 1 : 0
  subnet_id      = aws_subnet.public[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_eip" "nat" {
  count      = var.enable_nat ? 1 : 0
  domain     = "vpc"
  tags       = { Name = "${local.name}-nat" }
  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  count         = var.enable_nat ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = local.name }
  depends_on    = [aws_internet_gateway.this]
}

# Default route for the private subnets → NAT (only when enabled).
resource "aws_route" "private_nat" {
  count                  = var.enable_nat ? 1 : 0
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[0].id
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

# EventBridge — the resolver PutEvents a signal onto the bus when an event is
# ingested. The VPC has no NAT, so this interface endpoint is how the in-VPC
# Lambda reaches EventBridge.
resource "aws_vpc_endpoint" "events" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.events"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true

  tags = { Name = "${local.name}-events" }
}

# ── Outputs ─────────────────────────────────────────────────────────────────

output "vpc_id" { value = aws_vpc.this.id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
output "lambda_security_group_id" { value = aws_security_group.lambda.id }
output "db_security_group_id" { value = aws_security_group.db.id }
