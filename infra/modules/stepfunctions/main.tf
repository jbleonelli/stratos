# AWS Step Functions — the agent decision loop.
#
# A durable, observable wrapper around the agent worker: invoke the worker as a
# task (with retry/backoff), then branch on the decision (act / ask / skip).
# The worker currently embodies the spend-guard and record steps; as the
# runtime grows, those become discrete states here (a Choice guard state before
# a dedicated Bedrock task) without changing the ingress contract.
# See docs/architecture/agent-runtime.md.

variable "environment" { type = string }

variable "worker_lambda_arn" {
  type        = string
  description = "Agent worker function ARN invoked by the AgentTick state."
}

variable "log_retention_days" {
  type    = number
  default = 14
}

locals {
  name = "stratos-${var.environment}"
}

# ── Execution role ──────────────────────────────────────────────────────────

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "${local.name}-agent-loop"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "permissions" {
  statement {
    sid       = "InvokeWorker"
    actions   = ["lambda:InvokeFunction"]
    resources = [var.worker_lambda_arn, "${var.worker_lambda_arn}:*"]
  }

  # CloudWatch Logs delivery for the state machine's execution logs.
  statement {
    sid = "Logging"
    actions = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
      "logs:DescribeLogGroups",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "this" {
  name   = "agent-loop"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.permissions.json
}

# ── State machine ───────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/states/${local.name}-agent-loop"
  retention_in_days = var.log_retention_days
}

resource "aws_sfn_state_machine" "agent_loop" {
  name     = "${local.name}-agent-loop"
  type     = "STANDARD"
  role_arn = aws_iam_role.this.arn

  definition = jsonencode({
    Comment = "Stratos agent decision loop"
    StartAt = "AgentTick"
    States = {
      AgentTick = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = var.worker_lambda_arn
          "Payload.$"  = "$"
        }
        ResultSelector = {
          "decision.$" = "$.Payload.results[0].decision"
          "runId.$"    = "$.Payload.results[0].runId"
        }
        ResultPath = "$.tick"
        Retry = [{
          ErrorEquals     = ["Lambda.ServiceException", "Lambda.TooManyRequestsException", "States.TaskFailed"]
          IntervalSeconds = 2
          MaxAttempts     = 3
          BackoffRate     = 2
        }]
        Next = "Route"
      }
      Route = {
        Type = "Choice"
        Choices = [
          { Variable = "$.tick.decision", StringEquals = "act", Next = "Acted" },
          { Variable = "$.tick.decision", StringEquals = "ask", Next = "Asked" },
        ]
        Default = "Skipped"
      }
      Acted   = { Type = "Succeed" }
      Asked   = { Type = "Succeed" }
      Skipped = { Type = "Succeed" }
    }
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.this.arn}:*"
    include_execution_data = true
    level                  = "ERROR"
  }
}

output "state_machine_arn" { value = aws_sfn_state_machine.agent_loop.arn }
output "state_machine_name" { value = aws_sfn_state_machine.agent_loop.name }
