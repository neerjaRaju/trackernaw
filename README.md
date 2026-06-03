# Field Force Management Platform

A complete SaaS Field Force Management platform (Unolo-style) for attendance, live GPS tracking, task management, expense claims, sales visits, and analytics.

## Architecture

```
Flutter App  ──►  Backend API (Node.js + Express)
     │                  │
     ▼                  ├──► PostgreSQL (Prisma ORM)
   Kafka                ├──► Redis (sessions, cache)
     │                  └──► Socket.IO Gateway
     ▼                          │
   Flink                        ▼
     │                  React Admin Dashboard
     ▼
 Socket.IO Gateway
```

## Monorepo Layout

| Folder | Purpose |
|--------|---------|
| `backend/` | Node.js + Express + Prisma REST/WebSocket API |
| `admin-panel/` | React + TypeScript + Vite + MUI admin dashboard |
| `mobile-app/` | Flutter app for field employees (iOS + Android) |
| `kafka/` | Kafka producer configs + Flink stream processing jobs |
| `infrastructure/` | Terraform AWS modules + Docker Compose |
| `.github/workflows/` | CI/CD pipelines |
| `docs/` | Architecture and developer documentation |

## Quick Start

### Local development with Docker Compose

```bash
cp .env.example .env
docker compose -f infrastructure/docker/docker-compose.yml up -d
cd backend && npm install && npx prisma migrate dev && npm run dev
cd ../admin-panel && npm install && npm run dev
```

### Mobile app

```bash
cd mobile-app
flutter pub get
flutter run
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | Flutter |
| Admin Panel | React + TypeScript + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL via Prisma |
| Cache/Sessions | Redis |
| Real-time | Socket.IO |
| Streaming | Kafka + Apache Flink |
| Maps | Google Maps |
| Push | Firebase Cloud Messaging |
| Cloud | AWS (ECS, RDS, S3, CloudFront) |
| IaC | Terraform |
| CI/CD | GitHub Actions |

## Modules

1. Authentication & multi-tenant user management
2. GPS + selfie attendance with geo-fencing
3. Real-time live location tracking
4. Task assignment & completion proof
5. Expense claims with auto mileage
6. Sales visits & order management
7. Admin dashboard & analytics
8. Push / SMS / email notifications
9. Offline-first mobile sync
10. AI-assisted productivity scoring (roadmap)

## License

MIT
