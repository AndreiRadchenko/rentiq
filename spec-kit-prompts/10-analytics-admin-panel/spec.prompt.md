Create a functional specification for the Analytics + Admin Panel capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-12.4 and BR-12.5. Do not restate them; reference them.

Focus on business behavior only — describe admin-facing needs, not UI component design.

Include:
- User stories
- Functional requirements: admins need at-a-glance rental counts and revenue for today,
  this week, and this month, scoped so a STATION_OPERATOR only sees stats for their
  assigned stations; ORG_ADMIN and above can export the organization's full rental history
  to CSV/XLSX with date-range filtering; the admin needs a coherent set of management
  views covering: dashboard, stations (list, visibility/active toggles, locker status),
  locker detail (current rental, manual open/close), rentals list and detail (timeline,
  surcharge status, finish photo), tariffs management, admin/renter user management, audit
  log search, support report queue, and organization settings (branding, maintenance
  window, fiscal configuration)
- Business rules
- Acceptance criteria
- Error scenarios
- Non-functional requirements (dashboard data freshness expectations)
- Open questions

Exclude:
- Database schema
- NestJS/Next.js component or module design
- API endpoint shapes
- Visual/UI design details
