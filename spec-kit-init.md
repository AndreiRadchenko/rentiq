# Spec Kit Bootstrap Prompt — rentiq

**Purpose**: This file is itself a prompt. Give it to a coding agent (once) and it will
generate the full folder structure and prompt files described below. Each generated file is
in turn a ready-to-paste prompt for GitHub Spec Kit (`/constitution`, `/specify`, `/plan`)
when you run Spec Kit inside your AI coding assistant for each capability.

**Source documents to use as grounding context** (read before generating anything, and
reference them by path inside the generated prompts — do not copy their full content):

- `docs/architecture/greenfield-architecture.md` — system context, ADRs, module catalog,
  database design, event catalog, API design, i18n architecture.
- `docs/domain/business-rules.md` — authoritative business rules (BR-01 … BR-14).
- `docs/roadmap/implementation-roadmap.md` — phased delivery plan, deliverables, exit
  criteria, legacy migration notes.

**Spec Kit stage discipline** (do not violate this when generating prompt content):

| Stage | Goal | Focus | Must exclude |
|---|---|---|---|
| Constitution | Permanent engineering rules | How the team builds software | Any specific feature |
| Specification | What the system must do | Business requirements | DB schema, modules, classes, endpoints |
| Plan | How a feature will be built | Technical implementation | Production code |

---

## 1. Goals

1. Create the project structure below for storing reusable Spec Kit prompts.
2. Generate `constitution.prompt.md` — one file, project-wide, feature-agnostic.
3. Generate a `spec.prompt.md` + `plan.prompt.md` pair for every roadmap phase in
   `docs/roadmap/implementation-roadmap.md`.
4. Split **Phase 5 — Rentals** into 9 independent capability specs (see §4), each with its
   own `spec.prompt.md` + `plan.prompt.md`.
5. Every generated prompt must reference the three source documents above by path/section
   instead of restating their content, so the prompts stay in sync as the docs evolve.

---

## 2. Project Structure to Create

```
spec-kit-prompts/
├── constitution.prompt.md
├── 00-environment-infrastructure/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 01-shared-kernel-foundation/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 02-iam-organizations/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 03-locations-pricing/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 04-media-assets/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 05-rentals/
│   ├── 01-rental-registration/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   ├── 02-reservation/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   ├── 03-payment-initiation/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   ├── 04-pickup/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   ├── 05-active-rental/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   ├── 06-return/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   ├── 07-overtime/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   ├── 08-surcharge/
│   │   ├── spec.prompt.md
│   │   └── plan.prompt.md
│   └── 09-rental-history/
│       ├── spec.prompt.md
│       └── plan.prompt.md
├── 06-payments/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 07-notifications-i18n/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 08-telegram-bot/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 09-support-audit-log/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 10-analytics-admin-panel/
│   ├── spec.prompt.md
│   └── plan.prompt.md
├── 11-multi-tenant-hardening/
│   ├── spec.prompt.md
│   └── plan.prompt.md
└── 12-websockets-mobile-readiness/
    ├── spec.prompt.md
    └── plan.prompt.md
```

Numbering mirrors the roadmap's Phase numbers so traceability is trivial. Phase 5's
sub-folders are numbered independently (01–09) in the order the renter experiences them.

**Note on `.specify/`**: If you have not yet run the actual Spec Kit CLI
(`specify init` / `uvx --from git+https://github.com/github/spec-kit.git specify init`),
do that separately in the repo root first. `spec-kit-prompts/` (this structure) is our own
reusable prompt bank — it is not the tool's generated `.specify/`/`specs/` output. When you
later run `/constitution`, `/specify`, `/plan` inside your Spec-Kit-enabled assistant, paste
the content of the matching file from here as the command's argument.

---

## 3. Constitution Prompt

