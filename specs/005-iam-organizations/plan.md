# Implementation Plan: IAM + Organizations

**Branch**: `005-iam-organizations` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-iam-organizations/spec.md`

## Summary

Deliver the identity & access-management and organization-management capabilities of rentiq
(roadmap Phase 2). Two new NestJS modules land on top of the Phase 1 shared-kernel:

- **`iam`** — admin authentication (JWT RS256, 15-min access + 7-day refresh), admin account
  lifecycle, renter registration + JWT issuance, telegram bot-session exchange, and the
  `RenterRegistered`, `AdminAccountCreated`, `AdminAccountDisabled` domain events.
- **`organizations`** — organization creation, suspension, branding, and maintenance-window
  configuration, plus the `OrganizationCreated`, `OrganizationSuspended`,
  `OrganizationBrandingChanged` domain events.

`organizations` depends on `iam` **only through its public application-service interface**
(i.e., it imports `iam`'s application layer, never its domain/infrastructure internals). Both
modules depend on shared-kernel. No background jobs are introduced; domain events are
published on the in-process event bus with no Phase-2 subscribers yet (notifications/analytics
consume them in later phases). The three new tables (`organizations`, `admin_accounts`,
`renters`) are greenfield — no data migration or backfill — but the schema change still ships
as one `drizzle-kit`-generated migration (Principle VII), plus a seed for the bootstrap
`SUPER_ADMIN` and the `rentiq-dev` organization (slug `rentiq`).

Exit success (Phase 2 roadmap): an admin logs in via Postman and creates a second organization;
a renter registers and receives a renter JWT via the `/auth/telegram/exchange` endpoint.

## Technical Context

**Language/Version**: TypeScript 5.4+ (NestJS 10, Node >= 20, pnpm 9)

**Primary Dependencies**: existing shared-kernel (drizzle-orm + pg, @nestjs/event-emitter,
nestjs-i18n, zod, uuid); new: `bcrypt` (password hashing), `@nestjs/jwt` (RS256 signing), plus
dev types (`@types/bcrypt`). JWT/role guards are custom NestJS guards — no passport dependency.

**Storage**: PostgreSQL via Drizzle ORM. Three new tables: `organizations`, `admin_accounts`,
`renters` (schema per architecture doc §5.4 and `data-model.md`).

**Testing**: Jest (unit, `test:unit`) + Supertest (e2e, `test:e2e`), matching Phase 1 setup.
Unit: `AuthService` (login/refresh/exchange, RS256, 15-min/7-day), `RenterService`,
`AdminAccountService`, `OrganizationService`, guards. Integration: full flow
login → create-org → register-renter → telegram-exchange; plus locale-resolution check.

**Target Platform**: Linux server (`apps/api`, NestJS HTTP API).

**Project Type**: modular-monolith web service; feature modules inside the existing
`apps/api` Nx project.

**Performance Goals**: not a bottleneck phase; auth/token issuance must stay well under
shared-kernel latency budgets (no synchronous external calls on hot paths).

**Constraints**: strict module boundary `organizations → iam` (application interface only);
`enforce-module-boundaries` lint rule enabled in this phase (Task T059);
`org_id` + `TenantContext` on every request; money/monotonic values as integers (unused here);
append-only audit for financial tables (unused here); locale resolution must follow
ADR-006 order: JWT claim → org `defaultLocale` → `uk`; RS256 keypair never committed.

**Scale/Scope**: single-tenant-to-few-organizations bootstrap; seed 1 org + 1 super admin;
renter scale is small (one rental business) but must be unique per `(org_id, phone)`.

## Architecture Impact

- Two new feature modules (`iam`, `organizations`) register in `AppModule`; both depend on
  shared-kernel (`TenantContext`, `OrgId`, `EventBus`, `Db`, i18n, config).
- `iam` owns the auth surface. It does **not** depend on `organizations`; tenant identity is
  carried by the shared-kernel `OrgId` VO. `organizations` depends on `iam` via its exported
  application services only (e.g., admin-account creation on org bootstrap). This satisfies the
  roadmap dependency edge `organizations ──── iam` without a cycle (ADR-008 module boundaries).
- `TenantContext` is populated by an auth middleware/guard that verifies the JWT and sets
  `orgId` + `role` + `locale` on the per-request context (extending the Phase-1 tenant
  middleware rather than replacing it).
- i18n: a custom `I18nResolver` is registered **first** so the JWT `locale` claim wins over
  `Accept-Language`/`x-lang`/`lang`, implementing ADR-006 resolution order. `auth.json` +
  `organizations.json` + `renters.json` translation bundles are added in `uk` and `en`.
- `EventBus` (existing) is used to publish the six Phase-2 domain events; no subscribers are
  wired in this phase — publish only, with explicit coverage that events are emitted.
- No schema/process for Telegram, Monobank, Checkbox, or MinIO touches this phase; all remain
  behind future named ports.

## Required Modules

### `iam`

- **`auth`** sub-capability: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/telegram/exchange`.
- **`renter`** sub-capability: `POST /renters/register`, `GET /renters/me`.
- **`admin-account`** sub-capability: account lifecycle (create/disable/role assign) consumed
  via application service; no HTTP surface beyond login (org onboarding uses the
  `AdminAccountService` from `organizations`).
