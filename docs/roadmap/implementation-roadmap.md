# Implementation Roadmap — rentiq

**Version**: 1.1 (post-grilling refinement)
**Format**: Each phase ends with a demoable, if incomplete, system. No big-bang integration
at the end.

---

## Phase 0 — Environment & Infrastructure Setup

**Goal**: Both environments running, secrets managed, CI gate established. No application
code yet.

### 0.1 Monorepo Scaffold

- Initialize `pnpm` workspace + Nx at repo root.
- Create `apps/api` (NestJS), `apps/admin-panel` (Next.js), `apps/telegram-bot` (Python),
  `packages/i18n`, `packages/config`.
- Configure Nx `enforce-module-boundaries` lint rules (no cross-layer imports within NestJS
  modules, no `telegram-bot` importing `api` modules directly).
- Configure shared `tsconfig.base.json`, ESLint, Prettier.
- Set up `packages/i18n` with initial `uk/` and `en/` locale folders and empty JSON files.

### 0.2 Production Environment (Docker Compose)

```yaml
# docker-compose.yml — all production services
# postgres:16, redis:7, minio:latest, api, admin-panel, telegram-bot, nginx
```

- Write `docker-compose.yml` covering all production services.
- Configure Postgres with a dedicated `rentiq` database and a non-superuser app role.
- Configure Redis with password authentication and AOF persistence.
- Configure MinIO with a `rentiq-prod` bucket and retention lifecycle rules.
- Configure nginx for TLS termination + routing.
- Write `.env.example` with all required variables and descriptions.

### 0.3 Stage Environment (on host)

- Install Postgres, Redis, MinIO directly on the host at non-production ports.
- Create `rentiq-stage` Postgres database.
- Create separate Redis instance (different port or different Redis DB index).
- Create `rentiq-stage` MinIO bucket.
- Write `.env.stage.example`.
- Create systemd unit file templates for stage: `rentiq-api-stage.service`,
  `rentiq-bot-stage.service` (watchmedo auto-restart).

### 0.4 CI Pipeline

- GitHub Actions (or equivalent) with jobs:
  - `lint`: Nx boundary checks + ESLint.
  - `typecheck`: `tsc --noEmit` for all TS workspaces.
  - `test:unit`: Jest for all modules.
  - `test:e2e`: NestJS e2e tests against a containerized Postgres/Redis.
- All jobs must pass on every PR. No merge without green CI.
- Secret scanning (never commit `.env` files).

### 0.5 Database Migration Setup

- Configure Drizzle ORM with `drizzle-kit generate` + `drizzle-kit migrate`.
- Migration files are generated per schema change and committed to git.
- A migration is run as part of the deployment pipeline before the new binary starts
  (`npm run db:migrate` as a pre-start step in Docker).
- Stage migrations are run manually before each stage deployment.

**Exit criteria**: `docker compose up` starts all services. CI pipeline runs and passes
on an empty commit. Both Postgres databases accessible and empty. MinIO console accessible.

---

## Phase 1 — Shared Kernel + Foundation

**Goal**: The architectural skeleton that every module will build on.

### Deliverables

- `shared-kernel` NestJS module:
  - `Money(amountMinor, currency)` value object with `add`, `subtract`, `equals`.
  - `EntityId<T>` (UUID wrapper), `OrgId`, `PhoneNumber`, `Locale` value objects.
  - `DomainEvent` abstract base class + `EventBus` port.
  - In-process `EventBusImpl` using `@nestjs/event-emitter`.
  - `TenantContext` (AsyncLocalStorage-based) + `TenantMiddleware` that reads `orgId`
    from JWT and injects it into every request.
  - `Result<T, E>` utility class.
  - `@AuditableAction(action: string)` decorator stub (interceptor wired in Phase 9).
  - `ApiError` envelope type + global exception filter.
  - Pagination request/response DTOs.
- Drizzle database connection module with Zod-validated config.
- Global `ConfigModule` with full Zod validation of all env vars (app will not start
  if any required var is missing).