Write the following as `spec-kit-prompts/constitution.prompt.md` verbatim (adjust only if
the architecture doc's ADRs change):

```
Create a project constitution for rentiq, a greenfield multi-tenant SaaS platform for
time-based rental of physical equipment stored in smart lockers (v1 domain: SUP board
rental in Ukraine).

The constitution should define permanent engineering principles rather than
implementation details for any specific feature.

Use these constraints:

- NestJS Modular Monolith: one deployable process, 12+ internal modules, each following
  Clean Architecture layering (domain / application / infrastructure / interface).
- Hexagonal Architecture: external systems (Home Assistant, Monobank, Checkbox, MinIO,
  Telegram) are only ever accessed through named ports (SmartLockGateway, PaymentGateway,
  FiscalGateway, ObjectStorageGateway, NotificationChannel), never called directly from
  domain or application code.
- Domain-Driven Design: aggregates, entities, value objects, domain events, domain
  services. Money is always a Money(amountMinor, currency) value object — integer minor
  units, never float or text.
- Event-driven module communication: modules publish/subscribe domain events for side
  effects across module boundaries; synchronous calls are allowed only through another
  module's public application-service interface, never its repository or domain layer.
- Strong module boundaries mechanically enforced (Nx enforce-module-boundaries): no module
  imports another module's domain/ or infrastructure/ layer; no module reads another
  module's database tables directly.
- Multi-tenancy from day one: every business table carries org_id; a TenantContext
  (AsyncLocalStorage) propagates the current org from the JWT through every repository
  call automatically.
- PostgreSQL + Drizzle ORM only. No direct SQL outside repositories. Migrations generated
  via drizzle-kit and committed to git; never hand-edited.
- Telegram Bot is a separate deployable process and a REST client only — no direct
  database access, no business logic, no payment or fiscal calls, no HA calls.
- No business logic in controllers. Domain layer has zero framework (NestJS) dependencies.
  Application layer coordinates use cases; infrastructure implements ports.
- Backend-managed internationalization: all user-facing business messages (errors,
  notifications, status text) are returned by the API in the caller's locale (uk primary,
  en secondary). Client apps (bot, admin panel) own only their own UI-chrome strings.
- Security by default: JWT (RS256) auth, role-based access control (SUPER_ADMIN,
  ORG_ADMIN, STATION_OPERATOR), tenant isolation enforced at the data-access layer, an
  append-only audit log for sensitive admin actions.
- Financial and audit data integrity: payment_transactions, fiscal_receipts,
  audit_log_entries, rental_status_history are append-only / status-transition-only —
  never hard-deleted, retained a minimum of 1 year.
- Testability first: domain logic requires unit tests; APIs require integration tests;
  external provider integrations (Monobank, Checkbox, Home Assistant) require contract
  tests against a mock/sandbox.
- Incremental development: the system is built and demoed phase by phase (see
  docs/roadmap/implementation-roadmap.md); every phase ends in a working, if incomplete,
  system — no big-bang integration.
- ADRs required for any architectural change (new module, new cross-module dependency,
  new external integration pattern). Public API documented with OpenAPI.

Do not mention rentals, reservations, payments, or any other specific feature by name.
```

---

## 4. Specification & Plan Prompts per Roadmap Phase

For every phase below, generate the two files using this template, filling in the
bracketed parts. Keep each prompt short (10–20 lines) — it is an instruction to Spec Kit,
not the spec itself.

```
Specification prompt template
------------------------------
Create a functional specification for the [Capability] capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only
as context — see [BR references] and [ADR references]. Do not restate them; reference them.

Focus on business behavior only.

Include:
- User stories
- Functional requirements
- Business rules (grounded in the BR references above)
- Acceptance criteria
- Error scenarios
- Non-functional requirements
- Open questions (carry forward any [OPEN] items noted below)

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Event names

[Capability-specific notes]

Plan prompt template
---------------------
Create an implementation plan for the [Capability] specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md ([sections/ADRs]) and
docs/roadmap/implementation-roadmap.md ([Phase N] deliverables and exit criteria).

Preserve module boundaries: [module(s)].

Include:
- Architecture impact
- Required modules
- Domain model
- Database changes
- APIs
- Events
- Background jobs
- Testing strategy
- Risks
- Migration considerations
- Task breakdown matching the phase's exit criteria

Do not generate production code.
```

Below are the filled-in specifics for every phase.

---

### 00 — Environment & Infrastructure Setup

**Roadmap source**: Phase 0 (implementation-roadmap.md).
**Note**: This phase is operational, not a user-facing capability. Frame the "spec" as
operational/non-functional requirements rather than business behavior.

- **Capability-specific notes (spec)**: Cover — two isolated environments (containerized
  production, host-native stage) with fully separate data stores; CI must gate every PR
  (lint, typecheck, unit, e2e) with no merge on red; secrets are never committed; database
  migrations are generated and reviewed, never hand-edited, and run automatically before
  the new binary starts in production. Exclude exact docker-compose/GitHub Actions YAML.
- **BR/ADR references**: ADR-011 (per-environment deployment topology).
- **Plan references**: Phase 0 deliverables 0.1–0.5 exactly (Nx monorepo scaffold + module
  boundary lint, docker-compose service list — postgres16/redis7/minio/api/admin-panel/
  telegram-bot/nginx, stage host-native setup with systemd/watchmedo, CI jobs, drizzle-kit
  migration workflow). Plan must reproduce Phase 0's exit criteria as its acceptance test.

---

### 01 — Shared Kernel + Foundation

**Roadmap source**: Phase 1.

- **Capability-specific notes (spec)**: Frame as platform-wide guarantees every later
  capability depends on — every request is scoped to exactly one organization; all money
  values are exact (no floating-point drift); the app refuses to start with invalid
  configuration; the system exposes a health signal; error responses and paginated
  responses are consistent everywhere.
- **BR/ADR references**: ADR-002 (money as integer minor units), ADR-012 (org_id on every
  table + TenantContext).
- **Plan references**: architecture §4.2 shared-kernel (Money, EntityId/OrgId/PhoneNumber/
  Locale VOs, DomainEvent + EventBus port with in-process `@nestjs/event-emitter` impl,
  TenantContext via AsyncLocalStorage + TenantMiddleware, Result<T,E>, `@AuditableAction`
  stub, ApiError envelope, pagination DTOs), Drizzle connection module with Zod config,
  global ConfigModule Zod validation, `GET /health`. Phase 1 exit criteria.

---

### 02 — IAM + Organizations

**Roadmap source**: Phase 2.

- **Capability-specific notes (spec)**: Cover renter registration & consent, permanent
  renter-to-organization binding, renter locale selection/change, the three-tier admin
  role hierarchy and what each role can/cannot do, organization branding/locale-set
  concept, and the renter data-retention/anonymization rule.
- **BR references**: BR-01.1–BR-01.6, BR-02.1, BR-02.2. Carry forward
  `[OPEN: confirm Ukrainian data-retention law minimum period]` from BR-01.6.
- **Plan references**: architecture §4.3 (iam: AdminAccount/Renter aggregates, AuthService
  JWT RS256 15-min access/7-day refresh, RenterService, AdminAccountService), §4.4
  (organizations: Organization aggregate, BrandingConfig/PaymentGatewayCredentialsRef/
  TelegramBotConfig/MaintenanceWindow/CheckboxConfig VOs). Phase 2 deliverables (auth,
  register, org endpoints, seed SUPER_ADMIN, nestjs-i18n locale middleware) and exit
  criteria.

---

### 03 — Locations + Pricing

**Roadmap source**: Phase 3.

- **Capability-specific notes (spec)**: Cover the exact conditions under which a locker is
  bookable, station connectivity auto-flagging via periodic HA reachability checks and
  auto-recovery, mandatory auto-relock after any open, unauthorized-door-open security
  alerting, independent active/visible admin toggles, HA token secret-store storage, and
  the kit-type → tariff pricing structure including the fixed admin-configurable duration
  set.
- **BR references**: BR-03.1–BR-03.7, BR-04.1–BR-04.5. Carry forward
  `[OPEN: confirm overtime band definition with product owner]` from BR-04.4 as a forward
  reference (full resolution happens in the Overtime spec, §5.7 below).
- **Plan references**: architecture §4.5 (locations: Station/Locker aggregates,
  InventoryKit, LockerAccessService, StationHealthChecker, SmartLockGateway port with 3s
  connect/5s read timeouts, HomeAssistantGateway impl, mock impl for local dev), §4.6
  (pricing: Tariff aggregate, OvertimeCalculator pure function, PricingService.quote).
  Phase 3 deliverables (CRUD APIs, `GET /stations?visible=true&active=true`,
  LockerReconciliationJob, auto-relock BullMQ job) and exit criteria.

---

### 04 — Media Assets

**Roadmap source**: Phase 4.

- **Capability-specific notes (spec)**: Cover why photos must never rely on Telegram
  file_id, the upload flow expectation (bot downloads → API stores), access control
  (short-lived pre-signed URLs, never publicly guessable), and retention/auto-purge.
- **BR references**: BR-10.1–BR-10.4.
- **Plan references**: architecture §4.9 (MediaAsset entity, MediaService,
  ObjectStorageGateway port, MinIOGateway impl), ADR-005. Phase 4 deliverables
  (`POST /media/upload` 10MB multipart limit, `{orgId}/{ownerType}/{ownerId}/{uuid}.{ext}`
  storage key, `GET /media/:assetId/url` 15-min TTL, MediaCleanupJob daily cron, i18n
  "Photo too large"/"Unsupported file type") and exit criteria.

---

## 5. Rentals — Split into 9 Independent Specs (Phase 5)

Phase 5 in the roadmap is one phase but covers a full multi-stage lifecycle. Split it into
9 independent capability specs so each can be specified, planned, and implemented (mostly)
independently while still respecting the single `Rental` aggregate and its state machine
(`RESERVED → AWAITING_PAYMENT → AWAITING_PICKUP → ACTIVE → AWAITING_SURCHARGE_PAYMENT →
COMPLETED | CANCELLED`, architecture §4.7, ADR-008).

**Assumption flagged for user confirmation**: the roadmap/business-rules docs don't draw a
line between "Rental Registration" and "Reservation" as two separate named concepts — this
split is inferred as follows. Adjust the notes below if the intended boundary differs:
- **Rental Registration** = the renter's decision to start a booking (pick a station,
  pick one or more lockers, create the Rental record), including the pre-condition that
  they must already be a registered Renter and must have no unpaid surcharge blocking them.