- Publishes: `RenterRegistered`, `AdminAccountCreated`, `AdminAccountDisabled`.

### `organizations`

- `POST /organizations` (super-admin), `PATCH /organizations/:id/branding` (super-admin),
  `POST /organizations/:id/maintenance-window` (org-admin, per roadmap Phase 2).
- Publishes: `OrganizationCreated`, `OrganizationSuspended`, `OrganizationBrandingChanged`.

### Boundary rules

- `organizations` imports `iam`'s application-service symbols only (never domain entities,
  infrastructure, or interface layers) — enforced by the `enforce-module-boundaries` lint
  rule enabled in this phase (Task T059) + review.
- Both modules stay under the shared-kernel umbrella for cross-cutting concerns (ids,
  events, tenant context, i18n, DB access).

## Domain Model

Aggregates are plain domain objects (no DB coupling), built from validated command inputs;
all identities are shared-kernel `EntityId`/`OrgId` VOs. See `data-model.md` for tables.

- **`AdminAccount`** (iam): `id`, `orgId` (nullable — `SUPER_ADMIN` has none),
  `email` (unique), `passwordHash`, `role` (`SUPER_ADMIN | ORG_ADMIN | STATION_OPERATOR`),
  `assignedStationIds: string[]`, `locale` (default `uk`), `status` (`ACTIVE | DISABLED`),
  `recoveryChannel` (registered `email`/`sms`/`phone` path, FR-026).
  Transitions: `ACTIVE → DISABLED` (by a higher-role admin). Never hard-deleted.
- **`Renter`** (iam): `id`, `orgId`, `telegramId` (nullable, globally unique),
  `phone` (normalized, unique within org), `name`, `consentGivenAt`, `locale`,
  `status` (`ACTIVE | DISABLED`). Transitions: `ACTIVE → DISABLED` via admin-initiated disable
  (reversible — FR-029) or deletion request (irreversible — FR-020/BR-01.6). Re-registration
  with the same phone is recognized, never duplicated (FR-028, unique `(org_id, phone)`).
- **`Organization`** (organizations): `id`, `name`, `slug` (unique), `status`
  (`ACTIVE | SUSPENDED`), `createdAt`, and VOs:
  - **`BrandingConfig`**: `logoUrl`, `primaryColor`, `businessName`, `supportedLocales`,
    `defaultLocale`.
  - **`PaymentGatewayCredentialsRef`**: opaque refs to payment-credentials secrets (used in
    later phases; stored now).
  - **`TelegramBotConfig`**: `botSecretHash` (used for `/auth/telegram/exchange`), `botUsername`.
  - **`MaintenanceWindow`**: `startTime`, `endTime`, `timezone` (per-roadmap ORG_ADMIN config).
  - **`CheckboxConfig`**: cash-register integration placeholder (later phases).
  Transition: `ACTIVE → SUSPENDED` (super-admin, reversible). Suspension suspends orgs but
  does not disable its admin/renter records.

## Database Changes

Three new tables (greenfield — no data backfill; schema detail in `data-model.md`, shipped
as one `drizzle-kit`-generated migration per Principle VII):

1. **`organizations`** — id, name, slug (unique), status, branding JSONB, payment-creds-ref
   JSONB, telegram-config JSONB, maintenance-window JSONB, checkbox-config JSONB, created_at,
   deleted_at (soft-delete for safety; default NULL).
2. **`admin_accounts`** — id, org_id (nullable, FK → organizations, NULL for super-admin),
   email (unique), password_hash, role, assigned_station_ids (text[]), locale, status,
   created_at, deleted_at. Append-only: disable via `status`, never delete rows.
3. **`renters`** — id, org_id (NOT NULL, FK), telegram_id (bigint, unique, nullable),
   phone (unique per org via `(org_id, phone)`), name, consent_given_at (NOT NULL), locale,
   status, created_at. Never hard-deleted; disable via `status`.

Seed: one bootstrap `SUPER_ADMIN` (email from env/`ADMIN_EMAIL`, password hashed via bcrypt at
seed time) + `Organization` "rentiq-dev" (slug `rentiq`). Seed is idempotent.