- Health check endpoint: `GET /health` → `{ status: 'ok', db: 'ok', redis: 'ok' }`.

**Exit criteria**: `GET /api/v1/health` returns 200. Zod validation rejects an intentionally
broken `.env`.

---

## Phase 2 — IAM + Organizations

**Goal**: Admin login and multi-tenant organization model working end-to-end.

### Deliverables

- `organizations` module: `Organization` aggregate + `OrganizationRepository` (Drizzle).
  `OrganizationService` with `create`, `getById`, `getBySlug`. Seed script: one
  organization named "rentiq-dev" with slug `rentiq`.
- `iam` module: `AdminAccount` + `Renter` aggregates. `AuthService` (JWT RS256,
  15-min access token, 7-day refresh token). `AdminAccountService`. `RenterService`
  (register, findByTelegramId, updateLocale). Password hashing with bcrypt.
- `POST /api/v1/auth/login` — email + password → JWT pair.
- `POST /api/v1/auth/refresh` — refresh → new access token.
- `POST /api/v1/auth/telegram/exchange` — Telegram ID + org bot secret → renter JWT.
- `POST /api/v1/renters/register`, `GET /api/v1/renters/me`.
- `POST /api/v1/organizations` (SUPER_ADMIN), `PATCH /api/v1/organizations/:id/branding`.
- `POST /api/v1/organizations/:id/maintenance-window` (ORG_ADMIN).
- Seed: one `SUPER_ADMIN` account for local development.
- `nestjs-i18n` wired: locale resolution middleware reads JWT claim, sets locale on
  request context. First translated string: "Invalid credentials" in uk + en.

**Exit criteria**: Admin logs in via Postman, receives JWT, uses it to create a second
organization. Renter registers and receives a renter JWT via the exchange endpoint.

---

## Phase 3 — Locations + Pricing

**Goal**: Station/locker/tariff CRUD, HA gateway tested against a real HA test device
(stage) or a mock (local dev).

### Deliverables

- `locations` module: `Station`, `Locker`, `InventoryKit` aggregates. Drizzle repositories.
  `StationsService`, `LockersService`, `InventoryKitService`.
- `HomeAssistantGateway` implementing `SmartLockGateway` port. Per-station HA connection
  config resolved from `stations.ha_token_ref` (reads from env-vars in v1). Timeouts:
  connect 3s, read 5s.
- `StationHealthChecker`: `@Cron('*/30 * * * * *')` pings each active station's HA. On
  status change → publishes `StationHealthChanged` → (notifications module stubs in Phase 6).
- `LockerAccessService`: `openLocker(lockerId, actorType, actorId)`, `closeLocker(...)`.
  Schedules auto-relock via BullMQ delayed job (`station.autoLockDelaySeconds`).
- Full CRUD API: stations, lockers, inventory kits, tariffs.
- Renter-facing `GET /api/v1/stations?visible=true&active=true` (filters active + working
  + visible; includes locker availability count).
- `LockerReconciliationJob` (startup + `@Cron('0 * * * *')`): finds COMPLETED/CANCELLED
  rentals with non-AVAILABLE lockers and fixes them. Safety net for ADR-010.
- Mock `SmartLockGateway` implementation for local development (no HA required).

**Exit criteria**: Admin panel (or Postman) can create a station, assign lockers, configure
tariffs. `POST /api/v1/lockers/:id/open` physically opens a real test locker on stage.
Station goes offline → `StationHealthChanged` event is logged.

---

## Phase 4 — Media Assets (MinIO)

**Goal**: Photo upload working before it's needed by the rental finish flow.

**Rationale**: Phase before Rentals because `POST /api/v1/rentals/:id/finish/photo` depends
on media storage. Better to validate the upload flow in isolation.

### Deliverables

- `media` module: `MediaAsset` entity, `MediaService`, `MediaController`.
- `MinIOGateway` implementing `ObjectStorageGateway` port.
- `POST /api/v1/media/upload` (authenticated, multipart/form-data, max 10 MB).
  Stores to MinIO at `{orgId}/{ownerType}/{ownerId}/{uuid}.{ext}`. Returns `{ assetId }`.
