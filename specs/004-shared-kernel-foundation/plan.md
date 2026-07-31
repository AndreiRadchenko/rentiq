# Implementation Plan: Shared Kernel + Foundation

**Branch**: `004-shared-kernel-foundation` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-shared-kernel-foundation/spec.md`

## Summary

Build the shared-kernel module — the architectural skeleton every other module depends on. Deliver value objects (Money, EntityId, OrgId, PhoneNumber, Locale), an EventBus port with in-process implementation, TenantContext for multi-tenant isolation, Result<T,E> for explicit error handling, a global error envelope, pagination DTOs, Drizzle database connection, Zod-validated config, and a health check endpoint. No business logic; no domain-specific code. This module depends on nothing else in the system.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: NestJS 10+, Drizzle ORM, Zod, @nestjs/event-emitter, @nestjs/terminus (health), @nestjs-i18n/core, @nestjs-i18n/parsers, uuid

**Storage**: PostgreSQL (via Drizzle ORM) — connection module only, no business tables yet

**Testing**: Vitest (unit), Supertest (integration), drizzle-kit (migration generation)

**Target Platform**: Linux server (containerized production, host-native stage per ADR-011)

**Project Type**: Web service (NestJS modular monolith)

**Performance Goals**: Health check responds within 100ms (p95); startup validation completes within 5 seconds

**Constraints**: shared-kernel must never contain business logic; every other module depends on it, it depends on nothing else in the codebase

**Scale/Scope**: Foundation module — no runtime scale targets yet; correctness over performance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Modular Monolith with Enforced Clean Layering | ✅ PASS | shared-kernel is the foundation; contains only value objects, ports, and cross-cutting infra. No business logic. |
| II. Hexagonal Isolation via Named Ports | ✅ PASS | EventBus is defined as a port interface. Infrastructure implementation (in-process emitter) lives in infra layer. |
| III. Domain-Driven Modeling & Money Integrity | ✅ PASS | Money is a value object with integer minor units. Currency validated against {UAH, EUR}. No floats. |
| IV. Event-Driven Cross-Module Communication | ✅ PASS | EventBus port defined; no cross-module calls. In-process impl is swappable per ADR. |
| V. Mechanically Enforced Module Boundaries | ✅ PASS | shared-kernel has zero dependencies on other modules. Enforced by Nx lint rules. |
| VI. Multi-Tenant Isolation by Default | ✅ PASS | TenantContext (AsyncLocalStorage) carries orgId from JWT. Every repository call auto-scoped. |
| VII. Sole Persistence Path: PostgreSQL + Drizzle | ✅ PASS | Drizzle connection module with Zod-validated config. No raw SQL. |
| VIII. Process-Isolated, Thin Client Surfaces | ✅ PASS | shared-kernel is server-side only; no client concerns. |
| IX. Backend-Owned Internationalization | ✅ PASS | Locale value object defined; nestjs-i18n wired at foundation level. |
| X. Security and Data Integrity by Default | ✅ PASS | JWT validation deferred to Phase 2 (IAM). TenantContext populated from JWT — assumes valid token available. |

**Gate result**: All principles PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-shared-kernel-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── shared-kernel/
│   ├── domain/
│   │   ├── value-objects/
│   │   │   ├── money.ts            # Money(amountMinor, currency) with add/subtract/equals
│   │   │   ├── entity-id.ts        # EntityId<T> UUID wrapper
│   │   │   ├── org-id.ts           # OrgId extends EntityId<'OrgId'>
│   │   │   ├── phone-number.ts     # PhoneNumber value object
│   │   │   ├── locale.ts           # Locale value object ('uk' | 'en')
│   │   │   └── currency.ts         # Currency enum ('UAH' | 'EUR')
│   │   ├── events/
│   │   │   └── domain-event.ts     # DomainEvent abstract base class
│   │   └── result.ts               # Result<T, E> utility
│   ├── application/
│   │   └── ports/
│   │       └── event-bus.ts        # EventBus port interface
│   ├── infrastructure/
│   │   ├── event-bus-impl.ts       # In-process EventBusImpl (@nestjs/event-emitter)
│   │   ├── database/
│   │   │   ├── connection.ts       # Drizzle database connection module
│   │   │   └── config.schema.ts    # Zod schema for database config
│   │   └── config/
│   │       └── config.module.ts    # Global ConfigModule with Zod validation
│   ├── interface/
│   │   ├── middleware/
│   │   │   └── tenant.middleware.ts # TenantMiddleware (reads orgId from JWT)
│   │   ├── filters/
│   │   │   └── api-error.filter.ts # Global exception filter (ApiError envelope)
│   │   ├── dto/
│   │   │   ├── api-error.ts        # ApiError envelope type
│   │   │   ├── pagination.ts       # Pagination request/response DTOs
│   │   │   └── health.ts           # Health check response DTOs
│   │   └── health/
│   │       └── health.controller.ts # GET /health endpoint
│   └── shared-kernel.module.ts     # NestJS module definition
│
tests/
├── unit/
│   └── shared-kernel/
│       ├── money.test.ts
│       ├── entity-id.test.ts
│       ├── result.test.ts
│       └── tenant-context.test.ts
├── integration/
│   └── shared-kernel/
│       ├── health.test.ts
│       └── config-validation.test.ts
└── e2e/
    └── shared-kernel/
        └── health-e2e.test.ts
```

**Structure Decision**: Follows the constitution's Clean Layering (Principle I): domain / application / infrastructure / interface within the shared-kernel module. No business logic — only value objects, ports, and cross-cutting infrastructure. Every other module will import from `shared-kernel`, but shared-kernel imports from nothing else in the codebase (only external npm packages).

## Complexity Tracking

*No constitution violations — no complexity tracking required.*