- **Reservation** = the temporary-hold *mechanics* once Registration has happened: the
  bounded time window, all-or-nothing atomicity across multiple lockers, and DB-level
  exclusivity guarantee.

### 05/01 — Rental Registration

- **Capability-specific notes (spec)**: Cover starting a new booking: selecting a station
  and one or more lockers as a single booking session under one Rental; the precondition
  that any outstanding surcharge from a prior rental blocks a new booking until settled,
  with a direct payment link shown for each outstanding surcharge.
- **BR references**: BR-05.1, BR-05.3 (blocking precondition), BR-01.1/BR-01.2 (registered
  renter precondition, cross-reference to 02-iam-organizations).
- **Plan references**: architecture §4.7 (Rental aggregate, rental_lockers child table),
  RentalBookingService.reserve(renterId, stationId, lockerIds[]). Cross-module dependency
  on iam (renter identity) and locations (locker existence).

### 05/02 — Reservation

- **Capability-specific notes (spec)**: Cover the bounded reservation window (lockers
  removed from availability for other renters, then auto-released if unpaid), and the
  all-or-nothing rule for multi-locker reservation (if any locker becomes unavailable
  mid-request, none are reserved and the renter is told which ones).
- **BR references**: BR-05.2, BR-05.4, BR-05.5 (DB-level exclusivity, not just application
  level).
