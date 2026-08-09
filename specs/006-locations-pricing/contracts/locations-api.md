# Contract: Locations REST API

**Date**: 2026-08-09 | **Module**: `locations` | **Base**: `/api/v1`

Convention: REST, versioned (`/api/v1/`). `orgId` from JWT claims, never request body.
All admin endpoints require JWT (RS256) with role `SUPER_ADMIN`, `ORG_ADMIN`, or
`STATION_OPERATOR` (Constitution Principle X). Renter-facing endpoints require a renter
JWT. `Idempotency-Key` header required on POST endpoints that mutate state. All error
responses use the shared `ApiError` envelope (`{ correlationId, code, message }`).
User-facing messages are localized server-side per `Accept-Language` (`uk` default,
`en` secondary) — Constitution Principle IX.

## Stations

### `GET /api/v1/stations`
List stations. **Admin**: returns all stations in the caller's org (including inactive
/ hidden / MAINTENANCE). **Renter variant** `?visible=true&active=true`: returns only
bookable stations — `is_visible_to_clients=true`, `is_active=true`,
`working_status='WORKING'`, `deleted_at IS NULL` — each with an `availableLockersCount`
derived from `idx_lockers_available`.

**Auth**: admin JWT (no query flags) OR renter JWT (with `?visible=true&active=true`).

**200 Response** (renter variant):
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Station name",
      "address": "...",
      "availableLockersCount": 3,
      "sortOrder": 0,
      "displayStatus": "AVAILABLE" | "TEMPORARILY_UNAVAILABLE"
    }
  ]
}
```
`displayStatus = TEMPORARILY_UNAVAILABLE` when `is_visible_to_clients=true` and
`is_active=false` (FR-006 — station is shown by name with a "temporarily unavailable"
label; lockers not selectable). When `active=true` the station is fully bookable and
each offered locker's tariffs are returned via `/lockers` below.

### `POST /api/v1/stations`
Create a station. **Auth**: `ORG_ADMIN`. `Idempotency-Key` required. **Audit**:
`@AuditableAction("StationCreated")`.

**Request**:
```json
{
  "name": "Poshtova Ploshcha",
  "address": "Kyiv, Poshtova Sq.",
  "haUrlOrIp": "http://10.0.0.42:8123",
  "haTokenRef": "stations/poshtova/token",
  "autoLockDelaySec": 30,
  "sortOrder": 0
}
```
**Defaults applied server-side**: `isActive=true`, `isVisibleToClients=false`,
`workingStatus='WORKING'`, `healthStatus='UNKNOWN'`.

**201 Response**: the created station (full admin view, includes `healthStatus`,
`lastHealthCheckAt`).

**422 Errors**:
- `STATION_AUTOLOCK_INVALID` — `autoLockDelaySec <= 0`.
- `STATION_TOKEN_REF_EMPTY` — `haTokenRef` missing.
- `STATION_HA_URL_INVALID` — `haUrlOrIp` not a valid URL/IP.

### `GET /api/v1/stations/:id`
Fetch one station (admin view). **Auth**: admin JWT.

### `PATCH /api/v1/stations/:id`
Update mutable fields: `name`, `address`, `isActive`, `isVisibleToClients`,
`workingStatus`, `autoLockDelaySec`, `haUrlOrIp`, `haTokenRef`, `sortOrder`.
**Auth**: `ORG_ADMIN`. **Audit**: `@AuditableAction("StationUpdated")`. Independent
`isActive` / `isVisibleToClients` toggles (FR-004). Setting `workingStatus=
MAINTENANCE` removes lockers from bookability without touching active/visible (FR-033).

**422 Errors**: same creation validation plus `STATION_NOT_FOUND`.

### `GET /api/v1/stations/:id/health`
Return `healthStatus`, `lastHealthCheckAt`, and the admin-intended `isActive` vs the
*effective* `isActiveForBookability` (which is false if `healthStatus=OFFLINE`).
**Auth**: admin JWT.

### `GET /api/v1/stations/:id/lockers`
List lockers for a station (admin: all incl. non-AVAILABLE; renter: only those passing
the `BookabilityRule`). **Auth**: admin or renter JWT.

**200 Response** (renter variant — only bookable lockers):
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Locker 1",
      "kitType": "SUP_BOARD",
      "tariffs": [
        { "durationMinutes": 60,  "priceMinor": 10000, "currency": "UAH" },
        { "durationMinutes": 120, "priceMinor": 18000, "currency": "UAH" }
      ]
    }
  ]
}
```
Tariffs are resolved for the locker's kit type + the current day type (per
`DayTypeResolver`, BR-04.2). If a bookable locker has zero tariffs at quote time, it is
omitted (spec Error Scenarios — defensive double-check).

