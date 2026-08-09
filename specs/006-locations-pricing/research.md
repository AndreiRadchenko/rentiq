# Phase 0 Research: Locations + Pricing

**Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This document resolves every technical unknown required before Phase 1 design. Each
entry follows: **Decision → Rationale → Alternatives considered**. No `[NEEDS
CLARIFICATION]` markers remain after this file.

## R1 — Per-station Home Assistant connection resolution

**Decision**: One `HomeAssistantGateway` adapter instance is created per station, lazily
cached by `stationId`, configured from the station's `HaConnectionConfig` VO
(`ha_url_or_ip`, `ha_token_ref`, `auto_lock_delay_sec`). The raw token is resolved
through the `SecretStore` port (owned by `organizations`) at the moment of use, never
cached in the adapter beyond the lifetime of a single gateway call.

**Rationale**: ADR-001/ADR-002 keep the system a single process; a small per-station
gateway pool (≤50 stations/org in v1) is trivially cheap and isolates per-station
timeouts. Resolving the token at use-time (FR-021) means a rotated token takes effect on
the next call without invalidating the cached adapter.

**Alternatives**:
- Single shared gateway with `stationId` passed per call — rejected: spreads
  per-station config/timeout logic across call sites, harder to reason about.
- One adapter per `unlock`/`lock` call (no cache) — rejected: unnecessary object churn;
  config is stable for the station's lifetime.

## R2 — Auto-relock scheduling mechanism

**Decision**: Auto-relock is scheduled via a **BullMQ delayed job** with an
**absolute-deadline timestamp** (`lockAt = openedAt + autoLockDelaySeconds`). The BullMQ
worker, on pickup, checks `now >= lockAt`; if the locker is already closed (via an
explicit close event), the job is a no-op; otherwise it issues `SmartLockGateway.lock()`
(idempotent — locking an already-locked locker is a no-op, FR-015). The job is persisted
in Redis, so a process restart does not lose the pending relock (ADR-003).

**Rationale**: ADR-003 mandates absolute-deadline, restart-safe time-based behavior.
BullMQ delayed jobs persist in Redis and survive worker restarts; an in-process
`setTimeout` would not. The idempotent-lock property (FR-015) means explicit-close-before-
timer is safe without job cancellation, though we *also* attempt to cancel the pending
job on explicit close to reduce noise.

**Alternatives**:
- In-process `setTimeout` — rejected: lost on restart; violates ADR-003.
- DB-polling "due relock" sweep — rejected: higher latency, more DB load, more moving
  parts than a queue.
- Redis keyspace notifications on a TTL key — rejected: less observable than a job
  queue and harder to retry with backoff on gateway failure.

## R3 — Health-check debounce policy

