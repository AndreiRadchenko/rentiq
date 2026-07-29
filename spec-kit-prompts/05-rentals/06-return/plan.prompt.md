Create an implementation plan for the Return specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.7 rentals —
RentalFulfilmentService.submitFinishPhoto/confirmFinish, ADR-010 unverified-finish
fallback) and docs/roadmap/implementation-roadmap.md (Phase 5 — Rentals, finish-flow
portion of deliverables and exit criteria).

Preserve module boundaries: rentals depends on media (Phase 4) for photo storage and on
locations' SmartLockGateway port (via its public interface) for door-state reads; it never
touches MinIO or Home Assistant directly.

Include:
- Architecture impact
- Required modules: rentals (depends on media, locations)
- Domain model: closedAt, doorStateVerified (null|true|false) on RentalLocker
- Database changes: rental_lockers.closed_at, rental_lockers.door_state_verified
- APIs: POST /rentals/:id/finish/photo (multipart photo upload, links media asset to
  rental), POST /rentals/:id/finish/confirm (checks door sensors per locker, accepts with
  doorStateVerified=false if HA offline)
- Events published: UnverifiedFinishAccepted (only on the offline-fallback path)
- Background jobs: none
- Testing strategy: integration test for the full finish flow with door sensor reporting
  closed; integration test for the HA-offline fallback path asserting the rental still
  completes with doorStateVerified=false and an admin notification is triggered
- Risks: HA connectivity is explicitly flaky — the offline fallback must not block the
  renter from leaving
- Migration considerations: none (greenfield)
- Task breakdown matching the finish-flow portion of Phase 5's exit criteria

Do not generate production code.