## Lockers

### `POST /api/v1/lockers`
Create a locker under a station. **Auth**: `ORG_ADMIN`. **Audit**.
**Request**: `{ stationId, name, haLockEntityId, haDoorSensorEntityId }`.

### `PATCH /api/v1/lockers/:id`
Assign/unassign an inventory kit, toggle maintenance. **Auth**: `ORG_ADMIN`. **Audit**.
**Request**: `{ name?, inventoryKitId? (nullable to unassign), status? (only
AVAILABLE ⇄ MAINTENANCE allowed via admin) }`.

### `POST /api/v1/lockers/:id/open`
Admin manual open. **Auth**: `ORG_ADMIN` or `STATION_OPERATOR` (scoped to assigned
stations). **Audit**: `@AuditableAction("LockerManuallyOpened")`. Resolves the station's
`HaConnectionConfig`, calls `SmartLockGateway.unlock(lockerId)`, publishes `LockerOpened`
(actorType=`ADMIN`). Schedules auto-relock via BullMQ at `now + autoLockDelaySec`.

**Errors**:
- `LOCKER_STATION_OFFLINE` (503) — `healthStatus=OFFLINE` or gateway `isReachable()=
  false`.
- `LOCKER_OPEN_FAILED` (502) — gateway `unlock()` threw; admin alerted; rental (if
  any) not advanced.

### `POST /api/v1/lockers/:id/close`
Admin manual close. **Auth**: as above. **Audit**. Calls `SmartLockGateway.lock()` (
idempotent — FR-015), publishes `LockerClosed`, cancels the pending BullMQ auto-relock
job for this locker.

## Inventory Kits

### `POST /api/v1/inventory-kits`
Create a kit. **Auth**: `ORG_ADMIN`. **Audit**. **Request**: `{ stationId, name,
kitType }` (kit created unassigned; assign via `PATCH /lockers/:id`).

### `PATCH /api/v1/inventory-kits/:id`
Reassign to a different locker or unassign. **Auth**: `ORG_ADMIN`. **Audit**.
**Request**: `{ name?, kitType?, lockerId? (nullable) }`. Historical rentals unaffected
(FR-030).

### `DELETE /api/v1/inventory-kits/:id`
Soft-retire: set `locker_id = null` (the kit row is retained for audit). **Auth**:
`ORG_ADMIN`. **Audit**.

## HA Door-Events Webhook

### `POST /api/v1/webhooks/ha/door-events`
**Auth**: shared-secret header (`X-HA-Webhook-Secret`) validated against the org's
configured value (per-station in v1). **Not** JWT-authenticated — HA is an external
system. **Idempotent** on `(lockerId, eventTimestamp)`.

**Request** (from HA webhook):
```json
{
  "lockerId": "uuid",
  "doorState": "OPEN" | "CLOSED" | "UNKNOWN",
  "eventTimestamp": "2026-08-09T12:34:56Z"
}
```
**Behavior**:
- `doorState=OPEN` + no active/pickup-ready rental → publish
  `UnauthorizedDoorOpenDetected(lockerId, stationId)` (FR-016/017). MAINTENANCE mode
  does not suppress (FR-017).
- `doorState=OPEN` + active/pickup-ready rental → publish `LockerOpened` (FR-018).
- `doorState=CLOSED` → publish `LockerClosed`; cancel pending auto-relock job.
- `doorState=UNKNOWN` → no unauthorized alert, logged for admin awareness (Error
  Scenarios).

**200 Response**: `{ "acknowledged": true }`. Errors: `LOCKER_NOT_FOUND` (404),
`WEBHOOK_SECRET_INVALID` (401).

## Authorization Matrix

| Endpoint | SUPER_ADMIN | ORG_ADMIN | STATION_OPERATOR | Renter |
|---|---|---|---|---|
| `GET /stations` (admin) | ✓ | ✓ | ✓ (own stations) | — |
| `GET /stations?visible=true&active=true` | — | — | — | ✓ |
| `POST /stations` | ✓ | ✓ | — | — |
| `PATCH /stations/:id` | ✓ | ✓ | — | — |
| `POST /lockers/:id/open` (admin) | ✓ | ✓ | ✓ (assigned) | — |
| `POST /lockers/:id/open` (rental) | — | — | — | via `/rentals/:id/open-locker` (Phase 5) |
| `POST /webhooks/ha/door-events` | shared secret | shared secret | shared secret | shared secret |
