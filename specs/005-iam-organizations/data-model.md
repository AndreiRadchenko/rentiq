# Data Model: IAM + Organizations

**Date**: 2026-07-31
**Feature**: 005-iam-organizations
**Depends on**: shared-kernel VOs (`EntityId<T>`, `OrgId`, `PhoneNumber`, `Locale`, `TimeWindow`)

## Enums

### AdminRole

| Value | Description |
|-------|-------------|
| SUPER_ADMIN | Platform-level operator (global, no org). Can create/suspend organizations, manage orgs of all tenants. |
| ORG_ADMIN | Manages a single organization: admins, renters, branding, maintenance window. |
| STATION_OPERATOR | Operates one or more stations (`assignedStationIds`); no org-level admin powers. |

### AccountStatus

| Value | Description |
|-------|-------------|
| ACTIVE | Can authenticate and operate. |
| DISABLED | Cannot authenticate; reversible via re-enable. Never hard-deleted. |

### RenterStatus

| Value | Description |
|-------|-------------|
| ACTIVE | Normal state; can hold rentals. |
| DISABLED | Set by admin-initiated disable (reversible, FR-029) or deletion request (irreversible, FR-020/BR-01.6). Records retained. |

### OrganizationStatus

| Value | Description |
|-------|-------------|
| ACTIVE | Operational. |
| SUSPENDED | Frozen by SUPER_ADMIN; reversible. Blocks org-scoped operations while active. |

---

## Aggregate: AdminAccount (iam)

**Purpose**: Identity and authorization record for staff/operators.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | EntityId<'AdminAccountId'> | UUID v4 | PK |
| orgId | OrgId | nullable; NULL only for SUPER_ADMIN | Tenant scope; set from org context, never caller input |
| email | string | unique (global), normalized lowercase | Login identifier |
| passwordHash | string | bcrypt, cost 12 | Never stored plaintext |
| role | AdminRole | required | Authorization level |
| assignedStationIds | EntityId<'StationId'>[] | default [] | Operator-scoped stations (unused by other phases yet) |
| locale | Locale | default 'uk' | UI language (ADR-006 first source) |
| status | AccountStatus | default ACTIVE | Lifecycle state |
| recoveryChannel | RecoveryChannel | optional | Registered self-service recovery path (`email`/`sms`/`phone`); required before FR-026 recovery is usable |
| createdAt | timestamp | required | Creation time |

**Invariants / rules**:
- `orgId` is required unless `role === SUPER_ADMIN` (BR-02.x org scoping).
- A SUPER_ADMIN cannot be created by an ORG_ADMIN; only SUPER_ADMIN creates SUPER_ADMIN.
- An ORG_ADMIN manages only accounts within `TenantContext.getOrgId()`.
- Disabling uses `status = DISABLED`; rows are never hard-deleted (BR-01.6, Principle X).
- A disabled admin cannot login (login re-validates status).

**Transitions**: `ACTIVE → DISABLED` (higher-role admin; SUPER_ADMIN can disable any org admin).

---

## Aggregate: Renter (iam)

**Purpose**: End-customer identity bound to exactly one organization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | EntityId<'RenterId'> | UUID v4 | PK |
| orgId | OrgId | NOT NULL | Tenant scope (renter never global) |
| telegramId | bigint | nullable, globally unique | Bot session link; one Telegram account = one renter |
| phone | PhoneNumber | unique within org (`(org_id, phone)`) | Recognition key (FR-028/SC-009) |
| name | string | 1–255 chars | Display name |
| consentGivenAt | timestamp | NOT NULL | Explicit data-consent timestamp (BR-01.1/FR-001) — required before any identity use |
| consentVersion | string | required | Versioned consent (FR-024/DR-005); re-consent on material change |
| locale | Locale | default 'uk' | UI language |
| status | RenterStatus | default ACTIVE | Lifecycle state |
| createdAt | timestamp | required | Creation time |

**Invariants / rules**:
- Registration is impossible without `consentGivenAt` and `consentVersion` (FR-001).
- Within one org, a phone maps to exactly one renter — enforced by unique `(org_id, phone)`.
  Re-registration with the same phone returns the existing identity, never a duplicate
  (FR-028).
