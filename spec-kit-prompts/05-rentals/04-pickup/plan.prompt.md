Create an implementation plan for the Pickup specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.7 rentals —
RentalFulfilmentService, event handler subscribing to LockerOpened) and
docs/roadmap/implementation-roadmap.md (Phase 5 — Rentals, pickup portion of deliverables
and exit criteria).

Preserve module boundaries: rentals subscribes to locations' LockerOpened event; it never
calls SmartLockGateway directly (locations owns that port).

Include:
- Architecture impact
- Required modules: rentals (subscribes to locations events)
- Domain model: startedAt timestamp on Rental, openedAt on RentalLocker
- Database changes: rental_lockers.opened_at
- APIs: POST /rentals/:id/open-locker ({ lockerId })
- Events subscribed: LockerOpened (if rental is AWAITING_PICKUP, transition to ACTIVE, set
  startedAt)
- Events published: RentalPickupReady, RentalStarted
- Background jobs: RentalTimerSweepService grace-period auto-start sweep
  (now() >= pickupDeadlineAt)
- Testing strategy: integration test for locker-open triggering ACTIVE transition; unit
  test for grace-period auto-start
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching the pickup portion of Phase 5's exit criteria (open locker after
  stub payment completes)

Do not generate production code.
