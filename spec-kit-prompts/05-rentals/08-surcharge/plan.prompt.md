Create an implementation plan for the Surcharge specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (ADR-007 — event-driven surcharge
invoice creation, §4.7 rentals Surcharge entity) and
docs/roadmap/implementation-roadmap.md (Phase 5 — Rentals, surcharge portion, and Phase 6
— Payments, SurchargeRequired handler portion of deliverables and exit criteria).

Preserve module boundaries: rentals publishes SurchargeRequired and never calls payments
synchronously for this; payments subscribes asynchronously; notifications (delivered in a
later phase) owns the reminder scheduling.

Include:
- Architecture impact
- Required modules: rentals (publisher), payments (subscriber, cross-reference
  spec-kit-prompts/06-payments), notifications (reminder scheduler, cross-reference
  spec-kit-prompts/07-notifications-i18n)
- Domain model: Surcharge entity (id, rentalId, orgId, amountMinor, currency, status:
  PENDING|INVOICE_CREATED|SETTLED|CANCELLED, createdAt, settledAt)
- Database changes: surcharges table
- APIs: POST /surcharges/:id/cancel (admin, audited)
- Events published: SurchargeRequired (by rentals); PaymentInvoiceCreated (by payments on
  success); SurchargeInvoiceCreationFailed (by payments on persistent failure)
- Background jobs: BullMQ retry for failed top-up invoice creation; surcharge reminder
  BullMQ delayed job, re-queued each cycle until status = SETTLED
- Testing strategy: integration test confirming lockers release immediately on surcharge
  even before the invoice is created; test for retry-on-failure and eventual admin
  escalation; test for the write-off flow marking the surcharge CANCELLED and excluding it
  from the BR-05.3 blocking check
- Risks: transient invoice-creation failure must not silently drop the surcharge
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 5/6's surcharge exit criteria (surcharge invoice created
  asynchronously after SurchargeRequired)

Do not generate production code.
