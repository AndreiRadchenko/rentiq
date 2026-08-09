# Contract: Events (locations + pricing)

**Date**: 2026-08-09 | **Bus**: in-process `EventBus` v1 (`@nestjs/event-emitter`,
`shared-kernel`) — same contracts work unchanged when swapped for Redis Streams /
RabbitMQ (ADR-001).

Constitution Principle IV: cross-module side effects happen via events, not direct
calls. `notifications` (Phase 6), `audit-log` (Phase 9), `analytics` (Phase 10), and
`rentals` (Phase 5) subscribe to these. In Phase 3, `locations` publishes and the
subscribers are stubs (notifications) or no-ops (audit/analytics) until their phases;
the contracts are fixed now so subscriber wiring is a no-op change later.

Every event is a plain serializable object. Payloads use typed IDs (`uuid` strings in
v1) and `Money` where applicable.

## locations events

### `StationCreated`
Published when an admin creates a station. Subscribers (later phases): `audit-log`.
```json
{ "stationId": "uuid", "orgId": "uuid", "name": "string", "actorId": "uuid" }
```

### `StationVisibilityChanged`
Published when `is_visible_to_clients` or `is_active` toggles, or `working_status`
changes (combined as a "station config changed" event for audit/break-cache purposes).
Subscribers: `audit-log`.
```json
{
  "stationId": "uuid", "orgId": "uuid", "actorId": "uuid",
  "isActive": true, "isVisibleToClients": false, "workingStatus": "WORKING"
}
```

### `StationHealthChanged`
Published only on `health_status` **transition** (ONLINE→OFFLINE or OFFLINE→ONLINE),
never on each check while steady-state. This is the flap-flood mitigation. Subscribers
(later phases): `notifications` (admin alert), `audit-log`. This event is the Phase 3
exit-criteria observable ("Station goes offline → `StationHealthChanged` event is
logged").
```json
{
  "stationId": "uuid", "orgId": "uuid",
  "isOnline": false,
  "previousStatus": "ONLINE", "currentStatus": "OFFLINE",
  "checkedAt": "2026-08-09T12:34:56Z"
}
```

### `LockerOpened`
Published when a locker is opened — by a renter (via `rentals` Phase 5), by an admin
manual open (Phase 3), or by the HA door-events webhook reporting `OPEN` on an expected
(active/pickup-ready) rental. `rentalId` is null for admin manual opens. Subscribers:
`rentals` (advances pickup state), `audit-log`.
```json
{
  "lockerId": "uuid", "stationId": "uuid", "orgId": "uuid",
  "actorType": "RENTER" | "ADMIN" | "SYSTEM",
  "actorId": "uuid | null",
  "rentalId": "uuid | null",
  "openedAt": "2026-08-09T12:34:56Z"
}
```

### `LockerClosed`
Published on explicit close or on a `CLOSED` door-event. Cancels the pending auto-relock
job. Subscribers: `rentals`, `audit-log`.
```json
{
  "lockerId": "uuid", "stationId": "uuid", "orgId": "uuid",
  "actorType": "RENTER" | "ADMIN" | "SYSTEM",
  "actorId": "uuid | null",
  "rentalId": "uuid | null",
  "closedAt": "2026-08-09T12:34:56Z"
}
```

### `UnauthorizedDoorOpenDetected`
Published by the HA door-events webhook handler when `doorState=OPEN` arrives for a
locker with no active/pickup-ready rental. MAINTENANCE mode does **not** suppress this
(FR-017). Subscribers (later phases): `notifications` (immediate admin alert), `audit-
log`. Alert must reach admins within 1 minute (NFR).
```json
{
  "lockerId": "uuid", "stationId": "uuid", "orgId": "uuid",
  "detectedAt": "2026-08-09T12:34:56Z"
}
```

### `UnverifiedLockerFinish`
Published when a rental's finish cannot be verified because the HA controller is
unreachable at finish time (ADR-010). The rental is accepted as finished optimistically;
`LockerReconciliationJob` later corrects any locker left non-AVAILABLE. Subscribers
(later phases): `notifications` (admin awareness), `audit-log`. **Published by
`rentals` (Phase 5)**, but listed here because `locations` owns the reconciliation
subscriber that consumes it.
```json
{ "rentalId": "uuid", "lockerIds": ["uuid"], "orgId": "uuid", "reason": "HA_UNREACHABLE" }
```

## locations event handlers (subscribed, implemented in Phase 3)

- **On `RentalFinished`** (from `rentals`, Phase 5) and **On `RentalCancelled`**: for
  each `lockerId` in the event payload, `LockerRepository.release(lockerId)` sets
  `current_rental_id = null`, `status = 'AVAILABLE'`. This is the canonical locker
  release path (architecture §4.5). In Phase 3 the handler exists and is unit-tested
  with a synthetic event; `rentals` starts publishing in Phase 5.
- **`LockerReconciliationJob`** (startup + `@Cron('0 * * * *')`): scans for COMPLETED/
  CANCELLED rentals whose lockers are still non-AVAILABLE and corrects them. Safety net
  for the case where the in-process `RentalFinished`/`RentalCancelled` handler was
  missed (process crash between publish and handler — ADR-010, ADR-013).

## pricing events

### `TariffChanged`
Published on tariff create / update / soft-delete. Subscribers (later phases):
`audit-log`; any future cache-invalidation subscriber. The event is informational —
in-progress rentals hold their own locked `Money` snapshot and are not affected
(FR-027).
```json
{
  "tariffId": "uuid", "orgId": "uuid", "actorId": "uuid",
  "changeType": "CREATED" | "UPDATED" | "DELETED",
  "kitType": "SUP_BOARD", "dayType": "WEEKDAY", "durationMinutes": 60
}
```

## Event Taxonomy Rules (this phase)

- Events are **published by the module that owns the aggregate** (`locations` owns
  Station/Locker; `pricing` owns Tariff).
- Events are **subscribed by any module**, but subscribers never reach into the
  publisher's tables or domain layer (Principle IV/V).
- Events are **plain serializable objects** (no class methods, no Date objects —
  ISO-8601 strings for timestamps) so they survive a future bus swap to Redis Streams
  unchanged.
- The `EventBus` port is in `shared-kernel`; `locations` and `pricing` depend on the
  port, not on `@nestjs/event-emitter`.
