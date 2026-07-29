Create an implementation plan for the Active Rental specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.7 rentals —
RentalTimerSweepService) and docs/roadmap/implementation-roadmap.md (Phase 5 — Rentals,
active-rental portion of deliverables and exit criteria).

Preserve module boundaries: rentals publishes overtime events; notifications (a separate
module, delivered in a later phase) is the only consumer allowed to push them to the
renter.

Include:
- Architecture impact
- Required modules: rentals
- Domain model: warningAt absolute UTC timestamp on Rental (ADR-003)
- Database changes: rentals.warning_at column; timer-sweep index covering
  reservation_expires_at, pickup_deadline_at, warning_at
- APIs: GET /rentals/active (renter's active/awaiting-pickup rentals)
- Events published: RentalOvertimeWarningIssued, RentalOvertimeDetected
- Background jobs: RentalTimerSweepService (@Cron every 15s) — finds rentals where
  now() >= warningAt and publishes the warning event; separately detects full overtime
- Testing strategy: unit test for the sweep job firing exactly once per threshold crossed;
  integration test for GET /rentals/active showing live remaining/overtime time
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching the active-rental portion of Phase 5's exit criteria

Do not generate production code.
