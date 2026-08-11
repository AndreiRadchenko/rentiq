# Greenfield Architecture — rentiq

**Version**: 1.1 (post-grilling refinement)
**Source**: Reverse-engineered from `suppoint-bot` legacy + grilling session.
**Scope**: System architecture, module boundaries, technology choices, and Architecture Decision Records.

---

## 1. System Context

### 1.1 What rentiq Does

rentiq is a **multi-tenant SaaS platform** for managing time-based rentals of physical
equipment stored in smart lockers. Each tenant (Organization) is a rental operator with their
own branding, stations, pricing, and payment credentials.

**Primary domain** (v1): SUP (Stand-Up Paddleboard) rental at outdoor stations in Ukraine.

**Core integrations**:

| External System | Purpose | Authentication |
|---|---|---|
| Telegram Bot API | Customer-facing interface (booking, pickup, return) | Bot token per org |
| Home Assistant (per station) | Smart locker open/close + door sensor | Per-station HA token |
| Monobank Acquiring | Online payment collection | Per-org merchant credentials |
| Checkbox.ua | Fiscal receipt issuance (legally required in Ukraine) | Per-org license key |
| MinIO | Media file storage (finish-rental photos, support attachments) | Internal service credentials |

**Legacy system**: `suppoint-bot` (Python, aiogram 3.x, SQLite, single-tenant, no admin panel,
no audit trail, fragile tick-based timers, Telegram file_ids as "storage"). All business logic
is preserved rule-for-rule; no implementation decisions are carried forward.

### 1.2 System Diagram

```
┌─────────────────┐  REST/JWT  ┌────────────────────────────────────────────────────────┐
│  Next.js Admin  │◄──────────►│                                                        │
│  Panel          │            │           NestJS Modular Monolith (apps/api)            │
└─────────────────┘            │                                                        │
                               │  shared-kernel: Money, TenantContext, EventBus,         │
┌─────────────────┐  REST/JWT  │                Result, DomainEvent                     │
│  Telegram Bot   │◄──────────►│                                                        │
│  (thin client,  │            │  ┌──────┐ ┌───────────────┐ ┌──────────┐ ┌─────────┐  │
│  separate proc) │            │  │ iam  │ │ organizations │ │locations │ │ pricing │  │
└─────────────────┘            │  └──────┘ └───────────────┘ └──────────┘ └─────────┘  │
                               │  ┌─────────┐ ┌──────────┐ ┌───────────────────────┐   │
┌─────────────────┐  (future)  │  │ rentals │ │ payments │ │     notifications     │   │
│  Mobile App     │◄──────────►│  └─────────┘ └──────────┘ └───────────────────────┘   │
└─────────────────┘            │  ┌───────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐   │
                               │  │ media │ │ support  │ │ analytics │ │ audit-log │   │
                               │  └───────┘ └──────────┘ └───────────┘ └───────────┘   │
                               └────────────────────────┬───────────────────────────────┘
                                                        │
                         ┌──────────────────────────────┼────────────────────────┐
                         ▼                              ▼                        ▼
                   PostgreSQL                    Home Assistant            Monobank +
                   (Drizzle ORM)                 (per station)             Checkbox
                         ▼                              
                   Redis (BullMQ +
                   Bot FSM state)
                         ▼
                   MinIO (media files)
```

---

## 2. Architecture Style

### 2.1 NestJS Modular Monolith

The system is a **modular monolith** — one deployable process internally structured as 12
loosely-coupled modules, each following **Clean Architecture** layering:

```
module/
├── domain/          # Aggregates, entities, value objects, domain services, domain events
├── application/     # Application services, use-case orchestrators, command/query handlers
├── infrastructure/  # Repository implementations, gateway adapters, external API clients
└── interface/       # HTTP controllers, DTOs, request validators
```

**Module communication rules**:
- Modules communicate asynchronously via the **event bus** for side effects.
- Modules communicate synchronously only when a caller genuinely needs an immediate return
  value (e.g., `rentals` calling `pricing.PricingService.quote()`). The callee exposes a
  public **application service** interface only — never a repository, domain object, or
  infrastructure adapter.
- No module imports another module's `domain/` or `infrastructure/` layer.
- The `telegram-bot` is not a NestJS module at all — it is a separate process that
  communicates with the backend exclusively via the public REST API.

**Monorepo structure**: `pnpm` workspaces + Nx for boundary enforcement. Nx
`enforce-module-boundaries` lint rules mechanically enforce the layering contracts.

---

## 3. Architecture Decision Records

### ADR-001: Modular Monolith over Microservices

**Decision**: Ship v1 as a single deployable NestJS process with internal module boundaries.

**Rationale**: Current scale is one operator, one station. The team does not yet have the
operational maturity to run N services in production. The modular boundaries are cut
identically to how microservices would be designed, so any module can be extracted later
without a redesign.

**Rejected alternative**: Microservices — rejected for v1 due to operational overhead,
distributed tracing complexity, and network-failure surface area with no demonstrated need
at current scale.

### ADR-002: PostgreSQL + Drizzle ORM over SQLite

**Decision**: PostgreSQL (managed instance) as the production database, Drizzle as the ORM.

**Rationale**: SQLite is a single-writer database; PostgreSQL supports concurrent connections,
row-level locking, partial unique indexes, and native `ENUM` types — all needed for correctness
under concurrent load. Drizzle is type-safe, schema-first, and migration-aware.

**Concrete fix**: The legacy `rent.timer` tick decrement relied on SQLite's single-writer
guarantee for safety. In PostgreSQL with concurrent connections this would be a race condition.
The absolute-deadline timer design (ADR-003) removes this concern entirely.

**Legacy gap closed**: Money was stored as `TEXT` in the legacy system. All monetary values
are stored as `INTEGER` (minor units, e.g., 1000 = ₴10.00) with an explicit currency column.

### ADR-003: Absolute Deadline Timestamps over Tick Counters

**Decision**: Every time-bounded rental state stores an absolute UTC timestamp
(`reservationExpiresAt`, `pickupDeadlineAt`, `warningAt`). A sweep job compares
`now() >= expiresAt` to find expired states.

**Rationale**: The legacy system decrements a `timer` integer (15-second ticks) in a
scheduler loop. A scheduler outage, process restart, or clock adjustment desyncs every
in-flight rental. Absolute timestamps survive restarts and are trivially testable (set
`expiresAt = now() - 1 second` in a unit test — no need to simulate ticks).

**Business behavior**: unchanged. Same 5-minute warning windows, same thresholds — only
the mechanism changes.

### ADR-004: Telegram Bot as Separate Deployable Process

**Decision**: The Telegram bot is a standalone Python process (reusing the existing aiogram
codebase, stripped to a REST client) or a TypeScript/grammy process, deployed independently.
It communicates with the backend exclusively via the public REST API.

**Rationale**: Decouples the bot's release cycle from the backend's. The bot becomes a thin
client: no business logic, no DB access, no payment processing, no FSM except for
conversation flow. Any channel (mobile app, web widget) can replace or supplement it without
backend changes.

**Tradeoff**: One extra network hop per bot interaction. Acceptable for human-paced Telegram
interactions (seconds of latency).

**Legacy gap closed**: Legacy FSM was `MemoryStorage` — all conversation state was lost on
restart. Bot FSM state is stored in Redis, survived across restarts.

### ADR-005: MinIO for Media File Storage

**Decision**: All uploaded photos (finish-rental evidence, support report attachments) are
stored in MinIO object storage. Telegram `file_id` values are NOT used as the storage
reference.

**Rationale**: Telegram `file_id` values are bot-specific. They stop working if the bot
token changes, cannot be displayed in the admin panel, and are not a durable storage medium.
MinIO is S3-compatible, self-hostable, and provides pre-signed URLs for time-limited access.

