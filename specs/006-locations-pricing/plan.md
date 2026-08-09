# Implementation Plan: Locations + Pricing

**Branch**: `006-locations-pricing` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-locations-pricing/spec.md`

## Summary

Deliver the `locations` and `pricing` modules (Phase 3) of the rentiq modular monolith:
station/locker/inventory-kit/tariff CRUD, the bookability filtering rule (BR-03.2), the
kit-type→tariff pricing structure with admin-configured duration options (BR-04.x), the
`SmartLockGateway` port with a Home Assistant adapter and a mock adapter, automatic
station connectivity monitoring (`StationHealthChecker`), mandatory auto-relock via
BullMQ delayed jobs (`LockerAccessService`), unauthorized-door-open detection, the
renter-facing bookable-stations endpoint, and the `LockerReconciliationJob` safety net.
Both modules depend on `shared-kernel` and `organizations` only; `pricing` exposes a
synchronous `PricingService.quote()` that `rentals` (Phase 5) will call later.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (NestJS modular monolith — ADR-001).

**Primary Dependencies**: NestJS, Drizzle ORM (NEON PostgreSQL), drizzle-kit (migrations),
Nx + pnpm monorepo with `enforce-module-boundaries`, BullMQ (delayed auto-relock jobs +
Redis), `@nestjs/event-emitter` (in-process `EventBus` v1), `nestjs-i18n`, Zod (DTO
validation — established in Phase 1), `@nestjs/schedule` (`@Cron` for health check +
reconciliation).

**Storage**: PostgreSQL 16 via Drizzle ORM only (ADR-002). Tables: `stations`, `lockers`,
`inventory_kits`, `tariffs` (new in this phase). Reference `organizations` (existing from
Phase 2) for `org_id` FK. No direct SQL outside repositories; migrations generated via
`drizzle-kit`, never hand-edited.

**Testing**: Vitest (unit + integration). Unit tests for domain bookability rule
evaluation, `OvertimeCalculator` band rounding, and tariff uniqueness. Integration tests for
each API endpoint against a Testcontainers PostgreSQL + in-process `EventBus`, using a
`MockSmartLockGateway` (always available) — real HA exercised only on stage. Contract
tests for the `SmartLockGateway` port against the mock adapter.

**Target Platform**: Linux server (Docker Compose in dev/CI, on-host on stage —
ADR-011). Single deployable NestJS process.

**Project Type**: Web service (modular monolith). Module per feature, Clean/Hexagonal
layering inside each module.

**Performance Goals**:
- Renter-facing bookable-stations list < 2 s p95 for one org with up to 50 stations / 500
  lockers (spec NFR).
- Health-check outage → OFFLINE flag within ~3 minutes worst case (60 s interval × 2
  consecutive failures — Clarification 2026-08-09).
- Unauthorized-door-open admin alert delivered within 1 minute of detection.

**Constraints**:
- Money as `Money(amountMinor, currency)` integer minor units, default UAH — never
  float/text (Constitution Principle III).
- `org_id` on every business table from first migration; `TenantContext` (AsyncLocalStorage)
  is the sole scoping source in repositories (Principle VI).
- Domain layer has zero NestJS dependencies; controllers have no business logic
  (Principle I).
- External systems (Home Assistant, secret store) only behind named ports; adapters live
  in infrastructure (Principle II).
- Cross-module side effects via `EventBus` only; no module reads another's tables
  (Principles IV, V).
- Append-only audit for station/locker/kit/tariff admin changes (Principle X).
- Auto-relock uses absolute-deadline scheduling (ADR-003) — survives process restarts.

**Scale/Scope**: One org default in v1; designed for multi-tenant from day one. Per-org:
up to 50 stations, 500 lockers, ~100 tariffs. Background jobs: 1 health-check cron tick
per 60 s iterating all active stations; 1 reconciliation cron hourly + on startup.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|---|---|---|
| I | Modular Monolith + Clean Layering | PASS | `locations` and `pricing` are separate NestJS modules, each with `domain/` `application/` `infrastructure/` `interface/` layers. Domain layer has no NestJS imports. Controllers thin. |
| II | Hexagonal Isolation via Named Ports | PASS | `SmartLockGateway` port owned by `locations` domain; `HomeAssistantGateway` + `MockSmartLockGateway` adapters live only in `infrastructure`. Secret store access via `SecretStore` port from `organizations`. |
| III | Domain-Driven Modeling & Money Integrity | PASS | `Station`, `Locker`, `Tariff` aggregates; `InventoryKit` entity; `HaConnectionConfig`, `Money` VOs. Price stored as `price_minor` INTEGER + `currency`. `OvertimeCalculator` is a pure domain service. |
| IV | Event-Driven Cross-Module Communication | PASS | `locations` publishes `StationCreated`, `StationVisibilityChanged`, `StationHealthChanged`, `LockerOpened`, `LockerClosed`, `UnauthorizedDoorOpenDetected`, `UnverifiedLockerFinish`. `notifications` (Phase 6) and `audit-log` subscribe — no direct calls. `pricing` publishes `TariffChanged`. |
| V | Mechanically Enforced Module Boundaries | PASS | Nx `enforce-module-boundaries` lint rule fails the build if `locations` or `pricing` imports another module's `domain/` or `infrastructure/`, or queries another module's tables. |
| VI | Multi-Tenant Isolation by Default | PASS | `stations`, `lockers` (via station), `inventory_kits` (via station), `tariffs` all carry `org_id`. Repositories scope every query by `TenantContext.orgId`. |
| VII | Sole Persistence Path: PostgreSQL + Drizzle | PASS | All four tables accessed via Drizzle repositories only; migrations generated by `drizzle-kit`. No raw SQL. |
| VIII | Process-Isolated, Thin Client Surfaces | N/A this phase | No bot/admin UI work in Phase 3. API-only. |
| IX | Backend-Owned Internationalization | PASS | All user-facing business messages (errors, "temporarily unavailable" label, alerts) produced by the API in caller locale via `nestjs-i18n`. |
| X | Security and Data Integrity by Default | PASS | JWT RS256 + RBAC (`ORG_ADMIN`, `STATION_OPERATOR`) on every endpoint; station/locker/kit/tariff admin mutations go through `@AuditableAction` → append-only `audit-log`. Tariffs are soft-deletable config data (not financial); `tariffs.deleted_at` permitted. `rental_status_history`-style append-only tables not introduced here. |
| Quality & Verification | Unit + Integration + Contract tests | PASS | Unit tests for bookability rule + `OvertimeCalculator`; integration tests per endpoint; contract tests for `SmartLockGateway` against mock. |
| Delivery Workflow | Phase-by-phase, working system | PASS | Phase 3 ends in a demoable working slice per exit criteria. No big-bang. |

**Gate Result**: PASS — no violations, no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/006-locations-pricing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST + event contracts)
│   ├── locations-api.md
│   ├── pricing-api.md
│   ├── smart-lock-gateway-port.md
│   └── events.md
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── locations/
│   ├── domain/
│   │   ├── station.aggregate.ts            # Station + HaConnectionConfig VO
│   │   ├── locker.aggregate.ts             # Locker + LockerStatus enum
│   │   ├── inventory-kit.entity.ts
│   │   ├── bookability-rule.ts              # pure FR-001 evaluator
│   │   ├── locker-access.service.ts        # domain service: open/close orchestration
│   │   ├── station-health-checker.service.ts
│   │   ├── smart-lock-gateway.port.ts       # SmartLockGateway port
│   │   └── events/                          # StationCreated, StationHealthChanged, ...
│   ├── application/
│   │   ├── stations.service.ts             # CRUD use cases
│   │   ├── lockers.service.ts
│   │   ├── inventory-kit.service.ts
│   │   ├── bookable-stations.service.ts     # renter-facing query
│   │   └── dto/
│   ├── infrastructure/
│   │   ├── drizzle/
│   │   │   ├── stations.repository.ts
│   │   │   ├── lockers.repository.ts
│   │   │   ├── inventory-kits.repository.ts
│   │   │   └── schema/                      # Drizzle table defs (migrations via drizzle-kit)
│   │   ├── home-assistant.gateway.ts       # SmartLockGateway adapter
│   │   ├── mock-smart-lock.gateway.ts       # dev/test adapter
│   │   ├── bullmq/
│   │   │   ├── auto-relock.producer.ts
│   │   │   └── auto-relock.worker.ts
│   │   └── jobs/
│   │       ├── station-health-checker.cron.ts
│   │       └── locker-reconciliation.job.ts
│   └── interface/
│       ├── stations.controller.ts
│       ├── lockers.controller.ts
│       ├── inventory-kits.controller.ts
│       ├── ha-door-events.controller.ts    # POST /webhooks/ha/door-events
│       └── dto/
└── pricing/
    ├── domain/
    │   ├── tariff.aggregate.ts
    │   ├── overtime-calculator.service.ts   # pure domain service (referenced, stubbed)
    │   └── events/tariff-changed.event.ts
    ├── application/
    │   ├── pricing.service.ts              # quote(orgId, kitType, dayType, duration) → Money
    │   ├── tariff.service.ts               # CRUD use cases
    │   └── dto/
    ├── infrastructure/
    │   ├── drizzle/
    │   │   ├── tariffs.repository.ts
    │   │   └── schema/
    │   └── day-type-resolver.ts            # WEEKDAY/WEEKEND by org timezone + booking date
    └── interface/
        ├── tariffs.controller.ts
        └── dto/

tests/
├── unit/
│   ├── locations/bookability-rule.spec.ts
│   ├── locations/locker-access.service.spec.ts
│   ├── locations/station-health-checker.spec.ts
│   ├── pricing/overtime-calculator.spec.ts
│   └── pricing/tariff-uniqueness.spec.ts
├── integration/
│   ├── locations/stations.crud.spec.ts
│   ├── locations/lockers.crud.spec.ts
│   ├── locations/bookable-stations.endpoint.spec.ts
│   ├── locations/locker-open-close.spec.ts
│   ├── locations/door-event-webhook.spec.ts
│   ├── locations/health-checker.cron.spec.ts
│   ├── locations/reconciliation.job.spec.ts
│   ├── pricing/tariffs.crud.spec.ts
│   └── pricing/quote.endpoint.spec.ts
└── contract/
    └── locations/smart-lock-gateway.contract.spec.ts   # runs against MockSmartLockGateway

drizzle/                                     # repo-root migrations
└── locations-pricing/                       # drizzle-kit generated; NOT hand-edited
```

