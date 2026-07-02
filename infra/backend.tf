# Remote state in S3 with native locking. The bucket must exist before init.
# `key` is supplied per env/client at init time:
#   terraform init -backend-config="key=dev.tfstate"
terraform {
  backend "s3" {
    bucket       = "stratos-tfstate"
    key          = "PLACEHOLDER.tfstate" # override via -backend-config
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