**Upload flow (v1)**: Bot downloads photo bytes from Telegram → POSTs multipart to
`POST /api/v1/media/upload` → API stores in MinIO → API returns `{ assetId, previewUrl }` →
bot confirms receipt to renter. Future (v2): bot uploads directly via pre-signed URL.

**Access**: Pre-signed URLs (short-lived, default 15 minutes) for admin panel viewing.
Photos are never publicly accessible via a guessable URL.

**Retention**: 1 year (configurable per organization). A scheduled cleanup job expires
objects past their retention deadline.

### ADR-006: Backend-Managed i18n with Locale-Scoped API Responses

**Decision**: The backend API returns all user-facing messages (business errors, notification
content, status descriptions) in the caller's locale. The Telegram bot does not maintain its
own domain-message translation files.

**Rationale**: A single source of truth for all user-facing strings. When a product change
requires updating a message, it happens in one place (backend translation files), not
scattered across the bot and the API.

**Library**: `nestjs-i18n`. Translation files stored as JSON under
`apps/api/src/i18n/{locale}/`. v1 locales: `uk` (primary) and `en`.

**Locale resolution order**: JWT claim locale → Organization default locale → `uk`.

**Admin Panel**: Also multi-locale (uk + en). Translations managed via `next-intl` on the
frontend, sourced from the same JSON files (shared via `packages/i18n`).

**Org-custom translations (v2)**: An `org_translation_overrides` table can store per-org
key/value overrides, allowing white-label operators to customize specific strings
(e.g., brand name in messages, custom rental terms). Deferred to v2.

### ADR-007: Event-Driven Surcharge Invoice Creation

**Decision**: When a surcharge is required at rental finish, the `rentals` module publishes a
`SurchargeRequired` event. The `payments` module subscribes and creates the top-up invoice
asynchronously. The `notifications` module sends the payment link to the Renter once the
invoice is created.

**Rationale**: The original design had `rentals` calling `payments.InvoiceService`
synchronously during the finish-rental flow. This meant: if Monobank's API was unavailable
at finish time, the Renter's finish request would fail with a gateway error — mid-flow, after
photo upload and door-sensor check. Inconsistent and bad UX.

**Async behavior**: The finish endpoint returns `200 OK` immediately once the surcharge amount
is computed and the `SurchargeRequired` event is published. Lockers are released immediately.
The Renter receives the payment link via Telegram notification within seconds. If the invoice
creation fails transiently, BullMQ retries it. Persistent failure triggers an admin alert.

**Tradeoff**: Renter does not receive the payment link within the HTTP response cycle, only
via Telegram push. Acceptable because the Renter is using Telegram and the notification is
nearly instantaneous.

### ADR-008: Single Rental Aggregate for Multi-Locker Bookings

**Decision**: One `Rental` aggregate can cover multiple lockers (modeled via a `rental_lockers`
join table). There is no separate `bookingGroupId` correlation concept.

**Rationale**: The legacy system had one row per locker with a status-tracking problem when
multiple lockers were booked together. A single aggregate is conceptually cleaner: the Renter
made one booking decision, they pay once, and they return everything once.

**State machine**: The rental's status applies to all its lockers as a unit. Individual locker
open/close timestamps are tracked in `rental_lockers` rows.

**Concurrency protection**: A `lockers.current_rental_id` nullable FK, combined with an
application-level `UPDATE lockers SET current_rental_id = :id WHERE id = :lockerId AND
current_rental_id IS NULL` (returns 0 rows = conflict), provides DB-level locker exclusivity
without a cross-table partial unique index.

### ADR-009: Booking-Day Tariff for Overtime Calculation

**Decision**: The `OvertimeCalculator` uses the day type (WEEKDAY/WEEKEND) of the original
booking creation date, not the day type at the time of return.

**Rationale**: The Renter selects a duration and is quoted a price based on the current day
type. It would be a surprise (and legally questionable) if overtime accrued at a higher rate
because they returned after midnight when the day type changed. Locking in the booking day
type makes pricing predictable and auditable.

### ADR-010: Unverified-Finish Fallback for HA Offline

**Decision**: If the Home Assistant connectivity check fails when a Renter attempts to finish
a rental (door sensor unreadable), the system accepts the finish with a `doorStateVerified =
false` flag on each affected `rental_lockers` row. Admins are immediately notified of the
unverified finish.

**Rationale**: HA connectivity is explicitly flagged as flaky in both the legacy system and
this design (see legacy's `read_timeout_as_success` heuristic). Blocking rental completion
entirely when HA is offline means the Renter cannot leave — they are stuck at the station
until HA recovers. This is worse UX than an unverified finish with admin oversight.

**Admin responsibility**: On receiving an unverified-finish alert, the admin manually confirms
the locker state (physically or via HA when it recovers) and resolves the notification.

### ADR-011: Per-Environment Deployment Topology (One Host)

**Decision**:
- **Production**: All services run as Docker containers via Docker Compose.
- **Stage**: All services run as native processes directly on the host (systemd units or
  watchmedo auto-restart), with separate configuration.
- Both environments share one physical/virtual host but have completely separate data stores
  (separate Postgres instances, separate Redis instances, separate MinIO buckets).

**Rationale**: Stage reuses the familiar systemd/watchmedo approach from the legacy system,
minimizing operational friction for developers. Production gets containerization benefits
(reproducibility, easy restarts, resource isolation). The separation of data stores ensures
zero cross-contamination of prod and stage data.

**Stage-specific**: Monobank test mode, Checkbox sandbox API, real HA test device (separate
from prod), separate Telegram bot tokens.

### ADR-012: Row-Level Multi-Tenancy (org_id on every table)

**Decision**: Every business table carries an `org_id` foreign key. The `TenantContext`
(AsyncLocalStorage-based) propagates the current org from the JWT through the request
lifecycle to every repository call.

**Future hardening**: Postgres Row-Level Security policies keyed on the JWT-derived
tenant context, layered on without schema changes, once there are ≥2 real paying
organizations with strict data isolation requirements.

**Rejected alternative**: Separate database/schema per tenant — rejected for operational
complexity at current scale. Revisit only if a white-label contract explicitly requires
physical data isolation.

### ADR-013: One Reconciliation Owner

**Decision**: A single `PaymentReconciliationService` (NestJS `@Cron` or BullMQ repeatable
job) is the only component that polls Monobank for payment status. The webhook handler reacts
to inbound webhooks only and never runs a polling loop.

**Legacy gap closed**: The legacy ran two duplicate reconciliation loops — one from
APScheduler and one from the webhook server's own internal loop — creating race conditions
and duplicate processing risk.

---

### ADR-014: Impersonation Middleware (Cross-Tenant Support Access)

**Decision**: Cross-tenant support access is implemented as a per-request `x-org-id` HTTP
header, enforced by an `ImpersonationMiddleware` registered in the **Organizations module**
(which owns `ORGANIZATION_REPOSITORY`). It runs after `JwtAuthMiddleware` in the global
middleware chain (module import order: `SharedKernel` → `Organizations`), so it can read the
verified `request.auth`.

The middleware enforces all of BR-01.7:
- `x-org-id` present + actor role `SUPER_ADMIN` → re-runs `TenantContext.run` with
  `orgId = <target>` plus `impersonatorSub = <actor sub>` (nested AsyncLocalStorage context,
  so the impersonated org wins downstream; the outer JWT-derived context is restored after).
- `x-org-id` present + any other role → `403 IMPERSONATION_FORBIDDEN`.
- Target org must exist (`404 ORG_NOT_FOUND`) and be `ACTIVE` (`403 ORG_SUSPENDED`).
- Every impersonated request emits an `ImpersonationActivated` audit record via the global
  `AuditableLogger`, capturing the impersonator `sub`, the target `orgId`, method, and path.

The naive `TenantMiddleware` (which trusted `x-org-id` from any client) is removed; the
`orgId` for authenticated requests comes solely from the verified JWT payload. `TenantStore`
gains `impersonatorSub` so downstream code can distinguish a super-admin acting on behalf of a
tenant from that tenant's own operations. `[OPEN: decide whether non-GET impersonated requests
on sensitive resources need a confirmation step]`

---

## 4. Module Catalog

### 4.1 Dependency Graph

```
shared-kernel
    ├── iam
    ├── organizations ──── iam
    ├── media
    ├── locations ──────── shared-kernel, organizations
    ├── pricing ─────────── shared-kernel, organizations
    ├── rentals ─────────── iam, organizations, locations, pricing
    │                        (calls payments.InvoiceService sync for initial invoice)
    │                        (emits SurchargeRequired → payments subscribes async)
    ├── payments ────────── organizations, iam
    ├── notifications ───── subscribes to events from rentals, payments,
    │                        locations, support
    ├── support ─────────── iam, organizations, media
    ├── analytics ────────── read-only, no upstream sync dependencies
    └── audit-log ────────── cross-cutting consumer