- `GET /api/v1/media/:assetId/url` — returns a pre-signed URL (15-min TTL).
- `MediaCleanupJob`: `@Cron('0 2 * * *')` — deletes assets past `expiresAt` from both
  MinIO and the DB.
- i18n: "Photo too large" / "Unsupported file type" errors in uk + en.

**Exit criteria**: Upload a JPEG via Postman. Receive an assetId. Request a pre-signed URL.
Open URL in browser and see the photo. Confirm MinIO console shows the object. Run cleanup
job manually with an expired asset and confirm deletion.

---

## Phase 5 — Rentals (State Machine + Timer)

**Goal**: Full rental lifecycle working with a stub payment gateway (always returns "paid").

### Deliverables

- `rentals` module: `Rental`, `RentalLocker`, `Surcharge` aggregates/entities.
  `RentalLifecycleService` (state machine), `OvertimeCalculator`, `RentalBookingService`,
  `RentalFulfilmentService`.
- **Locker reservation**: atomic `UPDATE lockers SET current_rental_id = :id WHERE
  current_rental_id IS NULL` (ADR-008). Atomic multi-locker reservation = all succeed or
  none (DB transaction).
- **Maintenance window check**: in `selectDuration`, call
  `OrganizationService.getMaintenanceWindow()`. If window is active, return
  `MaintenanceWindowActiveError` (translated in uk + en).
- **Stub payment gateway**: `StubPaymentGateway` always returns a fake `checkoutUrl` and
  immediately fires a `PaymentSucceeded` event after 1s (for development only).
- `RentalTimerSweepService`: `@Cron('*/15 * * * * *')`.
  Finds rentals where `now() >= reservationExpiresAt` → cancel.
  Finds rentals where `now() >= pickupDeadlineAt` → auto-start.
  Finds rentals where `now() >= warningAt` → publish `RentalOvertimeWarningIssued`.
- **Finish flow**: `submitFinishPhoto` (links media asset to rental),
  `confirmFinish` (calls `SmartLockGateway.readDoorState` per locker — if HA offline,
  accepts with `doorStateVerified = false` per ADR-010; computes overtime; publishes
  `SurchargeRequired` or `RentalFinished`).
- `rental_status_history` written on every transition.
- All rental API endpoints (see §7 of architecture doc).
- Multi-locale error messages for all business-rule violations.

**Exit criteria**: Full booking flow via Postman — reserve → select duration → stub payment
completes → open locker → photo upload → confirm finish. Rental reaches COMPLETED.
Timer sweep cancels an expired reservation. Overtime surcharge computed correctly for a
test rental that exceeds paid duration.

---

## Phase 6 — Payments (Monobank + Checkbox)

**Goal**: Real payment flow working on stage against Monobank test mode and Checkbox sandbox.

### Deliverables

- `payments` module: `PaymentTransaction`, `FiscalReceipt` entities. All application
  services (see architecture §4.8).
- `MonobankGateway`: `createInvoice`, `verifyWebhook` (ECDSA verification against cached
  public key), `getStatus`. Per-org credentials from `organizations.payment_creds_ref`.
- `CheckboxGateway`: `createReceipt`, `openShift`, `closeShift`, `getReceiptStatus`.
  Per-org config from `organizations.checkbox_config`. Test mode / sandbox URL switch.
- `PaymentWebhookService`: `POST /api/v1/payments/webhook/monobank` — ECDSA verify →
  `SELECT ... FOR UPDATE` on payment row → idempotent status update → publish
  `PaymentSucceeded`/`PaymentFailed`/`PaymentExpired`.
- `ReconciliationService`: `@Cron('*/2 * * * *')` — polls Monobank for PENDING
  transactions older than 2 minutes (one reconciliation owner, ADR-013).