**Structure Decision**: Nx monorepo, single deployable `apps/api`, one folder per module
under `apps/api/src/modules/`, each with the four Clean layers. `locations` and `pricing`
are sibling modules with no horizontal import between them — `pricing` is called by
`rentals` (Phase 5) synchronously via its public application-service interface, and by
`locations` not at all. Module boundaries mechanically enforced by Nx
`enforce-module-boundaries` (Principle V).

## Complexity Tracking

> Not used — Constitution Check passed with no violations.

## Phases

### Phase 0: Outline & Research

See `research.md`. Resolves the open technical unknowns:
- Per-station HA connection resolution pattern (one gateway instance per station).
- BullMQ delayed-job scheduling vs. in-process timer for auto-relock (chosen: BullMQ,
  absolute-deadline, restart-safe per ADR-003).
- Health-check debounce implementation (2-fail → OFFLINE, 1-success → ONLINE).
- Secret store abstraction boundary (owned by `organizations`; `locations` receives
  only an opaque `tokenRef` and resolves via the `SecretStore` port).
- `OvertimeCalculator` scope boundary for Phase 3 (stubbed pure function; full spec
  resolved in the Overtime spec `05-rentals/07-overtime`).

### Phase 1: Design & Contracts

See `data-model.md`, `contracts/`, and `quickstart.md`.