```

No cycles. `payments` does not depend on `rentals`. `notifications`, `analytics`, and
`audit-log` are pure consumers that nothing depends on.

### 4.2 shared-kernel

**Purpose**: Foundational types and cross-cutting infrastructure used by all modules.
Never contains business logic.

**Contents**:
- **Value objects**: `Money(amountMinor: int, currency: 'UAH' | ...)`, `OrgId`, `EntityId<T>`,
  `PhoneNumber`, `TimeWindow`, `Locale`.
- **`DomainEvent` base class** + `EventBus` port (`publish`, `subscribe`).
  Infrastructure impl v1: in-process (`@nestjs/event-emitter`). Swappable for
  Redis Streams / RabbitMQ without touching any module's domain code.
- **`TenantContext`** (AsyncLocalStorage): carries `orgId` and `actorId` through a request.
  Every repository call is automatically org-scoped.
- **`Result<T, E>`**: explicit error handling in application services. Expected business-rule
  violations return `Err(...)`, not exceptions.
- **`@AuditableAction` decorator**: marks an application-service method as one that
  `audit-log` must record. Interceptor-driven, no audit code inside domain methods.
- Shared pagination DTOs, `ApiError` envelope (with `correlationId`, `code`, `message`),
  standard NestJS filters.

### 4.3 iam (Identity & Access Management)

**Aggregates**:
- `AdminAccount`: id, orgId (null for SUPER_ADMIN), email, passwordHash, role
  (`SUPER_ADMIN`|`ORG_ADMIN`|`STATION_OPERATOR`), assignedStationIds (STATION_OPERATOR only),
  locale, status (`ACTIVE`|`DISABLED`), createdAt, deletedAt.
- `Renter`: id, orgId, telegramId (nullable — future non-Telegram channels), phone, name,
  consentGivenAt, locale, status (`ACTIVE`|`DISABLED`), createdAt.

**Application services**:
- `AuthService`: `login(email, password)`, `refreshToken`, `issueServiceToken` (for the
  Telegram bot's service-to-service calls), `telegramExchange(telegramId, orgId, botSecret)`.
- `RenterService`: `register`, `findByTelegramId`, `updateLocale`, `disable`.
- `AdminAccountService`: CRUD + role management.

**Ports**: `PasswordHasher` (bcrypt/argon2), `TokenIssuer` (JWT).

**Events**: `RenterRegistered`, `AdminAccountCreated`, `AdminAccountDisabled`.

### 4.4 organizations

**Aggregate `Organization`**:
- id, name, slug (unique), status (`ACTIVE`|`SUSPENDED`), createdAt, deletedAt.
- `BrandingConfig` VO: logoUrl, primaryColor, businessName, supportedLocales, defaultLocale.
- `PaymentCreds` VO: encrypted Monobank test/live tokens (`testTokenEncrypted`,
  `liveTokenEncrypted`), `mode` (test/live), `redirectUrl`, `enabled`. Decrypted at call time
  via `CryptoService`.
- `PaymentDetails` VO: plaintext business identity (payerName, iban, edrpou, purpose).
- `TelegramBotConfig` VO: botTokenRef, webhookSecretRef.
- `MaintenanceWindow` VO: startTime (`HH:MM`), endTime (`HH:MM`), timezone (default
  `Europe/Kyiv`). Null means no maintenance window configured.
- `CheckboxConfig` VO: licenseKeyRef, shiftAutoCloseTime (should match MaintenanceWindow.startTime),
  fiscalRetryWindowMinutes (default 15), timezone.

**Application service**: `OrganizationService` (create, updateBranding, rotateCredentialsRef,
getBySlug, getMaintenanceWindow).

**Events**: `OrganizationCreated`, `OrganizationSuspended`, `OrganizationBrandingChanged`.

### 4.5 locations

**Aggregate `Station`**:
- id, orgId, name, address, workingStatus (`WORKING`|`MAINTENANCE`), isActive, isVisibleToClients,
  sortOrder, haConnectionConfig (`HaConnectionConfig` VO: urlOrIp, token, autoLockDelaySeconds),
  haWebhookSecret,
  healthStatus (`ONLINE`|`OFFLINE`|`UNKNOWN`), lastHealthCheckAt.

**Aggregate `Locker`**:
- id, stationId, name, status (`AVAILABLE`|`RESERVED`|`AWAITING_PAYMENT`|
  `AWAITING_PICKUP`|`RENTED`|`MAINTENANCE`), haLockEntityId, haDoorSensorEntityId,
  currentRentalId (nullable FK — the DB exclusivity mechanism, see ADR-008).

**Entity `InventoryKit`**: id, stationId, lockerId (nullable for unassigned), name, kitType.

**Domain services**:
- `LockerAccessService`: open/close orchestration + auto-relock scheduling.
- `StationHealthChecker`: periodic HA reachability ping.

**Event handlers (subscribed)**:
- On `RentalFinished` or `RentalCancelled`: for each lockerId in the rental, clear
  `locker.currentRentalId = null` and set `locker.status = AVAILABLE`.
  This is the canonical place that releases lockers after a rental ends. If the in-process
  event handler is missed (process crash between publish and handler), a startup reconciliation
  job (`LockerReconciliationJob`) finds rentals in COMPLETED/CANCELLED with non-AVAILABLE
  lockers and corrects them.

**Port `SmartLockGateway`**: `readDoorState(lockerId): OPEN|CLOSED|UNKNOWN`,
`unlock(lockerId)`, `lock(lockerId)`, `isReachable()`. Infrastructure impl:
`HomeAssistantGateway` (one instance per station, configured via `HaConnectionConfig`).
Timeouts: connect 3s, read 5s (tuned from legacy which already handles HA read-timeouts).

**Events published**: `StationCreated`, `StationVisibilityChanged`, `StationHealthChanged`,
`LockerOpened`, `LockerClosed`, `UnauthorizedDoorOpenDetected`, `UnverifiedLockerFinish`.

### 4.6 pricing

**Aggregate `Tariff`**: id, orgId, kitType, dayType (`WEEKDAY`|`WEEKEND`),
durationMinutes, price (`Money`).

**Domain service `OvertimeCalculator`**:
```
calculate(bookingDayType, paidDurationMinutes, actualDurationMinutes, tariffs[])
  → { bandDurationMinutes, totalPrice, surchargeAmount }
