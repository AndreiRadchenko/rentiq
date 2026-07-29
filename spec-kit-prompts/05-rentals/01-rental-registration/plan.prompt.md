Create an implementation plan for the Rental Registration specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.7 rentals — Rental aggregate,
rental_lockers child table) and docs/roadmap/implementation-roadmap.md (Phase 5 — Rentals,
booking-creation portion of the deliverables and exit criteria).

Preserve module boundaries: rentals depends on iam (renter identity) and locations
(locker existence) only through their public application-service interfaces.

Include:
- Architecture impact
- Required modules: rentals (depends on iam, locations)
- Domain model: Rental aggregate creation (id, orgId, renterId, stationId, lockers
  collection, status RESERVED)
- Database changes: rentals, rental_lockers tables (creation only — reservation-window
  columns owned by 02-reservation)
- APIs: POST /rentals ({ stationId, lockerIds[] } → reservation)
- Events: none published here — RentalReserved is owned by 02-reservation
- Background jobs: none
- Testing strategy: unit test for the unpaid-surcharge blocking rule; integration test
  creating a rental with multiple lockers
- Risks
- Migration considerations: none (greenfield)
- Task breakdown: RentalBookingService.reserve(renterId, stationId, lockerIds[])
  entry point, cross-module lookups to iam/locations, unpaid-surcharge guard

Do not generate production code.