- `FiscalizationService`: subscribes to `PaymentSucceeded` → creates fiscal receipt →
  `FiscalRetryPolicy` handles maintenance window deferral.
- Checkbox shift auto-close: `@Cron` triggered at `Organization.maintenanceWindowStart`.
- `SurchargeRequired` event handler in payments module (ADR-007): creates top-up invoice,
  publishes `PaymentInvoiceCreated`. BullMQ retry on failure.
- `POST /api/v1/surcharges/:id/cancel` (admin, `@AuditableAction`).

**Stage validation checklist**:
- [ ] Real test-mode Monobank invoice generated, QR code scannable.
- [ ] Webhook received and verified on stage URL.
- [ ] Rental transitions to AWAITING_PICKUP on payment confirmation.
- [ ] Checkbox sandbox receipt created, URL returned.
- [ ] Shift auto-close fires at configured time, fiscal receipt deferred, retried after window.
- [ ] Reconciliation sweep picks up a deliberately delayed webhook.
- [ ] Surcharge invoice created asynchronously after `SurchargeRequired`.

**Exit criteria**: End-to-end rental with real test payment, real fiscal receipt on stage.
No double-apply on duplicate webhook delivery (send the same webhook payload twice,
confirm the rental transitions only once).

---

## Phase 7 — Notifications + i18n

**Goal**: Every domain event that should produce a user-visible message does so, in the
correct locale.

### Deliverables

- `notifications` module: `NotificationDispatcher`, `TelegramChannel`.
- `TelegramChannel`: sends messages to Telegram Bot API. Only module allowed to push.
  Uses the per-org bot token from `organizations.telegram_config`.
- Fill `packages/i18n/locales/uk/notifications.json` and `.../en/notifications.json`
  with all notification template strings.
- Subscribe `NotificationDispatcher` to all events in the event catalog (§6 of
  architecture doc). Each event → correct template → locale-aware render → send.
- Admin broadcast: `POST /api/v1/notifications/broadcast` (ORG_ADMIN).
- Surcharge reminder scheduler: BullMQ delayed job, re-queued on each reminder cycle until
  `surcharge.status = SETTLED`.

**Translation coverage required before this phase ships**:
- All rental lifecycle messages (reservation confirmed, pay link, ready for pickup, overtime
  warning, overtime started, finish confirmed, surcharge required, surcharge reminder ×3).
- All payment messages (payment link, receipt delivered, fiscalization deferred, failed).
- All admin alerts (station offline, unauthorized door, unverified finish, fiscal failure).
- All error messages surfaced to renters (locker unavailable, unpaid surcharge blocks booking,
  maintenance window active, door open at finish).

**Exit criteria**: Register a renter with locale `en`. Complete a rental flow. Confirm all
Telegram notifications arrive in English. Switch locale to `uk` and repeat — all messages in
Ukrainian. Admin receives station-offline alert on Telegram when HA is disconnected.

---

## Phase 8 — Telegram Bot

**Goal**: The Telegram bot is a complete, working rental interface for renters — no direct DB
access, no business logic, no legacy SQLite code.

### Approach

Reuse the existing `suppoint-bot` aiogram codebase. Strip everything that is no longer the
bot's responsibility. The bot is restructured as a REST API client with conversation flows.

### What gets removed from the bot

| Legacy code | Replacement |
|---|---|
| All SQLite `db.py` calls | REST API calls via `api_client/` |
| `MemoryStorage` FSM | Redis-backed aiogram storage |
| Payment gateway calls (Monobank URLs) | API returns checkout URL |
| Checkbox calls | API handles fiscalization |
| HA direct calls (locker open/close) | `POST /api/v1/rentals/:id/open-locker` |
| Timer logic, tick counters | API handles all timer state |
| Admin notification dispatching | notifications module handles it |
| Photo upload webhook server | `POST /api/v1/media/upload` |
| HA door webhook handler | `POST /api/v1/webhooks/ha/door-events` |
| APScheduler jobs | Backend BullMQ/Cron jobs |
| Reconciliation loops | `ReconciliationService` in backend |