```
Pure function. Uses booking's day type (ADR-009). Rounds actual duration up to the nearest
band. Returns surcharge = 0 if no band exceeds the paid duration.

**Application service**: `PricingService.quote(orgId, kitType, dayType, durationMinutes): Money`.

**Events**: `TariffChanged` (for audit/cache invalidation).

### 4.7 rentals (core domain)

**Aggregate `Rental`**:
- id, orgId, renterId, stationId.
- `lockers`: child collection via `rental_lockers` join table (see 5.3).
- bookingDayType (`WEEKDAY`|`WEEKEND`) — locked at creation.
- status (`RESERVED` → `AWAITING_PAYMENT` → `AWAITING_PICKUP` → `ACTIVE` →
  `AWAITING_SURCHARGE_PAYMENT` → `COMPLETED` | `CANCELLED`).
- baseDurationMinutes, basePriceMinor, currency.
- totalTimeMinutes (filled at finish).
- reservationExpiresAt, pickupDeadlineAt, warningAt — absolute UTC timestamps (ADR-003).
- createdAt, startedAt, finishedAt.

**Entity `RentalLocker`** (child):
- rentalId, lockerId, openedAt (null until locker opened), closedAt (null until finish),
  doorStateVerified (null = not checked, true = sensor confirmed closed, false = HA offline
  at finish time — ADR-010).

**Entity `Surcharge`** (child):
- id, rentalId, orgId, amountMinor, currency,
  status (`PENDING`|`INVOICE_CREATED`|`SETTLED`|`CANCELLED`), createdAt, settledAt.

**Domain service `RentalLifecycleService`**: the single place that knows which state
transitions are legal. All state changes go through here — no direct status mutation
elsewhere.

**Application services**:
- `RentalBookingService`: `reserve(renterId, stationId, lockerIds[])`,
  `selectDuration(rentalId, durationMinutes)`, `cancel(rentalId)`.
- `RentalFulfilmentService`: `openLocker(rentalId, lockerId)`, `submitFinishPhoto(rentalId)`,
  `confirmFinish(rentalId)` (checks door sensors, computes overtime, publishes
  `SurchargeRequired` if needed, or `RentalFinished`).
- `RentalTimerSweepService`: scheduled sweep (`@Cron` every 15s or BullMQ repeatable job).
  Finds rentals where `now() >= expiresAt` for the current status and applies the appropriate
  timeout transition.

**Event handlers (subscribed)**:
- On `PaymentSucceeded` (`purchaseReference` = `rental:{rentalId}`) → transition
  AWAITING_PAYMENT rental to AWAITING_PICKUP.
- On `PaymentFailed` / `PaymentExpired` → transition to CANCELLED (releases lockers).
- On `LockerOpened` → if rental is AWAITING_PICKUP, transition to ACTIVE, set `startedAt`.

**Maintenance window enforcement**: In `RentalBookingService.selectDuration`, before calling
`InvoiceService.createInitialInvoice`, check `OrganizationService.getMaintenanceWindow()`.
If current time is within the window, return a business error with the window end time.

**Events published**: `RentalReserved`, `RentalPaymentRequested`, `RentalPickupReady`,
`RentalStarted`, `RentalOvertimeWarningIssued`, `RentalOvertimeDetected`, `SurchargeRequired`,
`RentalFinished`, `RentalCancelled`, `UnverifiedFinishAccepted`.

### 4.8 payments

**Aggregate `PaymentTransaction`**:
- id, orgId, payerId (renterId), type (`INITIAL`|`TOPUP`),
  purchaseReference (free text, e.g., `rental:uuid` — intentionally not an FK),
  amountMinor, currency, externalInvoiceId (unique), checkoutUrl,
  status (`PENDING`|`PROCESSING`|`SUCCESS`|`FAILED`|`EXPIRED`),
  rawLastPayload (jsonb), createdAt, paidAt, updatedAt.

**Entity `FiscalReceipt`** (child):
- id, paymentTransactionId, provider (`CHECKBOX`), externalReceiptId, receiptUrl, pdfUrl,
  status (`NOT_STARTED`|`PENDING`|`SUCCESS`|`FAILED`|`DEFERRED`),
  lastError, retryDeadlineAt, createdAt, updatedAt.

**Domain service `FiscalRetryPolicy`**: encapsulates fiscal deferral and retry logic.
Reads the Organization's maintenance window via `OrganizationService`. Decision tree:
1. If current time is within maintenance window → defer, schedule retry for window end.
2. If Checkbox error is `shift.not_opened` → retry after configurable delay.
3. If retry deadline exceeded → mark FAILED, notify admins.

**Event handlers (subscribed)**:
- On `SurchargeRequired` event → call `createTopupInvoice(rentalId, surchargeId, amount)`.
  Publishes `PaymentInvoiceCreated` on success. On failure, retries via BullMQ. On persistent
  failure, publishes `SurchargeInvoiceCreationFailed` → admin notification.

**Ports**:
- `PaymentGateway`: `createInvoice`, `getStatus`, `verifyWebhook`, `getPublicKey`.
  Impl: `MonobankGateway`. Credentials resolved per-org via `OrganizationService`.
- `FiscalGateway`: `createReceipt`, `getReceiptStatus`, `openShift`, `closeShift`.
  Impl: `CheckboxGateway`. Credentials and shift config resolved per-org.

**Application services**:
- `InvoiceService`: `createInitialInvoice(rentalId, amount)`, `createTopupInvoice(...)`.
- `PaymentWebhookService`: ECDSA signature verification + idempotent status update
  (SELECT FOR UPDATE on `payment_transactions` row, keyed by `externalInvoiceId`).
- `FiscalizationService`: async receipt creation + retry scheduling.
- `ReconciliationService`: `@Cron` sweep for PENDING transactions older than N minutes.

**Events published**: `PaymentInvoiceCreated`, `PaymentSucceeded`, `PaymentFailed`,
`PaymentExpired`, `FiscalizationDeferred`, `ReceiptFiscalized`, `FiscalizationFailed`.

### 4.9 media

**Purpose**: Upload, store, and serve media files (photos). Used by `rentals` (finish photo)
and `support` (report attachments). Owned by this module exclusively — other modules reference
media assets by ID only.

**Entity `MediaAsset`**:
- id, orgId, ownerType (`RENTAL_FINISH`|`SUPPORT_REPORT`), ownerId (UUID of the owning entity),
  storageKey (MinIO object path, e.g., `{orgId}/rentals/{rentalId}/{timestamp}.jpg`),
  contentType, sizeBytes, uploadedByType, uploadedById, expiresAt, createdAt.

**Application service `MediaService`**:
- `upload(orgId, ownerType, ownerId, bytes, contentType): MediaAsset`
- `getPreSignedUrl(assetId, ttlSeconds = 900): string` — for admin panel.
- `deleteExpired()` — scheduled job, purges assets past `expiresAt`.

**Port `ObjectStorageGateway`**: `put(key, bytes, contentType)`, `delete(key)`,
`presignedGetUrl(key, ttlSeconds): string`. Impl: `MinIOGateway`.

**No domain events** (media changes are not business events).

### 4.10 notifications

**Entity `NotificationRecord`** (tracking only, no business consequence):
- id, orgId, recipientType (`RENTER`|`ADMIN`), recipientId, channel (`TELEGRAM`|`PUSH`|
  `EMAIL`|`SMS`), template, payload (jsonb), status (`SENT`|`FAILED`), sentAt, createdAt.

**Port `NotificationChannel`**: `send(recipient, template, payload, locale)`.
- v1 impl: `TelegramChannel` — **only module allowed to call the Telegram Bot API for push**.
- Stubs registered but disabled: `PushChannel` (FCM/APNs), `EmailChannel`, `SmsChannel`.

**Application service `NotificationDispatcher`**: subscribes to domain events, renders the
correct template in the recipient's locale via the i18n service, dispatches via the
appropriate channel.

**Event subscriptions**: `RenterRegistered`, `RentalPaymentRequested`, `RentalPickupReady`,
`RentalStarted`, `RentalOvertimeWarningIssued`, `RentalOvertimeDetected`, `SurchargeRequired`,
`RentalFinished`, `RentalCancelled`, `UnverifiedFinishAccepted`, `PaymentSucceeded`,
`FiscalizationDeferred`, `ReceiptFiscalized`, `FiscalizationFailed`, `SurchargeInvoiceCreationFailed`,
`UnauthorizedDoorOpenDetected`, `StationHealthChanged`, `ProblemReported`, `ProblemResolved`.

### 4.11 support

**Aggregate `ProblemReport`**: id, orgId, renterId, rentalId (nullable), description,
attachmentAssetId (nullable FK → `media_assets`), status (`NEW`|`RESOLVED`), createdAt,
resolvedAt.

**Events**: `ProblemReported`, `ProblemResolved`.

### 4.12 analytics

Read-only projections. No source-of-truth aggregate.

**Two strategies**:
- **Direct queries**: simple dashboard figures (today/week/month counts) — read-only SQL
  against the transactional tables.
- **Rollup tables**: `daily_org_stats(orgId, statDate, rentalsCount, revenueMinor,
  surchargeRevenueMinor)` — event-driven, updated by subscribing to `RentalFinished` and
  `PaymentSucceeded`.

Nothing depends on `analytics` — it is a safe, non-critical consumer.

### 4.13 audit-log

**Entity `AuditLogEntry`**: id, orgId, actorType (`ADMIN`|`SYSTEM`|`RENTER`), actorId (null
for system), action (string), targetType, targetId, metadata (jsonb), occurredAt.

Populated by an interceptor reacting to the `@AuditableAction` decorator. Also subscribes
to explicit domain events that represent sensitive operations.

**Append-only. Never hard-deleted.** Retained for minimum 1 year.

### 4.14 telegram-bot (separate deployable)

**Language**: Python (aiogram 3.x) — reuse and strip the existing codebase.
Rewriting in TypeScript (grammy) is a valid v2 choice for stack consistency, not a v1 need.

**What the bot does**:
- Holds conversation FSM state in **Redis** (replaces `MemoryStorage`).
- Authenticates itself to the backend on `/start` via `POST /api/v1/auth/telegram/exchange`,
  caching the short-lived renter JWT for the session.
- Translates Telegram interactions into REST API calls. One screen = one API call (or a
  BFF composite endpoint).
- Renders API responses as Telegram messages. All bot UI labels and button text are managed
  in the bot's own i18n files. Domain content (prices, times, error messages) comes pre-
  translated from the API in the renter's locale.
- For photo uploads: downloads bytes from Telegram, POSTs to `POST /api/v1/media/upload`
  with multipart/form-data.
- **Never**: accesses the database, evaluates business rules, runs a timer, calls HA, or
  retries failed business operations.

**Multi-org**: In a white-label deployment, each org has its own bot token. One bot process
can serve multiple orgs by polling/receiving webhooks for multiple bot tokens (aiogram
supports multi-bot via `Dispatcher` + multiple `Bot` instances). Alternatively, one process
per bot if isolation is preferred.

---

## 5. Database Design

### 5.1 Principles

- Money: `INTEGER` minor units (e.g., 100 = ₴1.00). Never `FLOAT` or `TEXT`.
- Every business table carries `org_id FK`.
- Enums: Postgres native `ENUM` types or `VARCHAR + CHECK` — Drizzle supports both.
- Soft delete (`deleted_at`) only on reference/config data. Never on financial, audit, or
  rental history tables.
- Financial and audit tables are **append-only / status-transition only** — never
  hard-deleted.

### 5.2 Table Catalog

```sql
-- Tenancy
organizations(
  id              uuid pk,
  name            varchar(255) not null,
  slug            varchar(100) unique not null,
  status          org_status not null default 'ACTIVE',
  branding        jsonb,              -- BrandingConfig VO
  payment_creds jsonb,                 -- PaymentCreds VO (encrypted tokens)
  payment_details jsonb,               -- PaymentDetails VO (plaintext business identity)
  telegram_config jsonb,              -- TelegramBotConfig VO
  maintenance_window_start time,      -- HH:MM, nullable = no window
  maintenance_window_end   time,
  maintenance_timezone     varchar(50) default 'Europe/Kyiv',
  checkbox_config jsonb,              -- CheckboxConfig VO
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
)

