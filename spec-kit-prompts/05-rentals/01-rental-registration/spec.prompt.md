Create a functional specification for the Rental Registration capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-05.1, BR-05.3, and BR-01.1/BR-01.2. Do not restate them; reference them.

Focus on business behavior only. Scope: the renter's act of starting a new booking —
selecting a station and one or more lockers as a single booking session. Explicitly out of
scope: the reservation hold/expiry mechanics (spec-kit-prompts/05-rentals/02-reservation),
duration/pricing/payment (03-payment-initiation).

Include:
- User stories
- Functional requirements: a renter may book one or more lockers at a single station in
  one session, all belonging to one rental; the precondition that the person is already a
  registered renter; the precondition that a renter with any unpaid surcharge from a
  previous rental is blocked from starting a new booking until every outstanding surcharge
  is settled, and is shown a direct payment link for each one
- Business rules
- Acceptance criteria
- Error scenarios
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Event names
