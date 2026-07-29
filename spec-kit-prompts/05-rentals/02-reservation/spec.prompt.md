Create a functional specification for the Reservation capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-05.2, BR-05.4, BR-05.5. Do not restate them; reference them.

Focus on business behavior only. Scope: the temporary-hold mechanics once a rental has
been registered (spec-kit-prompts/05-rentals/01-rental-registration) — the bounded time
window, all-or-nothing atomicity, and exclusivity guarantee.

Include:
- User stories
- Functional requirements: selecting locker(s) removes them from availability for other
  renters for a bounded window; if payment is not completed within the window, the
  reservation expires automatically and all lockers become available again; reserving
  multiple lockers is all-or-nothing — either all succeed or none do, and the renter is
  told which lockers became unavailable in the interim; at any point in time a locker
  belongs to at most one active (non-terminal) rental, and this must hold even under
  concurrent requests
- Business rules
- Acceptance criteria
- Error scenarios (concurrent reservation attempts on the same locker)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Event names
