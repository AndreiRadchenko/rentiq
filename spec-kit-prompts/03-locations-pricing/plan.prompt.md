Create an implementation plan for the Locations + Pricing specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.5 locations, §4.6 pricing) and
docs/roadmap/implementation-roadmap.md (Phase 3 — Locations + Pricing deliverables and
exit criteria).

Preserve module boundaries: locations and pricing are separate modules; both depend on
shared-kernel and organizations only.

Include:
- Architecture impact
- Required modules: locations, pricing
- Domain model: Station aggregate (workingStatus, isActive, isVisibleToClients,
  haConnectionConfig, healthStatus); Locker aggregate (status, haLockEntityId,
  haDoorSensorEntityId, currentRentalId); InventoryKit entity; Tariff aggregate
  (kitType, dayType, durationMinutes, price); OvertimeCalculator domain service (pure
  function, referenced but not fully specified here)
- Database changes: stations, lockers, inventory_kits, tariffs tables; critical index on
  bookable stations and available lockers
- APIs: full CRUD for stations, lockers, inventory kits, tariffs;
  GET /stations?visible=true&active=true (renter-facing, filtered)
- Events: StationCreated, StationVisibilityChanged, StationHealthChanged, LockerOpened,
  LockerClosed, UnauthorizedDoorOpenDetected, UnverifiedLockerFinish
- Background jobs: StationHealthChecker (@Cron */30s) pinging each active station's HA
  connection; LockerAccessService scheduling auto-relock via BullMQ delayed job;
  LockerReconciliationJob (startup + hourly) fixing COMPLETED/CANCELLED rentals with
  non-AVAILABLE lockers
- Testing strategy: unit tests for bookability rule evaluation and OvertimeCalculator
  band rounding; integration test opening a real or mock locker via SmartLockGateway
- Risks: Home Assistant test device unavailable — keep a MockSmartLockGateway available at
  all times for local development
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 3's exit criteria (create station, assign lockers,
  configure tariffs; POST /lockers/:id/open physically opens a real test locker on stage;
  station-offline event logged on disconnect)

Do not generate production code.
