# Root composition — wires the platform modules together.
# 🟠 Skeleton: module blocks are declared with intent; inputs/outputs are filled
# in as each module is implemented (see ../ARCHITECTURE.md §10).

module "aurora" {
  source          = "./modules/aurora"
  environment     = var.environment
  db_min_capacity = var.db_min_capacity
  db_max_capacity = var.db_max_capacity
}

module "cognito" {
  source      = "./modules/cognito"
  environment = var.environment
}

module "lambda" {
  source      = "./modules/lambda"
  environment = var.environment
  # aurora_arn = module.aurora.cluster_arn
  # secret_arn = module.aurora.credentials_secret_arn
}

module "appsync" {
  source            = "./modules/appsync"
  environment       = var.environment
  # cognito_pool_id = module.cognito.user_pool_id
  # resolver_lambda = module.lambda.resolver_arn
}

module "eventbridge" {
  source      = "./modules/eventbridge"
  environment = var.environment
}

module "stepfunctions" {
  source      = "./modules/stepfunctions"
  environment = var.environment
  # bus_arn    = module.eventbridge.bus_arn
}

module "edge" {
  source      = "./modules/edge"
  environment = var.environment
  domain      = var.domain
}
