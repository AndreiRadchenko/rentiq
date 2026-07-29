Create an implementation plan for the Reservation specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (ADR-008 — single rental aggregate for
multi-locker bookings and current_rental_id exclusivity; ADR-003 — absolute deadline
timestamps; §5.3 atomic UPDATE pattern) and docs/roadmap/implementation-roadmap.md
(Phase 5 — Rentals, reservation portion of deliverables and exit criteria).

Preserve module boundaries: rentals owns reservation state; locations owns the lockers
table and only exposes exclusivity through the shared current_rental_id mechanism.

Include:
- Architecture impact
- Required modules: rentals
- Domain model: reservationExpiresAt absolute UTC timestamp on Rental
- Database changes: rentals.reservation_expires_at column; atomic
  UPDATE lockers SET current_rental_id = :id WHERE current_rental_id IS NULL pattern
  (returns 0 rows = conflict)
- APIs: none new — extends POST /rentals from 01-rental-registration
- Events: RentalReserved
- Background jobs: RentalTimerSweepService (@Cron every 15s) — finds rentals where
  now() >= reservationExpiresAt and cancels them, releasing lockers
- Testing strategy: concurrency test reserving the same locker from two simultaneous
  requests; unit test for the sweep job's expiry detection; test that a DB transaction
  makes multi-locker reservation all-or-nothing
- Risks: in-process event bus missing an event on crash — mitigate with the reconciliation
  job from 03-locations-pricing
- Migration considerations: none (greenfield)
- Task breakdown matching the reservation portion of Phase 5's exit criteria (timer sweep
  cancels an expired reservation)

Do not generate production code.
