# Implementation Plan: Cross-Tenant Support Access (Impersonation)

**Branch**: `007-cross-tenant-support-access` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-cross-tenant-support-access/spec.md`

## Summary

Replace the naive `TenantMiddleware` (which trusted `x-org-id` from any client) with an
`ImpersonationMiddleware` owned by the **organizations** module. The middleware runs after
`JwtAuthMiddleware` in the global chain, honors `x-org-id` only for `SUPER_ADMIN` tokens,
validates the target org exists and is ACTIVE, re-runs `TenantContext.run` with the target
`orgId` plus `impersonatorSub`, and emits an `ImpersonationActivated` audit entry per
impersonated request. `TenantStore` gains `impersonatorSub`; `AuditableLogger` moves to the
global shared-kernel module; two new error codes (`IMPERSONATION_FORBIDDEN`, `ORG_NOT_FOUND`)
and a new i18n key (`auth.impersonation_forbidden`) are added in both locales.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), NestJS 10+

**Primary Dependencies**: NestJS common/core (MiddlewareConsumer), Express, AsyncLocalStorage (Node built-in)

**Storage**: PostgreSQL — read-only dependency for org lookup via existing `ORGANIZATION_REPOSITORY`; no schema changes

**Testing**: Jest (unit) for middleware logic with a fake repository; curl verification against the stage server for the four HTTP paths

**Target Platform**: Linux server (stage: port 3002)

**Project Type**: NestJS modular monolith (apps/api)

**Performance Goals**: Zero added latency when `x-org-id` is absent; one indexed org lookup when present

**Constraints**: shared-kernel must not import from business modules; impersonation middleware must live in `organizations`; `JwtAuthMiddleware` must run before it

**Scale/Scope**: Security hardening — small, tightly-scoped change; no data model changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Modular Monolith with Enforced Clean Layering | ✅ PASS | Middleware lives in `organizations` infrastructure; shared-kernel only gains the `impersonatorSub` field and a global `AuditableLogger` provider. |
| II. Hexagonal Isolation via Named Ports | ✅ PASS | Org lookup happens through the existing `ORGANIZATION_REPOSITORY` port, not direct DB access. |
| III. Domain-Driven Modeling & Money Integrity | ✅ PASS | No money/domain changes. |
| IV. Event-Driven Cross-Module Communication | ✅ PASS | No new events; audit entry reuses the existing `AuditableLogger`. |
| V. Mechanically Enforced Module Boundaries | ✅ PASS | `organizations` already depends on shared-kernel; no new cross-module imports. |
| VI. Multi-Tenant Isolation by Default | ✅ PASS | The feature strengthens isolation: header-trust is removed, gating + validation added, context restored after request. |
| VII. Sole Persistence Path: PostgreSQL + Drizzle | ✅ PASS | Org lookup via repository → Drizzle; no new persistence. |
| VIII. Process-Isolated, Thin Client Surfaces | ✅ PASS | Server-side only. |
| IX. Backend-Owned Internationalization | ✅ PASS | New `auth.impersonation_forbidden` key added in uk + en; existing `org_not_found`/`org_suspended` reused. |
| X. Security and Data Integrity by Default | ✅ PASS | Core purpose of the feature: role gating, org validation, audit, no context leakage. |

**Gate result**: All principles PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/007-cross-tenant-support-access/
├── spec.md              # This feature's specification
├── plan.md              # This file
├── quickstart.md        # Setup + validation scenarios
├── contracts/           # API contract for the x-org-id header + error codes
├── checklists/          # Spec quality checklist
└── tasks.md             # Task breakdown
```

### Source Code (repository root)

```text
apps/api/src/
├── organizations/
│   ├── organizations.module.ts                       # registers ImpersonationMiddleware for '*'
│   └── infrastructure/middleware/
│       └── impersonation.middleware.ts               # NEW: gate + validation + audit + context rerun
├── shared-kernel/
│   ├── shared-kernel.module.ts                       # remove TenantMiddleware; add AuditableLogger (global)
│   ├── interface/middleware/
│   │   ├── jwt-auth.middleware.ts                    # orgId from JWT payload only (fallback removed)
│   │   ├── tenant-context.ts                         # TenantStore + impersonatorSub + getter
│   │   └── tenant.middleware.ts                      # DELETED (naive header trust)
│   ├── interface/dto/api-error.ts                    # + IMPERSONATION_FORBIDDEN, ORG_NOT_FOUND
│   ├── infrastructure/audit/auditable-action.decorator.ts  # AuditableLogger (now provided globally)
│   └── infrastructure/i18n/translations/{uk,en}/auth.json  # + impersonation_forbidden
└── locations/locations.module.ts, pricing/pricing.module.ts  # remove duplicate AuditableLogger providers
```

**Structure Decision**: Middleware ordering is guaranteed by module import order in
`AppModule` (`SharedKernelModule` → … → `OrganizationsModule` …), so `JwtAuthMiddleware`
(shared-kernel) always runs before `ImpersonationMiddleware` (organizations). The latter
re-enters `TenantContext.run` with a nested store; AsyncLocalStorage guarantees the outer
JWT-derived context is restored after the request.

## Complexity Tracking

No constitution violations — no complexity tracking required.
