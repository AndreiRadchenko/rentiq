# Tasks: Locations + Pricing

**Input**: Design documents from `/specs/006-locations-pricing/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks ARE included — the plan's Testing strategy mandates unit + integration + contract tests (Constitution Quality & Verification Standards), so tests are treated as required, not optional.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Per `plan.md` Project Structure: Nx monorepo, single deployable `apps/api`, modules under `apps/api/src/modules/`. Tests under `tests/`. Drizzle migrations at repo-root `drizzle/`.

**Spec → Story map** (from spec.md):
- **US1** (P1): Renter sees only bookable lockers with correct prices → requires Station/Locker/InventoryKit/Tariff reads + bookability rule + renter endpoint + pricing quote.
- **US2** (P1): Admin manages stations, lockers, and tariffs → requires full CRUD for all four entities.
- **US3** (P2): Station connectivity auto-monitoring and recovery → `StationHealthChecker` cron + `StationHealthChanged` event + auto-reactivate logic.
- **US4** (P2): Automatic locker re-lock → `LockerAccessService` open/close + BullMQ auto-relock job + `SmartLockGateway` port + HA + mock adapters.
- **US5** (P2): Unauthorized door open detection and alerting → HA door-events webhook + `UnauthorizedDoorOpenDetected` event.
- **US6** (P3): Encrypted credential storage → `CryptoService` (AES-256-GCM) encrypts HA tokens + webhook secrets on persist, decrypts at call time; API responses mask tokens.

US1 and US2 are the MVP (P1); US3/US4/US5 are P2; US6 is P3. The shared data layer (Drizzle schema, domain aggregates, repositories) is foundational and split across Phase 2 + the earliest story that needs each piece.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module scaffolding for `locations` and `pricing` with the four Clean layers each, Nx boundary config, and test harness.

- [X] T001 Create `locations` module folder structure under `apps/api/src/modules/locations/` with `domain/`, `application/`, `infrastructure/`, `interface/` subfolders and barrel `index.ts`
- [X] T002 [P] Create `pricing` module folder structure under `apps/api/src/modules/pricing/` with `domain/`, `application/`, `infrastructure/`, `interface/` subfolders and barrel `index.ts`
- [X] T003 Configure Nx `enforce-module-boundaries` lint rule in `nx.json` / `.eslintrc` to forbid `locations` and `pricing` importing any other module's `domain/` or `infrastructure/` layer, and querying tables owned by other modules (Constitution Principle V)
- [X] T004 [P] Create test directory skeleton: `tests/unit/locations/`, `tests/unit/pricing/`, `tests/integration/locations/`, `tests/integration/pricing/`, `tests/contract/locations/`
- [X] T005 [P] Configure Vitest with Testcontainers PostgreSQL + Redis setup in `vitest.config.ts` and `tests/helpers/db.ts` (integration tests get a per-test isolated schema)
- [X] T006 [P] Register `EventBus` v1 (`@nestjs/event-emitter` wrapper from `shared-kernel`) in the `locations` and `pricing` module wiring so events publish/subscribe in-process; no direct `@nestjs/event-emitter` imports outside `shared-kernel`

**Checkpoint**: Both modules scaffolded; lint blocks cross-module layer imports; test harness runs an empty integration test against a real Postgres container.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared data layer, domain primitives, and ports that ALL user stories depend on. MUST be complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Define Drizzle schema for `stations` table in `apps/api/src/modules/locations/infrastructure/drizzle/schema/stations.ts` per `data-model.md` (uuid PK, `org_id` FK, enums `station_working_status` / `station_health_status`, `auto_lock_delay_sec` CHECK > 0, soft-delete `deleted_at`)
- [X] T008 [P] Define Drizzle schema for `lockers` table in `apps/api/src/modules/locations/infrastructure/drizzle/schema/lockers.ts` per `data-model.md` (uuid PK, `station_id` FK, enum `locker_status`, nullable `current_rental_id` FK, soft-delete)
- [X] T009 [P] Define Drizzle schema for `inventory_kits` table in `apps/api/src/modules/locations/infrastructure/drizzle/schema/inventory_kits.ts` per `data-model.md` (uuid PK, `station_id` FK, nullable `locker_id` FK, `kit_type` varchar, no soft-delete)
- [X] T010 [P] Define Drizzle schema for `tariffs` table in `apps/api/src/modules/pricing/infrastructure/drizzle/schema/tariffs.ts` per `data-model.md` (uuid PK, `org_id` FK, enum `day_type`, `duration_minutes` CHECK > 0, `price_minor` INTEGER CHECK >= 0, `currency` default `UAH`, partial unique index `UNIQUE (org_id, kit_type, day_type, duration_minutes) WHERE deleted_at IS NULL`, soft-delete)
- [X] T011 Generate the first `drizzle-kit` migration from T007–T010 schemas into `drizzle/locations-pricing/` (never hand-edit; regenerate if diff drifts — Constitution Principle VII)
- [X] T012 Create the critical indexes migration: `idx_stations_bookable`, `idx_lockers_available`, `idx_tariffs_lookup` per `data-model.md` "Critical Indexes" (can be part of T011 migration or an immediately-following one)
- [X] T013 [P] Implement `HaConnectionConfig` value object in `apps/api/src/locations/domain/ha-connection-config.vo.ts` (`urlOrIp`, `token`, `autoLockDelaySeconds > 0` validation on construction, value equality)
- [X] T014 [P] Implement the `SmartLockGateway` port interface in `apps/api/src/modules/locations/domain/smart-lock-gateway.port.ts` per `contracts/smart-lock-gateway-port.md` (`readDoorState`, `unlock`, `lock`, `isReachable`; `DoorState = 'OPEN'|'CLOSED'|'UNKNOWN'`; `GatewayUnreachableError`, `GatewayCommandError`)
- [X] T015 [P] Implement `MockSmartLockGateway` adapter in `apps/api/src/modules/locations/infrastructure/mock-smart-lock.gateway.ts` (in-memory `Map<LockerId, DoorState>` default CLOSED, `Set<stationId>` unreachable set with `mock.setReachable()`, deterministic <50 ms delays; default adapter in dev + CI when `HA_BASE_URL` absent)
- [X] T016 Implement `Station` aggregate in `apps/api/src/modules/locations/domain/station.aggregate.ts` (fields per `data-model.md`; methods: `markMaintenance()`, `setActive()`, `setVisible()`, `transitionHealth(newStatus, now)` enforcing the 2-fail→OFFLINE / 1-success→ONLINE debounce by caller-provided consecutive-count; returns whether a state transition occurred so the caller knows to publish)
- [X] T017 [P] Implement `Locker` aggregate in `apps/api/src/modules/locations/domain/locker.aggregate.ts` (fields per `data-model.md`; methods: `assignKit(kitId)`, `unassignKit()`, `release()` setting `current_rental_id=null, status=AVAILABLE`, `reserveFor(rentalId)` atomic guard; invariant `status=AVAILABLE ⟺ current_rental_id=null`)
- [X] T018 [P] Implement `InventoryKit` entity in `apps/api/src/modules/locations/domain/inventory-kit.entity.ts` (fields per `data-model.md`; `reassignTo(lockerId|null)`; historical rentals unaffected)
- [X] T019 [P] Implement `Tariff` aggregate in `apps/api/src/modules/pricing/domain/tariff.aggregate.ts` (fields per `data-model.md`; `Money` for price; immutable key fields `kitType/dayType/durationMinutes`; `softDelete()`; `lockPrice()` returns a `Money` snapshot)
- [X] T020 Implement `BookabilityRule.evaluate(station, locker, tariffsForToday): boolean` pure function in `apps/api/src/modules/locations/domain/bookability-rule.ts` — the 6 conditions of FR-001, where condition (a) checks the **effective** active state (`station.adminIntendedIsActive === true && station.healthStatus !== 'OFFLINE'`); no I/O
- [X] T021 [P] Implement domain events in `apps/api/src/modules/locations/domain/events/` (`StationCreated`, `StationVisibilityChanged`, `StationHealthChanged`, `LockerOpened`, `LockerClosed`, `UnauthorizedDoorOpenDetected`, `UnverifiedLockerFinish`) as plain serializable objects per `contracts/events.md`
- [X] T022 [P] Implement `TariffChanged` event in `apps/api/src/modules/pricing/domain/events/tariff-changed.event.ts` per `contracts/events.md`
- [X] T023 [P] Implement Drizzle repositories: `StationsRepository` in `apps/api/src/modules/locations/infrastructure/drizzle/stations.repository.ts`, `LockersRepository` in `.../lockers.repository.ts`, `InventoryKitsRepository` in `.../inventory-kits.repository.ts` — each scopes every query by `TenantContext.orgId` (Constitution Principle VI); `LockersRepository.reserveAtomic()` uses the conditional UPDATE from `data-model.md`; `release()` sets null+AVAILABLE
- [X] T024 [P] Implement `TariffsRepository` in `apps/api/src/modules/pricing/infrastructure/drizzle/tariffs.repository.ts` (`TenantContext.orgId` scoped; maps partial-unique-index violation to `DuplicateTariffError`; `findForQuote(orgId, kitType, dayType, durationMinutes)` excluding soft-deleted)
- [X] T025 [P] Implement `DayTypeResolver` in `apps/api/src/modules/pricing/infrastructure/day-type-resolver.ts` (`resolve(date, orgTimezone='Europe/Kyiv')`: WEEKEND = Sat/Sun in that timezone; pure, unit-testable)

**Checkpoint**: Foundation ready — schema migrated, aggregates + rule + port + mock adapter + events + repositories exist. User story implementation can now begin.

---

## Phase 3: User Story 1 + 2 — Admin CRUD + Renter Bookable List + Pricing Quote (Priority: P1) 🎯 MVP

**Goal**: An ORG_ADMIN can create stations, lockers, inventory kits, and tariffs; a Renter can query bookable stations and see correct prices per duration. This is the combined MVP because US1 (renter view) and US2 (admin CRUD) share the same data layer and the renter view depends on admin-created data existing — implementing them together yields the first demoable vertical slice (Phase 3 exit criterion: "create a station, assign lockers, configure tariffs").

**Independent Test**: Admin creates a station + 2 lockers + 2 kits + 3 tariffs (60/120/180 min WEEKDAY); sets `isVisibleToClients=true`; a Renter calls `GET /stations?visible=true&active=true` and sees exactly that station with `availableLockersCount=2`, and `GET /stations/:id/lockers` returns both lockers with the three tariff prices. Hiding the station removes it from the renter view.

### Tests for User Story 1+2

> Write these FIRST; they MUST fail before implementation.

- [X] T026 [P] [US1] Unit test `BookabilityRule.evaluate` in `tests/unit/locations/bookability-rule.spec.ts` — each of the 6 conditions independently toggled to false; all-true returns true (FR-001)
- [X] T027 [P] [US1] Unit test `DayTypeResolver` in `tests/unit/pricing/day-type-resolver.spec.ts` — Friday-23:55 Europe/Kyiv → WEEKDAY even though local time crosses into Saturday (FR-003); pure Saturday → WEEKEND
- [X] T028 [P] [US2] Unit test tariff uniqueness in `tests/unit/pricing/tariff-uniqueness.spec.ts` — duplicate insert returns `DuplicateTariffError`; soft-deleting then re-creating same key succeeds (FR-026); `lockPrice()` snapshot unaffected by later mutation (FR-027)
- [X] T029 [P] [US1] Integration test `GET /stations?visible=true&active=true` in `tests/integration/locations/bookable-stations.endpoint.spec.ts` — bookable station appears with `availableLockersCount`; hidden/inactive/MAINTENANCE station excluded (Scenarios 1+2 from quickstart.md)
- [X] T030 [P] [US1] Integration test `GET /stations/:id/lockers` renter variant in `tests/integration/locations/bookable-stations.endpoint.spec.ts` — only bookable lockers returned with correct tariffs for today's day type; locker with no kit or no tariff omitted (FR-001d/e, FR-002 defensive)
- [X] T031 [P] [US2] Integration test stations CRUD in `tests/integration/locations/stations.crud.spec.ts` — create defaults (isActive=true, isVisibleToClients=false, WORKING, UNKNOWN); independent active/visible toggles (FR-004); visible+inactive shows `TEMPORARILY_UNAVAILABLE` (FR-006)
- [X] T032 [P] [US2] Integration test lockers + inventory kits CRUD in `tests/integration/locations/lockers.crud.spec.ts` — create locker, create kit, assign kit via PATCH, unassign; reassign kit to a different locker; `MAINTENANCE` toggle (FR-033)
- [X] T033 [P] [US2] Integration test tariffs CRUD in `tests/integration/pricing/tariffs.crud.spec.ts` — create, list with filters, patch price (key immutable), soft-delete removes from renter view, duplicate rejected with `existingTariffId` (FR-026)
- [X] T034 [P] [US1] Integration test quote endpoint `GET /tariffs/quote` in `tests/integration/pricing/quote.endpoint.spec.ts` — returns exact `priceMinor`+`currency`+`tariffId`; 404 `TARIFF_NOT_FOUND` when no tariff for the key
- [X] T035 [P] [US2] Contract test `SmartLockGateway` port in `tests/contract/locations/smart-lock-gateway.contract.spec.ts` — runs the port contract against `MockSmartLockGateway`: idempotent `lock()`/`unlock()`, `readDoorState` UNKNOWN on unreachable, `isReachable()` false when set unreachable (Principle II contract equivalence)

### Implementation for User Story 1+2

- [X] T036 [P] [US2] Implement `StationsService` (application) in `apps/api/src/modules/locations/application/stations.service.ts` — `create()`, `update()` (independent active/visible toggles FR-004), `getById()`, `listAdmin()`; `@AuditableAction` decorator on create/update (Constitution Principle X)
- [X] T037 [P] [US2] Implement `LockersService` in `apps/api/src/modules/locations/application/lockers.service.ts` — `create()`, `update()` (assign/unassign kit, MAINTENANCE toggle), `listForStation()`; `@AuditableAction`
- [X] T038 [P] [US2] Implement `InventoryKitService` in `apps/api/src/modules/locations/application/inventory-kit.service.ts` — `create()`, `update()` (reassign), `retire()` (unassign, row retained); `@AuditableAction`
- [X] T039 [P] [US2] Implement `TariffService` in `apps/api/src/modules/pricing/application/tariff.service.ts` — `create()` mapping `DuplicateTariffError`→`Err(DuplicateTariff)`; `update()` (price only, key immutable); `softDelete()`; `list(filter)`; publishes `TariffChanged` on each mutation; `@AuditableAction`
- [X] T040 [US1] Implement `BookableStationsService` in `apps/api/src/modules/locations/application/bookable-stations.service.ts` — `listForRenter()`: query via `idx_stations_bookable` + `idx_lockers_available`, compose `availableLockersCount`, set `displayStatus=TEMPORARILY_UNAVAILABLE` when visible+inactive (FR-006); `listBookableLockers(stationId)`: filter through `BookabilityRule`, attach tariffs from `PricingService` for today's day type
- [X] T041 [P] [US1] Implement `PricingService.quote(orgId, kitType, dayType, durationMinutes): Result<Money, TariffNotFound>` in `apps/api/src/modules/pricing/application/pricing.service.ts` — calls `TariffsRepository.findForQuote`; pure lookup, no mutation
- [X] T042 [US2] Implement `StationsController` in `apps/api/src/modules/locations/interface/stations.controller.ts` — `GET /stations` (admin + renter variant via query flags), `POST /stations`, `GET /stations/:id`, `PATCH /stations/:id`, `GET /stations/:id/health`, `GET /stations/:id/lockers`; Zod DTOs in `interface/dto/`; RBAC guard (`ORG_ADMIN` for mutations, renter JWT for `?visible=true&active=true`)
- [X] T043 [P] [US2] Implement `LockersController` in `apps/api/src/modules/locations/interface/lockers.controller.ts` — `POST /lockers`, `PATCH /lockers/:id`; Zod DTOs; `ORG_ADMIN` guard
- [X] T044 [P] [US2] Implement `InventoryKitsController` in `apps/api/src/modules/locations/interface/inventory-kits.controller.ts` — `POST /inventory-kits`, `PATCH /inventory-kits/:id`, `DELETE /inventory-kits/:id`; Zod DTOs; `ORG_ADMIN` guard
- [X] T045 [P] [US2] Implement `TariffsController` in `apps/api/src/modules/pricing/interface/tariffs.controller.ts` — `GET /tariffs`, `POST /tariffs`, `PATCH /tariffs/:id`, `DELETE /tariffs/:id`, `GET /tariffs/quote`; Zod DTOs; `ORG_ADMIN` for mutations, renter/admin for quote; `Idempotency-Key` on POST
- [X] T046 [US1] Add the misconfiguration warning path: `LockersService.listAdmin()` flags lockers failing FR-001d/e (no kit / no tariff for today) so the admin endpoint response includes a `misconfigured: true` marker per locker (FR-002)
- [X] T047 [US1] Wire localization: all user-facing messages (validation errors, "temporarily unavailable" label, `DUPLICATE_TARIFF` message) produced via `nestjs-i18n` in caller locale (`uk`/`en`) — Constitution Principle IX; add the translation keys to `apps/api/src/i18n/{uk,en}/locations.json` and `.../pricing.json`

**Checkpoint**: Admin CRUD + renter bookable list + quote endpoint all functional. Scenarios 1, 2, 3 from quickstart.md pass. This is the MVP demo slice.

---

## Phase 4: User Story 3 — Station Connectivity Auto-Monitoring & Recovery (Priority: P2)

**Goal**: Periodic health check pings each active station's HA controller; on 2 consecutive failures the station is flagged OFFLINE and `StationHealthChanged` published; on recovery (1 success) it is reactivated to its admin-intended active state, but an admin's manual `isActive=false` is never overridden (FR-010).

**Independent Test**: With the mock adapter marking a station unreachable, the cron flags it OFFLINE within 2 check cycles and publishes `StationHealthChanged(isOnline=false)`; on restoring reachability it returns ONLINE and publishes recovery; an admin-manually-deactivated station is NOT auto-reactivated (Scenario 5 from quickstart.md).

### Tests for User Story 3

- [X] T048 [P] [US3] Unit test `StationHealthChecker` debounce logic in `tests/unit/locations/station-health-checker.spec.ts` — 2 consecutive failures → OFFLINE + publish; 1 success → ONLINE + publish; repeated failures while OFFLINE do NOT re-publish (flap-flood mitigation); admin `isActive=false` respected on recovery (FR-010)
- [X] T049 [P] [US3] Integration test health-check cron in `tests/integration/locations/health-checker.cron.spec.ts` — using `MockSmartLockGateway.setReachable(false)`, assert `GET /stations/:id/health` reflects OFFLINE within ~2 cycles and `StationHealthChanged` captured by a test subscriber; restore → ONLINE

### Implementation for User Story 3

- [X] T050 [US3] Implement `StationHealthChecker` domain service in `apps/api/src/modules/locations/domain/station-health-checker.service.ts` — `checkOne(station)`: calls `SmartLockGateway.isReachable()`, tracks consecutive-failure count per stationId (in-memory map or a small `station_health_state` table if restart-safety required — v1 in-memory is acceptable per ADR-003 since the cron re-evaluates on each tick), applies the 2-fail/1-success debounce, returns the transition (or none) so the cron publishes only on transition
- [X] T051 [US3] Implement `StationHealthCheckerCron` in `apps/api/src/modules/locations/infrastructure/jobs/station-health-checker.cron.ts` — `@Cron('*/30 * * * * *')` iterating active stations (`is_active=true`); resolves the per-station `HomeAssistantGateway` (or mock) via the adapter factory; on transition publishes `StationHealthChanged` via `EventBus`; updates `stations.health_status` + `last_health_check_at` via `StationsRepository`
- [X] T052 [US3] Implement the recovery-with-override logic in `StationHealthChecker`: when a station recovers, set `health_status=ONLINE` only — do NOT mutate `admin_intended_is_active` (FR-010). The effective `is_active` is derived (`admin_intended_is_active AND health_status != OFFLINE`) so it auto-restores if the admin intended active, and stays false if the admin had set `admin_intended_is_active=false`. The `admin_intended_is_active` column is added to the `stations` schema (see data-model.md) and updated only by admin PATCH operations (T036). Migration generated via drizzle-kit (never hand-edited).

**Checkpoint**: Scenario 5 (offline → event logged → recovery) passes on mock; on stage the same scenario runs against real HA.

---

## Phase 5: User Story 4 — Automatic Locker Re-Lock (Priority: P2)

**Goal**: Any locker opened (by renter via rentals Phase 5, or by admin manual open) is automatically re-locked after the station's `autoLockDelaySec` (default 30s), even with no explicit close; an explicit close before the timer produces no double-lock error (FR-015 idempotent).

**Independent Test**: `POST /lockers/:id/open` (admin) opens the locker via the mock adapter; with no close sent, the locker is locked within `autoLockDelaySec + 5s` (35s default); an explicit close before the timer produces no error (Scenario 4 from quickstart.md).

### Tests for User Story 4

- [X] T053 [P] [US4] Unit test `LockerAccessService` open/close orchestration in `tests/unit/locations/locker-access.service.spec.ts` — `openLocker()` schedules a BullMQ delayed job at `now + autoLockDelaySec`; `closeLocker()` cancels the pending job and calls `lock()`; idempotent `lock()` on already-locked is a no-op (FR-015)
- [X] T054 [P] [US4] Integration test open + auto-relock in `tests/integration/locations/locker-open-close.spec.ts` — admin `POST /lockers/:id/open`; wait ~35s; assert `LockerClosed(actorType=SYSTEM)` published and mock adapter reports locked; idempotent-close sub-check (open, immediate close, wait for timer → no double-lock error)

### Implementation for User Story 4

- [X] T055 [US4] Implement `LockerAccessService` domain service in `apps/api/src/modules/locations/domain/locker-access.service.ts` — `openLocker(lockerId, actorType, actorId, rentalId?)`: resolves station config, calls `SmartLockGateway.unlock()`, publishes `LockerOpened`, schedules auto-relock via `AutoRelockProducer`; `closeLocker(...)`: calls `lock()` (idempotent), publishes `LockerClosed`, cancels pending job; returns `Err(GatewayUnreachableError)` / `Err(GatewayCommandError)` mapped to API errors
- [X] T056 [P] [US4] Implement `AutoRelockProducer` in `apps/api/src/modules/locations/infrastructure/bullmq/auto-relock.producer.ts` — schedules a BullMQ delayed job with absolute-deadline payload `{ lockerId, lockAt: ISO8601 }` (ADR-003); `cancel(lockerId)` removes the pending job
- [X] T057 [US4] Implement `AutoRelockWorker` in `apps/api/src/modules/locations/infrastructure/bullmq/auto-relock.worker.ts` — on pickup: if `now < lockAt` re-delay; if locker already CLOSED (query `LockerRepository`) → no-op; else call `SmartLockGateway.lock()` (idempotent); on `GatewayUnreachableError` retry with backoff, escalate to admin alert after N retries; publishes `LockerClosed(actorType=SYSTEM)`
- [X] T058 [US4] Add `POST /lockers/:id/open` and `POST /lockers/:id/close` admin endpoints to `LockersController` (or a dedicated `LockerAccessController`) — `ORG_ADMIN`/`STATION_OPERATOR` guard; `@AuditableAction`; map `GatewayUnreachableError`→503 `LOCKER_STATION_OFFLINE`, `GatewayCommandError`→502 `LOCKER_OPEN_FAILED`/`LOCKER_CLOSE_FAILED`
- [X] T059 [US4] Implement `HomeAssistantGateway` adapter in `apps/api/src/locations/infrastructure/home-assistant.gateway.ts` — per-station instance from `HaConnectionConfig`; uses the decrypted token (from `CryptoService.decrypt()` in the repository, plaintext in memory only); HA REST calls with connect 3s / read 5s timeouts; `isReachable()` = cheap HA `/api/` ping; maps HA states to `DoorState`; registered only when `HA_BASE_URL` present (stage/prod), else mock is default

**Checkpoint**: Scenario 4 passes on mock; stage variant physically opens + re-locks a real locker (Phase 3 exit criterion).

---

## Phase 6: User Story 5 — Unauthorized Door Open Detection & Alerting (Priority: P2)

**Goal**: An HA door-event reporting `OPEN` on a locker with no active/pickup-ready rental publishes `UnauthorizedDoorOpenDetected` and alerts admins immediately, regardless of MAINTENANCE mode (FR-017); an expected open (active/pickup-ready rental) publishes `LockerOpened` instead (FR-018). `doorState` and `eventTimestamp` are optional in the request body.

**Independent Test**: `POST /api/v1/webhooks/ha/door-events` with `doorState=OPEN` on an AVAILABLE locker → `UnauthorizedDoorOpenDetected` published; on a locker with an active rental → `LockerOpened` published, no unauthorized alert; under MAINTENANCE the unauthorized alert still fires (Scenario 6 from quickstart.md).

### Tests for User Story 5

- [X] T060 [P] [US5] Integration test door-events webhook in `tests/integration/locations/door-event-webhook.spec.ts` — `OPEN` on AVAILABLE locker → `UnauthorizedDoorOpenDetected`; `OPEN` with active rental (set `current_rental_id` directly in test) → `LockerOpened`; `CLOSED` → `LockerClosed` + job cancel; `UNKNOWN` (and omitted `doorState`) → no alert, logged; MAINTENANCE station + unauthorized open → alert still fires (FR-017); wrong/missing shared-secret → 401

### Implementation for User Story 5

- [X] T061 [US5] Implement `HaDoorEventsController` in `apps/api/src/modules/locations/interface/ha-door-events.controller.ts` — `POST /api/v1/webhooks/ha/door-events`; shared-secret header guard (`X-HA-Webhook-Secret` validated per station); Zod body DTO with `doorState` and `eventTimestamp` optional; org resolved from the station
- [X] T062 [US5] Implement the door-event handler logic in `apps/api/src/modules/locations/application/door-event.handler.ts` (or as a method on `LockerAccessService`) — on `OPEN`: if `locker.current_rental_id` is null AND no pickup-ready rental → publish `UnauthorizedDoorOpenDetected(lockerId, stationId)` (FR-016); else publish `LockerOpened(rentalId?)` (FR-018); on `CLOSED`: publish `LockerClosed` + cancel auto-relock job; on `UNKNOWN`: log for admin awareness, no alert (Error Scenarios); MAINTENANCE does not suppress the unauthorized alert (FR-017)

**Checkpoint**: Scenario 6 passes. The `notifications` module (Phase 6 of the roadmap) will subscribe to `UnauthorizedDoorOpenDetected` to deliver the actual admin alert within 1 minute (NFR); in Phase 3 a test subscriber captures the event.

---

## Phase 7: User Story 6 — Secret-Store-Only Credential Storage (Priority: P3)

**Goal**: Each station's controller token and webhook secret are stored encrypted in the database (AES-256-GCM via `CryptoService`, `MASTER_KEY` in `.env`); decrypted only at call time by the repository, never persisted as plaintext in business data or logs (FR-019/020/021). API responses mask token fields to the last 4 characters.

**Independent Test**: Create a station via the API and inspect the persisted DB row — `ha_token_encrypted` is ciphertext, raw token absent; the `StationRepository` decrypts it on read and `HomeAssistantGateway` uses the plaintext in memory only; API GET response shows `haToken: "****xxxx"` (masked); rotating the token via PATCH takes effect on the next command.

### Tests for User Story 6

- [X] T063 [P] [US6] Unit test `CryptoService` encrypt/decrypt round-trip + masking in `tests/unit/shared-kernel/crypto.service.spec.ts`

### Implementation for User Story 6

- [X] T064 [US6] `CryptoService` integrated into `StationRepository` + `OrganizationRepository`; `HomeAssistantGateway` receives plaintext from domain (already decrypted by repository); `MASTER_KEY` validated in `Env` Zod schema
- [ ] T065 [US6] Add a secret-hygiene guard: a lint rule or unit test asserting no `console.*` / logger call in `apps/api/src/locations/` includes the decrypted token; the `@AuditableAction` interceptor redacts `haToken`-adjacent fields in audit payloads (Constitution Principle X)
- [X] T066 [US6] Ensure `StationsController` responses never serialize the raw HA token to renters (or admins); `haToken` and `haWebhookSecret` are masked (`****xxxx`) in all API responses via `CryptoService.mask()`

**Checkpoint**: US6 passes; secret hygiene enforced.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Concerns that span multiple stories and final validation.

- [X] T067 DEFERRED TO PHASE 5 (rentals). The `LockerReconciliationJob` queries the `rentals` table, which does not exist until Phase 5. The job itself (`apps/api/src/modules/locations/infrastructure/jobs/locker-reconciliation.job.ts`) and its `@Cron('0 * * * *')` registration are implemented in Phase 5 alongside the `rentals` module. In Phase 3, only the event-handler side (T068) is delivered, so the release path exists for Phase 5 to publish into. The `LockerReconciliationJob` stub (empty class + TODO) may be committed now to reserve the file path, but MUST NOT query `rentals`.
- [X] T068 [P] Implement the `RentalFinished`/`RentalCancelled` event handlers in `apps/api/src/modules/locations/application/rental-event-handlers.ts` — subscribe to both events (via `EventBus`); for each `lockerId` in payload call `LockersRepository.release(lockerId)` (sets `current_rental_id=null, status=AVAILABLE`). Unit-test with synthetic events now (no `rentals` table needed — the handler receives the event payload, not a DB row); `rentals` starts publishing in Phase 5. This is the sole Phase 3 release-path deliverable; the polling safety net (`LockerReconciliationJob`, T067) is deferred to Phase 5.
- [X] T069 [P] Add the `OvertimeCalculator` pure function stub in `apps/api/src/modules/pricing/domain/overtime-calculator.service.ts` — signature per `contracts/` research R6: `calculate(bookingDayType, paidDurationMinutes, actualDurationMinutes, tariffs[]) → { bandDurationMinutes, totalPrice, surchargeAmount }`; returns surcharge=0 if no band exceeds paid duration; NOT yet called by any application service (Phase 5 Overtime spec owns the semantics)
- [X] T070 [P] Unit test `OvertimeCalculator` band-rounding arithmetic in `tests/unit/pricing/overtime-calculator.spec.ts` — synthetic tariffs; rounds actual duration up to nearest band; surcharge = sum of bands beyond paid duration; zero surcharge when within paid band (locks in the contract for Phase 5)
- [X] T071 [P] Update OpenAPI docs for all new endpoints in `apps/api/src/openapi/` (or `apps/api/openapi.yaml`) — stations, lockers, inventory-kits, tariffs, quote, door-events webhook, locker open/close; keep current as part of this change (Constitution Quality & Verification)
- [X] T072 [P] Cross-tenant isolation integration test in `tests/integration/cross-tenant.spec.ts` — two orgs; assert no org-A data leaks into org-B queries across stations, lockers, kits, tariffs (Scenario 7 from quickstart.md; Constitution Principle VI)
- [X] T073 Run full quickstart.md validation locally: Scenarios 1–7 against the mock adapter; all green
- [ ] T074 Run stage validation: Scenario 4 real-HA open/relock + Scenario 5 real disconnect/recovery — satisfies Phase 3 exit criteria requiring physical hardware
- [X] T075 Code cleanup: remove any `@phase5`-tagged skipped tests or TODO markers that were temporary scaffolding; ensure Nx `enforce-module-boundaries` lint passes with no violations; `pnpm lint` + `pnpm typecheck` green

**Checkpoint**: All Phase 3 exit criteria met — admin can create station/lockers/tariffs; `POST /lockers/:id/open` opens a real test locker on stage; station-offline event logged on disconnect.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **Phase 3 (US1+US2, MVP)**: Depends on Phase 2. This is the combined P1 slice.
- **Phase 4 (US3)**: Depends on Phase 2 + the `SmartLockGateway` port + mock adapter from Phase 2 (T014/T015). Can run in parallel with Phase 3 if team capacity allows, since it touches different files (cron, health-checker service) — but the `StationsController` `/health` endpoint from Phase 3 is reused, so sequence after Phase 3 if single-developer.
- **Phase 5 (US4)**: Depends on Phase 2 (port, mock, `Locker` aggregate) + the `LockerAccessService` which is new here. Can run in parallel with Phase 4 (different files: BullMQ worker/producer vs. health cron).
- **Phase 6 (US5)**: Depends on Phase 5 (`LockerOpened`/`LockerClosed` events + `LockerAccessService` exist) — the door-event handler reuses the open/close publishing path. Sequence after Phase 5.
- **Phase 7 (US6)**: Depends on Phase 5 (`HomeAssistantGateway` from T059) — the encrypted-credential integration is exercised through the gateway. Can run in parallel with Phase 6 if the gateway is already merged.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 + US2 (P1, MVP)**: Can start after Phase 2. No dependencies on other stories. US1 (renter view) consumes the data US2 (admin CRUD) creates, so they are delivered together as one vertical slice.
- **US3 (P2)**: After Phase 2 (port + mock) and ideally after Phase 3 (`/health` endpoint reused). Independent of US4/US5/US6.
- **US4 (P2)**: After Phase 2 (port + mock + `Locker` aggregate). Independent of US3; parallelizable with US3.
- **US5 (P2)**: After US4 (reuses `LockerOpened`/`LockerClosed` + `LockerAccessService`).
- **US6 (P3)**: After US4 (`HomeAssistantGateway`). Independent of US5; parallelizable with US5.

### Within Each User Story

- Tests written FIRST and FAIL before implementation (TDD — Constitution Quality & Verification Standards mandate coverage).
- Domain aggregates/primitives before application services.
- Application services before interface controllers.
- Core implementation before integration wiring.
- Story complete before moving to next priority.

### Parallel Opportunities

- **Phase 1**: T002, T004, T005, T006 are all `[P]` — different files, no deps.
- **Phase 2**: T008, T009, T010, T013, T014, T015, T017, T018, T019, T021, T022, T023, T024, T025 are all `[P]` — different files, depend only on T007/T011/T012/T016/T020 which are sequential.
- **Phase 3**: The five test tasks T026–T035 are all `[P]`; the four service tasks T036–T039 are `[P]`; controllers T043–T045 are `[P]`.
- **Phase 4 ↔ Phase 5**: Different files (health cron vs. BullMQ relock) — parallelizable by two developers once Phase 2 + Phase 3 are merged.
- **Phase 6 ↔ Phase 7**: Different files (webhook handler vs. encrypted-credential hygiene) — parallelizable once Phase 5 is merged.
- **Phase 8**: T067–T072 are all `[P]` (different cross-cutting concerns).

---

## Parallel Example: User Story 1+2 (Phase 3)

```bash
# Launch all tests for US1+US2 together (TDD — they fail first):
Task: "T026 bookability-rule.spec.ts"
Task: "T027 day-type-resolver.spec.ts"
Task: "T028 tariff-uniqueness.spec.ts"
Task: "T029 bookable-stations.endpoint.spec.ts"
Task: "T031 stations.crud.spec.ts"
Task: "T033 tariffs.crud.spec.ts"
Task: "T035 smart-lock-gateway.contract.spec.ts"