### What stays in the bot

- Conversation FSM flows: `RegistrationFlow`, `BookingFlow`, `FinishRentalFlow`,
  `SupportFlow`, `MyRentalsFlow`.
- Keyboard and message rendering (Ukrainian/English labels).
- Photo download from Telegram + upload to `POST /api/v1/media/upload`.
- JWT caching per chat session in Redis.
- Bot-specific i18n for button labels and UI structure (not domain content).

### Bot module layout

```
apps/telegram-bot/
├── flows/
│   ├── registration.py
│   ├── booking.py            # station → lockers → duration → pay link
│   ├── finish_rental.py      # photo → door confirm
│   ├── support.py
│   └── my_rentals.py
├── api_client/
│   ├── auth.py
│   ├── rentals.py
│   ├── locations.py
│   ├── media.py
│   └── base.py               # httpx async client, JWT attach, error handling
├── session/
│   └── redis_storage.py      # aiogram Redis FSM storage
├── i18n/
│   ├── uk.json               # button labels and UI-only strings
│   └── en.json
└── bot.py                    # startup, dispatcher, router registration
```

**Exit criteria**: A real Telegram user (non-admin) completes a full rental — register,
book, pay (Monobank test QR), open locker, photo, confirm finish — entirely through the
stripped bot calling the backend API. No direct DB connection in the bot process. Bot
restarts without losing FSM state (verify via Redis).

---

## Phase 9 — Support + Audit Log

**Goal**: Support reports visible in admin panel, every sensitive action recorded in the
audit log.

### Deliverables

- `support` module: `ProblemReport` aggregate, `SupportService`, `SupportController`.
  `POST /api/v1/support/reports` (multipart: description + optional photo).
  `GET /api/v1/support/reports?status=NEW` (admin).
  `PATCH /api/v1/support/reports/:id/resolve` (admin, `@AuditableAction`).
- `audit-log` module: `AuditLogEntry` entity, append-only repository.
  `@AuditableAction` interceptor wired (connects the decorator to the module).
  Sensitive actions to decorate:
  - `RentalFulfilmentService.forceClose`
  - `SurchargeRepository.cancel`
  - `LockersService.adminOpen`, `LockersService.adminClose`
  - `StationsService.toggleVisibility`, `StationsService.toggleActive`
  - `AdminAccountService.create`, `AdminAccountService.disable`
  - `OrganizationService.updateBranding`, `OrganizationService.rotateCredentials`
- `GET /api/v1/audit-log` (ORG_ADMIN, filtered by org_id from JWT).

**Audit log retention job**: `@Cron('0 3 * * *')` — flags entries older than `retentionDays`
(org-configurable, default 365). Hard delete only after the configurable retention window —
no earlier.

**Exit criteria**: Force-close a rental as an admin. Query audit log. Confirm the entry shows
the admin's ID, action `RENTAL_FORCE_CLOSED`, and the rental ID in `targetId`. Verify an
unauthorized admin (STATION_OPERATOR at a different station) cannot see the entry.

---

## Phase 10 — Analytics + Admin Panel

**Goal**: Admin panel has functional dashboards and the analytics module provides real data.

### Deliverables

- `analytics` module: `AnalyticsQueryService` (direct SQL for today/week/month),
  `StatsRollupJob` (subscribes to `RentalFinished`/`PaymentSucceeded`, updates
  `daily_org_stats`). `GET /api/v1/analytics/summary`,
  `GET /api/v1/analytics/export?format=csv`.
- `admin-panel` Next.js app:
  - Authentication (login, refresh, protected routes).
  - Dashboard: rental counts, revenue, active rentals live.
  - Stations view: list stations, toggle visibility/active, view locker status.
  - Locker detail: current rental, manually open/close.
  - Rentals list: filter by status/date/station.
  - Rental detail: timeline, surcharge status, finish photo.
  - Tariffs: CRUD.
  - Users: admin accounts management, renter list.
  - Audit log: searchable, date-filtered.
  - Support reports: open/resolved queue.
  - Org settings: branding, maintenance window, Checkbox config.
