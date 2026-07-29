Create a functional specification for the Rental History capability of rentiq.

Use docs/architecture/greenfield-architecture.md only as context — see §5.2
rental_status_history and §7 rentals API surface. Do not restate them; reference them.

Focus on business behavior only. Scope: the renter's own history view and the admin's
filterable rental list/detail view. Explicitly out of scope: CSV/XLSX export
(spec-kit-prompts/10-analytics-admin-panel).

Include:
- User stories
- Functional requirements: a renter can view their own past rentals; an admin can query
  rentals filtered by station, status, and date range, and view a single rental's full
  timeline of status changes (from creation through completion or cancellation); the
  timeline must be a faithful, immutable record — no status change is ever edited or
  removed after the fact
- Business rules
- Acceptance criteria
- Error scenarios
- Non-functional requirements (pagination for large result sets)
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Export/reporting formats
