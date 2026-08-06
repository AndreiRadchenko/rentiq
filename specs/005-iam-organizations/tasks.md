---

description: "Task list for IAM + Organizations feature implementation"
---

# Tasks: IAM + Organizations

**Input**: Design documents from `/specs/005-iam-organizations/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included because the plan's Testing Strategy and the constitution's Quality & Verification Standards mandate unit + integration coverage for domain logic and every public endpoint. Tests are written first (TDD) and must fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- NestJS modular monolith in `apps/api/`; feature modules under `apps/api/src/iam/` and `apps/api/src/organizations/` (domain / application / infrastructure / interface layering per plan.md); cross-cutting under `apps/api/src/shared-kernel/`; e2e under `apps/api/test/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Add `bcrypt` + `@nestjs/jwt` dependencies (and `@types/bcrypt` devDep) to `apps/api/package.json` and run `pnpm install`
- [X] T002 Extend zod env schema with `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RENTIQ_DEV_TELEGRAM_SECRET` in `apps/api/src/shared-kernel/infrastructure/config/env.ts`
- [X] T003 [P] Add Phase-2 error codes (`INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `RENTER_NOT_REGISTERED`, `RENTER_DISABLED`, `RENTER_ALREADY_REGISTERED`, `BOT_SECRET_INVALID`, `SLUG_TAKEN`, `FORBIDDEN`, `ORG_SUSPENDED`, `CONSENT_REQUIRED`) to the shared error catalog in `apps/api/src/shared-kernel/interface/dto/api-error.ts`
- [X] T004 [P] Scaffold `IamModule` and `OrganizationsModule` skeletons (domain/application/infrastructure/interface dirs) in `apps/api/src/iam/iam.module.ts` and `apps/api/src/organizations/organizations.module.ts`, and register both in `apps/api/src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Define Drizzle schema for `organizations`, `admin_accounts`, `renters` per `specs/005-iam-organizations/data-model.md` in `apps/api/src/organizations/infrastructure/database/organizations.schema.ts` and `apps/api/src/iam/infrastructure/database/{admin-accounts,renters}.schema.ts`
- [ ] T006 Generate and apply one `drizzle-kit` migration (run `pnpm db:generate` then `pnpm db:migrate` in `apps/api/`) including unique constraints on `organizations.slug`, `admin_accounts.email`, `renters.telegram_id`, and composite `renters(org_id, phone)`
- [X] T007 Implement RS256 JWT sign/verify + token issuance service (`JwtTokenService`, access 15 min / refresh 7 days, `type` claim `admin`|`renter`) reading keys from env in `apps/api/src/iam/infrastructure/jwt/jwt-token.service.ts` + `jwt.module.ts`
- [X] T008 [P] Implement `JwtAuthGuard` that verifies the bearer token and populates `TenantContext` (orgId, role, locale) in `apps/api/src/shared-kernel/interface/guards/jwt-auth.guard.ts`
- [X] T009 [P] Implement `RolesGuard` + `@Roles(...)` decorator in `apps/api/src/shared-kernel/interface/guards/roles.guard.ts`
- [X] T010 Implement `JwtLocaleResolver` (registered FIRST in the resolver chain, ADR-006 order) and translation bundles `uk`/`en` for `auth`, `organizations`, `renters` (incl. `invalid_credentials` in both locales) in `apps/api/src/shared-kernel/infrastructure/i18n/jwt-locale.resolver.ts` + `i18n.module.ts` + `translations/{uk,en}/`
- [X] T011 Implement idempotent seed script (bootstrap `SUPER_ADMIN` from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, org "rentiq-dev" slug `rentiq`, hashed bot secret from `RENTIQ_DEV_TELEGRAM_SECRET`) in `apps/api/src/seed.ts` + `seed` npm script in `apps/api/package.json`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Renter registration with explicit informed consent (Priority: P1) 🎯 MVP

**Goal**: A person registers with name, phone, and affirmative consent; a Renter identity is created bound to the org with a recorded consent timestamp, and the person immediately gets a renter JWT. No identity exists without consent (FR-001, FR-002, FR-028).

**Independent Test**: Register a fresh person with and without confirming consent; without consent → `CONSENT_REQUIRED` and no identity; with consent → identity + renter JWT; re-register same phone → `alreadyRegistered: true`, no duplicate. Booking refusal for unregistered persons is exercised at the identity surface (exchange/`/renters/me` require a registered ACTIVE renter) since booking endpoints land in later phases.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Unit tests for `RenterService.register` (consent required → `CONSENT_REQUIRED`; no partial identity on rejection; missing name/phone → `VALIDATION_ERROR`; duplicate phone → `alreadyRegistered`) in `apps/api/src/iam/application/renter/__tests__/renter.service.spec.ts`
- [ ] T013 [P] [US1] Integration test for the register → telegram-exchange → `/renters/me` flow (against seeded dev org) in `apps/api/test/iam/renter-registration.e2e-spec.ts`

### Implementation for User Story 1

- [X] T014 [US1] Implement `Renter` aggregate (orgId, phone, name, consentGivenAt, consentVersion, locale, status; consent invariants; ACTIVE/DISABLED transitions) in `apps/api/src/iam/domain/renter.ts`
- [X] T015 [US1] Implement org-scoped `RenterRepository` (queries scoped by `TenantContext.getOrgId()`, `findByOrgAndPhone`) in `apps/api/src/iam/infrastructure/repositories/renter.repository.ts`
- [X] T016 [US1] Implement `RenterService.register` (consent gate, FR-028 phone recognition, emits `RenterRegistered`) in `apps/api/src/iam/application/renter/renter.service.ts`
- [X] T017 [P] [US1] Implement `POST /renters/register` controller + request/response DTOs in `apps/api/src/iam/interface/renter/renter-register.controller.ts`
- [X] T018 [P] [US1] Implement `POST /auth/telegram/exchange` controller (Bot-secret auth per research RQ-5; reads the tenant org's `TelegramBotConfig` — ownership seam per plan.md Risks) in `apps/api/src/iam/interface/auth/telegram-exchange.controller.ts`
- [X] T019 [P] [US1] Implement `GET /renters/me` controller + DTO in `apps/api/src/iam/interface/renter/renter-me.controller.ts`
- [X] T020 [US1] Implement `RenterRegistered` domain event + publish via EventBus in `apps/api/src/iam/infrastructure/events/renter-registered.event.ts`
- [X] T062 [US1] Implement `ConsentStatement` version registry (version id, material-change flag, current-version lookup) in `apps/api/src/iam/domain/consent-statement.ts`
- [X] T063 [US1] Validate `consentVersion` at registration against the current statement (reject unknown/stale versions) in `RenterService.register` (FR-023)
- [X] T064 [US1] Implement re-consent use case: publishing a material statement change flags affected renters `REQUIRES_RE_CONSENT`; `POST /renters/me/re-consent` updates `consentVersion`; editorial changes flag nobody (FR-024, DR-005) in `apps/api/src/iam/application/renter/renter.service.ts` + `renter-me.controller.ts`
- [X] T065 [US1] Unit tests for re-consent gating (material vs editorial change; no-re-consent blocks new bookings via a `requiresReConsent` invariant; never deletes/anonymizes) in `apps/api/src/iam/application/renter/__tests__/renter.reconsent.spec.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - A renter is permanently bound to exactly one organization (Priority: P1)

**Goal**: A renter registered through org A's entry point is A's renter forever; no switch/merge/transfer mechanism exists; every operation is scoped to the binding org (FR-004, FR-005, FR-019, AC-002).

**Independent Test**: Register a renter under org A, attempt a switch (must be rejected), register the same person under org B, and confirm two separate identities with independent histories and zero cross-org reads.

### Tests for User Story 2

- [X] T021 [P] [US2] Unit tests for org-binding invariants (orgId immutable after creation, no `changeOrg` operation exposed, tenant scoping) in `apps/api/src/iam/domain/__tests__/renter.binding.spec.ts`
- [ ] T022 [P] [US2] Integration test for two-org isolation (register under A and B, attempt switch → rejected, separate identities, cross-org lookup returns nothing) in `apps/api/test/iam/org-binding.e2e-spec.ts`

### Implementation for User Story 2

- [X] T023 [US2] Enforce binding invariants on `Renter` aggregate (orgId set once from registration context, immutable; no transfer method; duplicate phone only recognized within same org) in `apps/api/src/iam/domain/renter.ts`
- [X] T024 [US2] Enforce strict org scoping in `RenterRepository` (every query includes org_id from `TenantContext`, never caller-supplied) in `apps/api/src/iam/infrastructure/repositories/renter.repository.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Three-tier admin role hierarchy (Priority: P1)

**Goal**: Staff log in as admins with exactly one of SUPER_ADMIN / ORG_ADMIN / STATION_OPERATOR; roles are strictly hierarchical and enforced at every access path; an active org can never be left without an active ORG_ADMIN (FR-009–FR-013, DR-002, AC-004).

**Independent Test**: Log in as each role and exercise the action matrix (org management, pricing/branding/users, assigned vs unassigned stations); verify each outcome matches the role's scope and no privileged action is reachable via another route.

> **Note**: STATION_OPERATOR station operations (open/close lockers etc.) belong to the locations/rentals phases; this story delivers the role model, login, and the role/guard enforcement used by all admin endpoints.

### Tests for User Story 3

- [X] T025 [P] [US3] Unit tests for `AuthService` (login, refresh rotation, disabled account → uniform `INVALID_CREDENTIALS`, bcrypt verify) in `apps/api/src/iam/application/auth/__tests__/auth.service.spec.ts`
- [X] T026 [P] [US3] Unit tests for `AdminAccountService` (role assignment rules, DR-002 last-active-ORG_ADMIN guard) in `apps/api/src/iam/application/admin-account/__tests__/admin-account.service.spec.ts`
- [X] T027 [P] [US3] Unit tests for `RolesGuard` role-matrix + token-`type` enforcement in `apps/api/src/shared-kernel/interface/guards/__tests__/roles.guard.spec.ts`
- [ ] T028 [P] [US3] Integration test for login + role matrix (SUPER_ADMIN creates org+admin, ORG_ADMIN denied cross-org) in `apps/api/test/iam/admin-login.e2e-spec.ts`

### Implementation for User Story 3

- [X] T029 [US3] Implement `AdminAccount` aggregate (role, orgId nullable for SUPER_ADMIN, assignedStationIds, locale, status, recovery-channel fields per FR-026/Key Entities) in `apps/api/src/iam/domain/admin-account.ts`
- [X] T030 [US3] Implement `AdminAccountRepository` (`findByEmail` for login; org-scoped for ORG_ADMIN operations) in `apps/api/src/iam/infrastructure/repositories/admin-account.repository.ts`
- [X] T031 [US3] Implement `AuthService` (`login`, `refresh` with rotation; bcrypt verify; RS256 via `JwtTokenService`) in `apps/api/src/iam/application/auth/auth.service.ts`
- [X] T032 [US3] Implement `AdminAccountService` (create/disable/role-change with hierarchy rules, DR-002 no-lockout, emits `AdminAccountCreated`/`AdminAccountDisabled`) in `apps/api/src/iam/application/admin-account/admin-account.service.ts`
- [X] T033 [P] [US3] Implement `POST /auth/login` and `POST /auth/refresh` controllers + DTOs in `apps/api/src/iam/interface/auth/auth.controller.ts`

**Checkpoint**: At this point, User Stories 1, 2 AND 3 should all work independently

---

## Phase 6: User Story 4 - Renter locale selection and change at any time (Priority: P2)

**Goal**: The renter picks a locale from the org's supported set at registration, every message is delivered in that locale, the renter can change it at any time (even mid-rental), and unsupported locales are rejected (FR-006–FR-008, FR-017, BR-02.2, ADR-006).

**Independent Test**: Register a renter with `uk` and trigger a localized message; change the renter's locale to `en` and trigger another; both messages arrive in the expected language; selecting an unsupported locale is rejected with the supported list.

> **Note**: The plan's contracts list 8 endpoints; US4's change-at-any-time acceptance requires a `PATCH /renters/me` locale endpoint, so this story extends `contracts/api.md` with a 9th endpoint (task T036). Doc sync is covered by T060.

### Tests for User Story 4

- [X] T034 [P] [US4] Unit tests for locale selection at registration, unsupported-locale rejection (BR-02.2), and change-immediacy (DR-003) in `apps/api/src/iam/application/renter/__tests__/renter.locale.spec.ts`
- [ ] T035 [P] [US4] Integration test for ADR-006 resolution precedence (JWT `locale` claim wins over `Accept-Language`) in `apps/api/test/iam/locale-resolution.e2e-spec.ts`

### Implementation for User Story 4

- [X] T036 [US4] Implement locale-change use case + `PATCH /renters/me` (extends `contracts/api.md`) in `apps/api/src/iam/application/renter/renter.service.ts` and `apps/api/src/iam/interface/renter/renter-me.controller.ts`
- [X] T037 [US4] Implement locale validation against the org's `supportedLocales` (reject with the supported list, BR-02.2) in `apps/api/src/iam/application/renter/locale.validation.ts`
- [X] T038 [US4] Ensure every renter-facing message resolves through the ADR-006 chain (`JwtLocaleResolver` → org defaultLocale → `uk`) in `apps/api/src/shared-kernel/infrastructure/i18n/jwt-locale.resolver.ts`

**Checkpoint**: User Story 4 should be independently functional

---

## Phase 7: User Story 5 - Admin and renter identities are separate and never merged (Priority: P2)

**Goal**: Admin and renter accounts are distinct identity types; an admin cannot rent with an admin account; an admin who also rents holds two fully separate identities; no operation merges or conflates them (FR-014, FR-015, DR-004, AC-005).

**Independent Test**: Log in as an admin and attempt a renter action (must be denied); register the same person as a renter and confirm a fully separate identity with its own capability.

### Tests for User Story 5

- [X] T039 [P] [US5] Unit tests for token-`type` claim enforcement (admin routes reject `type: renter` and vice versa) in `apps/api/src/shared-kernel/interface/guards/__tests__/token-type.spec.ts`
- [ ] T040 [P] [US5] Integration test for identity separation (admin token on renter routes → `FORBIDDEN`; renter token on admin routes → `FORBIDDEN`) in `apps/api/test/iam/identity-separation.e2e-spec.ts`

### Implementation for User Story 5

- [X] T041 [US5] Enforce the `type` claim (`admin` vs `renter`) in `JwtAuthGuard`/`RolesGuard` route authorization in `apps/api/src/shared-kernel/interface/guards/jwt-auth.guard.ts`
- [X] T042 [US5] Verify `AdminAccount` and `Renter` have fully separate repos/services/aggregates (no shared identity path, no merge/link operation) and assert via test in `apps/api/src/iam/`

**Checkpoint**: User Story 5 should be independently functional

---

## Phase 8: User Story 6 - Organization branding and supported-locale-set configuration (Priority: P2)

**Goal**: A SUPER_ADMIN creates an organization with its ORG_ADMIN onboarding account; each org configures branding (business name, logo, colors) and a supported locale set bounding what its renters may choose; orgs are fully isolated; maintenance window is configurable (FR-016–FR-019, FR-010, BR-02.1, AC-006, AC-007).

**Independent Test**: Create a second organization via the SUPER_ADMIN JWT, set its branding and locale set, register a renter under it, and confirm the renter sees only that org's branding and supported locales with zero visibility of the first org's data.

> **Note**: `POST /organizations/:id/maintenance-window` is ORG_ADMIN-scoped per roadmap Phase 2 (architecture §7 lists it super-admin-only; discrepancy flagged in plan.md Risks — implement per roadmap).

### Tests for User Story 6

- [X] T043 [P] [US6] Unit tests for `OrganizationService` (create, slug conflict → `SLUG_TAKEN`, branding validation, suspension, maintenance-window) in `apps/api/src/organizations/application/__tests__/organization.service.spec.ts`
- [ ] T044 [P] [US6] Integration test for create-org → bootstrap-admin → branding patch → maintenance window in `apps/api/test/organizations/organization.e2e-spec.ts`
- [ ] T045 [P] [US6] Integration test for two-org isolation (AC-006/SC-008, zero mutual visibility) in `apps/api/test/organizations/isolation.e2e-spec.ts`

### Implementation for User Story 6

- [X] T046 [US6] Implement `Organization` aggregate + VOs (`BrandingConfig`, `TelegramBotConfig`, `PaymentGatewayCredentialsRef`, `MaintenanceWindow`, `CheckboxConfig`) per `data-model.md` in `apps/api/src/organizations/domain/organization.ts`
- [X] T047 [US6] Implement `OrganizationRepository` (findBySlug, tenant-unscoped super-admin lookups only) in `apps/api/src/organizations/infrastructure/repositories/organization.repository.ts`
- [X] T048 [US6] Implement `OrganizationService` (create with admin bootstrap through iam's application-service interface ONLY, updateBranding, suspend, maintenance-window; emits org events) in `apps/api/src/organizations/application/organization.service.ts`
- [X] T049 [US6] Implement `POST /organizations`, `PATCH /organizations/:id/branding`, `POST /organizations/:id/maintenance-window` controllers + DTOs in `apps/api/src/organizations/interface/organizations.controller.ts`
- [X] T050 [US6] Apply `RolesGuard` to organization endpoints (SUPER_ADMIN for create/branding; ORG_ADMIN for own-org maintenance-window) in `apps/api/src/organizations/interface/`
- [X] T051 [US6] Implement `OrganizationCreated` / `OrganizationSuspended` / `OrganizationBrandingChanged` events + publish in `apps/api/src/organizations/infrastructure/events/`

**Checkpoint**: All user stories through 6 should be independently functional

---

## Phase 9: User Story 7 - Renter data deletion and anonymization (Priority: P3)

**Goal**: A deletion request deactivates the renter (never hard-deletes); identifying fields are anonymized only after the 3-year retention period; a renter with open obligations cannot request deletion; admin-initiated disable is reversible while deletion-request disable is permanent (FR-020–FR-022, FR-025, FR-029, AC-008, AC-010, SC-007, SC-011).

**Independent Test**: Submit a deletion request for a renter with settled history → disabled immediately; anonymization runs never fire before the 3-year retention elapses and only then anonymize name/phone while financial/fiscal records stay; a renter with an open obligation is rejected.

> **Deferred in this phase (recorded, not implemented)**: (1) the open-obligation gate (active rental / unpaid surcharge) depends on the rentals/payments modules (later roadmap phases) — implement the service hook, not the check; (2) the automatic scheduled anonymization run (NFR-005) — plan.md declares no background jobs this phase; `RenterAnonymizer` is unit-testable and invoked on demand now, scheduled later; (3) the append-only audit trail (NFR-006) is owned by the `audit-log` module (roadmap Phase 8) — the Phase-2 domain events published in T020/T032/T051 are what it will consume.

### Tests for User Story 7

- [X] T052 [P] [US7] Unit tests for disable transitions (admin-initiated disable reversible via re-enable; deletion-request disable permanent; disabled renter cannot book — FR-029/AC-010/SC-011) in `apps/api/src/iam/application/renter/__tests__/renter.disable.spec.ts`
- [X] T056 [P] [US7] Unit tests for `RenterAnonymizer` retention boundary (never anonymizes before 3-year retention elapses; idempotent; skips and retries later — FR-021/NFR-005) in `apps/api/src/iam/application/renter/__tests__/renter-anonymizer.spec.ts`

### Implementation for User Story 7

- [X] T053 [US7] Implement deletion-request flow in `RenterService` (deactivate renter, irreversible disable, no hard delete, consent/retention evidence retained) in `apps/api/src/iam/application/renter/renter.service.ts`
- [X] T054 [US7] Implement admin-initiated disable + re-enable in `RenterService` (reversible, distinct from deletion path, ORG_ADMIN-scoped) in `apps/api/src/iam/application/renter/renter.service.ts`
- [X] T055 [US7] Implement `RenterAnonymizer` + 3-year retention policy constant (anonymize name/phone only, keep records linked) in `apps/api/src/iam/application/renter/renter-anonymizer.ts`

**Checkpoint**: User Story 7 should be independently functional

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T057 [P] Update OpenAPI documentation for the new endpoints (auth, renters, organizations) and error codes in `apps/api/` (constitution Quality & Verification standard)
- [X] T058 [P] Add a Postman collection covering `quickstart.md` validation scenarios V1–V6 in `specs/005-iam-organizations/`
- [X] T059 [P] Enable `enforce-module-boundaries` (or equivalent) for `apps/api` and verify the boundary: `organizations` imports only iam's public application-service interface (never domain/infrastructure); the build must FAIL on any violation — check in `apps/api/src/organizations/` and `apps/api/src/iam/iam.module.ts`
- [X] T060 Sync derived docs with implementation deltas (add `PATCH /renters/me` and any adjustments) in `specs/005-iam-organizations/contracts/api.md` and `specs/005-iam-organizations/data-model.md`
- [ ] T061 Run full validation: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:e2e` in `apps/api/`, then execute quickstart V1–V6 from `specs/005-iam-organizations/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3–9)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; uses the seeded `rentiq-dev` org. No dependency on other stories.
- **US2 (P1)**: Starts after Foundational; builds on US1's Renter aggregate/repo (small, non-breaking completion).
- **US3 (P1)**: Starts after Foundational; independent of US1/US2 (own aggregate/repo/service + auth).
- **US4 (P2)**: Depends on US1 (renter identity) and US6 (org `supportedLocales`); locale resolver is foundational.
- **US5 (P2)**: Depends on US1 (renter tokens) and US3 (admin tokens); guard-level enforcement.
- **US6 (P2)**: Starts after Foundational (needs `organizations` table); needed by US4 and by the full exit-criteria flow (admin → create org → register renter).
- **US7 (P3)**: Depends on US1 (renter status machinery); obligation-gate and scheduled run deferred to rentals/payments phases.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/aggregates before services
- Services before endpoints
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational completes, US1, US2, US3, and US6 can start in parallel (US4/US5/US7 depend on them)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit tests for RenterService.register in apps/api/src/iam/application/renter/__tests__/renter.service.spec.ts"
Task: "Integration test register → exchange → me in apps/api/test/iam/renter-registration.e2e-spec.ts"

# Launch all endpoint controllers for User Story 1 together:
Task: "POST /renters/register controller in apps/api/src/iam/interface/renter/renter-register.controller.ts"
Task: "POST /auth/telegram/exchange controller in apps/api/src/iam/interface/auth/telegram-exchange.controller.ts"
Task: "GET /renters/me controller in apps/api/src/iam/interface/renter/renter-me.controller.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (registration + consent + renter JWT against the seeded `rentiq-dev` org)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP)
3. Add User Story 2 + User Story 3 → Test independently → Deploy/Demo
4. Add User Story 6 → Test independently → **Phase-2 exit criteria met** (admin login → create second org; renter register → renter JWT via exchange)
5. Add User Stories 4, 5, 7 → Test independently → Deploy/Demo
6. Polish (Phase 10) → final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (+ US4/US5 after)
   - Developer B: User Story 3
   - Developer C: User Story 6
3. Stories complete and integrate independently

---

## Notes

- **[P] tasks** = different files, no dependencies
- **[Story] label** maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Out of scope this phase** (recorded, not implemented): FR-026/FR-027 password recovery — delivery channel owned by the notifications capability (spec Assumptions); NFR-006 audit trail — `audit-log` module is roadmap Phase 8; the open-obligation deletion gate and scheduled anonymization run — depend on rentals/payments modules and background jobs (plan.md: none this phase); STATION_OPERATOR station operations — locations phase. → Follow-up owned by Phase 8: `audit-log` MUST consume `RenterRegistered`, `AdminAccountCreated`, `AdminAccountDisabled`, `OrganizationCreated`, `OrganizationSuspended`, `OrganizationBrandingChanged` (event payloads already carry acting identity/orgId).
- **Flagged deltas from plan.md**: `PATCH /renters/me` (9th endpoint, US4); maintenance-window authorization follows roadmap Phase 2 (ORG_ADMIN) per plan.md Risks.