- `next-intl` wired in admin panel with uk + en.

**Exit criteria**: Admin logs into the panel. Dashboard shows today's rental count and
revenue. Opens a rental with a finish photo — photo displays (MinIO pre-signed URL). Exports
last 30 days of rentals to CSV.

---

## Phase 11 — Multi-Tenant Hardening

**Goal**: Second organization onboarded. Cross-tenant isolation validated automatically.

### Deliverables

- Onboard a second real (or test) organization via the admin panel.
- **Cross-tenant isolation test suite**: automated e2e tests that run every core flow
  (booking, payment, rental, support report) under two different `orgId`s and assert:
  - `GET /api/v1/rentals/active` for renter of org A returns zero results for org B's rentals.
  - `GET /api/v1/analytics/summary` for admin of org A shows only org A's revenue.
  - `GET /api/v1/audit-log` for admin of org A returns no entries from org B.
  - Webhook for org A's payment does not advance org B's rental.
- Evaluate Postgres Row-Level Security policies — apply if the second org has contractual
  data isolation requirements.
- Per-org Telegram bot tokens: confirm the `auth/telegram/exchange` endpoint correctly
  rejects a renter presenting org A's bot secret against an org B renter.

**Exit criteria**: Cross-tenant test suite passes in CI. All tests green with two orgs active.

---

## Phase 12 — WebSockets + Mobile Readiness

**Goal**: Real-time admin dashboard updates. API contracts stable for a future mobile app.

**Not a rearchitecture** — the event bus and REST API contracts already support this.

### Deliverables

- WebSocket gateway on `apps/api` (`/ws/admin`): subscribes to `LockerStatusChanged`,
  `RentalStarted`, `RentalFinished`, `StationHealthChanged` events; pushes to connected
  admin clients scoped by `orgId`.
- Admin panel connects to WebSocket: rental counts and locker status badges update live
  without page refresh.
- OpenAPI spec generated and published (`apps/api` → `openapi.json`). This is the contract
  document for a future mobile app SDK.
- API versioning review: confirm `v1` contract is stable. Document any breaking-change
  policy.

---

## Migration Plan from `suppoint-bot`

### What to preserve from the legacy codebase

| Legacy artifact | Action |
|---|---|
| `handlers/finishRent.py` photo flow | Port FSM + photo-handling to `flows/finish_rental.py`; replace SQLite + Telegram file_id with `POST /api/v1/media/upload` |
| `handlers/rent.py` booking flow | Port FSM to `flows/booking.py`; replace direct DB calls with REST API |
| `handlers/start.py` (admin panel ~1580 lines) | Do NOT port — replaced by `apps/admin-panel` |
| `services/payments/monobank_client.py` | Reference implementation for `MonobankGateway` — port verified ECDSA signature logic exactly |
| `services/payments/checkbox_client.py` | Reference implementation for `CheckboxGateway` — port shift management exactly |
| `services/payments/payment_service.py` fiscal retry policy | Port `FiscalRetryPolicy` logic; replace duplicated reconciliation loops with single `ReconciliationService` |
| `helper/utilits_funk.py` timer logic | Replace tick counters with absolute-deadline sweep (ADR-003). Business thresholds (5-min warning, grace periods) preserved numerically. |
| `db.py` (51 methods) | Extract schema knowledge; do not port code. Use as reference for understanding legacy status transitions. |
| Ukrainian message strings (`text/` dir, handler strings) | Source for `packages/i18n/locales/uk/notifications.json` content. |
| Legacy status strings (`'Резервація'`, `'Оренда'`, etc.) | Map to new enum values: `RESERVED`, `ACTIVE`, etc. See mapping table below. |
| `monobank-acquiring/*.md` docs | Keep in `apps/api/docs/` as reference for Monobank API details. |
| `payment-description.md`, `rent-description.md` | Keep as domain knowledge reference during Phase 5 and 6. |

