# Production environment variables.
# Replace placeholders before `terraform apply`. Secrets should come from your
# secret store (Vault, AWS Secrets Manager) — do NOT commit real values here.

environment       = "prod"
region            = "ap-south-1"            # India region for DPDP data residency
db_instance_class = "db.m6g.large"          # Multi-AZ production sizing
db_password       = "REPLACE_FROM_SECRETS_STORE"

jwt_secret         = "REPLACE_FROM_SECRETS_STORE"   # 32+ random bytes
jwt_refresh_secret = "REPLACE_FROM_SECRETS_STORE"   # 32+ random bytes, different from jwt_secret

cors_origin     = "https://admin.fieldforce.app"
certificate_arn = "arn:aws:acm:ap-south-1:000000000000:certificate/REPLACE_ME"

backend_image = "000000000000.dkr.ecr.ap-south-1.amazonaws.com/fieldforce-backend:REPLACE_TAG"
admin_image   = "000000000000.dkr.ecr.ap-south-1.amazonaws.com/fieldforce-admin:REPLACE_TAG"

redis_url     = "redis://fieldforce-prod.xxxxxx.ng.0001.aps1.cache.amazonaws.com:6379"
kafka_brokers = "b-1.fieldforce-msk.xxxxxx.kafka.ap-south-1.amazonaws.com:9098"
