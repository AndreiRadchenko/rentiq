Create a functional specification for the Overtime capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-04.4 (open item), BR-09.4, BR-09.5, and ADR-009 (booking-day tariff
lock-in). Do not restate them; reference them.

Focus on business behavior only. Scope: computing whether and how much overtime was
accrued at return time. Explicitly out of scope: the physical return flow
(spec-kit-prompts/05-rentals/06-return) and the billing consequence
(spec-kit-prompts/05-rentals/08-surcharge).

Include:
- User stories
- Functional requirements: actual usage time is compared against the paid duration using
  the day type (weekday/weekend) of the original booking, never the day type at return
  time; if actual usage does not exceed the paid duration (within a small tolerance), no
  further charge applies; if it does, usage is rounded up to the next defined tariff band
  and the overtime amount is the price of that band minus the amount already paid; a
  computed amount of zero or negative results in no charge
- Business rules
- Acceptance criteria (including a rental that ends exactly at a band boundary)
- Error scenarios
- Non-functional requirements
- Open questions: confirm with the product owner what the tariff duration bands actually
  represent (BR-04.4) — this must be resolved before this specification is finalized

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Event names
