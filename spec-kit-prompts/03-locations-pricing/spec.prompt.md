Create a functional specification for the Locations + Pricing capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-03.1 through BR-03.7 and BR-04.1 through BR-04.5. Do not restate them;
reference them.

Focus on business behavior only.

Include:
- User stories
- Functional requirements: the exact conditions under which a locker is offered for
  booking (active station, visible station, WORKING operational status, an assigned
  inventory kit, at least one tariff for that kit type and day type, and the locker itself
  being available); automatic station connectivity monitoring that flags a station
  inactive when its controller is unreachable and reactivates it automatically on
  recovery; mandatory automatic re-lock after any locker open, even without an explicit
  close; immediate admin alerting on an unauthorized door-open with no active or
  pickup-ready rental; independent admin control of a station's active and
  visible-to-clients flags; secret-store-only storage of per-station connectivity
  credentials; the kit-type → tariff pricing structure with a fixed, admin-configurable
  set of duration options (no free-form duration input)
- Business rules
- Acceptance criteria
- Error scenarios
- Non-functional requirements
- Open questions, including: confirm with the product owner what the tariff duration
  bands (e.g. 60/120/180/240/300/480 minutes) represent — a forward reference resolved in
  the Overtime specification (spec-kit-prompts/05-rentals/07-overtime)

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Home Assistant protocol details