- **Plan references**: ADR-008 (`current_rental_id` nullable FK exclusivity mechanism),
  §5.3 atomic `UPDATE lockers SET current_rental_id = :id WHERE current_rental_id IS NULL`
  pattern, RentalTimerSweepService reservation-expiry sweep (`reservationExpiresAt`,
  ADR-003 absolute-deadline design), `RentalReserved` event.

### 05/03 — Payment Initiation

- **Capability-specific notes (spec)**: Cover duration selection producing a locked-in
  price quote, the maintenance-window block on new payment requests (with a clear
  "unavailable until HH:MM" message), and that already-in-progress surcharge payments are
  never blocked by the window. Explicitly out of scope: webhook verification, idempotency,
  and fiscalization — those belong to `06-payments`.
- **BR references**: BR-06.4, BR-04.2/BR-04.3/BR-04.5 (tariff lookup and price lock-in).
- **Plan references**: RentalBookingService.selectDuration, PricingService.quote,
  OrganizationService.getMaintenanceWindow check before calling
  payments.InvoiceService.createInitialInvoice (sync call per module dependency graph),
  `MaintenanceWindowActiveError` (uk+en), `RentalPaymentRequested` event,
  `POST /rentals/:id/duration`.

### 05/04 — Pickup

- **Capability-specific notes (spec)**: Cover the renter opening their own paid locker(s)
  at will, the rental starting on first open, and the automatic start (paid duration
  begins) if the renter never opens within a configurable grace period.
