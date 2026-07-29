Create a functional specification for the Surcharge capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-09.6, BR-09.7, BR-09.8, BR-05.3 (cross-reference), and BR-12.3
(cross-reference). Do not restate them; reference them.

Focus on business behavior only. Scope: the billing consequence once overtime has been
computed (spec-kit-prompts/05-rentals/07-overtime). Explicitly out of scope: the actual
payment-gateway invoice mechanics (spec-kit-prompts/06-payments).

Include:
- User stories
- Functional requirements: when a surcharge is owed, all lockers in the rental are
  immediately released back to available — the physical locker is never held hostage for
  an unpaid surcharge; the debt follows the renter instead (cross-reference: it blocks
  their next booking per BR-05.3); a top-up invoice is requested asynchronously — the
  finish flow returns success immediately without waiting for the invoice to be created;
  the renter with an unpaid surcharge is reminded on an escalating schedule (shortly
  after, again a few hours later, then daily) until it is settled; an admin with
  sufficient privilege can cancel (write off) an unpaid surcharge as a sensitive, audited
  action
- Business rules
- Acceptance criteria
- Error scenarios (invoice creation fails transiently; persistent failure)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Payment gateway details
