# Research Notes — Phase 0: IAM + Organizations

Researched open technical points before design. Every resolved question states the decision,
rationale, and alternatives considered, grounded in the feature spec (`spec.md`),
constitution, and architecture doc.

## RQ-1 — Password hashing algorithm

- **Decision**: bcrypt (cost factor 12).
- **Rationale**: architecture §4.3 names `PasswordHasher` with bcrypt; Node `bcrypt` is
  native (fast, battle-tested); the `SUPER_ADMIN` seed and admin login are the only hashing
  paths in this phase; PHC-grade argon2 is not required by the architecture and adds a
  native build dependency for no in-phase need.
- **Alternatives**:
  - argon2 — stronger KDF, but spec/architecture reference bcrypt and do not call for argon2.
  - scrypt (node:crypto) — zero deps, but no explicit architecture support and weaker
    ecosystem convention here.

## RQ-2 — JWT strategy & token lifecycle

- **Decision**: asymmetric **RS256** signing using `@nestjs/jwt`; access token 15 minutes,
  refresh token 7 days (both enforced by `exp` claims). Refresh is rotated: each refresh
  reissues a new pair and the old refresh token is rejected thereafter (per
  `SESSION_RENEWAL`/NFR-002). Keys are loaded from env/secret store (private key signs,
  public key verifies) — never committed (Principle X).
- **Rationale**: constitution Principle X mandates RS256 asymmetric tokens with 15-min/7-day
  lifetimes; `@nestjs/jwt` is the module already in the NestJS stack; rotation protects
  long-lived refresh tokens without server-side session tables.
- **Alternatives**:
  - Symmetric HS256 — rejected (Principle X explicitly requires RS256).
  - Opaque refresh tokens in a `sessions` table — rejected: adds a table + revocation cron
    in a phase whose exit criteria only need JWT issuance; rotation + short TTL covers the
    use case. Revisit if revocation becomes a product requirement.

## RQ-3 — Locale resolution middleware

- **Decision**: a custom `I18nResolver` (`JwtLocaleResolver`) registered **first** in the
  `nestjs-i18n` resolver chain reads the `locale` claim from the JWT and resolves it against
  the org's `supportedLocales`/`defaultLocale`, falling back to system `uk`. This implements
  ADR-006 resolution order (JWT claim → org `defaultLocale` → `uk`) on top of the Phase-1
  i18n module (currently `AcceptLanguage` → `x-lang` → `lang`).
- **Rationale**: architecture §8.3 mandates the JWT-first order; bot-sent requests rely on it
  (bot passes the renter's JWT, no `Accept-Language`). Clean integration via nestjs-i18n's
  `I18nResolver` interface — no hand-rolled middleware.
- **Alternatives**:
  - Custom Nest middleware mutating a request-scoped context — rejected: bypasses
    nestjs-i18n's `I18nContext` and duplicates resolver logic.
  - Leave Phase-1 chain unchanged — rejected: violates ADR-006 (JWT must win).

## RQ-4 — Admin/renter authorization mechanism

- **Decision**: two small custom guards on `shared-kernel`: `JwtAuthGuard` (verifies the
  bearer RS256 token, populates `TenantContext` with `orgId`, `role`, `locale`) and
  `RolesGuard` (declarative `@Roles(...)` check against `TenantContext.role`). Renter-token
  endpoints assert the token `type === 'renter'`; admin endpoints require `type === 'admin'`.
- **Rationale**: no passport dependency needed; guards are the idiomatic NestJS way; role data
  lives in the token and is re-validated against account status on protected operations.
- **Alternatives**:
  - `@nestjs/passport` + `passport-jwt` — rejected: extra deps for a single strategy; the
    architecture names "Role-based NestJS guards reading TenantContext" directly.

## RQ-5 — Telegram exchange security

- **Decision**: `POST /auth/telegram/exchange` authenticates with the org's bot secret
  (stored hashed in `TelegramBotConfig.botSecretHash`), compared in constant time. The body
  carries `telegramId`; exchange succeeds **only for an existing ACTIVE renter** (matched by
  `org_id` + `telegram_id`) and mints a renter JWT. Unknown/disabled renters get a
  `renter_not_registered` error — registration is the consent-gated step, never implicit.
- **Rationale**: FR-014/BR-01.5 make consent a hard precondition of any identity; the bot is a
  "REST-client-only" process (ADR) and must not mint identities by itself. Hashing the secret
  means a DB leak does not leak the secret (Principle X).
- **Alternatives**:
  - Auto-register on exchange — rejected: bypasses explicit consent, violating BR-01.5.
  - Plaintext secret comparison — rejected: leak vector; constant-time compare required.

## RQ-6 — Ren name identity uniqueness & returning-renter recognition

- **Decision**: enforce `(org_id, phone)` uniqueness via a composite unique constraint on
  `renters` (FR-028/SC-009). `RenterService` recognizes an existing ACTIVE renter by phone
  within the org and returns the existing identity (with `already_registered` signal) instead
  of creating a duplicate; a DISABLED renter on the same phone is returned as
  `renter_disabled` (re-enable is the recovery path, FR-029).
- **Rationale**: spec SC-009 explicitly demands recognition by phone; a DB constraint closes
  the race between two concurrent registrations that service-level checks alone cannot.
- **Alternatives**:
  - Service-level check only — rejected: TOCTOU race can create duplicates.
  - Global (org-agnostic) phone uniqueness — rejected: the spec scopes recognition per
    organization (BR-01).

## RQ-7 — Renter token contents vs. admin token contents

- **Decision**: both are RS256 JWTs but carry a `type` claim and a minimal payload:
  - Admin: `sub` = adminAccountId, `orgId` (absent for SUPER_ADMIN), `role`, `type: 'admin'`,
    `locale`.
  - Renter: `sub` = renterId, `orgId`, `type: 'renter'`, `locale`.
  Guards enforce `type` per route group. `orgId` and `locale` populate `TenantContext` and
  drive the i18n resolver (RQ-3).
- **Rationale**: keeps renter payload free of role data while giving the guards everything
  they need; `org_id` on every request is an architecture requirement (ADR-007).
- **Alternatives**:
  - Single generic token — rejected: cannot distinguish renter vs. admin routes safely.

## RQ-8 — `organizations` → `iam` boundary enforcement

- **Decision**: `OrganizationsModule` imports `IamModule`'s **application layer only**
  (e.g., `AdminAccountService` to bootstrap an admin on org creation) — never iam domain
  entities, repositories, or interface DTOs. Shared identity types (`OrgId`) come from
  shared-kernel, not from iam.
- **Rationale**: architecture ADR-008 and the roadmap dependency edge
  `organizations ──── iam`; this keeps `iam` independently evolvable and avoids an
  `organizations ↔ iam` cycle.
- **Alternatives**:
  - Direct repo access from organizations — rejected: couples modules at the DB layer.
  - Introduce a shared package for identity — rejected: over-abstraction; iam is the rightful
    owner of admin/renter identity.

## RQ-9 — Seed strategy

- **Decision**: idempotent seed script extending the Phase-1 seed pattern: creates
  `SUPER_ADMIN` (email + password from env, bcrypt-hashed at seed time) and the `rentiq-dev`
  organization (slug `rentiq`). Re-running is a no-op via existence checks on email/slug.
- **Rationale**: the exit criteria require login + org creation; a bootstrap org and admin
  must exist before any API call. Idempotency keeps local/dev refresh workflows safe.
- **Alternatives**:
  - Seed via migration — rejected: credentials in migrations are an anti-pattern; env-driven
    seed keeps secrets out of the repo.