- **BR references**: BR-08.1, BR-08.2, BR-08.3, cross-reference BR-06.5 (payment
  confirmation transitions lockers to awaiting-pickup — owned by `06-payments`/
  `05-03-payment-initiation`).
- **Plan references**: RentalFulfilmentService.openLocker, `LockerOpened` event handler in
  rentals (AWAITING_PICKUP → ACTIVE, set `startedAt`), grace-period auto-start via
  RentalTimerSweepService (`pickupDeadlineAt`), `POST /rentals/:id/open-locker`.

### 05/05 — Active Rental

- **Capability-specific notes (spec)**: Cover the live duration countdown, the 5-minute
  overtime warning notification, the overtime-started notification once paid duration
  elapses, and the renter's ability to view all active/awaiting-pickup rentals live.
- **BR references**: BR-08.4, BR-08.5, BR-08.6.
- **Plan references**: RentalTimerSweepService warning/overtime sweep (`warningAt`),
  `RentalOvertimeWarningIssued` / `RentalOvertimeDetected` events, `GET /rentals/active`.

### 05/06 — Return

- **Capability-specific notes (spec)**: Cover the mandatory finish-photo submission, the
  mandatory door-sensor-closed verification per locker, and the HA-offline fallback that
  still completes the rental with an unverified flag plus immediate admin notification.
  Explicitly out of scope: overtime/surcharge computation (`07-overtime`,
  `08-surcharge`).
- **BR references**: BR-09.1, BR-09.2, BR-09.3.
- **Plan references**: RentalFulfilmentService.submitFinishPhoto/confirmFinish, dependency
  on `04-media-assets` for photo storage, `SmartLockGateway.readDoorState`,
  `doorStateVerified` flag on `rental_lockers`, `UnverifiedFinishAccepted` event,
  `POST /rentals/:id/finish/photo`, `POST /rentals/:id/finish/confirm`.

### 05/07 — Overtime

- **Capability-specific notes (spec)**: Cover how actual usage time is compared against
  paid duration using the *booking's* day type (not the return day type), rounding up to
  the next tariff band, and the rule that no further charge applies within tolerance.
  Carry forward the open question on what the tariff bands (60/120/180/240/300/480 min)
  actually represent.
- **BR references**: BR-04.4 `[OPEN]`, BR-09.4, BR-09.5, ADR-009 (booking-day tariff
  lock-in).
- **Plan references**: `pricing.OvertimeCalculator` pure function
  (`calculate(bookingDayType, paidDurationMinutes, actualDurationMinutes, tariffs[])`),
  invoked from `RentalFulfilmentService.confirmFinish`.

### 05/08 — Surcharge

- **Capability-specific notes (spec)**: Cover immediate locker release regardless of
  unpaid surcharge (the debt follows the renter, not the hardware), asynchronous invoice
  creation after finish (finish endpoint must not wait on it), the escalating reminder
  schedule until settled, and admin write-off as a sensitive audited action. Explicitly
  out of scope: the actual payment-gateway invoice mechanics — those belong to
  `06-payments`.
- **BR references**: BR-09.6, BR-09.7, BR-09.8, BR-05.3 (cross-reference — blocks new
  bookings, owned by `05-01-rental-registration`), BR-12.3 (write-off, cross-reference to
  `09-support-audit-log`).