-- Identity
admin_accounts(
  id                  uuid pk,
  org_id              uuid fk null,   -- null = SUPER_ADMIN
  email               varchar(255) unique not null,
  password_hash       varchar(255) not null,
  role                admin_role not null,
  assigned_station_ids uuid[],        -- STATION_OPERATOR only
  locale              varchar(10) not null default 'uk',
  status              account_status not null default 'ACTIVE',
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
)

renters(
  id                uuid pk,
  org_id            uuid fk not null,
  telegram_id       bigint unique,    -- nullable: future non-Telegram channels
  phone             varchar(20) not null,
  name              varchar(255) not null,
  consent_given_at  timestamptz not null,
  locale            varchar(10) not null default 'uk',
  status            renter_status not null default 'ACTIVE',
  created_at        timestamptz not null default now()
  -- no deleted_at: deactivate via status; financial history must be preserved
)

-- Locations
stations(
  id                    uuid pk,
  org_id                uuid fk not null,
  name                  varchar(255) not null,
  address               text,
  working_status        station_working_status not null default 'WORKING',
  is_active             boolean not null default true,
  is_visible_to_clients boolean not null default false,
  sort_order            integer not null default 0,
  ha_url_or_ip          varchar(255) not null,
  ha_token_encrypted     text not null,         -- AES-256-GCM encrypted HA token
  ha_webhook_secret_encrypted text not null,    -- AES-256-GCM encrypted webhook secret
  auto_lock_delay_sec   integer not null default 30,
  health_status         station_health_status not null default 'UNKNOWN',
  last_health_check_at  timestamptz,
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz
)

lockers(
  id                    uuid pk,
  station_id            uuid fk not null,
  name                  varchar(100) not null,
  status                locker_status not null default 'AVAILABLE',
  ha_lock_entity_id     varchar(255) not null,
  ha_door_sensor_entity_id varchar(255) not null,
  current_rental_id     uuid fk null references rentals(id),
  -- current_rental_id IS the exclusivity mechanism (ADR-008)
  -- AVAILABLE = current_rental_id IS NULL
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz
)

inventory_kits(
  id          uuid pk,
  station_id  uuid fk not null,
  locker_id   uuid fk null,       -- nullable: kit not yet assigned to a locker
  name        varchar(255) not null,
  kit_type    varchar(100) not null,
  created_at  timestamptz not null default now()
)

-- Pricing
tariffs(
  id               uuid pk,
  org_id           uuid fk not null,
  kit_type         varchar(100) not null,
  day_type         day_type not null,   -- 'WEEKDAY' | 'WEEKEND'
  duration_minutes integer not null,
  price_minor      integer not null,
  currency         varchar(3) not null default 'UAH',
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  UNIQUE (org_id, kit_type, day_type, duration_minutes)
    WHERE deleted_at IS NULL
)

