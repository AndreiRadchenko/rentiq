Create an implementation plan for the Rental History specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§5.2 rental_status_history table,
§7 rentals API surface) and docs/roadmap/implementation-roadmap.md (Phase 5 — Rentals,
history/query portion of deliverables and exit criteria).

Preserve module boundaries: rentals owns rental_status_history as an append-only table;
no other module writes to it directly.

Include:
- Architecture impact
- Required modules: rentals
- Domain model: rental_status_history write on every state transition (rentalId,
  fromStatus, toStatus, changedByType, changedById, reason, occurredAt)
- Database changes: rental_status_history table (append-only, never updated or deleted)
- APIs: GET /rentals/history (renter's own history), GET /rentals?stationId=&status=&
  from=&to= (admin queries)
- Events: none new
- Background jobs: none
- Testing strategy: unit test asserting every legal state transition writes exactly one
  history row; integration test for filtered admin queries and pagination
- Risks
- Migration considerations: none (greenfield)
- Task breakdown: wire RentalLifecycleService so every transition it performs writes a
  rental_status_history row; implement the two read endpoints using shared-kernel
  pagination DTOs

Do not generate production code.
