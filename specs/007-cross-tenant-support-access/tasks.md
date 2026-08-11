# Tasks: Cross-Tenant Support Access (Impersonation)

**Input**: Design documents from `/specs/007-cross-tenant-support-access/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), contracts/

**Tests**: Test tasks are included for each user story per the spec's acceptance criteria.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup & Prerequisites

**Purpose**: Shared infrastructure the middleware depends on

- [ ] T001 Add `IMPERSONATION_FORBIDDEN` and `ORG_NOT_FOUND` to `ErrorCode` in `apps/api/src/shared-kernel/interface/dto/api-error.ts` (`ORG_SUSPENDED` already exists)
- [ ] T002 [P] Add `impersonation_forbidden` key to `apps/api/src/shared-kernel/infrastructure/i18n/translations/en/auth.json` and `uk/auth.json` (org_not_found / org_suspended already exist in `organizations.json`)
- [ ] T003 Add `impersonatorSub?: string` to `TenantStore` and a `getImpersonatorSub()` getter in `apps/api/src/shared-kernel/interface/middleware/tenant-context.ts`
- [ ] T004 Add `AuditableLogger` to `SharedKernelModule` providers AND exports in `apps/api/src/shared-kernel/shared-kernel.module.ts`; remove the now-redundant local `AuditableLogger` providers from `apps/api/src/locations/locations.module.ts` and `apps/api/src/pricing/pricing.module.ts`

---

## Phase 2: User Story 1 - SUPER_ADMIN Impersonation Gate (Priority: P1)

**Goal**: `x-org-id` is honored only for SUPER_ADMIN against an existing ACTIVE org.

**Independent Test**: V1–V5 in quickstart.md pass against the stage server.

### Tests for User Story 1

- [ ] T005 [P] [US1] Unit test `ImpersonationMiddleware`: no header → `next()`, store untouched, in `apps/api/test/unit/organizations/impersonation.middleware.test.ts`
- [ ] T006 [P] [US1] Unit test `ImpersonationMiddleware`: non-SUPER_ADMIN with header → throws `IMPERSONATION_FORBIDDEN` (403), in `apps/api/test/unit/organizations/impersonation.middleware.test.ts`
- [ ] T007 [P] [US1] Unit test `ImpersonationMiddleware`: org not found → throws `ORG_NOT_FOUND` (404), in `apps/api/test/unit/organizations/impersonation.middleware.test.ts`
- [ ] T008 [P] [US1] Unit test `ImpersonationMiddleware`: org suspended → throws `ORG_SUSPENDED` (403), in `apps/api/test/unit/organizations/impersonation.middleware.test.ts`

### Implementation for User Story 1

- [ ] T009 [US1] Create `ImpersonationMiddleware` in `apps/api/src/organizations/infrastructure/middleware/impersonation.middleware.ts`: read `x-org-id`; if absent `next()`; if `request.auth` is not `type=admin` + `role=SUPER_ADMIN` throw `ApiException(403, IMPERSONATION_FORBIDDEN, 'auth.impersonation_forbidden')`; `findById(orgId)` → null throws `ApiException(404, ORG_NOT_FOUND, 'organizations.org_not_found')`; `org.isSuspended` throws `ApiException(403, ORG_SUSPENDED, 'organizations.org_suspended')`; otherwise `TenantContext.run({ orgId, role, locale, sub, tokenType, impersonatorSub: sub }, next)`
- [ ] T010 [US1] Register `ImpersonationMiddleware` for `'*'` in `apps/api/src/organizations/organizations.module.ts` via `MiddlewareConsumer` (module already imported after SharedKernelModule in AppModule → runs after `JwtAuthMiddleware`)
- [ ] T011 [US1] Remove `TenantMiddleware` registration + import from `apps/api/src/shared-kernel/shared-kernel.module.ts` and delete `apps/api/src/shared-kernel/interface/middleware/tenant.middleware.ts`
- [ ] T012 [US1] Simplify `JwtAuthMiddleware` in `apps/api/src/shared-kernel/interface/middleware/jwt-auth.middleware.ts`: orgId from JWT payload only (`payload.orgId ?? undefined`), removing the `?? TenantContext.getOrgId()` fallback

**Checkpoint**: V1–V5 pass. SUPER_ADMIN impersonation works; all rejection paths return documented codes.

---

## Phase 3: User Story 2 - Auditable & Leak-Free Impersonation (Priority: P2)

**Goal**: Every impersonated request is audited with full attribution and no context leakage.

**Independent Test**: Perform one impersonated request; confirm an `ImpersonationActivated` audit entry with impersonator + target + method/path, and that a subsequent unimpersonated request in the same process has no impersonator marker.

### Tests for User Story 2

- [ ] T013 [P] [US2] Unit test `ImpersonationMiddleware`: valid impersonation calls `audit.log('ImpersonationActivated', …)` with impersonatorSub/targetOrgId/method/path, in `apps/api/test/unit/organizations/impersonation.middleware.test.ts`
- [ ] T014 [P] [US2] Unit test `TenantContext`: nested `run()` with `impersonatorSub` restores the outer store (no leakage), in `apps/api/test/unit/shared-kernel/tenant-context.test.ts`

### Implementation for User Story 2

- [ ] T015 [US2] Emit `ImpersonationActivated` audit entry in `ImpersonationMiddleware` (before re-running TenantContext) via the global `AuditableLogger` with impersonatorSub, targetOrgId, method, path

**Checkpoint**: Audit entry present for impersonated requests; tenant context restored after request.

---

## Phase 4: Verification

- [ ] T016 Run `npx tsc --noEmit` in `apps/api`
- [ ] T017 Run `npm run lint` in `apps/api`
- [ ] T018 Run quickstart.md scenarios V1–V5 against stage and verify all pass
- [ ] T019 Verify Constitution Check: all 10 principles still PASS after implementation
- [ ] T020 Verify module boundaries: shared-kernel has no new imports from business modules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends on Phase 1 (error codes, i18n, TenantStore, global AuditableLogger)
- **User Story 2 (Phase 3)**: Depends on Phase 2 (middleware exists and runs)
- **Verification (Phase 4)**: Depends on all implementation complete

### Within Each User Story

- Tests written FIRST and confirmed failing before implementation
- Middleware logic before module registration
- Unit tests before live curl verification

### Parallel Opportunities

- Phase 1: T001, T002, T003, T004 are all different files — can run in parallel
- Phase 2: T005–T008 (tests) can run in parallel; T009 → T010/T011/T012 (T011 must follow T009's removal? no — T009/T010/T011/T012 are separate files; T011/T012 can run in parallel with T009)
- Phase 3: T013, T014 can run in parallel; T015 depends on T009

---

## Implementation Strategy

### MVP First

1. Phase 1 setup (codes, i18n, store, global logger)
2. Phase 2 US1 — gate middleware + registration + removal of naive middleware
3. **STOP and VALIDATE**: V1–V5 against stage
4. Phase 3 US2 — audit + leakage tests
5. Phase 4 verification (tsc, lint, curl, constitution, boundaries)

### Exit Criteria Verification

Per the roadmap Phase 11: V2/V3/V4 rejection paths and V1 success path all pass.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests written FIRST and confirmed failing before implementation
- Commit after each task or logical group