**Decision**: `StationHealthChecker` runs as `@Cron('*/30 * * * * *')` (every 30 seconds
at the cron level, iterating active stations). Per the spec Clarification 2026-08-09,
the *effective* flagging rule is: 2 consecutive failed `isReachable()` checks →
`healthStatus = OFFLINE` and publish `StationHealthChanged(isOnline=false)`; 1
successful check → `healthStatus = ONLINE` and publish
`StationHealthChanged(isOnline=true)`. A "failed check" includes timeout, network
error, or a non-2xx HA response (per the spec's Error Scenarios). State transitions
are the only thing that publishes an event — repeated failures while already OFFLINE
do not re-publish. Admin's manual `isActive=false` is never overridden on recovery
(FR-010): recovery clears only the connectivity hold, restoring the admin-intended
`isActive` state.

**Rationale**: 2-fail debounce avoids flapping on transient packet loss; 1-success clear
means recovery is fast. The 60 s interval stated in the spec Clarification is the
*logical* check interval per station; the 30 s cron iterates the station set so each
station is visited roughly every 60 s once the set is non-trivial. State-transition-only
publishing prevents alert floods (Edge Case "Health check flapping").

**Alternatives**:
- 1-strike failure → OFFLINE — rejected: too noisy on flaky outdoor links.
- Per-station configurable interval — rejected by Clarification (org-global defaults
  this phase).
- Exponential backoff on failures before flagging — rejected: adds complexity without
  clear benefit over a fixed 2-fail window.

## R4 — Secret store abstraction boundary

**Decision**: The `SecretStore` port (methods `store(secret): SecretRef`,
`resolve(ref): Secret`) is owned by the `organizations` module and exposed as a public
application-service interface. `locations` domain/application code holds only an opaque
`tokenRef: string`; only the `HomeAssistantGateway` adapter (infrastructure) calls
`SecretStore.resolve(tokenRef)` at the moment of issuing a gateway command. The raw
token never enters `locations` domain, application, or persistence layers (FR-019/020/
021). In v1 the concrete `SecretStore` adapter reads from environment variables (per
the roadmap Phase 3 deliverable: "reads from env-vars in v1"); a real vault adapter is a
later-phase swap behind the same port.

**Rationale**: Constitution Principle II (external systems behind named ports) and
Principle X (secret hygiene — raw tokens never in logs/audit/API). Keeping the port in
`organizations` co-locates it with the org-level credential refs it also manages
(payment, checkbox, telegram).

**Alternatives**:
- `locations` owns its own `SecretStore` port — rejected: duplicates the abstraction;
  `organizations` already needs it for payment/checkbox creds.
- Pass the resolved token into the domain layer — rejected: violates Principle II and
  secret hygiene.

## R5 — Day type resolution

**Decision**: `DayTypeResolver` (in `pricing` infrastructure) computes `WEEKDAY |
WEEKEND` from a given `Date` interpreted in the owning organization's configured
timezone (default `Europe/Kyiv`, from `organizations.maintenance_timezone`). WEEKEND =
Saturday or Sunday in that timezone. Day type for a rental is resolved once, from the
booking *creation* date (BR-04.2/FR-003), and frozen — a Friday-23:55 booking returned
Saturday is priced as WEEKDAY.

**Rationale**: BR-04.2 explicitly mandates booking-creation-date determination. Using
the org timezone matches the maintenance-window timezone handling already established
in `organizations`, giving one consistent time-zone story per org.

**Alternatives**:
- UTC day-of-week — rejected: would mislabel Friday-evening Ukraine bookings that cross
  midnight UTC as WEEKEND.
- Per-station timezone — rejected: out of scope; org-level is the spec's stated default
  (Assumptions).

## R6 — OvertimeCalculator scope for Phase 3

**Decision**: The `OvertimeCalculator` domain service is created as a **pure, fully
unit-tested function** with its signature matching the architecture doc
(`calculate(bookingDayType, paidDurationMinutes, actualDurationMinutes, tariffs[]) →
{ bandDurationMinutes, totalPrice, surchargeAmount }`), but its *full overtime
semantics* (what the 240/300/480-minute tariff bands represent — flat durations, day
passes, or overtime ceilings) is **not specified in this phase**. It is a forward
reference to the Overtime spec (`spec-kit-prompts/05-rentals/07-overtime`, Open
Question 1 in the spec). In Phase 3 the function is exercised only by unit tests with
synthetic tariffs to lock in the band-rounding arithmetic; it is not yet called by any
application service or endpoint.

**Rationale**: The spec explicitly defers duration-band semantics to the Overtime spec.
Building the signature now lets Phase 5 (Rentals) integrate it without a contract
change, while leaving the policy decision to its proper spec.

**Alternatives**:
- Omit `OvertimeCalculator` entirely until the Overtime spec — rejected: the
  architecture doc declares it as part of the `pricing` module; defining the signature
  now avoids a Phase 5 contract churn.
- Fully implement it now with guessed semantics — rejected: would pre-empt the Open
  Question and risk rework.

## R7 — Locker exclusivity & release mechanism

**Decision**: The DB-level exclusivity mechanism from ADR-008 is used: `lockers
.current_rental_id` is the single source of truth — `AVAILABLE ⟺ current_rental_id IS
NULL`. Reservation is an atomic conditional UPDATE (`SET current_rental_id = :rentalId,
status = 'RESERVED' WHERE id = :lockerId AND current_rental_id IS NULL`); 0 rows updated
means "already reserved" → `Err(LockerAlreadyReserved)`. In Phase 3 we define the
`Locker` aggregate and the `LockerRepository.reserveAtomic()` method with this
contract, but the reservation *use case* is delivered in Phase 5 (Rentals). What
`locations` delivers in Phase 3 is the **release side**: the event handler subscribed
to `RentalFinished` / `RentalCancelled` that sets `current_rental_id = null`, `status =
'AVAILABLE'`, plus the `LockerReconciliationJob` safety net (startup + hourly) that
finds COMPLETED/CANCELLED rentals with non-AVAILABLE lockers and corrects them
(ADR-010, ADR-013).

**Rationale**: ADR-008 mandates single-row exclusivity; ADR-010/ADR-013 mandate a
reconciliation owner. Phase 3 owns the locker release path because it owns the locker
aggregate; Phase 5 owns the reservation path because it owns the rental aggregate.

**Alternatives**:
- App-level lock with no DB constraint — rejected: race-prone.
- DB `SELECT FOR UPDATE` on the locker row — rejected: heavier than a conditional UPDATE;
  the conditional UPDATE is the pattern documented in §5.3.

## R8 — Unauthorized door-open detection trigger

**Decision**: The HA door-events webhook (`POST /api/v1/webhooks/ha/door-events`,
shared-secret header) is the sole ingress for door state. The webhook handler maps an
incoming `door_state = OPEN` event for a locker to: if `locker.current_rental_id` is
null AND no pickup-ready rental exists for that locker → publish
`UnauthorizedDoorOpenDetected(lockerId, stationId)` and let `notifications`/`audit-log`
subscribers handle the alert (FR-016/017). If there is an active or pickup-ready rental,
the open is expected and `LockerOpened` is published instead (FR-018). MAINTENANCE
mode does not suppress the unauthorized alert (Acceptance Scenario 5.3). `UNKNOWN` door
state is treated as not-open for unauthorized detection but logged (Error Scenarios).

**Rationale**: The webhook is the existing HA→backend ingress (architecture §7
Locations). Treating the webhook as the only door-state source keeps one path to reason
about. Subscribing `notifications` rather than calling it directly honors Principle IV.

**Alternatives**:
- Poll door state from HA on a timer — rejected: higher latency than the webhook; the
  webhook already exists.
- Have `locations` send the admin alert directly — rejected: violates Principle IV
  (notifications is a separate module's concern).

## R9 — Mock SmartLockGateway contract

**Decision**: `MockSmartLockGateway` implements the full `SmartLockGateway` port
(`readDoorState`, `unlock`, `lock`, `isReachable`) with in-memory state per `lockerId`,
controllable failure injection (set a station "unreachable", force a `lock()` failure),
and deterministic delays. It is registered as the default adapter in dev + test; the
`HomeAssistantGateway` is registered only when `HA_BASE_URL` / `HA_TOKEN_REF` config is
present (stage + prod). Both adapters implement the same port, so the domain layer is
unaware which one is active (Principle II).

**Rationale**: Risk R1 (HA test device unavailable) is mitigated only if the mock is
always available and contract-equivalent. The same contract test suite runs against
both adapters on stage.

**Alternatives**:
- Test against a real HA in CI — rejected: HA is not available in CI; would make the
  suite environment-dependent.
- Skip the mock and only test via mocked repository calls — rejected: would not
  exercise the gateway port contract.
