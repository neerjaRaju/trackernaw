# REST API Reference

Base URL: `/api/v1`. All endpoints (except `/auth/*`) require `Authorization: Bearer <token>`.

## Auth

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/auth/register` | `{ email, password, fullName, companyName, phone? }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken }` |
| POST | `/auth/logout` | `{ refreshToken }` | `{ ok: true }` |
| POST | `/auth/otp/request` | `{ phone }` | `{ ok: true }` |
| POST | `/auth/otp/verify` | `{ phone, otp }` | `{ user, accessToken, refreshToken }` |

## Attendance

| Method | Path | Notes |
|--------|------|-------|
| POST | `/attendance/checkin` | Body: `{ lat, lng, selfieUrl? }` |
| POST | `/attendance/checkout` | Body: `{ lat, lng, selfieUrl? }` |
| GET | `/attendance/today` | Returns today's record or null |
| GET | `/attendance/history?from&to` | Last 100 records |
| GET | `/attendance/team` | All today's company records (manager+) |

## Location

| Method | Path | Notes |
|--------|------|-------|
| POST | `/location/update` | Body: `{ lat, lng, accuracy, speed, battery, isMoving, isMock, recordedAt }`. Returns `422 MOCK_LOCATION` if `isMock` is true; `400` on out-of-range coordinates. Real-GPS-only is enforced. |
| GET | `/location/live` | Last-known for each online user |
| GET | `/location/history/:userId?from&to` | Polyline points |

## Tasks

`GET /tasks`, `POST /tasks`, `GET /tasks/:id`, `PUT /tasks/:id`, `POST /tasks/:id/complete`, `POST /tasks/:id/comments`

## Expenses

`GET /expenses`, `POST /expenses`, `POST /expenses/:id/approve` (manager+), `POST /expenses/:id/reject` (manager+)

## Orders

`GET /orders`, `POST /orders`, `GET /orders/:id`, `PUT /orders/:id/status`

## Visits

`GET /visits`, `POST /visits`, `POST /visits/:id/checkout`

## Users

`GET /users/me`, `GET /users` (manager+), `POST /users` (admin), `PUT /users/:id` (admin), `POST /users/fcm-token`, `GET /users/teammates` (all employees — same-org peers with last-known location for the team map)

## Messages (1:1 chat)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/messages/conversations` | All conversations with last message + unread count |
| GET | `/messages/:peerId?take&before` | History with one peer; auto-marks inbound as read |
| POST | `/messages` | Body: `{ recipientId, body }`. Recipient must be in same company |
| POST | `/messages/:peerId/read` | Mark all messages from peer as read |

Real-time: server emits `chat:new` to recipient's user room and `chat:sent` to sender's other devices.

## SOS / Panic Alerts

| Method | Path | Notes |
|--------|------|-------|
| POST | `/sos` | Body: `{ lat, lng, accuracy?, audioUrl?, note? }`. Triggers FCM push to all managers + Socket.IO `sos:new` event. |
| GET | `/sos?status=ACTIVE` | List alerts (manager+) |
| POST | `/sos/:id/acknowledge` | Mark as seen (manager+) |
| POST | `/sos/:id/resolve` | Mark as resolved (manager+) |

Socket events: `sos:new` (broadcast on trigger), `sos:update` (acknowledge/resolve).

## Reports

| Method | Path | Notes |
|--------|------|-------|
| GET | `/reports/daily?date=YYYY-MM-DD` | JSON daily summary per employee (manager+) |
| GET | `/reports/daily.csv?date=YYYY-MM-DD` | CSV export for payroll |
| GET | `/reports/daily.pdf?date=YYYY-MM-DD` | PDF report for archive |

## Face Verification

| Method | Path | Notes |
|--------|------|-------|
| POST | `/users/face/enroll` | Body: `{ referenceUrl }`. Stores enrolled reference selfie. |

Check-in flow: if a user has an enrolled reference, the selfie posted to `/attendance/checkin` is compared via AWS Rekognition. Failed match returns `422 FACE_MISMATCH`.

## Dynamic Forms

| Method | Path | Notes |
|--------|------|-------|
| GET | `/forms/templates?activeOnly=true` | List form templates |
| GET | `/forms/templates/:id` | Single template with schema |
| POST | `/forms/templates` | Admin only. Body: `{ key, name, schema[] }`. Auto-versions on existing key. |
| POST | `/forms/templates/:id/deactivate` | Soft-disable a template |
| POST | `/forms/submit` | Body: `{ templateId, data, attachments?, refId?, refType?, lat?, lng? }`. Fires `form.submitted` webhook. |
| GET | `/forms/submissions?templateId&refId` | List (employees see own only) |
| GET | `/forms/submissions/:id` | Single submission |

