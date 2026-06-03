terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.60" }
  }
  # Uncomment after creating the state bucket:
  # backend "s3" {
  #   bucket = "fieldforce-tf-state"
  #   key    = "fieldforce/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.region
}

module "vpc" {
  source     = "./modules/vpc"
  name       = "${var.project}-${var.environment}"
  cidr_block = "10.0.0.0/16"
}

module "rds" {
  source            = "./modules/rds"
  name              = "${var.project}-${var.environment}"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnets
  engine_version    = "16.3"
  instance_class    = var.db_instance_class
  allocated_storage = 50
  db_name           = "fieldforce"
  username          = "fieldforce"
  password          = var.db_password
}

module "s3" {
  source = "./modules/s3"
  bucket = "${var.project}-${var.environment}-uploads"
}

module "ecs" {
  source              = "./modules/ecs"
  name                = "${var.project}-${var.environment}"
  vpc_id              = module.vpc.vpc_id
  public_subnets      = module.vpc.public_subnets
  private_subnets     = module.vpc.private_subnets
  backend_image       = var.backend_image
  admin_image         = var.admin_image
  database_url        = "postgresql://fieldforce:${var.db_password}@${module.rds.endpoint}/fieldforce"
  redis_url           = var.redis_url
  jwt_secret          = var.jwt_secret
  jwt_refresh_secret  = var.jwt_refresh_secret
  s3_bucket           = module.s3.bucket_name
  cors_origin         = var.cors_origin
  certificate_arn     = var.certificate_arn
  kafka_brokers       = var.kafka_brokers
}
