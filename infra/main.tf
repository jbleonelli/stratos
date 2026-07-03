# Root composition — wires the platform modules together.
# 🟢 Foundation live: network + aurora are apply-ready. 🟠 Remaining modules are
# skeletons, filled in as each vertical slice lands (see ../ARCHITECTURE.md §10).

module "network" {
  source      = "./modules/network"
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  enable_nat  = var.enable_nat
}

module "aurora" {
  source                 = "./modules/aurora"
  environment            = var.environment
  db_min_capacity        = var.db_min_capacity
  db_max_capacity        = var.db_max_capacity
  subnet_ids             = module.network.private_subnet_ids
  vpc_security_group_ids = [module.network.db_security_group_id]
  deletion_protection    = var.db_deletion_protection
}

module "cognito" {
  source            = "./modules/cognito"
  environment       = var.environment
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.lambda_security_group_id
  db_secret_arn     = module.aurora.credentials_secret_arn
  db_host           = module.aurora.cluster_endpoint
  db_name           = module.aurora.database_name
}

module "lambda" {
  source            = "./modules/lambda"
  environment       = var.environment
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.lambda_security_group_id
  db_secret_arn     = module.aurora.credentials_secret_arn
  db_host           = module.aurora.cluster_endpoint
  db_name           = module.aurora.database_name
  bedrock_model_id  = var.bedrock_model_id

  enable_simulator           = var.enable_simulator
  simulator_schedule         = var.simulator_schedule
  simulator_signals_per_tick = var.simulator_signals_per_tick
}

module "appsync" {
  source               = "./modules/appsync"
  environment          = var.environment
  cognito_user_pool_id = module.cognito.user_pool_id
  resolver_lambda_arn  = module.lambda.resolver_arn
  worker_role_name     = module.lambda.role_name
}

module "eventbridge" {
  source             = "./modules/eventbridge"
  environment        = var.environment
  worker_lambda_arn  = module.lambda.agent_worker_arn
  worker_lambda_name = module.lambda.agent_worker_name
  worker_role_name   = module.lambda.role_name
}

module "stepfunctions" {
  source            = "./modules/stepfunctions"
  environment       = var.environment
  worker_lambda_arn = module.lambda.agent_worker_arn
}

module "edge" {
  count               = var.enable_edge ? 1 : 0
  source              = "./modules/edge"
  environment         = var.environment
  domain              = var.domain
  acm_certificate_arn = var.acm_certificate_arn
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}
