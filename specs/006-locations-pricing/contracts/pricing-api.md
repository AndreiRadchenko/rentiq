# Contract: Pricing REST API

**Date**: 2026-08-09 | **Module**: `pricing` | **Base**: `/api/v1`

Same conventions as the locations API (REST, `/api/v1/`, JWT RS256, `orgId` from JWT,
`ApiError` envelope, server-side i18n, `Idempotency-Key` on mutating POSTs). All admin
endpoints require `ORG_ADMIN` role.

## Tariffs

### `GET /api/v1/tariffs`
List tariffs for the caller's org, optionally filtered. **Auth**: `ORG_ADMIN`.

**Query**: `?kitType=SUP_BOARD&dayType=WEEKDAY` (both optional; omit to list all).

**200 Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "kitType": "SUP_BOARD",
      "dayType": "WEEKDAY",
      "durationMinutes": 60,
      "priceMinor": 10000,
      "currency": "UAH",
      "deletedAt": null
    }
  ]
}
```

### `POST /api/v1/tariffs`
Create a tariff (adds a duration option). **Auth**: `ORG_ADMIN`. `Idempotency-Key`
required. **Audit**: `@AuditableAction("TariffCreated")`.

**Request**:
```json
{
  "kitType": "SUP_BOARD",
  "dayType": "WEEKDAY",
  "durationMinutes": 60,
  "priceMinor": 10000,
  "currency": "UAH"
}
```
**Behavior**: `TariffService.create()` attempts the insert; the partial unique index
`UNIQUE (org_id, kit_type, day_type, duration_minutes) WHERE deleted_at IS NULL`
enforces uniqueness (FR-026). A constraint violation is mapped to
`DuplicateTariffError` and returned as `Err(...)`.

**201 Response**: the created tariff.

**422 Errors**:
- `DUPLICATE_TARIFF` — a non-deleted tariff with the same
  `(kitType, dayType, durationMinutes)` already exists; response includes the
  conflicting `existingTariffId` (Error Scenarios).
- `TARIFF_DURATION_INVALID` — `durationMinutes <= 0`.
- `TARIFF_PRICE_INVALID` — `priceMinor < 0`.
- `TARIFF_DAY_TYPE_INVALID` — `dayType` not `WEEKDAY` or `WEEKEND` (FR-023).

### `PATCH /api/v1/tariffs/:id`
Update `priceMinor` / `currency`. The key fields (`kitType`, `dayType`,
`durationMinutes`) are **immutable** after creation — to change a duration, soft-delete
this tariff and create a new one (FR-025). **Auth**: `ORG_ADMIN`. **Audit**:
`@AuditableAction("TariffUpdated")`.

**Request**: `{ priceMinor?, currency? }`.

**Invariants**: Changing a tariff does not retroactively affect in-progress or
completed rentals (FR-027) — those hold their own locked-in `Money` snapshot.

### `DELETE /api/v1/tariffs/:id`
Soft delete. **Auth**: `ORG_ADMIN`. **Audit**: `@AuditableAction("TariffDeleted")`.
Sets `deleted_at = now()`. The duration option is no longer offered to renters;
in-progress and completed rentals retain their locked price (FR-027). The partial
unique index now permits a new tariff with the same key to be created.

**Response**: `204 No Content`.

## Quote (used internally + by `rentals` in Phase 5)

### `GET /api/v1/tariffs/quote`
Quote a price for a (kitType, dayType, durationMinutes). **Auth**: renter or admin JWT.

**Query**: `?kitType=SUP_BOARD&dayType=WEEKDAY&durationMinutes=60`.

**200 Response**:
```json
{
  "priceMinor": 10000,
  "currency": "UAH",
  "tariffId": "uuid"
}
```
**404 Errors**:
- `TARIFF_NOT_FOUND` — no non-deleted tariff for the given key in this org.

`dayType` is normally resolved server-side from the booking creation date (BR-04.2) by
`rentals`; this endpoint accepts it explicitly so it can be exercised standalone in
Phase 3. The `rentals` module (Phase 5) will call `PricingService.quote()` directly
(synchronous application-service call, Principle IV exception), not this HTTP
endpoint.

## Day Type Resolution (internal, not an endpoint)

`DayTypeResolver.resolve(date, orgTimezone): 'WEEKDAY' | 'WEEKEND'` — WEEKEND = Saturday
or Sunday in the org's configured timezone (default `Europe/Kyiv`). Frozen at booking
creation date (FR-003). Unit-tested for the Friday-23:55→Saturday-return edge case
(Assumptions / spec Edge Cases).

## Events

`pricing` publishes `TariffChanged` (created/updated/deleted) for audit + any future
cache-invalidation subscriber. Payload: `{ tariffId, orgId, changeType, kitType,
dayType, durationMinutes }`. See [events.md](./events.md).
