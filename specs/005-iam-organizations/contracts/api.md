# API Contracts: IAM + Organizations

**Date**: 2026-07-31
**Feature**: 005-iam-organizations
**Base**: all endpoints under `/api/v1`, JSON. Reuses the Phase-1 error envelope
(`correlationId`, `code`, localized `message`, `timestamp`) — see
`specs/004-shared-kernel-foundation/contracts/api.md`.

## New Error Codes (this feature)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password or disabled account (uniform message, NFR-009) |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token missing/expired/rotated |
| `RENTER_NOT_REGISTERED` | 403 | Telegram exchange for unknown renter |
| `RENTER_DISABLED` | 403 | Renter account disabled (FR-029) |
| `RENTER_ALREADY_REGISTERED` | 409 | Phone already bound to an ACTIVE renter in this org (FR-028) |
| `BOT_SECRET_INVALID` | 401 | Telegram exchange secret mismatch |
| `SLUG_TAKEN` | 409 | Organization slug already in use |
| `FORBIDDEN` | 403 | Authenticated but wrong role for the operation |
| `ORG_SUSPENDED` | 403 | Organization suspended; org-scoped operation blocked |
| `CONSENT_REQUIRED` | 400 | Registration missing explicit consent (BR-01.1) |
| `RE_CONSENT_REQUIRED` | 400 | Standing consent is stale after a material statement change (FR-024) |

## Locale resolution

Applies to every response `message`. Order (ADR-006): JWT `locale` claim → org
`defaultLocale` → system `uk`.

---

## POST /auth/login

**Purpose**: Admin authentication. Returns an access + refresh token pair.

**Authentication**: none.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | yes | Admin email (case-insensitive) |
| password | string | yes | Plaintext password (never logged) |

**Response (200 OK)**:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "admin": {
    "id": "uuid",
    "orgId": "uuid",
    "role": "ORG_ADMIN",
    "email": "admin@rentiq.dev"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| accessToken | string | RS256 JWT, 15-min TTL |
| refreshToken | string | RS256 JWT, 7-day TTL, type `refresh` |
| expiresIn | integer | Access token TTL in seconds (900) |
| admin | object | Admin identity; `orgId` null for SUPER_ADMIN |

**Errors**: `INVALID_CREDENTIALS` (401) for wrong credentials or disabled account — identical
message in both cases.

**Admin JWT claims**: `sub`=adminAccountId, `orgId` (nullable), `role`, `type: 'admin'`,
`locale`.

---

## POST /auth/refresh

**Purpose**: Rotate the refresh token and reissue an access token.

**Authentication**: bearer `refreshToken` (in body per bot-friendliness).

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| refreshToken | string | yes | Valid, unrotated refresh token |

**Response (200 OK)**: same shape as `/auth/login` (new pair).

**Behavior**: the presented refresh token is invalidated after use (rotation); the new
refresh token replaces it. A used or expired token returns `INVALID_REFRESH_TOKEN`.

**Errors**: `INVALID_REFRESH_TOKEN` (401).

---

## POST /auth/telegram/exchange

**Purpose**: Exchange a Telegram session for a renter JWT. Called by the bot with the org's
bot secret (REST-client-only bot, ADR).

**Authentication**: `Authorization: Bot <orgBotSecret>`.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| telegramId | integer | yes | Telegram user id (positive int64) |

**Response (200 OK)**:

```json
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "renter": {
    "id": "uuid",
    "orgId": "uuid",
    "name": "Олег",
    "locale": "uk",
    "status": "ACTIVE"
  }
}
```

**Behavior**: secret is constant-time compared against `TelegramBotConfig.botSecretHash`.
Renter must exist, be ACTIVE, and belong to the bot's org (matched by
`org_id + telegram_id`).

**Renter JWT claims**: `sub`=renterId, `orgId`, `type: 'renter'`, `locale`.

