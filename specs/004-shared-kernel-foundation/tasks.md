# Tasks: Shared Kernel + Foundation

**Input**: Design documents from `/specs/004-shared-kernel-foundation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included for each user story per the spec's acceptance criteria.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure per implementation plan: `src/shared-kernel/{domain,application,infrastructure,interface}`, `tests/{unit,integration,e2e}/shared-kernel`
- [X] T002 Initialize NestJS project with TypeScript 5.x strict mode, add dependencies: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `drizzle-orm`, `@nestjs-drizzle/core`, `zod`, `@nestjs/event-emitter`, `@nestjs/terminus`, `uuid`
- [X] T003 [P] Configure linting (ESLint) and formatting (Prettier) per project conventions in `.eslintrc.js` and `.prettierrc`
- [X] T004 [P] Configure Vitest test runner in `vitest.config.ts` with paths for unit, integration, and e2e tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create Currency enum (`UAH` | `EUR`) in `src/shared-kernel/domain/value-objects/currency.ts`
- [X] T006 [P] Create EntityId<T> generic UUID wrapper in `src/shared-kernel/domain/value-objects/entity-id.ts`
- [X] T007 [P] Create OrgId extending EntityId<'OrgId'> in `src/shared-kernel/domain/value-objects/org-id.ts`
- [X] T008 [P] Create PhoneNumber value object with E.164 validation in `src/shared-kernel/domain/value-objects/phone-number.ts`
- [X] T009 [P] Create Locale value object (`uk` | `en') in `src/shared-kernel/domain/value-objects/locale.ts`
- [X] T010 [P] Create DomainEvent abstract base class with eventId, occurredAt, eventType in `src/shared-kernel/domain/events/domain-event.ts`
- [X] T011 [P] Create Result<T, E> utility with Ok/Err constructors, unwrap, map, flatMap in `src/shared-kernel/domain/result.ts`
- [X] T012 [P] Create EventBus port interface (publish, subscribe) in `src/shared-kernel/application/ports/event-bus.ts`
- [X] T013 [P] Create pagination request/response DTOs (page, pageSize, total, items) in `src/shared-kernel/interface/dto/pagination.ts`
- [X] T014 [P] Create ApiError envelope DTO (correlationId, code, message, timestamp) in `src/shared-kernel/interface/dto/api-error.ts`
- [X] T015 Create Zod schema for database config (DATABASE_URL, REDIS_URL) in `src/shared-kernel/infrastructure/database/config.schema.ts`
- [X] T016 Create ConfigModule with global Zod validation at startup in `src/shared-kernel/infrastructure/config/config.module.ts`
- [X] T017 Create Drizzle database connection module in `src/shared-kernel/infrastructure/database/connection.ts`
- [X] T018 Create shared-kernel NestJS module definition exporting all value objects, ports, and infrastructure in `src/shared-kernel/shared-kernel.module.ts`
- [X] T019 Configure nestjs-i18n with uk (primary) and en (secondary) locales, create translation files for shared error messages, wire i18n middleware globally in `src/shared-kernel/infrastructure/i18n/i18n.module.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Tenant Isolation (Priority: P1) 🎯 MVP

**Goal**: Every request is scoped to exactly one organization; cross-tenant data access is impossible by construction.

**Independent Test**: Make a request as Organization A, verify context propagation; attempt to access Organization B's data within same request and confirm inaccessibility.

### Tests for User Story 1

- [X] T020 [P] [US1] Unit test TenantContext: create, getOrgId, setOrgId, isolation between contexts in `tests/unit/shared-kernel/tenant-context.test.ts`

### Implementation for User Story 1

- [X] T021 [US1] Create TenantContext class using AsyncLocalStorage with getOrgId/setOrgId/static run methods in `src/shared-kernel/interface/middleware/tenant-context.ts`
- [X] T022 [US1] Create TenantMiddleware that reads orgId from JWT (or request header for dev) and sets TenantContext in `src/shared-kernel/interface/middleware/tenant.middleware.ts`
- [X] T023 [US1] Register TenantMiddleware globally in shared-kernel.module.ts

**Checkpoint**: TenantContext propagates orgId automatically; unscoped data access is refused.

---

## Phase 4: User Story 2 - Money Integrity (Priority: P1)

**Goal**: All monetary values are integer minor units with explicit currency; cross-currency arithmetic is rejected.

**Independent Test**: Create Money values, perform add/subtract/equals, verify integer precision and currency mismatch rejection.

### Tests for User Story 2

- [X] T024 [P] [US2] Unit test Money: add, subtract, equals, currency mismatch throws, invalid currency throws in `tests/unit/shared-kernel/money.test.ts`
- [X] T025 [P] [US2] Unit test EntityId: generate, from, equals, type safety in `tests/unit/shared-kernel/entity-id.test.ts`

### Implementation for User Story 2

- [X] T026 [US2] Create Money value object with amountMinor (integer), currency (Currency enum), add, subtract, equals, isGreaterThan, isLessThan, static from factory in `src/shared-kernel/domain/value-objects/money.ts`
- [X] T027 [US2] Add currency validation: Money.from rejects currencies outside {UAH, EUR} with clear error message in `src/shared-kernel/domain/value-objects/money.ts`

**Checkpoint**: Money arithmetic is exact; invalid currencies are rejected at construction time.

---

## Phase 5: User Story 3 - Fail-Fast Configuration (Priority: P1)

**Goal**: Application refuses to start with invalid or missing required configuration; never degrades silently.

**Independent Test**: Remove or corrupt a required config value, confirm startup fails with clear error; fix it, confirm startup succeeds.

### Tests for User Story 3

- [X] T028 [P] [US3] Integration test: missing DATABASE_URL fails startup in `tests/integration/shared-kernel/config-validation.test.ts`
- [X] T029 [P] [US3] Integration test: invalid DATABASE_URL fails startup in `tests/integration/shared-kernel/config-validation.test.ts`
- [X] T030 [P] [US3] Integration test: valid config allows startup in `tests/integration/shared-kernel/config-validation.test.ts`

### Implementation for User Story 3

- [X] T031 [US3] Implement Zod schema validation that runs at process startup before NestJS bootstrap in `src/shared-kernel/infrastructure/config/config.module.ts`
- [X] T032 [US3] Ensure clear error messages identify the specific missing/invalid config value (FR-009) in `src/shared-kernel/infrastructure/config/config.module.ts`

**Checkpoint**: Startup fails loudly on bad config; succeeds on valid config.

---

## Phase 6: User Story 4 - Health Check (Priority: P2)

**Goal**: Health endpoint reports system readiness and per-dependency status (database, cache).

**Independent Test**: Query health when all deps healthy (expect 200); stop database, confirm 503 with db: "error".

### Tests for User Story 4

- [X] T033 [P] [US4] Integration test: health returns 200 when all deps healthy in `tests/integration/shared-kernel/health.test.ts`
- [X] T034 [P] [US4] Integration test: health returns 503 when database down in `tests/integration/shared-kernel/health.test.ts`
- [X] T035 [P] [US4] Integration test: health returns 503 when Redis down in `tests/integration/shared-kernel/health.test.ts`
- [X] T036 [P] [US4] E2E test: GET /api/v1/health returns correct JSON shape in `tests/e2e/shared-kernel/health-e2e.test.ts`

### Implementation for User Story 4

- [X] T037 [US4] Create health check response DTOs (status, db, redis, details) in `src/shared-kernel/interface/dto/health.ts`
- [X] T038 [US4] Create HealthController with GET /api/v1/health endpoint using @nestjs/terminus in `src/shared-kernel/interface/health/health.controller.ts`
- [X] T039 [US4] Register HealthController in shared-kernel.module.ts in `src/shared-kernel/shared-kernel.module.ts`

**Checkpoint**: Health endpoint returns 200/503 with per-dependency status.

---

## Phase 7: User Story 5 - Consistent API Responses (Priority: P2)

**Goal**: All error responses and paginated responses follow uniform structure across the entire API.

**Independent Test**: Trigger errors on multiple endpoints, verify same response structure; paginate through list endpoints, verify same pagination shape.

### Tests for User Story 5

- [X] T040 [P] [US5] Unit test Result: Ok unwrap, Err unwrap, map, flatMap in `tests/unit/shared-kernel/result.test.ts`

### Implementation for User Story 5

- [X] T041 [US5] Create global exception filter that catches all exceptions and formats as ApiError envelope (correlationId, code, message, timestamp) in `src/shared-kernel/interface/filters/api-error.filter.ts`
- [X] T042 [US5] Register global exception filter in shared-kernel.module.ts in `src/shared-kernel/shared-kernel.module.ts`
- [X] T043 [US5] Ensure error responses never expose internal details (stack traces, db errors) per FR-016 in `src/shared-kernel/interface/filters/api-error.filter.ts`

**Checkpoint**: All API errors follow uniform ApiError structure; no internal details leaked.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [X] T044 [P] Run all unit tests and verify 100% pass rate
- [X] T045 [P] Run all integration tests and verify 100% pass rate
- [X] T046 Run quickstart.md validation scenarios V1-V9 and verify all pass
- [X] T047 Verify Constitution Check: all 10 principles still PASS after implementation
- [X] T048 [P] Verify module boundaries: shared-kernel has zero imports from other modules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational phase completion
  - US1 (Tenant Isolation) and US2 (Money Integrity) can proceed in parallel
  - US3 (Fail-Fast Config) depends on Phase 2 ConfigModule
  - US4 (Health Check) depends on Phase 2 Drizzle connection + ConfigModule
  - US5 (Consistent API) depends on Phase 2 ApiError DTO + Result utility
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Can start after Foundational — no dependencies on other stories
- **US3 (P1)**: Can start after Foundational — no dependencies on other stories
- **US4 (P2)**: Can start after Foundational — depends on ConfigModule (Phase 2 T016) and Drizzle connection (Phase 2 T017)
- **US5 (P2)**: Can start after Foundational — depends on ApiError DTO (Phase 2 T014) and Result utility (Phase 2 T011)

### Within Each User Story

- Tests written FIRST and confirmed failing before implementation
- Models/value objects before services
- Services before controllers/endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: All tasks T001–T004 marked [P] can run in parallel
- Phase 2: Tasks T005–T014 (value objects, ports, DTOs) can all run in parallel; T015–T018 (infra) depend on each other
- Phase 3: T020 (test) and T021–T023 (implementation) can run in parallel
- Phase 4: T024–T025 (tests) can run in parallel; T026–T027 (implementation) can run in parallel
- Phase 5: T028–T030 (tests) can run in parallel; T031–T032 can run in parallel
- Phase 6: T033–T036 (tests) can run in parallel; T037–T039 can run in parallel
- Phase 7: T040 (test) and T041–T043 (implementation) can run in parallel
- Phase 8: T044–T045 (tests) and T047–T048 (validation) can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all value objects together (different files):
Task: "Create Currency enum in src/shared-kernel/domain/value-objects/currency.ts"
Task: "Create EntityId<T> in src/shared-kernel/domain/value-objects/entity-id.ts"
Task: "Create OrgId in src/shared-kernel/domain/value-objects/org-id.ts"
Task: "Create PhoneNumber in src/shared-kernel/domain/value-objects/phone-number.ts"
Task: "Create Locale in src/shared-kernel/domain/value-objects/locale.ts"
Task: "Create DomainEvent base in src/shared-kernel/domain/events/domain-event.ts"
Task: "Create Result<T,E> in src/shared-kernel/domain/result.ts"
Task: "Create EventBus port in src/shared-kernel/application/ports/event-bus.ts"
Task: "Create pagination DTOs in src/shared-kernel/interface/dto/pagination.ts"
Task: "Create ApiError DTO in src/shared-kernel/interface/dto/api-error.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Tenant Isolation
4. Complete Phase 4: US2 — Money Integrity
5. **STOP and VALIDATE**: Run unit tests for US1 and US2; verify tenant isolation and money arithmetic work correctly
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 (P1) → Test independently → Deploy/Demo (MVP!)
3. Add US3 (P1) → Test independently → Deploy/Demo
4. Add US4 + US5 (P2) → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Exit Criteria Verification

Per the roadmap, Phase 1 exits when:
1. `GET /api/v1/health` returns 200 → T038 + T036
2. Zod validation rejects an intentionally broken `.env` → T031 + T028

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests written FIRST and confirmed failing before implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

---

## Phase 9: Convergence

**Purpose**: Close gaps between spec/plan intent and current implementation

- [X] T049 [US4] Implement nestjs-i18n module with uk (primary) and en (secondary) locales, create translation files for shared error messages, wire i18n middleware globally in `src/shared-kernel/infrastructure/i18n/i18n.module.ts` per FR-017 (missing)
- [X] T050 [US4] Wire actual Drizzle and Redis health indicators in `src/shared-kernel/interface/health/health.controller.ts` using @nestjs/terminus so the health endpoint returns real per-dependency status per FR-011/FR-012 (partial)
- [X] T051 [US3] Refactor `tests/integration/shared-kernel/config-validation.test.ts` to import `validateEnv` from `src/shared-kernel/infrastructure/config/env.ts` instead of duplicating the schema inline (partial)
- [X] T052 Remove unused `TenantContext.createMiddleware()` method from `src/shared-kernel/interface/middleware/tenant-context.ts` (unrequested dead code)
- [X] T053 Remove duplicate `EventEmitterModule.forRoot()` import from `src/shared-kernel/shared-kernel.module.ts` (already provided by `EventBusModule`) (unrequested redundancy)
