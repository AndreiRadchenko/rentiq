# Quickstart: Cross-Tenant Support Access (Impersonation)

**Date**: 2026-08-10
**Feature**: 007-cross-tenant-support-access

## Prerequisites

- Stage infrastructure running (PostgreSQL :5433, Redis :6380) — see
  `specs/004-shared-kernel-foundation/quickstart.md`.
- A seeded SUPER_ADMIN account and at least one ACTIVE organization.
- A second, non-SUPER_ADMIN account (ORG_ADMIN / STATION_OPERATOR / renter) for gate tests.

## Setup

```bash
cd apps/api
pnpm install
```

## Build

```bash
cd apps/api
npx tsc --noEmit
npm run lint
```

## Run

```bash
cd apps/api
set -a && source ../../.env.stage && set +a && npm run start:dev
```

API listens on port 3002 (per `API_PORT` in `.env.stage`).

## Validation Scenarios

### V1: SUPER_ADMIN impersonation works

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rentiq.dev","password":"rentiq-admin-dev"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s -w "\nHTTP %{http_code}\n" http://localhost:3002/api/v1/stations \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: 40948aba-43bc-4f71-8571-71eae1206566"
```

Expected: `200` and only the target org's stations.

### V2: Non-SUPER_ADMIN rejected

```bash
TOKEN2=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@second-org.dev","password":"rentiq-admin-dev"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s -w "\nHTTP %{http_code}\n" http://localhost:3002/api/v1/stations \
  -H "Authorization: Bearer $TOKEN2" \
  -H "x-org-id: 40948aba-43bc-4f71-8571-71eae1206566"
```

Expected: `403` with `"code":"IMPERSONATION_FORBIDDEN"`.

### V3: Unknown org rejected

```bash
curl -s -w "\nHTTP %{http_code}\n" http://localhost:3002/api/v1/stations \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: 00000000-0000-0000-0000-000000000000"
```

Expected: `404` with `"code":"ORG_NOT_FOUND"`.

### V4: Suspended org rejected

Temporarily suspend the target org, then re-run V1's request:

```bash
psql "$DATABASE_URL" -c "UPDATE organizations SET status='SUSPENDED' WHERE slug='second-org';"
```

Expected: `403` with `"code":"ORG_SUSPENDED"`. Restore `ACTIVE` afterwards.

### V5: No header — behavior unchanged

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/v1/stations \
  -H "Authorization: Bearer $TOKEN2"
```

Expected: `200` (ORG_ADMIN in its own org, no header).

## Run Tests

```bash
cd apps/api
npx jest --passWithNoTests
```

## Exit Criteria (roadmap Phase 11)

1. Non-SUPER_ADMIN with `x-org-id` → 403 `IMPERSONATION_FORBIDDEN` → **V2**
2. Unknown org → 404 `ORG_NOT_FOUND` → **V3**
3. Suspended org → 403 `ORG_SUSPENDED` → **V4**
4. SUPER_ADMIN with `x-org-id` → 200, tenant-scoped → **V1**
