Create an implementation plan for the Payment Initiation specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.7 rentals — RentalBookingService,
module dependency graph showing rentals calling payments.InvoiceService synchronously for
the initial invoice) and docs/roadmap/implementation-roadmap.md (Phase 5 — Rentals,
duration-selection/maintenance-window portion of deliverables and exit criteria).

Preserve module boundaries: rentals calls payments only through its public InvoiceService
interface; pricing is called through PricingService.quote only.

Include:
- Architecture impact
- Required modules: rentals (calls pricing, organizations, payments synchronously)
- Domain model: baseDurationMinutes, basePriceMinor, currency, bookingDayType fields on
  Rental
- Database changes: rentals duration/price columns
- APIs: POST /rentals/:id/duration ({ durationMinutes } → price quote + invoice)
- Events: RentalPaymentRequested
- Background jobs: none
- Testing strategy: unit test for the maintenance-window guard
  (MaintenanceWindowActiveError, uk+en translated); integration test for
  selectDuration → PricingService.quote → InvoiceService.createInitialInvoice
- Risks
- Migration considerations: none (greenfield)
- Task breakdown: RentalBookingService.selectDuration(rentalId, durationMinutes),
  OrganizationService.getMaintenanceWindow() check before invoice creation

Do not generate production code.