-- Rentals
rentals(
  id                     uuid pk,
  org_id                 uuid fk not null,
  renter_id              uuid fk not null,
  station_id             uuid fk not null,
  booking_day_type       day_type not null,
  status                 rental_status not null,
  base_duration_minutes  integer,
  base_price_minor       integer,
  currency               varchar(3) default 'UAH',
  total_time_minutes     integer,         -- filled at finish
  reservation_expires_at timestamptz,     -- ADR-003 absolute timestamp
  pickup_deadline_at     timestamptz,
  warning_at             timestamptz,
  created_at             timestamptz not null default now(),
  started_at             timestamptz,
  finished_at            timestamptz
)

rental_lockers(
  rental_id          uuid fk not null references rentals(id),
  locker_id          uuid fk not null references lockers(id),
  opened_at          timestamptz,
  closed_at          timestamptz,
  door_state_verified boolean,    -- null=not checked, true=sensor OK, false=HA offline
  PRIMARY KEY (rental_id, locker_id)
)

rental_status_history(
  id              bigserial pk,
  rental_id       uuid fk not null,
  from_status     rental_status,
  to_status       rental_status not null,
  changed_by_type varchar(20),     -- 'ADMIN'|'SYSTEM'|'RENTER'
  changed_by_id   uuid,
  reason          text,
  occurred_at     timestamptz not null default now()
  -- append-only, never updated or deleted
)

surcharges(
  id           uuid pk,
  rental_id    uuid fk not null,
  org_id       uuid fk not null,
  amount_minor integer not null,
  currency     varchar(3) not null default 'UAH',
  status       surcharge_status not null default 'PENDING',
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
)

-- Payments
payment_transactions(
  id                  uuid pk,
  org_id              uuid fk not null,
  payer_id            uuid fk not null,   -- renterId
  type                payment_type not null,  -- 'INITIAL'|'TOPUP'
  purchase_reference  varchar(255) not null,  -- 'rental:{uuid}' (not an FK, intentional)
  amount_minor        integer not null,
  currency            varchar(3) not null default 'UAH',
  external_invoice_id varchar(255) unique not null,
  checkout_url        text not null,
  status              payment_status not null default 'PENDING',
  raw_last_payload    jsonb,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz,
  updated_at          timestamptz not null default now()
)

fiscal_receipts(
  id                      uuid pk,
  payment_transaction_id  uuid fk not null unique,
  provider                varchar(50) not null default 'CHECKBOX',
  external_receipt_id     varchar(255),
  receipt_url             text,
  pdf_url                 text,
  status                  fiscal_status not null default 'NOT_STARTED',
  last_error              text,
  retry_deadline_at       timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
)

-- Media
media_assets(
  id               uuid pk,
  org_id           uuid fk not null,
  owner_type       varchar(50) not null,  -- 'RENTAL_FINISH'|'SUPPORT_REPORT'
  owner_id         uuid not null,
  storage_key      varchar(500) not null, -- MinIO object path
  content_type     varchar(100) not null,
  size_bytes       integer not null,
  uploaded_by_type varchar(20) not null,
  uploaded_by_id   uuid not null,
  expires_at       timestamptz,           -- null = retain indefinitely
  created_at       timestamptz not null default now()
)

-- Support
problem_reports(
  id                  uuid pk,
  org_id              uuid fk not null,
  renter_id           uuid fk not null,
  rental_id           uuid fk null,
  description         text not null,
  attachment_asset_id uuid fk null references media_assets(id),
  status              report_status not null default 'NEW',
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
)

-- Notifications
notification_records(
  id             uuid pk,
  org_id         uuid fk not null,
  recipient_type varchar(20) not null,
  recipient_id   uuid not null,
  channel        varchar(20) not null,
  template       varchar(100) not null,
  status         varchar(20) not null,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
)

-- Audit
audit_log_entries(
  id           bigserial pk,
  org_id       uuid fk not null,
  actor_type   varchar(20) not null,
  actor_id     uuid,
  action       varchar(100) not null,
  target_type  varchar(50) not null,
  target_id    uuid,
  metadata     jsonb,
  occurred_at  timestamptz not null default now()
  -- append-only, never updated or deleted, retained >= 1 year
)

-- Analytics
daily_org_stats(
  org_id                  uuid fk not null,
  stat_date               date not null,
  rentals_count           integer not null default 0,
  revenue_minor           bigint not null default 0,
  surcharge_revenue_minor bigint not null default 0,
  PRIMARY KEY (org_id, stat_date)
)
```

### 5.3 Key Constraints

**Locker exclusivity** (ADR-008):
```sql
-- Application-level atomic reservation:
UPDATE lockers
SET current_rental_id = :rentalId, status = 'RESERVED'
WHERE id = :lockerId AND current_rental_id IS NULL;
-- Returns 0 rows updated → locker already reserved → business error.
```

**Payment idempotency** (ADR-013):
```sql
SELECT * FROM payment_transactions
WHERE external_invoice_id = :id
FOR UPDATE;
-- Row-level lock prevents concurrent webhook + reconciliation from double-applying.
```

**Financial records**:
`payment_transactions`, `fiscal_receipts`, `audit_log_entries`, `rental_status_history` —
no DELETE permission granted to the application role.

### 5.4 Critical Indexes

```sql
-- Station picker (renter-facing)
CREATE INDEX idx_stations_bookable
  ON stations(org_id, is_active, is_visible_to_clients, sort_order)
  WHERE working_status = 'WORKING' AND deleted_at IS NULL;

-- Locker availability
CREATE INDEX idx_lockers_available
  ON lockers(station_id)
  WHERE status = 'AVAILABLE' AND current_rental_id IS NULL AND deleted_at IS NULL;

-- Timer sweep (scans only non-terminal rentals)
CREATE INDEX idx_rentals_timer_sweep
  ON rentals(reservation_expires_at, pickup_deadline_at, warning_at)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED');

-- Payment idempotency
CREATE UNIQUE INDEX idx_payment_transactions_external_id
  ON payment_transactions(external_invoice_id);

