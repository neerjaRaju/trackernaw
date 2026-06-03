# Development Guide

## Prerequisites

- Node 20+, npm
- Docker 24+ with Docker Compose v2
- Flutter 3.24+ with Android Studio / Xcode for mobile
- PostgreSQL client (optional)
- Terraform 1.9+ (only for cloud deploys)

## First-time setup

```bash
# 1. Clone and configure
git clone <repo> fieldforce && cd fieldforce
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to something random

# 2. Start infra (Postgres, Redis, Kafka, Flink)
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis kafka zookeeper

# 3. Backend
cd backend
npm install
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev      # http://localhost:4000

# 4. Admin panel
cd ../admin-panel
npm install
echo "VITE_GOOGLE_MAPS_KEY=your_key" > .env
npm run dev      # http://localhost:5173 — login admin@demo.test / admin123

# 5. Mobile app (in another terminal)
cd ../mobile-app
flutter pub get
flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api/v1
```

## Running everything in Docker

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

Admin panel served on http://localhost:8080, backend on http://localhost:4000.

## Building the Flink job

```bash
cd kafka/flink-jobs
mvn package
# Submit to the running Flink jobmanager (web UI: http://localhost:8081)
docker compose exec flink-jobmanager flink run -d /opt/flink/usrlib/location-pipeline-1.0.0.jar
```

## Database migrations

```bash
cd backend
npx prisma migrate dev --name <descriptive_name>   # local
npx prisma migrate deploy                          # production
```

## Testing

```bash
# Backend unit + integration
cd backend && npm test

# Flutter
cd mobile-app && flutter test
```

## Deploying to AWS

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=environments/dev/terraform.tfvars
terraform apply -var-file=environments/dev/terraform.tfvars
```

Push backend & admin images to ECR before applying:

```bash
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t fieldforce-backend backend && docker tag ... && docker push ...
```

## Troubleshooting

- **Prisma client out of date:** run `npx prisma generate` after editing schema.
- **Socket connections rejected:** ensure JWT is being passed via `auth: { token }` in client.
- **Flutter location not updating in background:** confirm `ACCESS_BACKGROUND_LOCATION` permission was granted; Android 14+ requires user toggle in settings.
- **Kafka consumer lag:** check Flink job UI at `http://localhost:8081`.
