# Quickstart: Locations + Pricing (Phase 3 Validation)

**Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This is a runnable validation guide — not a test suite, not implementation code. It
proves the Phase 3 deliverables and exit criteria work end-to-end. Implementation
details belong in `tasks.md` (Phase 2 output). For contracts and data model, see
[contracts/](./contracts) and [data-model.md](./data-model.md).

## Prerequisites

- Node.js 20 LTS, pnpm, Docker (for Postgres + Redis via `docker compose up`).
- Phases 0–2 complete: `apps/api` runs, `GET /api/v1/health` returns 200, an
  `ORG_ADMIN` exists and can log in via `POST /api/v1/auth/login` to receive a JWT.
- Postgres migrated to include the `locations` + `pricing` tables (drizzle-kit
  generated; see `data-model.md`).
- Redis running (BullMQ dependency for auto-relock).
- **No Home Assistant required** for local dev / CI: the `MockSmartLockGateway` is the
  default adapter when `HA_BASE_URL` / `HA_TOKEN_REF` env vars are absent. To exercise
  the real HA path, run the *Stage* scenarios below on the stage host where HA is
  available.

## Environment

Yes on both counts. Verified against apps/api/src/shared-kernel/infrastructure/config/env.ts:26 — .env.stage has every required var (DATABASE_URL, REDIS_URL, MINIO_*, TELEGRAM_BOT_TOKEN, JWT_*, ADMIN_*, RENTIQ_DEV_TELEGRAM_SECRET, MASTER_KEY) and Postgres/Redis are up on ports 5433/6380.
But you need db:migrate first: the stage DB has only 3 tables (admin_accounts, organizations, renters) and no drizzle_migrations tracking table, so migration 0001_handy_nightcrawler.sql (stations, lockers, inventory_kits, tariffs) has not been applied. Run it once before starting:

```bash
cd apps/api
set -a && source ../../.env.stage && set +a
pnpm db:migrate
```

pnpm seed is optional — seed data already exists (2 orgs, 2 admins) and seed.ts skips existing orgs, so it's idempotent/harmless.
Note: the DATABASE_URL=... pnpm ... prefix in your quickstart snippet is redundant — DATABASE_URL is already in .env.stage.

1. Bring the DB schema up to date
# From repo root — point at your running stage Postgres
cd apps/api
DATABASE_URL=postgres://rentiq:<password>@localhost:5432/rentiq pnpm db:migrate
DATABASE_URL=postgres://rentiq:<password>@localhost:5432/rentiq pnpm seed

The migrate step applies 0001_youthful_post.sql (the new stations/lockers/inventory_kits/tariffs tables). The seed step creates the rentiq-dev org + a SUPER_ADMIN if not already present.