-- Audit + analytics
CREATE INDEX idx_audit_log_org_time ON audit_log_entries(org_id, occurred_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log_entries(target_type, target_id);
CREATE INDEX idx_daily_stats_org_date ON daily_org_stats(org_id, stat_date DESC);
```

---

## 6. Event Architecture

In-process event bus (v1). Every event is a plain serializable object — same contracts
work unchanged when the bus is swapped for Redis Streams or RabbitMQ.

| Event | Publisher | Subscribers | Key Payload |
|---|---|---|---|
| `RenterRegistered` | iam | notifications, analytics | renterId, orgId, locale |
| `StationHealthChanged` | locations | notifications(admin), audit-log | stationId, isOnline |
| `UnauthorizedDoorOpenDetected` | locations | notifications(admin), audit-log | lockerId, stationId |
| `LockerOpened` | locations | rentals, audit-log | lockerId, actorType, rentalId? |
| `LockerClosed` | locations | rentals, audit-log | lockerId, actorType |
| `RentalReserved` | rentals | analytics | rentalId, lockerIds[] |
| `RentalPaymentRequested` | rentals | notifications | rentalId, checkoutUrl, renterId |
| `RentalPickupReady` | rentals | notifications | rentalId, renterId |
| `RentalStarted` | rentals | notifications, analytics | rentalId, startedAt |
| `RentalOvertimeWarningIssued` | rentals | notifications | rentalId, minutesRemaining |
| `RentalOvertimeDetected` | rentals | notifications | rentalId |
| `SurchargeRequired` | rentals | **payments** (creates invoice), notifications, analytics | rentalId, surchargeId, amountMinor |
| `UnverifiedFinishAccepted` | rentals | notifications(admin), audit-log | rentalId, lockerIds[] |
| `RentalFinished` | rentals | **locations** (releases lockers), notifications, analytics, audit-log | rentalId, lockerIds[] |
| `RentalCancelled` | rentals | **locations** (releases lockers), notifications, analytics | rentalId, lockerIds[], reason |
| `PaymentInvoiceCreated` | payments | analytics | invoiceId, type, amountMinor |
| `PaymentSucceeded` | payments | **rentals** (advances state), notifications, analytics | invoiceId, purchaseReference, amountMinor |
| `PaymentFailed` / `PaymentExpired` | payments | rentals, notifications | invoiceId, reason |
| `FiscalizationDeferred` | payments | notifications | invoiceId, resumeAfter |
| `ReceiptFiscalized` | payments | notifications, analytics | invoiceId, receiptUrl |
| `FiscalizationFailed` | payments | notifications(admin), audit-log | invoiceId, error |
| `SurchargeInvoiceCreationFailed` | payments | notifications(admin), audit-log | surchargeId, error |
| `ProblemReported` / `ProblemResolved` | support | notifications(admin), audit-log | reportId |

---

## 7. API Design

Convention: REST, `/api/v1/`, versioned. `orgId` from JWT claims. Idempotency keys
(`Idempotency-Key` header) required on all money-moving POST endpoints.

### Auth
```
POST   /api/v1/auth/login                    # admin email+password → JWT + refresh
POST   /api/v1/auth/refresh
POST   /api/v1/auth/telegram/exchange        # bot service secret + telegramId → renter JWT
```

### Organizations (super-admin only)
```
POST   /api/v1/organizations
GET    /api/v1/organizations/:id
PATCH  /api/v1/organizations/:id/branding
PATCH  /api/v1/organizations/:id/maintenance-window
PATCH  /api/v1/organizations/:id/payment-credentials
PATCH  /api/v1/organizations/:id/checkbox-config
```

### Renters
```
POST   /api/v1/renters/register              # called by bot after consent
GET    /api/v1/renters/me
PATCH  /api/v1/renters/me/locale
GET    /api/v1/renters/:id                   # admin lookup
```

### Locations
```
GET    /api/v1/stations                      # admin: all incl. inactive
GET    /api/v1/stations?visible=true&active=true  # renter: bookable only
POST   /api/v1/stations
PATCH  /api/v1/stations/:id
GET    /api/v1/stations/:id/health
GET    /api/v1/stations/:id/lockers
POST   /api/v1/lockers
PATCH  /api/v1/lockers/:id                   # assign kit, maintenance toggle
POST   /api/v1/lockers/:id/open              # admin manual open (audited)
POST   /api/v1/lockers/:id/close             # admin manual close (audited)
POST   /api/v1/webhooks/ha/door-events       # HA → backend (shared secret header)
```

### Pricing
```
GET    /api/v1/tariffs?kitType=&dayType=
POST   /api/v1/tariffs
PATCH  /api/v1/tariffs/:id
DELETE /api/v1/tariffs/:id                   # soft delete
```

### Rentals
```
POST   /api/v1/rentals                       # { stationId, lockerIds[] } → reservation
POST   /api/v1/rentals/:id/duration          # { durationMinutes } → price quote + invoice
POST   /api/v1/rentals/:id/cancel
GET    /api/v1/rentals/active                # renter's active/awaiting-pickup rentals
GET    /api/v1/rentals/history               # renter's history
POST   /api/v1/rentals/:id/open-locker       # { lockerId } — renter opens one locker
POST   /api/v1/rentals/:id/finish/photo      # multipart photo upload
POST   /api/v1/rentals/:id/finish/confirm    # checks door sensors, computes surcharge or completes
POST   /api/v1/rentals/:id/force-close       # admin only, audited, { reason }
GET    /api/v1/rentals?stationId=&status=&from=&to=   # admin queries
```

### Payments
```
POST   /api/v1/payments/webhook/monobank     # signature-verified inbound
GET    /api/v1/payments/:invoiceId/status
POST   /api/v1/surcharges/:id/cancel         # admin write-off, audited
```

### Media
```
POST   /api/v1/media/upload                  # multipart: bot → API → MinIO
GET    /api/v1/media/:assetId/url            # returns short-lived pre-signed URL
```

### Notifications
```
POST   /api/v1/notifications/broadcast       # admin manual broadcast
```

### Analytics
```
GET    /api/v1/analytics/summary?range=today|week|month
GET    /api/v1/analytics/export?format=csv&from=&to=
```

### Support
```
POST   /api/v1/support/reports               # multipart: description + optional photo
GET    /api/v1/support/reports?status=NEW
PATCH  /api/v1/support/reports/:id/resolve
```

### Audit
```
GET    /api/v1/audit-log?actorId=&from=&to=&targetType=&targetId=
```

---

## 8. Internationalization Architecture

**Library**: `nestjs-i18n` (backend), `next-intl` (admin panel).

**Translation file layout**:
```
packages/i18n/
├── locales/
│   ├── uk/
│   │   ├── common.json        # shared strings (error codes, status labels)
│   │   ├── rentals.json       # rental-flow messages
│   │   ├── payments.json      # payment messages
│   │   └── notifications.json # notification templates
│   └── en/
│       ├── common.json
│       ├── rentals.json
│       ├── payments.json
│       └── notifications.json
```

The `packages/i18n` workspace package is consumed by both `apps/api` and `apps/admin-panel`.

**Locale resolution** (per request, in order):
1. `locale` claim from JWT (from `renters.locale` or `admin_accounts.locale`).
2. Organization's `defaultLocale`.
3. System fallback: `uk`.

**Bot behavior**: The bot sends the renter's locale in every API call (via the JWT it holds).
The API returns domain messages in that locale. The bot only manages its own button labels
(keyboard UI), not domain content.

**Org-custom translation overrides** (v2, deferred): A future `org_translation_overrides`
table will allow operators to customize specific message keys per locale.

---

## 9. Deployment Architecture

### 9.1 Environments

| Environment | Runtime | Database | Redis | MinIO | Telegram | Monobank | Checkbox |
|---|---|---|---|---|---|---|---|
| **Production** | Docker Compose | Separate Postgres container | Separate Redis container | MinIO container | Live bot token | Live merchant account | Live fiscal |
| **Stage** | systemd / watchmedo on host | Separate Postgres on host | Separate Redis on host | MinIO on host (separate buckets) | Separate bot token | Test mode | Sandbox API |

Both environments run on **one physical/virtual host**. Stage processes bind to different ports.

### 9.2 Production Docker Compose (services)

```yaml
services:
  api:           # NestJS, port 3000
  admin-panel:   # Next.js, port 3001
  telegram-bot:  # Python aiogram, no HTTP port (polling or webhook)
  postgres:      # PostgreSQL 16
  redis:         # Redis 7
  minio:         # MinIO, port 9000 (API), 9001 (console)
  nginx:         # Reverse proxy, TLS termination
```

### 9.3 Stage (on host)

```bash
# Stage uses:
# - .env.stage (separate file, never committed with secrets)
# - Different DB: rentiq-stage (Postgres, same host)
# - Different Redis DB index or separate Redis instance on different port
# - Different MinIO bucket prefix: stage/
# - Monobank: MONOBANK_TEST_MODE=true
# - Checkbox: CHECKBOX_API_BASE_URL=https://dev-api.checkbox.in.ua
# - Telegram: separate bot token (TELEGRAM_BOT_TOKEN_STAGE)
# - HA: separate test station (HA_URL_STAGE, HA_TOKEN_STAGE per station)
```

Stage services run as systemd units with watchmedo auto-restart on file changes
(preserving the legacy development workflow exactly).

### 9.4 Configuration Validation

All environment variables are validated at startup using **Zod schemas** (NestJS config module
with custom validation). The application will not start if required variables are missing or
malformed. No runtime `undefined` config values.

### 9.5 Secrets Management

- Per-tenant secrets (Monobank test/live tokens, Checkbox license key + test/live tokens, HA
  long-lived tokens, HA webhook secrets) are stored **encrypted** in the database using
  AES-256-GCM envelope encryption. The `CryptoService` (shared-kernel) encrypts on write and
  decrypts on read in the repository layer. A single `MASTER_KEY` in `.env` (32 bytes, hex or
  base64) is the only secret that lives outside the DB.
- Encrypted columns: `organizations.payment_creds` (jsonb with `testTokenEncrypted`,
  `liveTokenEncrypted`), `organizations.checkbox_config` (jsonb with `licenseKeyEncrypted`,
  `testTokenEncrypted`, `liveTokenEncrypted`), `stations.ha_token_encrypted`,
  `stations.ha_webhook_secret_encrypted`.
- Plaintext business data (payer name, IBAN, EDRPOU, purpose) is stored separately in
  `organizations.payment_details` (jsonb, not encrypted — it is org identity, not a credential).
- API responses **mask** token fields (last 4 chars only, e.g. `****rGg`). Admins can SET a
  new token value but never READ the full token via the API.
- `MASTER_KEY` rotation: generate a new key, re-encrypt all secret columns (script TODO),
  update `.env`. No schema migration needed.
- Future: HashiCorp Vault or AWS Secrets Manager. The `CryptoService` interface would be
  replaced by a Vault-backed adapter; the encrypted columns become references.

---

## 10. Security Architecture

| Concern | Mechanism |
|---|---|
| Admin auth | JWT (short-lived access + refresh token), bcrypt/argon2 password hashing |
| Admin authorization | Role-based NestJS guards reading TenantContext (`SUPER_ADMIN`/`ORG_ADMIN`/`STATION_OPERATOR`) |
| Renter auth | Short-lived JWT minted only via `/auth/telegram/exchange`, gated by per-org bot service secret. A renter cannot obtain a token by guessing a Telegram ID. |
| Webhook verification | Monobank: ECDSA signature verified against cached public key. HA door events: shared secret header. |
| Tenant isolation | `TenantContext` propagates `orgId` to every repository call. All queries implicitly filter by `orgId`. |
| Cross-tenant support access | `x-org-id` header honored only for `SUPER_ADMIN`; org existence + ACTIVE validated; every impersonated request audited (ADR-014, BR-01.7). |
| Future hardening | Postgres Row-Level Security (RLS) policies once ≥2 real paying orgs are live. |
| Secrets | Per-tenant tokens encrypted in DB (AES-256-GCM via `CryptoService`); one `MASTER_KEY` in `.env`. API responses mask token fields. |
| Media access | Pre-signed MinIO URLs (15-min TTL). Photos never accessible via guessable public URL. |
| Audit trail | Every sensitive admin action captured via `@AuditableAction` interceptor. |

---

## 11. Folder Structure

```
rentiq/                          # monorepo root
├── apps/
│   ├── api/                     # NestJS modular monolith
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── shared-kernel/
│   │       │   ├── domain/      # Money, DomainEvent, TenantContext, Result
│   │       │   ├── application/ # EventBus port, @AuditableAction
│   │       │   ├── infrastructure/  # in-process EventBus, BullMQ integration
│   │       │   └── interface/   # filters, pagination DTOs, ApiError
│   │       ├── modules/
│   │       │   ├── iam/
│   │       │   │   ├── domain/
│   │       │   │   ├── application/
│   │       │   │   ├── infrastructure/  # drizzle repos, bcrypt, jwt
│   │       │   │   ├── interface/       # controllers, DTOs
│   │       │   │   └── iam.module.ts
│   │       │   ├── organizations/   (same layering)
│   │       │   ├── locations/       (same + HomeAssistantGateway)
│   │       │   ├── pricing/         (same)
│   │       │   ├── rentals/         (same + timer sweep job)
│   │       │   ├── payments/        (same + MonobankGateway, CheckboxGateway)
│   │       │   ├── media/           (same + MinIOGateway)
│   │       │   ├── notifications/   (same + TelegramChannel)
│   │       │   ├── support/         (same)
│   │       │   ├── analytics/       (same, read-only)
│   │       │   └── audit-log/       (same, append-only)
│   │       └── infra/
│   │           ├── database/    # drizzle schema + migrations (per-module schema files)
│   │           └── config/      # zod-validated env config
│   ├── admin-panel/             # Next.js (app router)
│   │   └── src/
│   │       ├── app/             # feature-based, mirrors backend modules
│   │       └── components/
│   └── telegram-bot/            # Python aiogram (reused from legacy, stripped)
│       ├── flows/               # registration, booking, finish-rental, support
│       ├── api_client/          # typed HTTP client for REST API
│       └── session/             # Redis FSM state
├── packages/
│   ├── i18n/                    # shared translation JSON files (uk, en)
│   └── config/                  # shared tsconfig, eslint
├── docs/
│   ├── architecture/            # this document
│   ├── domain/                  # business-rules.md
│   └── roadmap/                 # implementation-roadmap.md
├── docker-compose.yml           # production
├── docker-compose.stage.yml     # stage overrides (if ever needed)
├── .env.example
├── .env.stage.example
├── nx.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| HA connectivity is inherently flaky | Locker operations fail during rentals | Short timeouts (3s/5s), HA offline handled gracefully (ADR-010), StationHealthChecker surfaces issues to admins before renters hit them |
| Fiscal correctness during go-live | Double-charge or lost receipt = legal + UX incident | DB-level idempotency (§5.3), shadow-run against Checkbox sandbox before go-live, `FiscalRetryPolicy` covers the maintenance-window race |
| Multi-tenancy untested with >1 org | Cross-tenant data leak possible | Automated test suite: every core flow runs twice with two different `orgId`s asserting zero cross-visibility, run in CI before onboarding a second real org |
| Redis as added dependency | FSM state lost if Redis crashes | Redis persistence (AOF), bot shows "please retry" on FSM state miss; financial data is always in PostgreSQL |
| MinIO availability | Photo uploads fail | MinIO is local to the host (same as legacy "always available"); uploads are retried once by the bot; if MinIO is down, finish-rental flow degrades (photo step fails with user-visible error) |
| In-process event bus + crash | Event delivery missed between publish and handler | Locker reconciliation job (§4.5) catches missed locker releases; BullMQ for all jobs that must be durable; revisit with persistent bus if rate of missed events is observed in production |

---

## 13. Open Questions

These require product-owner answers before the relevant module is built:

1. **Overtime bands (BR-04.4)**: Are the 240/300/480-minute bands intentional "day pass"
   pricing tiers or an artifact of having only those tariff rows in the legacy DB?
   Answer determines whether `OvertimeCalculator` is a static algorithm or driven by a
   configurable band table.

2. **Shared vs. per-org Monobank account**: Do white-label partners need their own Monobank
   merchant accounts (current design), or does revenue flow through one shared merchant
   account with internal settlement? Changes whether `PaymentGatewayCredentialsRef` is
   required or optional per org.

3. **STATION_OPERATOR pricing visibility**: Can STATION_OPERATORs see revenue figures for
   their stations, or only operational data? Affects `analytics` authorization rules.

4. **SMS channel**: Is SMS needed in v1 for renters without Telegram? If yes, add
   `SmsChannel` to Phase 7 (Notifications).

5. **Ukrainian data retention**: What is the legally mandated minimum retention period for
   fiscal-adjacent records? Drives partitioning/archival strategy.

6. **Org-custom bot multi-process**: For white-label orgs, deploy one shared bot process
   with multi-bot token handling, or one process per org? Decision needed before Phase 8.
