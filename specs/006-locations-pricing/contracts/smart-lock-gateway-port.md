# Contract: SmartLockGateway Port

**Date**: 2026-08-09 | **Module**: `locations` (domain layer owns the port; infrastructure
layer provides the adapters).

This is the hexagonal port (Constitution Principle II) through which `locations` domain
and application code interact with the physical smart-lock controller. Two adapters
implement it: `HomeAssistantGateway` (stage/prod) and `MockSmartLockGateway` (dev/test).
The domain layer depends only on this interface — never on HA, HTTP, or any adapter
internals.

## Port Interface (TypeScript sketch — for contract clarity, not production code)

```ts
// locations/domain/smart-lock-gateway.port.ts
export type DoorState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface SmartLockGateway {
  /**
   * Read the current door-sensor state for a locker.
   * Resolves UNKNOWN if the sensor is unreachable or reports an indeterminate value.
   * Must not throw on transient network errors — return UNKNOWN and let the caller
   * decide (e.g. treat as not-open for unauthorized detection).
   */
  readDoorState(lockerId: LockerId): Promise<DoorState>;

  /**
   * Command the lock actuator to unlock. Idempotent at the device level: unlocking an
   * already-unlocked locker is a no-op.
   * Rejects with GatewayUnreachableError if the controller is not reachable.
   * Rejects with GatewayCommandError on any non-transient controller failure.
   */
  unlock(lockerId: LockerId): Promise<void>;

  /**
   * Command the lock actuator to lock. Idempotent at the device level: locking an
   * already-locked locker is a no-op (FR-015 — explicit close before auto-relock timer
   * produces no error).
   * Same failure modes as unlock().
   */
  lock(lockerId: LockerId): Promise<void>;

  /**
   * Cheap reachability probe used by StationHealthChecker. Resolves true/false; never
   * throws. A "failed check" (timeout, network error, non-2xx) resolves false.
   */
  isReachable(): Promise<boolean>;
}
```

## Operational Contract

- **Per-station instance**: one adapter instance per station, configured from the
  station's `HaConnectionConfig` VO. The `token` field holds the plaintext HA token
  (decrypted from `ha_token_encrypted` by `StationRepository` via `CryptoService`); the
  adapter uses it directly for HA REST calls. The plaintext exists only in memory — never
  persisted in DB (encrypted column) or serialized to API responses (masked in DTOs).
- **Timeouts** (Home Assistant adapter): connect 3 s, read 5 s (tuned from the legacy
  suppoint-bot's HA read-timeout handling). The mock adapter uses deterministic delays
  < 50 ms.
- **Idempotency**: `lock()` and `unlock()` are idempotent at the device level — issuing
  the same command twice in a row is a no-op. This is what makes the auto-relock timer
  safe against an explicit close that arrived first (FR-015): the worker's `lock()`
  call on an already-locked locker simply succeeds.
- **No domain coupling**: the port signature speaks only in `LockerId` and the
  `DoorState` enum. HA entity ids (`ha_lock_entity_id`, `ha_door_sensor_entity_id`)
  live in the `Locker` aggregate and are mapped to HA-specific calls **inside the
  adapter**, never in domain code.

## Error Semantics (shared with application layer)

| Error | Meaning | Caller action |
|---|---|---|
| `GatewayUnreachableError` | `isReachable()` would be false; controller down | `LockerAccessService` returns `LOCKER_STATION_OFFLINE` (503); `StationHealthChecker` counts a failure toward the 2-strike OFFLINE debounce |
| `GatewayCommandError` | Controller reachable but command failed (HA error response, auth rejected) | `LockerAccessService` returns `LOCKER_OPEN_FAILED` / `LOCKER_CLOSE_FAILED` (502); admin alerted; auto-relock retried with backoff |
| `readDoorState` → `UNKNOWN` | Sensor unreachable or indeterminate | Treated as not-open for unauthorized detection; logged for admin awareness (Error Scenarios) |

## Mock Adapter Behavior

`MockSmartLockGateway` keeps in-memory state: `Map<LockerId, DoorState>` (default
`CLOSED`) and `Set<stationId>` of "unreachable" stations (controllable in tests via
`mock.setReachable(stationId, false)`). It implements every port method and lets tests
inject failures deterministically. It is the default adapter in dev + CI; the
`HomeAssistantGateway` is auto-registered only when `HA_BASE_URL` is
present (stage/prod). The same contract test suite runs against both adapters on stage.

## What This Port Does NOT Cover

- Reservation logic — `locations` exposes `unlock`/`lock`/`readDoorState`; *when* to
  unlock for a renter is decided by `rentals` (Phase 5) which calls `LockerAccessService`,
  not the gateway directly.
- Auto-relock scheduling — `LockerAccessService` (domain service) schedules a BullMQ
  job; the worker calls this port's `lock()`.
- Health-check orchestration — `StationHealthChecker` calls `isReachable()` and
  applies the debounce; the port just reports reachability.