**Errors**: `BOT_SECRET_INVALID` (401), `RENTER_NOT_REGISTERED` (403),
`RENTER_DISABLED` (403).

---

## POST /renters/register

**Purpose**: Create a renter identity with explicit consent. Returns a renter JWT.

**Authentication**: public (invoked by the bot after consent is collected).

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Display name (1–255) |
| phone | string | yes | E.164, e.g. `+380501234567` |
| consentGiven | boolean | yes | Must be `true` (BR-01.1) |
| consentVersion | string | yes | Consent terms version, e.g. `"v1"` |
| locale | string | no | `uk` or `en`; default `uk` |
| telegramId | integer | no | Bind to Telegram now (used at exchange) |

**Response (200 OK)**:

```json
{
  "renter": {
    "id": "uuid",
    "orgId": "uuid",
    "name": "Олег",
    "phone": "+380501234567",
    "consentGivenAt": "2026-07-31T12:00:00.000Z",
    "locale": "uk",
    "status": "ACTIVE"
  },
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "alreadyRegistered": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| renter | object | Created (or existing, when `alreadyRegistered: true`) renter |
| accessToken | string | Renter JWT (15 min) |
| alreadyRegistered | boolean | `true` when the phone was already bound to an ACTIVE renter (FR-028) |

**Behavior**:
- `consentGiven: false` → `CONSENT_REQUIRED` (400).
- Phone already bound to an ACTIVE renter in this org → return existing identity, no new row,
  `alreadyRegistered: true` (FR-028/SC-009).
- Phone bound to a DISABLED renter → `RENTER_DISABLED` (recovery path is re-enable, FR-029).

**Errors**: `CONSENT_REQUIRED` (400), `RENTER_DISABLED` (403), `VALIDATION_ERROR` (400),
`RENTER_ALREADY_REGISTERED` (409) if the product later wants a hard-error variant.

---

## GET /renters/me

**Purpose**: Current renter profile.

**Authentication**: renter JWT bearer.

**Response (200 OK)**: `{ "renter": { id, orgId, name, phone, consentGivenAt, consentVersion,
locale, status } }` (same shape as register).

**Errors**: `FORBIDDEN` (403) when token `type` is not `renter`; `NOT_FOUND` (404) for a
deleted/missing identity.

---

## PATCH /renters/me

**Purpose**: Change the renter's interface locale (DR-003 — changeable at any time).

**Authentication**: renter JWT bearer.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| locale | string | yes | `uk` or `en`; must be ∈ org `supportedLocales` (BR-02.2) |

**Response (200 OK)**: `{ "renter": { id, orgId, name, phone, consentGivenAt, consentVersion,
locale, status } }` with the updated `locale`.

**Behavior**: rejects locales outside the org's `supportedLocales` (BR-02.2). Resolution
precedence for subsequent messages is unchanged (ADR-006: JWT `locale` claim → org default →
`uk`).

**Errors**: `VALIDATION_ERROR` (400), `FORBIDDEN` (403), `NOT_FOUND` (404).

---

## POST /renters/me/re-consent

**Purpose**: Record the renter's acceptance of the current consent statement after a material
change (FR-024, DR-005).

**Authentication**: renter JWT bearer.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| consentVersion | string | yes | Must equal the currently-published statement version (e.g. `"v2"`) |

**Response (200 OK)**: `{ "renter": { id, orgId, name, phone, consentGivenAt, consentVersion,
locale, status } }` with `consentVersion` updated.

**Behavior**: an unknown or non-current `consentVersion` is rejected
(`RE_CONSENT_REQUIRED`); re-consent never deletes or anonymizes the renter. Until the affected
renter re-consents, new bookings are blocked (needs-re-consent invariant).

**Errors**: `RE_CONSENT_REQUIRED` (400), `VALIDATION_ERROR` (400), `FORBIDDEN` (403),
`NOT_FOUND` (404).

---

## POST /organizations

**Purpose**: Create an organization + its ORG_ADMIN bootstrap account (via the iam
application-service interface).

**Authentication**: SUPER_ADMIN JWT.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Organization display name |
| slug | string | yes | `[a-z0-9-]`, unique |
| adminEmail | string | yes | Bootstrap ORG_ADMIN email |
| adminPassword | string | yes | Bootstrap ORG_ADMIN password |
| defaultLocale | string | no | `uk` or `en`; default `uk` |
| supportedLocales | string[] | no | Default `["uk", "en"]` |
| businessName | string | no | Defaults to `name` |
| telegramBotSecret | string | yes | Bot secret for the exchange endpoint |

**Response (201 Created)**:

```json
{
  "organization": {
    "id": "uuid",
    "name": "OrgName",
    "slug": "org-slug",
    "status": "ACTIVE",
    "branding": {
      "businessName": "OrgName",
      "supportedLocales": ["uk", "en"],
      "defaultLocale": "uk"
    }
  },
  "bootstrapAdmin": {
    "id": "uuid",
    "orgId": "uuid",
    "role": "ORG_ADMIN",
    "email": "admin@org-slug.rentiq.dev"
  }
}
```

**Behavior**: creates `organizations` row + `admin_accounts` row via `iam`'s
`AdminAccountService`; emits `OrganizationCreated` + `AdminAccountCreated`. `telegramBotSecret`
is stored hashed in `TelegramBotConfig.botSecretHash` (never returned).

**Errors**: `SLUG_TAKEN` (409), `VALIDATION_ERROR` (400), `FORBIDDEN` (403).

---

## PATCH /organizations/:id/branding

**Purpose**: Update organization branding VOs.

**Authentication**: SUPER_ADMIN JWT.

**Request Body** (all optional; partial update):

| Field | Type | Description |
|-------|------|-------------|
| logoUrl | string | Valid URL or null to clear |
| primaryColor | string | `#RRGGBB` |
| businessName | string | 1–255 chars |
| supportedLocales | string[] | Non-empty subset of {uk, en} |
| defaultLocale | string | Must be ∈ supportedLocales |