- `telegramId` is globally unique because one Telegram account cannot be bound to multiple
  organizations (per spec/SC-009 resolution).
- Rows are never hard-deleted; deletion request sets `status = DISABLED` permanently
  (FR-020/BR-01.6), admin-initiated disable sets `status = DISABLED` reversibly (FR-029).
- A DISABLED renter cannot receive a fresh JWT via exchange (`renter_disabled` error).

**Transitions**:
- `ACTIVE → DISABLED` (admin-initiated disable — reversible; re-enable allowed).
- `ACTIVE → DISABLED` (renter deletion request — irreversible; data retained 3 years per
  BR-01.6).

---

## Aggregate: Organization (organizations)

**Purpose**: Tenant root; owns admin accounts, renters, and (in later phases) stations,
rentals, payments.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | OrgId | UUID v4 | PK |
| name | string | 1–255 chars | Display name |
| slug | string | unique, lowercase `[a-z0-9-]` | Stable reference (seed: `rentiq`) |
| status | OrganizationStatus | default ACTIVE | Lifecycle state |
| branding | BrandingConfig | required VO | Org presentation config |
| paymentCredsRef | PaymentGatewayCredentialsRef | required VO | Opaque refs to payment secrets (used later) |
| telegramConfig | TelegramBotConfig | required VO | Bot secret + username for exchange |
| maintenanceWindow | MaintenanceWindow | optional VO | Per-org maintenance window |
| checkboxConfig | CheckboxConfig | optional VO | Cash-register placeholder (used later) |
| createdAt | timestamp | required | Creation time |
| deletedAt | timestamp | nullable | Soft-delete safety; normal lifecycle uses SUSPENDED |

**Invariants / rules**:
- Only SUPER_ADMIN creates or suspends organizations.
- Suspension is reversible (`SUSPENDED → ACTIVE` by SUPER_ADMIN).
- Suspending an organization does not delete or disable its admin/renter records.
- Slug is immutable after creation.

**Transitions**: `ACTIVE → SUSPENDED` (SUPER_ADMIN, reversible).

---

## Value Objects

### RecoveryChannel

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| type | string | `email` \| `sms` \| `phone` | Channel kind (FR-026) |
| value | string | validated per type | Contact target; never returned by APIs |

### BrandingConfig

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| logoUrl | string | optional, valid URL | Org logo |
| primaryColor | string | optional, hex `#RRGGBB` | Brand color |
| businessName | string | 1–255 chars | Displayed business name |
| supportedLocales | Locale[] | non-empty subset of {uk, en}; must include `defaultLocale` | Locales offered to users |
| defaultLocale | Locale | required, ∈ supportedLocales | Fallback locale (ADR-006 source #2) |

### PaymentGatewayCredentialsRef

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| gateway | string | enum-ish `{monobank}` | Which gateway |
| secretRef | string | required, opaque | Secret-manager key; never the secret itself |
| enabled | boolean | default true | Active flag |

### TelegramBotConfig

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| botSecretHash | string | bcrypt/sha-256 hash, required | Constant-time-compared against exchange requests (RQ-5) |
| botUsername | string | required, `[a-zA-Z0-9_]{5,32}` | Public bot handle |

### MaintenanceWindow

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| startTime | string (HH:MM) | 24h format | Window start |
| endTime | string (HH:MM) | 24h format, > startTime | Window end |
| timezone | string | IANA tz, default Europe/Kyiv | Applies to both times |

Reuses shared-kernel `TimeWindow` semantics; defined here as the org-scoped config VO.

### CheckboxConfig

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| cashierProfileId | string | optional | Checkbox cashier profile (used in payments phase) |
| enabled | boolean | default false | Integration flag |

---

## Domain Events

All extend shared-kernel `DomainEvent` (`eventId`, `occurredAt`, `eventType`). Each event
carries `orgId` (may be omitted for the bootstrap super-admin creation). Published via the
in-process `EventBus`; no subscribers in this phase.

| Event | Emitter | Payload | Notes |
|-------|---------|---------|-------|
| RenterRegistered | iam | `renterId`, `orgId`, `locale` | Per architecture §6 event catalog; consumed later by notifications/analytics |
| AdminAccountCreated | iam | `adminAccountId`, `orgId` (nullable), `role` | Emitted on any admin creation incl. bootstrap |
| AdminAccountDisabled | iam | `adminAccountId`, `orgId` (nullable) | |
| OrganizationCreated | organizations | `orgId`, `slug` | |
| OrganizationSuspended | organizations | `orgId` | |
| OrganizationBrandingChanged | organizations | `orgId` | |

---

## Database Tables

Owned by the owning module's infrastructure layer (pattern per §4.2 — every business table
carries `org_id`).