## APIs

All under `/api/v1`, JSON, reuse the Phase-1 error envelope and the configured i18n
localization (JWT-locale-aware). Contracts with request/response/error payloads in
`contracts/api.md`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | public | admin email+password → JWT pair |
| POST | `/auth/refresh` | refresh token | rotate refresh + reissue access token |
| POST | `/auth/telegram/exchange` | bot secret | telegram session → renter JWT |
| POST | `/renters/register` | public (bot) | create renter identity w/ explicit consent → renter JWT |
| GET | `/renters/me` | renter JWT | current renter profile |
| POST | `/organizations` | SUPER_ADMIN | create org + bootstrap admin |
| PATCH | `/organizations/:id/branding` | SUPER_ADMIN | update branding VOs |
| POST | `/organizations/:id/maintenance-window` | ORG_ADMIN | set maintenance window |

## Events

Published on the existing in-process `EventBus`; payloads as `DomainEvent` with `id`, type,
`occurredAt`, `orgId` and per-event fields:

| Event | Emitter | Payload notes |
|-------|---------|---------------|
| `RenterRegistered` | iam | `renterId`, `orgId`, `locale` (per §6 event catalog) |
| `AdminAccountCreated` | iam | `adminAccountId`, `orgId`, `role` |
| `AdminAccountDisabled` | iam | `adminAccountId`, `orgId` |
| `OrganizationCreated` | organizations | `orgId`, `slug` |
| `OrganizationSuspended` | organizations | `orgId` |
| `OrganizationBrandingChanged` | organizations | `orgId` |

No subscribers in this phase (notifications/analytics come later). Publishing is exercised by
tests to prove emission.

## Background Jobs

None. No scheduled tasks, queues, or cron in this phase. Token refresh is synchronous.

## Testing Strategy

- **Unit (Jest)** — `AuthService`: bcrypt verify, RS256 sign/verify, 15-min access / 7-day
  refresh, refresh rotation, telegram exchange (constant-time secret compare, renter must
  exist). `RenterService`: registration consent precondition, duplicate-phone recognition
  (FR-028), disable transitions. `AdminAccountService`: role rules, disable. `OrganizationService`:
  slug uniqueness, branding validation, suspension. Guards: unauthenticated/forbidden paths.
- **Integration (Supertest + test DB)** — full happy path:
  `POST /auth/login` → `POST /organizations` (with admin JWT) → `POST /renters/register` →
  `POST /auth/telegram/exchange` → `GET /renters/me`; then locale check (register with `en`,
  assert `en` messages returned; JWT locale wins over `Accept-Language`).
- **No new e2e infra** — reuses Phase-1 `docker-compose.e2e.yml` / `jest-e2e.json`.

## Risks

| Risk | Mitigation |
|------|------------|
| Authorization role scope conflicts (e.g., maintenance-window: architecture §7 lists it super-admin-only, roadmap Phase 2 says ORG_ADMIN) | Plan follows roadmap Phase 2 (ORG_ADMIN); flagged to product owner in spec-clarification log before implementation |
| Telegram exchange secret leakage | Secret stored as hash in `TelegramBotConfig`; constant-time comparison; no secret logging |
| RS256 keypair mishandled/committed | Keys via env/secret store only, never in repo; e2e uses ephemeral generated keys |
| Duplicate renter identity under race | Unique `(org_id, phone)` DB constraint + service-level recognition (FR-028) |
| Cross-module coupling drift (organizations reaching into iam internals) | Public application-service facade only; enforce via review; note in README per module |
| i18n resolver ordering regression | First resolver = JWT-locale resolver; integration test asserts precedence |

## Migration & Seeding

- **Migrations**: no data migration or backfill (greenfield). The three new tables are added
  to the Drizzle schema and shipped as a single `drizzle-kit generate` migration committed to
  git (never hand-edited — Principle VII), applied via the Phase-1 `db:migrate` path.
- **Seed**: idempotent seed script (Phase-1 seed pattern extended):
  - `SUPER_ADMIN` admin account (email + bcrypt hashed password from env),
  - `Organization` "rentiq-dev", slug `rentiq`,
  - optional dev renter for local Telegram smoke tests.
- Data safety: `admin_accounts`/`renters` rows are never deleted — disable via status
  (BR-01.6, FR-020).

## Task Breakdown

Design-level breakdown aligned to Phase 2 deliverables/exit criteria (granular tasks are
produced by `/speckit.tasks`):

