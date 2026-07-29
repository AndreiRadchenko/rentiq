Create a functional specification for the Multi-Tenant Hardening capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-02.1 (complete data isolation between white-label operators). Do not
restate them; reference them.

Focus on business behavior only. Frame this as a platform-wide guarantee to be validated,
not a new feature.

Include:
- User stories
- Functional requirements: two organizations sharing the platform must have complete data
  isolation across every flow — bookings, payments, rentals, support reports, analytics,
  and audit logs of one organization must never be visible to or affected by another
  organization's activity; a renter's per-organization authentication credential (e.g. bot
  secret) must never authenticate them against a different organization
- Business rules
- Acceptance criteria: for each core flow (booking, payment, rental, support report), an
  action performed under organization A must be provably invisible to and unaffected by
  organization B, and vice versa
- Error scenarios (a payment webhook for org A must never advance org B's rental; a renter
  presenting org A's bot secret must be rejected against an org B renter)
- Non-functional requirements
- Open questions: when does a white-label contract require physical data isolation
  (separate schema/database) instead of row-level isolation?

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Row-Level Security implementation details
