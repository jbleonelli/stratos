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

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  value = module.cognito.user_pool_client_id
}

output "graphql_url" {
  description = "AppSync GraphQL endpoint for the SPA."
  value       = module.appsync.graphql_url
}

output "graphql_realtime_url" {
  value = module.appsync.realtime_url
}

output "migrate_lambda_name" {
  description = "Invoke this to apply db/ migrations to Aurora."
  value       = module.lambda.migrate_name
}

output "spa_bucket" {
  description = "S3 bucket to sync the built web/ SPA into."
  value       = one(module.edge[*].spa_bucket)
}

output "spa_url" {
  description = "CloudFront domain serving the SPA."
  value       = var.enable_edge ? "https://${one(module.edge[*].distribution_domain_name)}" : null
}

output "cloudfront_distribution_id" {
  value = one(module.edge[*].distribution_id)
}
