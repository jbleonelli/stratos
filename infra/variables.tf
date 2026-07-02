variable "environment" {
  type        = string
  description = "Deployment environment / client id (dev, staging, prod, or <client>)."
}

variable "region" {
  type        = string
  description = "AWS region for this stack (per-client residency)."
  default     = "us-east-1"
}

variable "domain" {
  type        = string
  description = "Primary domain for the SPA + API (e.g. app.stratos.example)."
  default     = ""
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert ARN in us-east-1 for `domain` (CloudFront). Empty → CloudFront default cert."
  default     = ""
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the platform VPC."
  default     = "10.20.0.0/16"
}

variable "db_min_capacity" {
  type        = string
  description = "Aurora Serverless v2 minimum ACUs."
  default     = "0.5"
}

variable "db_max_capacity" {
  type        = string
  description = "Aurora Serverless v2 maximum ACUs."
  default     = "4"
}

variable "db_deletion_protection" {
  type        = bool
  description = "Protect the Aurora cluster from deletion (enable in prod)."
  default     = false
}

variable "enable_edge" {
  type        = bool
  description = "Deploy the edge tier (S3 + CloudFront + WAF for the SPA). Disable for backend-only stacks."
  default     = true
}

variable "enable_nat" {
  type        = bool
  description = "Give private subnets internet egress via NAT (needed for the agent worker's AppSync push-to-UI and other non-PrivateLink calls). Off by default to avoid idle NAT cost."
  default     = false
}
