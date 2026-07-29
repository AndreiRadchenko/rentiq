Create a functional specification for the Shared Kernel + Foundation capability of
rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see ADR-002 (money as integer minor units) and ADR-012 (org_id on every table +
TenantContext). Do not restate them; reference them.

Focus on business behavior only. Frame this as the set of platform-wide guarantees every
later capability depends on, not as a technical component list.

Include:
- User stories (framed as guarantees the platform as a whole must uphold)
- Functional requirements: every request is scoped to exactly one organization and can
  never see or affect another organization's data; all monetary values are exact, with no
  floating-point drift, and always carry an explicit currency; the application refuses to
  start with invalid or missing configuration rather than degrading silently; the system
  exposes a health signal covering its own status and its dependencies (database, cache);
  error responses and paginated responses are consistent in shape across the entire API.
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
