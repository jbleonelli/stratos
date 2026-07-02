provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "stratos"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