2. Generate a JWT keypair (if you don't have one)
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

Put the PEM contents (multi-line, quoted) into your .env as JWT_PRIVATE_KEY and JWT_PUBLIC_KEY. The .env.example shows the format.

```bash
cd apps/api
set -a && source ../../.env.stage && set +a && npm run start:dev
```

```bash
cp .env.example .env   # ensure DATABASE_URL, REDIS_URL, JWT public key are set
pnpm db:up             # docker compose up postgres + redis
pnpm migrate           # drizzle-kit push (or generate + migrate)
pnpm dev               # apps/api dev mode — MockSmartLockGateway auto-registered
```

## Scenario 1 — Admin creates a station, assigns lockers, configures tariffs

Maps to **Phase 3 exit criterion**: "Admin panel (or Postman) can create a station,
assign lockers, configure tariffs." See [locations-api.md](./contracts/locations-api.md)
and [pricing-api.md](./contracts/pricing-api.md) for full request/response shapes.

1. `POST /api/v1/auth/login` with the `ORG_ADMIN` email/password → save `JWT`.
2. `POST /api/v1/stations` with `{ name, address, haUrlOrIp, haToken, haWebhookSecret,
   autoLockDelaySec: 30 }` → 201. The `haToken` and `haWebhookSecret` are encrypted
   (AES-256-GCM) on the server; the response masks them (`****xxxx`). Verify defaults:
   `isActive=true`, `isVisibleToClients=false`, `workingStatus=WORKING`,
   `healthStatus=UNKNOWN`.
3. `POST /api/v1/lockers` ×2 under that station → 201 each.
4. `POST /api/v1/inventory-kits` ×2 (`{ stationId, name, kitType: "SUP_BOARD" }`).
5. `PATCH /api/v1/lockers/:lockerId` `{ inventoryKitId: <kitId> }` to assign each kit.
6. `POST /api/v1/tariffs` for `WEEKDAY` durations 60 / 120 / 180 minutes (e.g.
   `priceMinor: 10000`, `18000`, `24000`; `currency: "UAH"`).
7. `PATCH /api/v1/stations/:id` `{ isVisibleToClients: true }`.

**Expected**: all calls return 2xx; the audit log (once Phase 9 wires the subscriber)
records `StationCreated`, `TariffCreated`, etc. In Phase 3, the `@AuditableAction`
decorator emits a no-op log line.

## Scenario 2 — Renter sees only bookable lockers with correct prices

Maps to **User Story 1** and acceptance criteria #1, #11, #14. Uses the station from
Scenario 1.

1. Acquire a renter JWT (Phase 2 flow, or a test-only renter login).
2. `GET /api/v1/stations?visible=true&active=true` → 200. Expect exactly the one
   station from Scenario 1, `displayStatus: "AVAILABLE"`, `availableLockersCount: 2`.
3. `GET /api/v1/stations/:id/lockers` → 200. Expect 2 lockers, each with `kitType:
   "SUP_BOARD"` and the three `WEEKDAY` tariffs with the exact `priceMinor` values
   configured.

**Negative sub-checks** (each toggles one bookability condition and re-queries):
- Set `isVisibleToClients=false` → station disappears from the renter list.
- Set `workingStatus=MAINTENANCE` → station disappears.
- Set `isActive=false`, `isVisibleToClients=true` → station appears with
  `displayStatus: "TEMPORARILY_UNAVAILABLE"` (FR-006); lockers not selectable.
- Unassign one locker's kit (`PATCH /lockers/:id { inventoryKitId: null }`) → that
  locker disappears from renter view (FR-001d), admin sees a misconfiguration warning
  (FR-002).
- Soft-delete all `WEEKDAY` tariffs for `SUP_BOARD` → both lockers disappear (FR-001e).

## Scenario 3 — Tariff uniqueness, price lock-in, day-type by booking date

Maps to acceptance criteria #12, #13, #14. See [data-model.md](./data-model.md)
"Uniqueness".

1. `POST /api/v1/tariffs` with the same `(kitType, dayType, durationMinutes)` as an
   existing one → 422 `DUPLICATE_TARIFF` with `existingTariffId` in the body.
2. (Lock-in) This requires a rental snapshot, which is Phase 5. In Phase 3 validate the
   *mechanism* with a unit test: `TariffService.lockPrice(tariffId)` returns a `Money`
   snapshot; mutating the tariff afterwards and re-reading the snapshot shows the
   original price. (Run: `pnpm test -- pricing/tariff-lock-in.spec.ts`.)
3. (Day type) Unit test `DayTypeResolver.resolve(new Date('2026-08-07T23:55:00+03:00'),
   'Europe/Kyiv')` → `WEEKDAY` even though local time crosses into Saturday (FR-003).
   (Run: `pnpm test -- pricing/day-type-resolver.spec.ts`.)

## Scenario 4 — Admin manual open + auto-relock (mock adapter)

Maps to **User Story 4** and acceptance #6, #7. Uses the `MockSmartLockGateway`.

1. `POST /api/v1/lockers/:lockerId/open` (admin JWT) → 200. `LockerOpened` published
   (actorType=`ADMIN`). A BullMQ delayed job is scheduled at `now + 30s` (the station's
   `autoLockDelaySec`).
2. Do **not** send a close. Wait ~35 s. The worker fires `SmartLockGateway.lock()` on
   the mock adapter; `LockerClosed` published (actorType=`SYSTEM`). Assertion: locker
   re-locked within `autoLockDelaySec + 5s` (35 s — Clarification 2026-08-09).
3. **Idempotent close** sub-check: open again; immediately `POST /lockers/:id/close`;
   then wait for the auto-relock timer to fire. Expect no double-lock error (FR-015);
   the worker's `lock()` is a no-op on the already-locked mock.

**Stage-only variant** (real HA): run the same scenario against the
`HomeAssistantGateway` by setting `HA_BASE_URL` + `HA_TOKEN_REF` on stage; observe the
physical locker open and re-lock. This satisfies the exit criterion "`POST
/api/v1/lockers/:id/open` physically opens a real test locker on stage".

## Scenario 5 — Health check: station goes offline → event logged

Maps to **User Story 3**, acceptance #4/#5, and the exit criterion "Station goes
offline → `StationHealthChanged` event is logged." See [events.md](./contracts/events.md).

1. Configure the mock adapter: `mock.setReachable(stationId, false)` (or, on stage,
   disconnect HA from the network).
2. Wait for the `StationHealthChecker` `@Cron('*/30 * * * * *')` to run **twice**
   (2-strike debounce — Clarification 2026-08-09). Within ~3 minutes worst case,
   `healthStatus` transitions `ONLINE → OFFLINE` and `StationHealthChanged(isOnline:
   false)` is published. Verify via `GET /api/v1/stations/:id/health` → `healthStatus:
   OFFLINE` and via the event being captured by a test subscriber (or the
   `audit-log`-stub log line in Phase 3).
3. Restore reachability (`mock.setReachable(stationId, true)` or reconnect HA). Within
   one check cycle, `healthStatus` transitions `OFFLINE → ONLINE` and
   `StationHealthChanged(isOnline: true)` is published. Verify `isActiveForBookability:
   true` again.
4. **Manual override respected** sub-check: admin sets `isActive=false`, then the
   controller goes offline and comes back. On recovery the station is **not**
   auto-reactivated (FR-010); `isActive` stays `false`. Verify via
   `GET /stations/:id/health`.

## Scenario 6 — Unauthorized door open → admin alert event

Maps to **User Story 5**, acceptance #8/#9. See [events.md](./contracts/events.md).

1. Ensure the locker has **no** active/pickup-ready rental (status `AVAILABLE`).
2. Inject a door event: `POST /api/v1/webhooks/ha/door-events` with `{
   lockerId, doorState: "OPEN", eventTimestamp: now }` and the correct shared-secret
   header. Expect 200.
3. Verify `UnauthorizedDoorOpenDetected(lockerId, stationId)` was published (test
   subscriber or audit stub log line). This event is what `notifications` (Phase 6) will
   turn into an admin alert within 1 minute (NFR).
4. **No false positive** sub-check: with a pickup-ready rental on the locker (Phase 5
   sets `current_rental_id`), replay the same door event. Expect `LockerOpened`
   published, **not** `UnauthorizedDoorOpenDetected` (FR-018).
5. **MAINTENANCE does not suppress** sub-check: set `workingStatus=MAINTENANCE`,
   replay the unauthorized door event on an `AVAILABLE` locker. Expect
   `UnauthorizedDoorOpenDetected` still published (FR-017, acceptance #5.3).

## Scenario 7 — Cross-tenant isolation

Maps to Constitution Principle VI and the NFR "Multi-tenant isolation".

1. Create a second org + `ORG_ADMIN` (Phase 2 capability).
2. As org A's admin, `GET /api/v1/stations` → only org A's stations. As org B's admin,
   same endpoint → only org B's stations. Cross-IDs must never appear.
3. `pnpm test -- integration/cross-tenant.spec.ts` — the dedicated cross-tenant test
   suite asserts no org-A data leaks into org-B queries across stations, lockers,
   inventory kits, and tariffs.

## Test Commands Summary

```bash
pnpm test -- unit/locations/bookability-rule.spec.ts
pnpm test -- unit/locations/locker-access.service.spec.ts
pnpm test -- unit/locations/station-health-checker.spec.ts
pnpm test -- unit/pricing/overtime-calculator.spec.ts
pnpm test -- unit/pricing/tariff-uniqueness.spec.ts
pnpm test -- integration/locations
pnpm test -- integration/pricing
pnpm test -- contract/locations/smart-lock-gateway.contract.spec.ts
pnpm test -- integration/cross-tenant.spec.ts
pnpm lint       # includes Nx enforce-module-boundaries
pnpm typecheck
```

All green == Phase 3 design validated locally. The *stage* run additionally executes
Scenario 4's real-HA variant and Scenario 5's real-disconnect variant to satisfy the
exit criteria that require physical hardware.