### `organizations` (owned by organizations)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| name | varchar(255) | NOT NULL |
| slug | varchar(100) | NOT NULL, UNIQUE |
| status | varchar(16) | NOT NULL, default 'ACTIVE' |
| branding | jsonb | NOT NULL |
| payment_creds_ref | jsonb | NOT NULL |
| telegram_config | jsonb | NOT NULL |
| maintenance_window | jsonb | NULL |
| checkbox_config | jsonb | NULL |
| created_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | NULL (soft-delete safety) |

### `admin_accounts` (owned by iam)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | NULL, FK → organizations.id (NULL only for SUPER_ADMIN) |
| email | varchar(320) | NOT NULL, UNIQUE, lowercase |
| password_hash | varchar(255) | NOT NULL (bcrypt) |
| role | varchar(16) | NOT NULL |
| assigned_station_ids | text[] | NOT NULL, default '{}' (opaque station identifiers, not DB uuids) |
| locale | varchar(8) | NOT NULL, default 'uk' |
| status | varchar(16) | NOT NULL, default 'ACTIVE' |
| recovery_channel | jsonb | NULL (required once FR-026 recovery is implemented) |
| created_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | NULL (rows never hard-deleted; disable via status) |

### `renters` (owned by iam)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| org_id | uuid | NOT NULL, FK → organizations.id |
| telegram_id | bigint | NULL, UNIQUE |
| phone | varchar(20) | NOT NULL, E.164 — UNIQUE with org_id |
| name | varchar(255) | NOT NULL |
| consent_given_at | timestamptz | NOT NULL |
| consent_version | varchar(32) | NOT NULL |
| locale | varchar(8) | NOT NULL, default 'uk' |
| status | varchar(16) | NOT NULL, default 'ACTIVE' |
| disable_reason | varchar(16) | NULL — `ADMIN` (reversible, FR-029) or `DELETION_REQUEST` (permanent, FR-020/BR-01.6) |
| created_at | timestamptz | NOT NULL, default now() |

**Unique constraints**: `organizations.slug` UNIQUE; `admin_accounts.email` UNIQUE;
`renters.telegram_id` UNIQUE (nullable); `renters (org_id, phone)` composite UNIQUE.

---

## Repository Patterns

- Each repository is tenant-scoped: reads `orgId` from `TenantContext`, never from caller
  arguments (shared-kernel §4.2 pattern).
- Exceptions: super-admin global lookups (`email` login, org create/suspend) are explicitly
  unscoped and permitted only via SUPER_ADMIN-guarded services.
- Renter lookups that must also match a `telegramId`/`phone` include `org_id` in the
  predicate — the renter's org is always the caller's org.

---

## Validation Rules Summary

- Admin login: email exists **and** `status = ACTIVE` → otherwise `invalid_credentials`
  (uniform error, NFR-009).
- Renter registration: consent fields required; phone must be E.164 (`PhoneNumber` VO);
  if `(org_id, phone)` already exists → return existing identity + `already_registered`;
  if existing renter is DISABLED → `renter_disabled`.
- Telegram exchange: secret constant-time match against `TelegramBotConfig.botSecretHash`;
  renter must exist, be ACTIVE, and belong to the caller's org.
- Org creation: slug unique, lowercase `[a-z0-9-]`; branding VOs validated; only SUPER_ADMIN.
