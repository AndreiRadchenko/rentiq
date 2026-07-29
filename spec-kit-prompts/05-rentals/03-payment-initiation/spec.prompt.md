Create a functional specification for the Payment Initiation capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-06.4 and BR-04.2/BR-04.3/BR-04.5. Do not restate them; reference them.

Focus on business behavior only. Scope: the rentals-side behavior of requesting payment —
duration selection, price quoting, and the maintenance-window gate. Explicitly out of
scope: payment-gateway integration, webhook verification, and idempotency, which belong to
spec-kit-prompts/06-payments.

Include:
- User stories
- Functional requirements: the renter selects a duration from a fixed set of options and
  receives a price quote locked in at that moment; new payment requests are blocked during
  the organization's configured maintenance window, with a clear message stating when
  payments become available again; a surcharge (top-up) payment already in progress is
  never blocked by the maintenance window
- Business rules
- Acceptance criteria
- Error scenarios (duration selected during maintenance window)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Payment gateway details
