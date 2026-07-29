Create a functional specification for the Pickup capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-08.1, BR-08.2, BR-08.3, and BR-06.5 (cross-reference). Do not restate
them; reference them.

Focus on business behavior only. Scope: the renter opening their locker(s) after payment
confirmation and the rental transitioning to active.

Include:
- User stories
- Functional requirements: after payment confirmation, a renter may open only the
  locker(s) reserved for them in a confirmed, paid rental, at any time; opening any locker
  in a rental for the first time transitions the rental to active and starts the duration
  countdown from that exact moment; if the renter never opens a locker within a
  configurable grace period after payment confirmation, the rental starts automatically
  anyway
- Business rules
- Acceptance criteria
- Error scenarios (attempting to open a locker not part of the renter's paid rental)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Home Assistant integration details