1. **Auth foundations**: add `bcrypt` + `@nestjs/jwt`; `AuthService` (login, refresh,
   exchange); RS256 key loading from env; JWT + refresh token service; `JwtAuthGuard` +
   `RolesGuard` wiring `TenantContext`.
2. **Locale resolution**: custom `I18nResolver` reading the JWT `locale` claim, registered
   first; `auth.json`, `organizations.json`, `renters.json` bundles in `uk`/`en`;
   first translated string `invalid_credentials` in both locales.
3. **iam module**: `AdminAccount` + `Renter` aggregates, repositories, application services;
   `admin_accounts` + `renters` Drizzle tables; events `RenterRegistered`,
   `AdminAccountCreated`, `AdminAccountDisabled`; `/auth/login`, `/auth/refresh`,
   `/auth/telegram/exchange`, `/renters/register`, `/renters/me`.
4. **organizations module**: `Organization` aggregate + VOs; `organizations` table; events
   `OrganizationCreated`, `OrganizationSuspended`, `OrganizationBrandingChanged`;
   `/organizations`, `/organizations/:id/branding`, `/organizations/:id/maintenance-window`;
   bootstraps an admin account via the `iam` application-service interface.
5. **Seed + validation**: idempotent seed (SUPER_ADMIN + "rentiq-dev"/`rentiq`); Postman
   collection covering the exit criteria flows; enable `enforce-module-boundaries` + boundary
   review.
6. **Exit-criteria verification**: admin login via Postman → JWT → create second organization;
   renter registration → renter JWT via telegram exchange; locale-resolution check.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Delivery Workflow (single source of truth)**: plan derives only from `spec.md`, which
  derives from the architecture/business-rules docs. Passed.
- **Phase Integrity**: no production code in this phase; artifacts are plan/research/
  data-model/contracts/quickstart only. Passed.
- **Core Principles I–V, VII, VIII**: single responsibility per module; explicit consent for
  renter registration (FR-001/BR-01.1); no orphaned data (retention + anonymization rules);
  org/tenant scoping via `org_id`; no hard deletes; domain-first boundaries. Passed. Principle V
  is satisfied by enabling the `enforce-module-boundaries` lint rule for `apps/api` in this
  phase (Task T059).
- **Principle IX (localization)**: ADR-006 resolution order implemented via first-position
  JWT-locale resolver; seed default `uk`. Passed.
- **Principle X (security)**: bcrypt password hashing; RS256 asymmetric tokens with
  15-min/7-day lifetimes; secrets out of repo; constant-time secret comparison. Passed.
- **Quality & Verification**: unit + integration coverage defined; exit criteria mapped to
  tests and Postman flows. Passed.
- **Complexity Tracking**: no violations — three tables and two modules are the minimal
  structure implied by the architecture. N/A.

## Project Structure

### Documentation (this feature)

```text
specs/005-iam-organizations/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── app.module.ts                        # registers IamModule + OrganizationsModule
├── shared-kernel/                       # Phase 1 (existing) + auth guard additions
│   ├── interface/middleware/            # tenant.middleware.ts, tenant-context.ts (existing)
│   └── infrastructure/i18n/             # i18n.module.ts (add JwtLocaleResolver)
├── iam/
│   ├── domain/                          # AdminAccount, Renter aggregates; VOs; ports
│   ├── application/                     # AuthService, RenterService, AdminAccountService, ports
│   ├── infrastructure/                  # drizzle schema (admin_accounts, renters), jwt, bcrypt, repos
│   ├── interface/                       # auth.controller, renters.controller, guards, dto
│   └── iam.module.ts                    # exports application-service facade
├── organizations/
│   ├── domain/                          # Organization aggregate + BrandingConfig, TelegramBotConfig, ...
│   ├── application/                     # OrganizationService
│   ├── infrastructure/                  # drizzle schema (organizations), repos
│   ├── interface/                       # organizations.controller, dto
│   └── organizations.module.ts          # imports IamModule for admin bootstrap
└── main.ts                              # (existing)
```

**Structure Decision**: follow the Phase-1 hexagonal layout (domain / application /
infrastructure / interface) already established in `apps/api/src/shared-kernel` and documented
in `specs/004-shared-kernel-foundation`. Each feature module is a self-contained Nest module
with its own sub-folders; cross-module access flows through application-service interfaces
only. Tests live beside their modules (`*.spec.ts`) and in `apps/api/test/` for e2e.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Justified deferral (NFR-006 / Principle X)**: the append-only audit trail is owned by the
`audit-log` module (roadmap Phase 8). This phase persists no audit entries; instead the six
domain events (T020/T032/T051) carry the acting identity and org so the audit-log module can
consume them in Phase 8 without schema change. Entered as a tracked follow-up, not a silent gap.
