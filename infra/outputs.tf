# Root outputs — foundation handles other modules / operators consume.

output "vpc_id" {
  value = module.network.vpc_id
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "lambda_security_group_id" {
  value = module.network.lambda_security_group_id
}

output "db_cluster_endpoint" {
  value = module.aurora.cluster_endpoint
}

output "db_credentials_secret_arn" {
  description = "Secrets Manager ARN for the Aurora master credentials."
  value       = module.aurora.credentials_secret_arn
}
