# Roadmap

## Phase 1 — MVP (this scaffold)
- [x] Multi-tenant auth (JWT + refresh)
- [x] GPS attendance + geofencing
- [x] Live location tracking (REST + Socket.IO + Kafka/Flink)
- [x] Task management
- [x] Expense claims + approval
- [x] Sales orders + dealer visits
- [x] Admin dashboard
- [x] Flutter app

## Phase 2 — Production hardening
- [ ] Selfie face verification (face_recognition / AWS Rekognition)
- [ ] S3 presigned upload flow for receipts/selfies
- [ ] Full unit + integration test coverage
- [ ] Redis adapter for Socket.IO horizontal scaling
- [ ] CloudWatch + Sentry integration
- [ ] Sentry release tracking on mobile
- [ ] Push notifications wired end-to-end

## Phase 3 — Enterprise features
- [ ] White-label branding per tenant
- [ ] Subscription billing (Stripe)
- [ ] SSO (SAML, OIDC)
- [ ] Audit-log UI
- [ ] ERP webhook integrations (SAP, Tally, Zoho)
- [ ] WhatsApp Business invoice sharing

## Phase 4 — AI / ML
- [ ] Productivity scoring (time-on-task / route efficiency)
- [ ] Route optimization (OR-Tools)
- [ ] Anomaly detection on attendance + location patterns
- [ ] Smart task auto-assignment