- **Plan references**: ADR-007 (event-driven surcharge invoice creation — `rentals`
  publishes `SurchargeRequired`, `payments` subscribes async, BullMQ retry on failure),
  `Surcharge` entity (`PENDING`|`INVOICE_CREATED`|`SETTLED`|`CANCELLED`), surcharge
  reminder BullMQ delayed/re-queued job (owned by `07-notifications-i18n`),
  `POST /surcharges/:id/cancel`.

### 05/09 — Rental History

- **Capability-specific notes (spec)**: Cover the renter's own rental history view and the
  admin's filterable rental list/detail view (status, station, date range), backed by an
  immutable timeline of status changes. Explicitly out of scope: CSV/XLSX export (owned by
  `10-analytics-admin-panel`, BR-12.5).
- **BR references**: none dedicated — derive from architecture §5.2 `rental_status_history`
  (append-only) and §7 rentals API surface.
- **Plan references**: `GET /api/v1/rentals/history`,
  `GET /api/v1/rentals?stationId=&status=&from=&to=`, `rental_status_history` read model,
  shared-kernel pagination DTOs.

---

## 6. Remaining Roadmap Phases

### 06 — Payments (Monobank + Checkbox)

**Roadmap source**: Phase 6.

- **Capability-specific notes (spec)**: Cover fully automatic webhook-driven payment
  confirmation with periodic reconciliation as a fallback, mandatory cryptographic webhook
  verification before any business effect, idempotent status handling (no double-apply,
  terminal states never overwritten by stale events, but a prior failure may be superseded
  by a later success), mandatory fiscalization of every successful payment, fiscalization
  never blocking locker access, automatic Checkbox shift open/close tied to the
  maintenance window, bounded fiscal retry with admin escalation on persistent failure, and
  automatic receipt delivery to the renter.
- **BR references**: BR-06.1–BR-06.5, BR-07.1–BR-07.6.
- **Plan references**: architecture §4.8 (PaymentTransaction/FiscalReceipt, InvoiceService,
  PaymentWebhookService with `SELECT ... FOR UPDATE` idempotency, FiscalizationService,
  ReconciliationService, FiscalRetryPolicy), ADR-007, ADR-013 (single reconciliation
  owner), PaymentGateway/FiscalGateway ports (MonobankGateway/CheckboxGateway impls). Use
  Phase 6's stage-validation checklist as the plan's testing strategy basis.

### 07 — Notifications + i18n

**Roadmap source**: Phase 7.

- **Capability-specific notes (spec)**: Cover that only this capability may push messages
  to renters/admins, that every message is delivered in the recipient's locale, the
  channel-abstraction principle (Telegram today, other channels pluggable later without
  logic changes), the admin broadcast capability, and locale-resolution precedence.
- **BR references**: BR-13.1–BR-13.4, BR-14.1–BR-14.4.
- **Plan references**: architecture §4.10 (NotificationDispatcher, NotificationChannel
  port, TelegramChannel), §6 full event-subscription catalog, nestjs-i18n file layout under
  `packages/i18n/locales/{uk,en}/`, surcharge reminder BullMQ job. Use Phase 7's required
  translation-coverage checklist (rental lifecycle, payment, admin alerts, renter errors)
  as the plan's acceptance criteria.

### 08 — Telegram Bot

**Roadmap source**: Phase 8.

- **Capability-specific notes (spec)**: Describe the bot purely as a rental interface from
  the renter's point of view — registration, booking (station → lockers → duration → pay
  link), finish-rental (photo → door confirm), support, my-rentals — and state the hard
  constraint that it is a thin REST client with no DB access, no business logic, no
  payment/fiscal/HA calls, and that conversation state survives a bot restart. Exclude
  Python/aiogram specifics and endpoint paths.
- **BR references**: ADR-004 (bot as separate deployable REST client), ADR-006 (bot does
  not translate domain content).
