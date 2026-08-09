# Quickstart: IAM + Organizations

**Date**: 2026-07-31
**Feature**: 005-iam-organizations

## Prerequisites

- Everything from `specs/004-shared-kernel-foundation/quickstart.md` (Node 20+, pnpm 9+,
  PostgreSQL 16+ on stage port 5433, Redis 7+ on 6380).
- **New env vars** for this phase (never committed — Principle X):

| Variable | Purpose |
|----------|---------|
| `JWT_PRIVATE_KEY` | RS256 private key (PEM) — signs tokens |
| `JWT_PUBLIC_KEY` | RS256 public key (PEM) — verifies tokens |
| `JWT_ACCESS_TTL_SECONDS` | default `900` (15 min) |
| `JWT_REFRESH_TTL_SECONDS` | default `604800` (7 days) |
| `ADMIN_EMAIL` | bootstrap SUPER_ADMIN email (seed) |
| `ADMIN_PASSWORD` | bootstrap SUPER_ADMIN password (seed) |
| `RENTIQ_DEV_TELEGRAM_SECRET` | bot secret for the `rentiq-dev` org (seed) |

Generate an ephemeral keypair for local dev:

```bash
openssl genrsa -out /tmp/jwt-private.pem 2048
openssl rsa -in /tmp/jwt-private.pem -pubout -out /tmp/jwt-public.pem
```

## Setup

```bash
pnpm install
pg_isready -h localhost -p 5433
redis-cli -p 6380 ping
```

## Build & Run

```bash
cd apps/api
npx tsc --noEmit
npm run lint
set -a && source ../../.env.stage && set +a && \
  JWT_PRIVATE_KEY="$(cat /tmp/jwt-private.pem)" \
  JWT_PUBLIC_KEY="$(cat /tmp/jwt-public.pem)" \
  ADMIN_EMAIL="super@rentiq.dev" ADMIN_PASSWORD="change-me" \
  RENTIQ_DEV_TELEGRAM_SECRET="dev-bot-secret" \
  npm run start:dev
```

```bash
cd apps/api
set -a && source ../../.env.stage && set +a && npm run start:dev
```

## Seed

Idempotent — safe to re-run:

```bash
cd apps/api
# after the app is running (or as a separate npm script: pnpm seed)
node dist/seed.js
```

Creates:
- `SUPER_ADMIN` (`ADMIN_EMAIL` / bcrypt hash of `ADMIN_PASSWORD`),
- Organization **"rentiq-dev"** (slug `rentiq`), branding `{businessName: "rentiq-dev",
  supportedLocales: ["uk","en"], defaultLocale: "uk"}`, telegram config with hashed
  `RENTIQ_DEV_TELEGRAM_SECRET`.

## Validation Scenarios (Phase 2 exit criteria)

All requests against `http://localhost:3000/api/v1` — verify with Postman or curl.

### V1 — Admin logs in and receives a JWT

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"super@rentiq.dev","password":"change-me"}' | jq .
```

Expected: `200`, `accessToken` (decodes to RS256, `type: admin`, `role: SUPER_ADMIN`,
15-min expiry) + `refreshToken` (7-day). Store `accessToken` for V2/V3.

### V2 — Admin uses the JWT to create a second organization

```bash
curl -s -X POST http://localhost:3000/api/v1/organizations \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS" \
  -d '{"name":"Second Org","slug":"second-org","adminEmail":"admin@second-org.dev",
       "adminPassword":"org-pass-123","telegramBotSecret":"second-org-secret"}' | jq .
```

Expected: `201`, `organization` (slug `second-org`) + `bootstrapAdmin` (role `ORG_ADMIN`).
Also asserts: `SLUG_TAKEN` (`409`) when re-posting the same slug; `FORBIDDEN` (`403`) when
the token is not SUPER_ADMIN.

### V3 — Renter registers and receives a renter JWT via telegram exchange

Register (invoked by the bot after consent):

```bash
curl -s -X POST http://localhost:3000/api/v1/renters/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Олег","phone":"+380501234567","consentGiven":true,
       "consentVersion":"v1","locale":"uk","telegramId":123456789}' | jq .
```

Expected: `200`, renter object (`status: ACTIVE`, `consentGivenAt` set) + renter
`accessToken`.

Exchange (from the bot):

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/telegram/exchange \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bot $RENTIQ_DEV_TELEGRAM_SECRET" \
  -d '{"telegramId":123456789}' | jq .
```

Expected: `200`, renter `accessToken` (`type: renter`). Then:

```bash
curl -s http://localhost:3000/api/v1/renters/me \
  -H "Authorization: Bearer $RENTER_TOKEN" | jq .
```

Expected: `200`, the renter profile.

### V4 — Locale resolution: JWT claim wins (ADR-006)

Register a renter with `locale: "en"` and `Accept-Language: uk`, then hit `GET /renters/me`
with an invalid-scope error (or any localized message):

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/renters/me
```

Expected: `401` with message in **English** (the renter JWT's `locale` claim overrides
`Accept-Language`). Then repeat V1 without `Accept-Language` on a `uk` account — message in
**Ukrainian**.

### V5 — Refresh rotation

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq .
```

Expected: `200`, new pair. Re-using the same `$REFRESH` again → `401 INVALID_REFRESH_TOKEN`.

### V6 — Preconditions and business rules

- `consentGiven: false` → `400 CONSENT_REQUIRED`.
- Register same phone again in `rentiq-dev` → `200` with `alreadyRegistered: true` and the
  same `renter.id` (FR-028/SC-009, no duplicate row).
- Exchange with a wrong bot secret → `401 BOT_SECRET_INVALID`.
- Exchange for an unknown telegramId → `403 RENTER_NOT_REGISTERED`.
- Login with wrong password → `401 INVALID_CREDENTIALS` (same message as unknown email,
  NFR-009).

## Run Tests

```bash
cd apps/api

# Unit (auth/renters/admin-account/organization services + guards)
npx jest --testPathPattern="(auth|renters|admin-account|organization)" --passWithNoTests

# Integration (requires PostgreSQL + Redis)
npx jest --config ./test/jest-e2e.json --passWithNoTests
```

## Exit Criteria (Phase 2 — roadmap)

1. Admin logs in via Postman and receives a JWT → **V1**
2. JWT creates a second organization → **V2**
3. Renter registers and receives a renter JWT via the exchange endpoint → **V3**
4. Locale resolution middleware wired (JWT claim → org default → uk) → **V4**
5. `invalid_credentials` translated in uk + en → **V4** (message assertion)
