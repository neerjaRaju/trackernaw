# Architecture

## High-Level Components

```
                  ┌────────────────────────────────────┐
                  │           Flutter Mobile App        │
                  │  (Attendance, GPS, Tasks, Expense) │
                  └───────────────┬────────────────────┘
                                  │ HTTPS / WebSocket
                                  ▼
                  ┌────────────────────────────────────┐
                  │     Node.js + Express API           │
                  │   ┌──────────┐  ┌──────────────┐    │
                  │   │  REST    │  │  Socket.IO   │    │
                  │   └──────────┘  └──────────────┘    │
                  │   JWT, Prisma, Redis, S3, FCM       │
                  └─┬──────┬──────┬──────────┬──────────┘
                    │      │      │          │
                    ▼      ▼      ▼          ▼
                Postgres  Redis  S3       Kafka topic
                                          location-events
                                              │
                                              ▼
                                   ┌────────────────────┐
                                   │ Apache Flink Job   │
                                   │ - dedup            │
                                   │ - idle detection   │
                                   │ - geofence breach  │
                                   └─────────┬──────────┘
                                             │
                                             ▼
                                 Kafka topic: location-enriched
                                             │
                                             ▼
                                   Socket.IO Gateway ─► React Dashboard
```

## Data Flow: Live Tracking

1. Flutter app captures position every 25m of movement (or every 15 min in background).
2. Backend `/location/update` persists ping, caches last-known in Redis (5min TTL), publishes to Kafka.
3. Flink consumes raw events, enriches with movement delta, idle flag, geofence checks, emits to `location-enriched`.
4. Backend's Kafka consumer pushes enriched events to Socket.IO room `company:<id>`.
5. React dashboard subscribes via Socket.IO, updates Google Maps markers in real time.

## Multi-Tenancy

Every domain entity carries `companyId`. All Prisma queries are scoped via `req.user.companyId` injected by `authenticate` middleware. JWT claims include `{ sub, companyId, role }`.

## Authentication

- Access token (15m) + refresh token (7d) flow.
- Refresh tokens are hashed (SHA-256) in DB and can be revoked.
- OTP login (Twilio) for mobile.
- Future: Google OAuth via `/auth/google`.

## Authorization

Role hierarchy:
- `SUPER_ADMIN` — platform owner, can manage tenants
- `COMPANY_ADMIN` — full access within a company
- `MANAGER` — manage their team
- `TEAM_LEAD` — manage direct reports
- `EMPLOYEE` — self-only access

Middleware `authorize(...roles)` gates endpoints.

## Scalability

- API is stateless; scale horizontally behind ALB.
- Sticky sessions or Redis-adapter for Socket.IO when running multiple replicas.
- Kafka with 12 partitions on `userId` key — horizontal scaling for the Flink pipeline.
- Postgres read-replica for analytics queries.

## Observability

- Winston JSON logs → CloudWatch
- Prometheus metrics (TODO)
- Sentry for error tracking (TODO)
