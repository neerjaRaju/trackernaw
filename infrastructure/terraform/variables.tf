variable "project" {
  type    = string
  default = "fieldforce"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "redis_url" {
  type    = string
  default = "redis://elasticache:6379"
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "backend_image" {
  type = string
}

variable "admin_image" {
  type = string
}

variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
}

variable "cors_origin" {
  type        = string
  description = "Exact origin allowed by CORS (e.g. https://admin.fieldforce.app)"
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for the ALB HTTPS listener (must be in same region)"
}

variable "kafka_brokers" {
  type    = string
  default = ""
}
