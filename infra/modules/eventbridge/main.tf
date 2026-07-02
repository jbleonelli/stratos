# Amazon EventBridge — the canonical signal layer.
#
# Devices / webhooks / the simulator publish events onto a custom bus. A rule
# routes actionable signals (by source + detail-type) to an SQS work queue with
# a dead-letter queue; the agent worker Lambda consumes the queue in batches.
# This is the durable, decoupled ingest in front of the decision loop
# (docs/architecture/agent-runtime.md).

variable "environment" { type = string }

variable "worker_lambda_arn" {
  type        = string
  description = "Agent worker function ARN (SQS event-source target)."
}

variable "worker_lambda_name" {
  type        = string
  description = "Agent worker function name (for the event-source mapping)."
}

variable "worker_role_name" {
  type        = string
  description = "Agent worker execution role — the SQS receive policy attaches here."
}

variable "event_sources" {
  type        = list(string)
  description = "EventBridge `source` values the routing rule matches."
  default     = ["stratos.api", "stratos.devices", "stratos.webhooks", "stratos.simulator"]
}

locals {
  name = "stratos-${var.environment}"
}

resource "aws_cloudwatch_event_bus" "events" {
  name = "${local.name}-events"
}

# ── Work queue + dead-letter queue ──────────────────────────────────────────

resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name}-agent-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "work" {
  name                       = "${local.name}-agent-work"
  visibility_timeout_seconds = 360 # ≥ 6× the worker timeout (60s)
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 5
  })
}

# Allow this account's EventBridge rule to enqueue.
data "aws_iam_policy_document" "queue" {
  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.work.arn]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.route.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "work" {
  queue_url = aws_sqs_queue.work.id
  policy    = data.aws_iam_policy_document.queue.json
}

# ── Routing rule: signal → work queue ───────────────────────────────────────

resource "aws_cloudwatch_event_rule" "route" {
  name           = "${local.name}-route-signals"
  event_bus_name = aws_cloudwatch_event_bus.events.name
  description    = "Route device/webhook/simulator signals to the agent work queue."
  event_pattern = jsonencode({
    source = var.event_sources
  })
}

resource "aws_cloudwatch_event_target" "to_queue" {
  rule           = aws_cloudwatch_event_rule.route.name
  event_bus_name = aws_cloudwatch_event_bus.events.name
  arn            = aws_sqs_queue.work.arn
}

# ── SQS → worker Lambda ─────────────────────────────────────────────────────

data "aws_iam_policy_document" "consume" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.work.arn]
  }
}

resource "aws_iam_role_policy" "consume" {
  name   = "consume-agent-work"
  role   = var.worker_role_name
  policy = data.aws_iam_policy_document.consume.json
}

resource "aws_lambda_event_source_mapping" "work" {
  event_source_arn                   = aws_sqs_queue.work.arn
  function_name                      = var.worker_lambda_name
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  function_response_types            = ["ReportBatchItemFailures"]
  depends_on                         = [aws_iam_role_policy.consume]
}

output "bus_name" { value = aws_cloudwatch_event_bus.events.name }
output "bus_arn" { value = aws_cloudwatch_event_bus.events.arn }
output "work_queue_url" { value = aws_sqs_queue.work.id }
output "work_queue_arn" { value = aws_sqs_queue.work.arn }
output "dlq_url" { value = aws_sqs_queue.dlq.id }