- **Plan references**: architecture §4.14 (module layout: flows/, api_client/, session/,
  i18n/), the roadmap's legacy-removal table (what's stripped from `suppoint-bot` vs. what
  is ported), Redis-backed aiogram FSM storage. Phase 8 exit criteria.

### 09 — Support + Audit Log

**Roadmap source**: Phase 9.

- **Capability-specific notes (spec)**: Cover free-text problem reporting (optionally
  linked to a rental, optionally with a photo, no booking required), admin resolution
  permission scoped to STATION_OPERATOR-and-above for the affected station, and the
  requirement that every sensitive admin action (manual locker control, force-close/cancel
  rental, surcharge write-off, admin account changes, org credential/branding changes) is
  recorded in an append-only, non-deletable audit log for at least 1 year.
- **BR references**: BR-11.1, BR-11.2, BR-12.1, BR-12.2, BR-12.3, BR-12.6,
  BR-12.7 `[OPEN: confirm Ukrainian legal minimum retention]`.
- **Plan references**: architecture §4.11 (support: ProblemReport aggregate), §4.13
  (audit-log: AuditLogEntry, `@AuditableAction` interceptor), the exact list of decorated
  methods from Phase 9's deliverables, the retention-flagging cron job. Phase 9 exit
  criteria.

### 10 — Analytics + Admin Panel

**Roadmap source**: Phase 10.

- **Capability-specific notes (spec)**: Cover role-scoped dashboard stats (today/week/
  month; STATION_OPERATOR sees only their assigned stations), CSV/XLSX export with
  date-range filtering, and the full set of admin panel views needed (dashboard, stations,
  locker detail, rentals list/detail, tariffs, users, audit log, support queue, org
  settings) described as business/UX requirements, not component design.
- **BR references**: BR-12.4, BR-12.5.
- **Plan references**: architecture §4.12 (direct-query stats + `daily_org_stats` rollup,
  StatsRollupJob subscribing to `RentalFinished`/`PaymentSucceeded`), Next.js admin-panel
  app structure, `next-intl` wiring. Phase 10 exit criteria.

### 11 — Multi-Tenant Hardening

**Roadmap source**: Phase 11.

- **Capability-specific notes (spec)**: Frame as a non-functional/business guarantee: two
  organizations' data (rentals, revenue, audit log) must never be visible to each other
  under any flow, and a renter's per-org Telegram bot secret must never authenticate them
  against a different organization.
- **BR references**: BR-02.1 (complete data isolation between white-label operators).
- **Plan references**: ADR-012, the exact cross-tenant automated e2e test scenarios listed
  in Phase 11 (rentals/active, analytics/summary, audit-log, webhook isolation, telegram
  exchange rejection), the Postgres Row-Level Security evaluation criteria. Phase 11 exit
  criteria.

### 12 — WebSockets + Mobile Readiness

**Roadmap source**: Phase 12.

- **Capability-specific notes (spec)**: Cover the business requirement for the admin
  dashboard to reflect locker status, rental start/finish, and station health changes
  live without a page refresh, and the platform-level commitment to a stable, documented
  v1 API contract as groundwork for a future mobile client — as policy/requirement
  statements, not implementation.
- **BR references**: none dedicated — this is a platform capability, not covered in
  business-rules.md.
- **Plan references**: WebSocket gateway `/ws/admin` scoped by `orgId`, the exact event
  subscription list (`LockerStatusChanged`, `RentalStarted`, `RentalFinished`,
  `StationHealthChanged`), admin panel live-update wiring, OpenAPI spec generation/
  publication as the contract artifact, v1 API breaking-change policy documentation. Note
  explicitly in the plan: "not a rearchitecture" — event bus and REST contracts already
  support this per the roadmap.

---

## 7. Execution Order

Process phases in the same order as the roadmap's dependency timeline (Phase 0 → 1 → 2 →
3 → 4 → 5 → 6 → 7 → 8 → {9, 10 in parallel} → 11 → 12), and within Phase 5, in the renter-
experienced order: Rental Registration → Reservation → Payment Initiation → Pickup →
Active Rental → Return → Overtime → Surcharge → Rental History. The constitution applies
to all of them uniformly and is generated once, first, before any spec/plan prompt.