# Once tests fail as expected, launch all domain/service tasks in parallel:
Task: "T036 StationsService"
Task: "T037 LockersService"
Task: "T038 InventoryKitService"
Task: "T039 TariffService"
Task: "T041 PricingService"
# Then the orchestrating services + controllers (sequential, depend on the above):
Task: "T040 BookableStationsService"
Task: "T042 StationsController"
Task: "T045 TariffsController"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 only)

1. Complete Phase 1: Setup (module scaffolding, lint, test harness).
2. Complete Phase 2: Foundational (schema, aggregates, port, mock, repositories, events) — CRITICAL, blocks all stories.
3. Complete Phase 3: US1+US2 (admin CRUD + renter bookable list + quote).
4. **STOP and VALIDATE**: Run quickstart.md Scenarios 1, 2, 3 locally against the mock adapter. All green → demoable MVP.
5. Deploy to stage for the real-HA scenarios only after US4 (open/relock) is also done.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1+US2 → MVP demo (admin configures, renter sees bookable lockers + prices).
3. + US3 → connectivity auto-monitoring demo (offline → event logged → recovery).
4. + US4 → auto-relock demo (open locker, watch it re-lock; stage: real locker opens).
5. + US5 → unauthorized-door-open alert demo.
6. + US6 → secret-hygiene hardening.
7. Polish → reconciliation job, `OvertimeCalculator` stub, OpenAPI, cross-tenant tests, stage exit-criteria run.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: US1+US2 (the MVP slice — highest priority).
   - Developer B: US3 (health checker) — parallel with A, different files.
   - Developer C: US4 (auto-relock) — parallel with A and B, different files.
3. US5 (door-event webhook) starts once US4 merges (reuses `LockerAccessService` events).
4. US6 (encrypted credentials) starts once US4's `HomeAssistantGateway` merges.
5. Polish done by the whole team once all stories merge.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks.
- `[Story]` label maps a task to its user story for traceability; Setup/Foundational/Polish tasks have NO story label.
- Each user story is independently completable and testable against the `MockSmartLockGateway`; real-HA validation is stage-only.
- Verify tests fail before implementing (TDD).
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- The `OvertimeCalculator` (T069/T070) is a contract-freezing stub — its full overtime semantics are owned by the Overtime spec (`05-rentals/07-overtime`) and must NOT be guessed here.
- The `LockerReconciliationJob` (T067) and the `RentalFinished`/`RentalCancelled` handlers (T068) are wired now but no-op until `rentals` (Phase 5) exists — they are the canonical locker-release path that Phase 5 will publish into.
