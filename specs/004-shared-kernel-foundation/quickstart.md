# Quickstart: Shared Kernel + Foundation

**Date**: 2026-07-31
**Feature**: 004-shared-kernel-foundation

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+ (stage: port 5433)
- Redis 7+ (stage: port 6380)
- MinIO (stage: ports 9002/9003)

Stage infrastructure runs host-native (not Docker). See `.env.stage` for connection details.

## Setup

```bash
# Install dependencies
pnpm install

# Verify stage infrastructure is running
pg_isready -h localhost -p 5433
redis-cli -p 6380 ping
```

## Build

```bash
cd apps/api

# Typecheck
npx tsc --noEmit

# Build (compiles TypeScript to dist/)
npx nest build

# Lint
npm run lint
```

Build does NOT read `.env` files — it's pure TypeScript compilation.

## Run

### Development (with hot-reload)

```bash
cd apps/api
set -a && source ../../.env.stage && set +a && npm run start:dev
```

> **Note**: `set -a` auto-exports all variables. `set +a` turns it off after sourcing. This is needed because `.env.stage` doesn't have `export` prefixes.

### Production (compiled output)

```bash
cd apps/api
npx nest build
set -a && source ../../.env.stage && set +a && node dist/main.js
```

### Manual env vars (alternative)

If `source` doesn't work (e.g. Cyrillic characters in `.env.stage`), pass vars inline:

```bash
cd apps/api
npx nest build

DATABASE_URL="postgres://rentiq:09GSljIosh2cJKweV5TyRiMaVV74xkvL4ELLgauHBVc=@localhost:5433/rentiq-stage" \
REDIS_URL="redis://localhost:6380" \
MINIO_ENDPOINT="localhost:9002" \
MINIO_ACCESS_KEY="rentiq" \
MINIO_SECRET_KEY="i4kvpGWZWMhg8yf6iM02t6x7gpHZM3n1J1dtn6hp+3Q=" \
MINIO_BUCKET="rentiq-stage" \
TELEGRAM_BOT_TOKEN="8914629674:AAHSkIzZPz3kJTkScEO2zSWm_AHv1ixYdV0" \
node dist/main.js
```

## Validation Scenarios

### V1: Health endpoint returns 200

```bash
curl -s http://localhost:3000/api/v1/health | jq .
```

Expected:
```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok"
}
```

### V2: Config validation rejects missing DATABASE_URL

```bash
DATABASE_URL="" node dist/main.js
```

Expected: exit code 1, error message mentions `DATABASE_URL` and `required`.

### V3: Config validation rejects invalid DATABASE_URL

```bash
DATABASE_URL="not-a-url" node dist/main.js
```

Expected: exit code 1, error message mentions `DATABASE_URL` and `invalid`.

### V4: Health returns 503 when database is down

Stop PostgreSQL or point DATABASE_URL to unreachable host, then:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health
```

Expected: HTTP 503.

## Run Tests

```bash
cd apps/api

# All unit + integration + e2e tests
npx jest --passWithNoTests

# Unit tests only (no infra needed)
npx jest --testPathPattern="tests/unit" --passWithNoTests

# Integration tests (requires PostgreSQL + Redis running)
npx jest --testPathPattern="tests/integration" --passWithNoTests
```

## Exit Criteria (Phase 1 — roadmap)

1. `GET /api/v1/health` returns 200 → **V1**
2. Zod validation rejects broken `.env` → **V2, V3**