### Legacy Status String Mapping

| Legacy (Ukrainian) | New enum value | Note |
|---|---|---|
| `Резервація` | `RESERVED` | Locker reserved, no payment yet |
| `Очікує оплату` | `AWAITING_PAYMENT` | Duration selected, invoice created |
| `Очікування відкриття` | `AWAITING_PICKUP` | Paid, waiting for renter to open |
| `Оренда` | `ACTIVE` | Locker opened, timer running |
| `Очікує доплату` | `AWAITING_SURCHARGE_PAYMENT` | Overtime surcharge owed |
| `Завершено` | `COMPLETED` | Rental complete, locker returned |
| `Скасовано` | `CANCELLED` | Reservation expired or cancelled |

### Data Migration (if any legacy data must be carried over)

If production rentals data needs to be migrated from SQLite to PostgreSQL:

1. Export SQLite `rent` table to CSV.
2. Map Ukrainian status strings to new enums (table above).
3. Convert `timer` tick values to absolute timestamps using `data_create` + ticks × 15s.
4. Generate UUIDs for all new IDs (legacy used integer auto-increment).
5. Insert into `rentals` table; insert `rental_lockers` rows (one per legacy rent row, since
   legacy was already one-row-per-locker).
6. Insert `rental_status_history` with `from_status = null`, `to_status = <current>`,
   `changed_by_type = 'SYSTEM'`, `reason = 'Migrated from legacy suppoint-bot'`.
7. Financial records: `payment_transactions` rows from legacy `payment_file_id` / `file_type`
   — these cannot be migrated to MinIO (file_ids are bot-specific); migrate metadata only
   (`purchase_reference`, `amount_minor`, `status = SUCCESS`).

**If no migration is needed** (clean start with new data): skip steps 1–7. Legacy SQLite
data is preserved as a read-only archive for any disputes.

---

## Definition of Done per Phase

A phase is done when:
- All listed deliverables are implemented.
- Unit tests cover all business-rule-enforcing application services and domain services.
- At least one e2e test covers the phase's primary happy path.
- CI passes (lint, typecheck, unit tests, e2e tests).
- The phase's "exit criteria" scenario is manually verified on stage.
- No known regressions in previously completed phases.

---

## Dependency Timeline

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3
                                        │
                         Phase 4 ◄──────┘
                              │
                         Phase 5 (uses Phase 4 for photo upload)
                              │
                         Phase 6 (replaces stub payment in Phase 5)
                              │
                         Phase 7 (notifications wired to Phase 5+6 events)
                              │
                         Phase 8 (bot calls fully-functional API)
                              │
                    Phase 9 ──┴── Phase 10 (parallel, independent)
                              │
                         Phase 11
                              │
                         Phase 12
```

---

## Key Risks and Mitigations

| Risk | When it bites | Mitigation |
|---|---|---|
| HA test device unavailable on stage | Phase 3 | Keep `MockSmartLockGateway` available at all times for local dev; use HA only on stage |
| Monobank webhook delivery to local dev | Phase 6 | Use ngrok or Cloudflare Tunnel during local dev for webhook endpoint exposure |
| Checkbox sandbox requires live credentials | Phase 6 | Obtain Checkbox sandbox credentials before starting Phase 6; do not share with prod |
| Telegram bot token exhaustion (two envs) | Phase 8 | Create separate `@rentiqprodbot` and `@rentiqstagebot` Telegram bots before Phase 8 begins |
| MinIO storage fills up on a single host | Phase 4+ | Set MinIO retention lifecycle rules immediately in Phase 0; default 1-year retention with cleanup job |
| Drizzle migration conflicts in rapid dev | Phase 1+ | Always run `drizzle-kit generate` + review generated migration before committing; never manually edit migration files |
| In-process event bus = missed events on crash | Phase 5+ | Acceptance: bus is in-process for v1, startup reconciliation jobs (locker, fiscal) cover known idempotency gaps; add persistent bus in future if event loss is observed |
