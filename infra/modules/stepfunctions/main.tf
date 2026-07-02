# AWS Step Functions — the agent decision loop (act/ask/skip). Durable,
# observable, retryable. Spend-guard is a state before the Bedrock invoke; writes
# agent_runs + action tables; pushes results to the UI via an AppSync mutation.
# See docs/architecture/agent-runtime.md
# 🟠 Skeleton — not apply-ready.

variable "environment" { type = string }

locals {
  name = "stratos-${var.environment}"
}

# TODO:
# resource "aws_sfn_state_machine" "agent_loop" {
#   name       = "${local.name}-agent-loop"
#   type       = "STANDARD"
#   definition = file("${path.module}/agent-loop.asl.json")
#   # states: SpendGuard → Decide → (Bedrock) → WriteRun → PushToUI
# }
#
# resource "aws_sqs_queue" "agent_work" { name = "${local.name}-agent-work" }

# output "state_machine_arn" { value = aws_sfn_state_machine.agent_loop.arn }
