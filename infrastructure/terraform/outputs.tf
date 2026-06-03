output "backend_url" {
  value = module.ecs.backend_url
}

output "admin_url" {
  value = module.ecs.admin_url
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "s3_bucket" {
  value = module.s3.bucket_name
}