**Response (200 OK)**: `{ "organization": { "id", "status", "branding": {...} } }`.

**Behavior**: emits `OrganizationBrandingChanged`. Suspended orgs reject with `ORG_SUSPENDED`.

**Errors**: `FORBIDDEN` (403), `ORG_SUSPENDED` (403), `VALIDATION_ERROR` (400),
`NOT_FOUND` (404).

---

## POST /organizations/:id/maintenance-window

**Purpose**: Set the org maintenance window (roadmap Phase 2: ORG_ADMIN scope; architecture
§7 lists it super-admin-only — discrepancy flagged to product owner before implementation).

**Authentication**: ORG_ADMIN JWT (own org) — per roadmap; SUPER_ADMIN may act on any org.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| startTime | string (HH:MM) | yes | e.g. `"02:00"` |
| endTime | string (HH:MM) | yes | Must be after startTime |
| timezone | string | no | IANA tz; default `Europe/Kyiv` |

**Response (200 OK)**: `{ "organization": { "id", "maintenanceWindow": { startTime, endTime,
timezone } } }`.

**Behavior**: stores the window in `organizations.maintenance_window`. Actual enforcement
(downtime/blocking) is owned by later capabilities; this endpoint only configures the window.

**Errors**: `FORBIDDEN` (403), `ORG_SUSPENDED` (403), `VALIDATION_ERROR` (400),
`NOT_FOUND` (404).

---

## Header / convention notes

- `Authorization: Bearer <jwt>` for admin/renter tokens; `Authorization: Bot <secret>` for
  telegram exchange.
- Admin endpoints reject renter tokens and vice versa (`FORBIDDEN`) based on the `type` claim.
- All responses and error messages honor ADR-006 locale resolution.
- Passwords and bot secrets are never returned, logged, or included in error messages.