- `data-model.md`: Station, Locker, InventoryKit, Tariff aggregates/entities with fields,
  validation rules, state transitions, indexes.
- `contracts/locations-api.md`, `contracts/pricing-api.md`: full REST contract.
- `contracts/smart-lock-gateway-port.md`: the hexagonal port contract.
- `contracts/events.md`: events published by both modules with payload schemas.
- `quickstart.md`: end-to-end validation scenarios mapping to Phase 3 exit criteria.

## Risks & Mitigations

| Risk | Phase | Mitigation |
|---|---|---|
| HA test device unavailable on stage | 3 | `MockSmartLockGateway` always available for local dev + CI; real HA exercised only on stage. All integration tests run against the mock. |
| Auto-relock job lost on process restart | 3 | BullMQ persists delayed jobs in Redis; absolute-deadline timestamp (ADR-003) means a missed deadline fires immediately on worker restart. |
| Health-check flapping floods admins | 3 | Debounce: 2 consecutive failures → OFFLINE, 1 success → ONLINE (Clarification 2026-08-09). Alert only on state transition, not on each failed check. |
| Tariff duplicate race under concurrent admin writes | 3 | Partial unique index `UNIQUE (org_id, kit_type, day_type, duration_minutes) WHERE deleted_at IS NULL` enforces uniqueness at DB level; repository maps constraint violation to a `DuplicateTariffError`. |
| Day-type boundary mispricing | 3 | Day type resolved from booking creation date in org timezone (BR-04.2); `DayTypeResolver` unit-tested for the Friday-23:55→Saturday case. |
| Cross-tenant data leak | 3 | `TenantContext.orgId` propagates via AsyncLocalStorage; repositories scope every query. Cross-tenant isolation test added to integration suite. |

## Migration Considerations

Greenfield — no existing data to migrate. The four new tables are created by the first
`drizzle-kit`-generated migration in this phase. No hand-edited migrations (Principle VII).

## Task Breakdown (preview for /speckit.tasks)

Aligned to Phase 3 exit criteria:
1. Drizzle schema + migration for `stations`, `lockers`, `inventory_kits`, `tariffs`
   (with `org_id`, partial unique index on tariffs, critical bookability indexes).
2. `locations` domain layer: aggregates, `BookabilityRule`, `SmartLockGateway` port,
   domain events.
3. `locations` infrastructure: Drizzle repositories, `HomeAssistantGateway`,
   `MockSmartLockGateway`, BullMQ auto-relock producer/worker, `StationHealthChecker`
   cron, `LockerReconciliationJob`.
4. `locations` application + interface: CRUD services + controllers, renter-facing
   `GET /stations?visible=true&active=true`, HA door-events webhook.
5. `pricing` module end-to-end: `Tariff` aggregate, `PricingService.quote`,
   `OvertimeCalculator` stub, `TariffService` CRUD, tariffs controller,
   `DayTypeResolver`.
6. Unit + integration + contract test suite (per Testing strategy above).
7. OpenAPI docs updated for all new endpoints.
8. Phase 3 exit-criteria validation on stage (create station → assign lockers →
   configure tariffs → `POST /lockers/:id/open` opens real locker → disconnect HA →
   `StationHealthChanged` logged).
