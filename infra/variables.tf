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

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model / cross-region inference profile the agent's act path invokes. The account must have model access enabled for it. Empty → the code default in api/src/bedrock.mjs. Stronger option: us.anthropic.claude-sonnet-4-5-20250929-v1:0."
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "enable_simulator" {
  type        = bool
  description = "Deploy the scheduled signal simulator that drives the agent loop with synthetic events (demos/load). Off by default — costs nothing until enabled."
  default     = false
}

variable "simulator_schedule" {
  type        = string
  description = "EventBridge schedule expression for the simulator tick, e.g. rate(5 minutes) or cron(...)."
  default     = "rate(5 minutes)"
}

variable "simulator_signals_per_tick" {
  type        = number
  description = "Synthetic signals emitted per simulator tick. Higher → more load (and more Bedrock act calls on the ~10% critical share)."
  default     = 1
}
