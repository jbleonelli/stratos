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
