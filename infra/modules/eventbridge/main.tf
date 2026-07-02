# Amazon EventBridge — the events bus (signal pipeline) + scheduled jobs.
# Devices/webhooks/simulator publish events here; rules route by kind/severity to
# SQS → Step Functions. EventBridge Scheduler runs the non-agent crons.
# 🟠 Skeleton — not apply-ready.

variable "environment" { type = string }

locals {
  name = "stratos-${var.environment}"
}

# TODO:
# resource "aws_cloudwatch_event_bus" "events" { name = "${local.name}-events" }
#
# resource "aws_scheduler_schedule" "sla_sweep" {
#   name                = "${local.name}-sla-sweep"
#   schedule_expression = "rate(1 minute)"
#   target { arn = var.cron_lambda_arn  role_arn = var.scheduler_role_arn }
# }

# output "bus_arn" { value = aws_cloudwatch_event_bus.events.arn }