Supported field types: `text`, `number`, `date`, `boolean`, `select`, `multiselect`, `photos`, `signature`.

## Audit Log

| Method | Path | Notes |
|--------|------|-------|
| GET | `/audit?userId&action&entityType&from&to&page&pageSize` | Paginated audit log (admin+). Returns `{ total, page, pageSize, rows }`. |
| GET | `/audit/actions` | Distinct action names for filter dropdowns |

## Webhooks

| Method | Path | Notes |
|--------|------|-------|
| GET | `/webhooks/events` | Supported event types |
| GET | `/webhooks` | List configured hooks (secrets masked) |
| POST | `/webhooks` | Body: `{ name, url, events[] }`. Secret returned **once** on creation. |
| PUT | `/webhooks/:id` | Update name/url/events/isActive |
| DELETE | `/webhooks/:id` | Delete a hook |
| GET | `/webhooks/:id/deliveries` | Last 100 delivery attempts |

Outbound headers on every delivery: `X-FieldForce-Event`, `X-FieldForce-Delivery`, `X-FieldForce-Signature: sha256=<HMAC>`. Auto-disabled after 10 consecutive failures. 3 attempts with exponential backoff (1s, 4s).

## Uploads (S3 presigned)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/uploads/presign` | Body: `{ kind, contentType, filename? }`. Kind one of: `selfie`, `face`, `receipt`, `sos_audio`, `chat`, `task_proof`, `visit`. Returns `{ url, key, publicUrl }`. Client PUTs bytes directly to `url`. |
| GET | `/uploads/download?key=...` | Presigned GET for private objects. Tenant-guarded by companyId prefix. |

## Receipt OCR

| Method | Path | Notes |
|--------|------|-------|
| POST | `/expenses/ocr` | Body: `{ key }`. Runs AWS Textract `AnalyzeExpense` on the receipt at the S3 key. Returns `{ vendor, total, currency, date, raw }`. Stub returns 202 when AWS is not configured. |

## Leaves

| Method | Path | Notes |
|--------|------|-------|
| GET | `/leaves?status=PENDING` | List (employees see their own, managers see team) |
| POST | `/leaves` | Body: `{ type, startDate, endDate, reason, halfDay? }` |
| GET | `/leaves/balance` | Current YTD usage vs allowance per leave type |
| POST | `/leaves/:id/decide` | Body: `{ status: APPROVED\|REJECTED, decisionNote? }`. Team-lead+ only. Approved leaves auto-fill `Attendance.status=ON_LEAVE` for each day. |
| POST | `/leaves/:id/cancel` | Cancel an in-flight request |

Real-time events: `leave:new` (manager's user room), `leave:update` (employee's user room).

## SSO (OIDC)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/auth/sso/providers` | List configured providers (`["azure","salesforce"]`) |
| GET | `/auth/sso/:provider` | Redirect to IdP authorization URL. Optional `?companyId=` hint. |
| GET | `/auth/sso/:provider/callback` | IdP redirect target. Issues JWT and redirects to admin panel `/login#access=...&refresh=...`. |

## DPDP — data-subject endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/me/consent` | Caller's consent history |
| POST | `/me/consent` | Body: `{ type, granted, purpose, policyVersion }` |
| GET | `/me/export` | Download all my data as JSON |
| POST | `/me/erasure` | Anonymize immediately + schedule purge. Body: `{ reason? }` |

Every action is written to `AuditLog` with IP and user-agent for compliance evidence.

## Geofences

| Method | Path | Notes |
|--------|------|-------|
| GET | `/geofences` | List company fences (all roles) |
| POST | `/geofences` | Body: `{ name, lat, lng, radiusM, type }`. Manager+ only |
| PUT | `/geofences/:id` | Manager+ only |
| DELETE | `/geofences/:id` | Admin+ only |

## Heatmap & Routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/dashboard/heatmap?days=30` | Grid-aggregated location density `[{ lat, lng, weight }]` (manager+) |
| GET | `/location/route/:userId?day&radiusM&minMinutes` | Per-day polyline + computed stops + total km |

## Dashboard

`GET /dashboard/summary`, `GET /dashboard/attendance-trend` (manager+)

## Socket.IO Events

Client connects with `auth: { token }`. Joins room `company:<id>` automatically.

| Event | Direction | Payload |
|-------|-----------|---------|
| `attendance:update` | server → client | Attendance record |
| `location:update` | server → client | `{ userId, lat, lng, ... }` |
| `location:stream` | server → client | Flink-enriched ping with `deltaMeters`, `idle` |
| `task:new` | server → user | New task assigned |
| `chat:new` | server → recipient | Incoming message `{ id, senderId, body, createdAt }` |
| `chat:sent` | server → sender's other devices | Echo of sent message for multi-device sync |
