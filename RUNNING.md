# Field Force Platform — How to Run

End-to-end guide for getting every component of the platform up: backend API, PostgreSQL + Redis + Kafka infrastructure, React admin dashboard, Flutter mobile app, Apache Flink streaming job, and AWS deployment via Terraform.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Project layout](#2-project-layout)
3. [Quick start (60-second smoke test)](#3-quick-start-60-second-smoke-test)
4. [Full local setup, component by component](#4-full-local-setup-component-by-component)
5. [Environment variables explained](#5-environment-variables-explained)
6. [Database migrations and seed data](#6-database-migrations-and-seed-data)
7. [Default credentials and demo data](#7-default-credentials-and-demo-data)
8. [Running everything in Docker Compose](#8-running-everything-in-docker-compose)
9. [Flink streaming pipeline](#9-flink-streaming-pipeline)
10. [Mobile app — Android emulator + physical device](#10-mobile-app--android-emulator--physical-device)
11. [End-to-end smoke test](#11-end-to-end-smoke-test)
12. [Production deployment on AWS](#12-production-deployment-on-aws)
13. [Common operations](#13-common-operations)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

Install the following before you start. Versions listed are what the project is tested against — newer is fine.

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 20+ | Backend API + admin panel build |
| npm | 10+ | Comes with Node |
| Docker | 24+ | Postgres, Redis, Kafka, Flink locally |
| Docker Compose | v2 | Multi-container orchestration |
| Flutter SDK | 3.24+ | Mobile app (also installs Dart) |
| Android Studio | latest | Android emulator + SDK |
| Xcode | latest | iOS builds (macOS only) |
| Git | 2.x | Source control |
| AWS CLI | v2 | Production deploys (optional locally) |
| Terraform | 1.9+ | Production infra (optional locally) |
| Java JDK | 11+ | Building the Flink job (optional) |
| Maven | 3.8+ | Building the Flink job (optional) |

Verify in one go:

```bash
node -v && npm -v && docker -v && docker compose version && flutter --version && git --version
```

---

## 2. Project layout

```
trackingNew/
├── backend/                  Node + Express + Prisma API
│   ├── prisma/               schema.prisma, migrations, seed
│   └── src/
│       ├── controllers/      Per-domain handlers (auth, attendance, etc.)
│       ├── routes/           Express routers
│       ├── services/         Reusable: face, OCR, S3 upload, webhooks
│       ├── sockets/          Socket.IO server
│       └── jobs/             Kafka consumers, scheduled tasks
├── admin-panel/              React + Vite + TS + MUI dashboard
├── mobile-app/               Flutter app (Android primary, iOS scaffold)
├── kafka/flink-jobs/         Java/Maven Flink streaming job
├── infrastructure/
│   ├── docker/               docker-compose.yml for local dev
│   └── terraform/            AWS modules (VPC, RDS, S3, ECS)
├── .github/workflows/        CI: backend, admin, mobile, terraform
├── docs/                     ARCHITECTURE, API, ROADMAP, BRD-001
├── .env.example              Copy to .env and fill in
├── README.md
└── RUNNING.md                This file
```

---

## 3. Quick start (60-second smoke test)

If you just want to see the admin panel + backend running with demo data:

```bash
# 1. From the repo root
cp .env.example .env

# 2. Start Postgres + Redis only
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis

# 3. Backend
cd backend
npm install
npx prisma migrate dev --name init       # creates the schema
node prisma/seed.js                       # creates demo company + users
npm run dev                               # http://localhost:4000

# 4. In a second terminal: admin panel
cd admin-panel
npm install
npm run dev                               # http://localhost:5173

# 5. Open http://localhost:5173 and log in
#    Email:    admin@demo.test
#    Password: admin123
```

That's it for a smoke test. Continue below for the full setup.

---

## 4. Full local setup, component by component

### 4.1 Backend API

```bash
cd backend
npm install
```

Generate the Prisma client and apply schema:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Seed demo data:

```bash
node prisma/seed.js
```

Start the API in watch mode:

```bash
npm run dev
```

Endpoints:

- REST: `http://localhost:4000/api/v1/...`
- Health: `http://localhost:4000/health`
- Socket.IO: `ws://localhost:4000/socket.io/`
- Prisma Studio (DB GUI): `npx prisma studio` → `http://localhost:5555`

### 4.2 Admin panel

```bash
cd admin-panel
npm install
```

Create the local env file:

```bash
echo "VITE_GOOGLE_MAPS_KEY=your_google_maps_api_key_here" > .env
```

Run:

```bash
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` and `/socket.io` to the backend on port 4000, so the two services play nicely with no CORS configuration.

### 4.3 Mobile app

```bash
cd mobile-app
flutter pub get
```

Run on an Android emulator (recommended for desktop dev):

```bash
flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api/v1 \
            --dart-define=SOCKET_BASE=http://10.0.2.2:4000
```

`10.0.2.2` is the magic address an Android emulator uses to reach the host machine's `localhost`. On a physical device, replace it with your machine's LAN IP, e.g. `http://192.168.1.42:4000/api/v1`.

For iOS simulator:

```bash
flutter run --dart-define=API_BASE=http://localhost:4000/api/v1 \
            --dart-define=SOCKET_BASE=http://localhost:4000
```

### 4.4 Flink streaming job

This is optional for development — the backend works without it, the Kafka consumer in the API will simply find no messages on the enriched topic. To run it:

```bash
cd kafka/flink-jobs
mvn clean package
```

That produces `target/location-pipeline-1.0.0.jar`. Submit it to a running Flink cluster (started by docker-compose, see Section 8):

```bash
docker compose -f ../../infrastructure/docker/docker-compose.yml exec flink-jobmanager \
  flink run -d /opt/flink/usrlib/location-pipeline-1.0.0.jar
```

Flink Web UI: `http://localhost:8081`.

---

## 5. Environment variables explained

All variables live in `.env` at the repo root. The backend, Docker Compose, and the seed script read from this single file.

| Variable | Purpose | Required for |
|----------|---------|--------------|
| `DATABASE_URL` | Postgres connection string | Always |
| `REDIS_URL` | Redis connection | Always |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing | Always |
| `PORT`, `CORS_ORIGIN` | Server config | Always |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` | S3 presigned uploads | Receipt/selfie/SOS audio uploads |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | FCM push | Mobile push notifications |
| `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS | OTP login, SOS SMS fallback |
| `SENDGRID_API_KEY`, `EMAIL_FROM` | Email | Password reset, notifications |
| `GOOGLE_MAPS_API_KEY` | Maps | Distance computation (server-side optional) |
| `KAFKA_BROKERS`, `KAFKA_LOCATION_TOPIC` | Streaming | Live tracking pipeline |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | SSO | Azure AD login |
| `SALESFORCE_DOMAIN`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` | SSO | Salesforce login |
| `SSO_REDIRECT_BASE`, `ADMIN_PANEL_URL` | SSO redirect URLs | SSO callbacks |

**Minimum for local dev:** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`. Everything else has dev-mode stubs that return harmless results when unset (e.g. face verification auto-passes, OCR returns null, Kafka is skipped).

The admin panel has its own `.env` with `VITE_GOOGLE_MAPS_KEY` and `VITE_API_BASE`.

---

## 6. Database migrations and seed data

Prisma manages everything. From the `backend/` directory:

```bash
# After editing prisma/schema.prisma:
npx prisma migrate dev --name <descriptive_name>      # creates migration + runs it (dev)

# In production / CI:
npx prisma migrate deploy                              # runs pending migrations only

# Inspect / edit data:
npx prisma studio                                      # http://localhost:5555

# Reset everything (DESTRUCTIVE):
npx prisma migrate reset                               # drops + recreates + reseeds
```

After every schema change, regenerate the client:

```bash
npx prisma generate
```

The seed script (`prisma/seed.js`) creates:

- Company **Demo Co** with subdomain `demo`
- One admin user: `admin@demo.test` / `admin123`
- One employee user: `employee@demo.test` / `emp123` (manager = admin)
- One geofence at Delhi (28.6139, 77.209) with 200m radius

Run it manually:

```bash
node prisma/seed.js
```

---

## 7. Default credentials and demo data

| Email | Password | Role |
|-------|----------|------|
| admin@demo.test | admin123 | COMPANY_ADMIN |
| employee@demo.test | emp123 | EMPLOYEE |

**Change these before any real deployment.** They exist purely so the smoke test works without configuration.

---

## 8. Running everything in Docker Compose

For a one-command stack with all dependencies:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

This starts:

| Service | Port | Purpose |
|---------|------|---------|
| `postgres` | 5432 | Database |
| `redis` | 6379 | Cache + sessions + presence |
| `zookeeper` | 2181 | Kafka coordinator |
| `kafka` | 9092 (internal), 9094 (host) | Event stream |
| `flink-jobmanager` | 8081 | Flink web UI |
| `flink-taskmanager` | — | Flink workers |
| `backend` | 4000 | Express API + Socket.IO |
| `admin-panel` | 8080 | nginx-served React build |

Run only the data plane (so you can run backend/admin on the host with hot reload):

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis kafka zookeeper
```

Shut down and wipe volumes:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down -v
```

---

## 9. Flink streaming pipeline

The pipeline processes location pings in real time:

```
Mobile app → POST /location/update → Backend → Kafka (location-events)
                                                    ↓
                                           Flink (LocationPipelineJob)
                                                    ↓
                                          Kafka (location-enriched)
                                                    ↓
                                Backend consumer → Socket.IO → Admin map
```

The Flink job adds `deltaMeters`, `deltaMs`, and an `idle` flag to each ping. Build it:

```bash
cd kafka/flink-jobs
mvn clean package -DskipTests
```

Then either:

- **Run locally with Docker Flink (already in compose):**
  ```bash
  docker cp target/location-pipeline-1.0.0.jar trackingnew-flink-jobmanager-1:/opt/flink/
  docker compose -f infrastructure/docker/docker-compose.yml exec flink-jobmanager \
    flink run -d /opt/flink/location-pipeline-1.0.0.jar
  ```
- **Run as a standalone Java process (no Docker):**
  ```bash
  KAFKA_BROKERS=localhost:9092 java -jar target/location-pipeline-1.0.0.jar
  ```

You can skip this entirely during local development — the backend Kafka consumer just sees no messages on the enriched topic, and the admin live map uses the raw `location:update` socket event instead.

---

## 10. Mobile app — Android emulator + physical device

### Android Studio emulator

1. In Android Studio open Tools → AVD Manager → Create a Pixel 6 / API 33+ device.
2. Boot it and verify `adb devices` lists it.
3. From `mobile-app/`:
   ```bash
   flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api/v1 \
               --dart-define=SOCKET_BASE=http://10.0.2.2:4000
   ```

### Physical Android device

1. Enable Developer Options → USB Debugging.
2. Plug into your computer, accept the RSA fingerprint.
3. Find your host machine's LAN IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).
4. Run with your LAN IP:
   ```bash
   flutter run --dart-define=API_BASE=http://192.168.1.42:4000/api/v1 \
               --dart-define=SOCKET_BASE=http://192.168.1.42:4000
   ```
5. Your firewall must allow inbound 4000 from the LAN.

### Google Maps key

The mobile app's Google Maps view needs an Android Maps API key in `mobile-app/android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_KEY"/>
```

Set up an Android-restricted key in Google Cloud Console with Maps SDK for Android enabled.

### Permissions checklist

Android 13+: the app will prompt at runtime for Camera, Location (foreground + background), and Notifications. Grant all three. For background location specifically the user must visit Settings → Apps → Field Force → Permissions → Location and choose "Allow all the time" — Android no longer lets apps request this in-flow.

### iOS simulator (macOS only)

```bash
flutter run -d "iPhone 15" --dart-define=API_BASE=http://localhost:4000/api/v1 \
                            --dart-define=SOCKET_BASE=http://localhost:4000
```

Note: real-GPS-only enforcement uses `Position.isMocked` on Android. iOS doesn't expose a comparable flag, so iOS spoofing protection relies on the Apple sandbox + future Play-Integrity-equivalent attestation (DeviceCheck).

---

## 11. End-to-end smoke test

After the quick start above, walk through this in 5 minutes to confirm everything works:

1. **Admin login.** Open `http://localhost:5173`, log in as `admin@demo.test` / `admin123`. You should see the dashboard with placeholder zeros.
2. **Create a geofence.** Go to Geofences, click on the map, name it "Office", save.
3. **Mobile login.** In the Flutter app, log in as `employee@demo.test` / `emp123`.
4. **Check in.** Tap the Attendance tab, then "Check In with Selfie", grant camera + location, take a selfie. The check-in completes; location stream starts.
5. **Watch the live map.** Switch back to the admin browser tab, open Live Map. You should see a marker for the employee within five seconds.
6. **Send a message.** In the mobile app go to the Team tab, tap the admin's avatar, send "Hello from the field". On the admin browser, the message would arrive (admin-side chat UI is on the roadmap — verify by inspecting `/api/v1/messages/conversations`).
7. **Trigger SOS.** Long-press the red SOS button in the mobile app for 1 second. The admin's Live Map and SOS Alerts page should both light up immediately.
8. **Submit an expense.** Mobile → Expenses → "+" → submit Travel ₹250. Admin → Expenses → click Approve.
9. **Download the daily report.** Admin → Reports → today's date → Download CSV. Open the CSV; the employee row should show one check-in and one expense.
10. **Inspect audit log.** Admin → Audit Log. The login, check-in, expense submission, and SOS should all be there.

If all ten steps work, the platform is wired up correctly.

---

## 12. Production deployment on AWS

### One-time setup

1. Create the Terraform state S3 bucket and DynamoDB lock table (or remove the `backend "s3"` stanza from `main.tf` for state in local file).
2. Push backend + admin Docker images to ECR:

   ```bash
   aws ecr create-repository --repository-name fieldforce-backend
   aws ecr create-repository --repository-name fieldforce-admin

   $(aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com)

   docker build -t fieldforce-backend backend
   docker tag  fieldforce-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/fieldforce-backend:latest
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/fieldforce-backend:latest

   docker build -t fieldforce-admin admin-panel
   docker tag  fieldforce-admin:latest <account>.dkr.ecr.us-east-1.amazonaws.com/fieldforce-admin:latest
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/fieldforce-admin:latest
   ```

3. Fill in `infrastructure/terraform/environments/dev/terraform.tfvars` with your image URIs and DB password.

### Deploy

```bash
cd infrastructure/terraform
terraform init
terraform plan  -var-file=environments/dev/terraform.tfvars
terraform apply -var-file=environments/dev/terraform.tfvars
```

The Terraform modules create:

- VPC with 2 public + 2 private subnets across two AZs
- RDS Postgres (Multi-AZ, encrypted, in private subnets)
- S3 bucket for uploads (encrypted, versioned, public access blocked)
- ECS Fargate cluster + ALB
- Security groups stitching it all together

After `apply`, outputs include `backend_url`, `admin_url`, `rds_endpoint`, `s3_bucket`. Run migrations once against RDS:

```bash
DATABASE_URL='postgresql://...' npx prisma migrate deploy
```

### CI/CD

The four GitHub Actions workflows in `.github/workflows/` run on push:

- `backend.yml` — installs deps, runs migrations against a service Postgres, runs tests, builds + pushes Docker on `main`.
- `admin-panel.yml` — TypeScript + Vite build.
- `mobile-app.yml` — `flutter analyze` + `flutter test`.
- `terraform.yml` — `terraform validate` on PRs touching infra.

Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (or AWS_* secrets for ECR push) to the repo secrets.

---

## 13. Common operations

### Create a new user

```bash
# As admin from the admin panel: Employees → Add
# Or via API:
curl -X POST http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","password":"secret","fullName":"New User","role":"EMPLOYEE"}'
```

### Add a webhook

Admin → Webhooks → New webhook. Pick events, paste your endpoint URL, save. **Copy the signing secret immediately** — it's shown only once. Verify deliveries by computing HMAC-SHA256 of the request body with that secret and comparing against `X-FieldForce-Signature`.

### Create a custom form template

Admin → Forms → New template. Paste a JSON array of field definitions. Supported field types: `text`, `number`, `date`, `boolean`, `select`, `multiselect`, `photos`, `signature`. Each field needs `id`, `label`, `type` and optional `required`, `min`, `max`, `options`.

### Export an employee's data (DPDP)

The employee themselves: Privacy page → "Download my data".

As admin via API:

```bash
curl http://localhost:4000/api/v1/me/export \
  -H "Authorization: Bearer $USER_JWT" -o user-data.json
```

### Backup the database

```bash
docker compose -f infrastructure/docker/docker-compose.yml exec postgres \
  pg_dump -U fieldforce fieldforce > backup-$(date +%F).sql
```

### View logs

```bash
docker compose -f infrastructure/docker/docker-compose.yml logs -f backend
docker compose -f infrastructure/docker/docker-compose.yml logs -f admin-panel
```

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `PrismaClient is not generated` | Forgot `prisma generate` | `cd backend && npx prisma generate` |
| Backend startup error `P1001` | Postgres not running | `docker compose up -d postgres` |
| Admin shows blank map | Missing Google Maps key | Set `VITE_GOOGLE_MAPS_KEY` in `admin-panel/.env` |
| Mobile can't reach backend | `10.0.2.2` only works on Android emulator; physical devices need LAN IP | Run with `--dart-define=API_BASE=http://<LAN-IP>:4000/api/v1` |
| Background tracking stops after a few minutes | Android OEM aggressive battery savers (Xiaomi, Oppo, Vivo) | Go to Settings → Battery → Field Force → "Allow background activity" + "No restrictions" |
| Mock-location check fails on emulator | Emulator GPS is fundamentally simulated and may be flagged as mock | Set `IS_MOCK_ALLOWED_FOR_DEV=true` (then turn off before release) or test on a physical device |
| Selfie check-in returns 422 FACE_MISMATCH | User has an enrolled face that doesn't match | Re-enroll via `/users/face/enroll` or temporarily clear `avatarUrl` |
| Webhook deliveries marked failed | Receiver returning non-2xx, or timing out (>8s) | Inspect deliveries page; check your endpoint logs |
| Live map markers don't update | Socket.IO connection rejected | Check browser console for token errors; verify `JWT_SECRET` matches between API and admin |
| Kafka consumer "ECONNREFUSED" | `KAFKA_BROKERS` set but Kafka not running | Either run Kafka in compose or unset the env var to skip |
| `npm install` fails on `sharp` or `bcrypt` | Native build deps missing | macOS: `xcode-select --install`. Linux: `sudo apt install build-essential python3` |
| `flutter run` hangs at "Running Gradle task" | First-run downloads | Wait — it's pulling Gradle, AGP, dependencies. ~5-10 min on first launch |
| Prisma migrate fails with "drift detected" | Schema and DB out of sync | In dev: `npx prisma migrate reset`. In production: write a manual migration |

---

## Glossary of the moving parts

- **Backend** — the Node + Express API that does most of the work. Port 4000.
- **Admin panel** — React SPA for managers. Port 5173 in dev, served by nginx on 80 in prod.
- **Mobile app** — Flutter app for field agents. Connects to backend over HTTPS in prod.
- **Postgres** — the canonical store. All facts live here.
- **Redis** — short-lived state: presence (5min TTL per user), OTPs, SSO state, rate-limit counters.
- **Kafka** — the event bus. Location pings flow here; Flink processes them; the backend re-broadcasts enriched events over Socket.IO.
- **Flink** — stateful stream processor. Computes movement delta, idle flag, and is where future anomaly detection / geofence-breach computation will live.
- **Socket.IO** — real-time bidirectional channel. Lives inside the backend Node process, rooms per company + per user.
- **S3** — selfies, receipts, SOS audio, chat attachments. Bytes never traverse the API server — clients use presigned PUT URLs.
- **AWS Rekognition** — face verification at check-in.
- **AWS Textract** — receipt OCR.
- **AWS Cognito / Azure AD / Salesforce** — SSO via OIDC.
- **FCM (Firebase Cloud Messaging)** — push notifications to mobile.
- **Twilio** — SMS for OTP login + SOS fallback.
- **Terraform** — describes the AWS production environment as code.

---

## 15. Production readiness — what the codebase enforces

The platform now enforces the following in `NODE_ENV=production`. These are **hard refusals** — the process will not start or the request will fail if any of these is violated:

| Guarantee | How it's enforced |
|-----------|-------------------|
| Strong JWT secrets | `src/utils/jwt.js` throws on startup if `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing, shorter than 32 chars, equal to a known weak value, or identical to the refresh secret. |
| Locked-down CORS | `src/app.js` throws if `CORS_ORIGIN` is `*` or unset in production. |
| HSTS + strict CSP | Helmet ships HSTS (1 year, preload) and a default-deny CSP. |
| No silent face-verify bypass | `faceService.compareFaces()` throws `503 FACE_SERVICE_UNAVAILABLE` in prod if AWS Rekognition isn't configured — refuses to silently return `verified: true`. |
| No silent OCR bypass | `ocrService.analyzeReceipt()` throws `503 OCR_SERVICE_UNAVAILABLE` in prod if Textract isn't configured. |
| No local-disk upload fallback | `uploadService.presignUpload()` throws `503 UPLOAD_SERVICE_UNAVAILABLE` in prod if S3 isn't configured. |
| Account lockout | 5 failed logins → 15-min lock per email, tracked in Redis. Every failure + lock event written to `AuditLog`. |
| Mock-GPS rejection | Android SDK drops mock fixes at source; Flutter app drops `Position.isMocked`; backend rejects `isMock=true` with `422 MOCK_LOCATION`. |
| Socket.IO horizontal scale | `@socket.io/redis-adapter` required in prod — startup throws if it fails to initialize. Without it, events on one node wouldn't reach clients on another. |
| Graceful shutdown | SIGTERM handler closes HTTP, Socket.IO, Prisma, and Redis within a 25s deadline (ECS gives 30s). |

### Pre-flight checklist before going live

Run through these in order. Each line is something the codebase will let you skip in dev but will fail in production:

1. **Secrets.** `JWT_SECRET` and `JWT_REFRESH_SECRET` set to 32+ random bytes each, different from each other, sourced from your secret store of choice (this codebase reads from env vars — wire it to whatever your platform uses).
2. **CORS.** `CORS_ORIGIN` set to the exact admin panel origin, e.g. `https://admin.fieldforce.app`. No wildcard.
3. **AWS.** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` all set. IAM role on ECS tasks gives Rekognition + Textract + S3 access (the Terraform module wires this).
4. **TLS.** ACM certificate created in the same region as the ALB, ARN provided to `certificate_arn` Terraform variable. HTTP automatically redirects to HTTPS.
5. **WAF.** Created by Terraform with AWS managed common-rule set + per-IP rate limit at 2000 req/5min.
6. **Database migrations.** `npx prisma migrate deploy` run against the prod RDS once before the first deploy.
7. **Worker service.** A separate ECS service running `node src/worker.js` consumes the Kafka enriched stream and fans out to Socket.IO across all API replicas via the Redis adapter.
8. **Run the test suite in CI.** `npm test` requires a test Postgres + Redis. The Jest config enforces 60% coverage threshold.
9. **Sanity-check `/health/ready`.** Once deployed, hit `https://api.fieldforce.app/health/ready` — every dependency (Postgres, Redis, Kafka) must report `ok`. ALB target group health-checks this endpoint.
10. **Smoke test the prod-only refusals.** Try starting the backend with `JWT_SECRET=change-me` and `NODE_ENV=production` — it must refuse to boot. Try calling `/attendance/checkin` with AWS Rekognition disabled — it must return `503`. These are guard rails; verify they work.

### Running the test suite

```bash
cd backend
# Create the test database (one-time)
createdb fieldforce
TEST_DATABASE_URL=postgresql://fieldforce:fieldforce@localhost:5432/fieldforce npm test
```

The suite covers authentication, password validation, account lockout flow, tenant isolation across companies, RBAC enforcement, mock-GPS rejection, geofence detection, Haversine math, stop-cluster detection, attendance check-in/out lifecycle, and dual-checkin prevention. Coverage threshold is 60% lines / 60% functions; CI fails below that.

### What this codebase still does NOT do for you

These are operational concerns the codebase can't enforce — your platform team owns them:

- Provisioning the actual secrets. The code reads from env vars; how those get populated (Secrets Manager, Parameter Store, sealed-secrets, K8s secrets) is your call.
- Backup automation beyond RDS automated snapshots. Cross-region replication for DR is not configured.
- Log aggregation. Logs go to CloudWatch via the ECS log driver; if you want them in your SIEM, set up the subscription.
- VAPT. The Terraform-deployed WAF stops common attacks but is not a substitute for a real penetration test before BFSI deployment.
- DPDP data-residency. The Terraform module defaults to `us-east-1` — for India production, override `region = "ap-south-1"` in `terraform.tfvars`.
- DR exercise. The platform supports it (RDS Multi-AZ, S3 versioning, Terraform reproducible) but you need to actually rehearse a failover.
