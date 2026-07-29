Create a functional specification for the IAM + Organizations capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-01.1 through BR-01.6 and BR-02.1, BR-02.2. Do not restate them; reference
them.

Focus on business behavior only.

Include:
- User stories
- Functional requirements: renter registration and explicit informed consent as a
  precondition for any booking; permanent binding of a renter to exactly one
  organization; renter locale selection at registration and change at any time; the
  three-tier admin role hierarchy (SUPER_ADMIN cross-organization, ORG_ADMIN full control
  within one organization, STATION_OPERATOR scoped to assigned stations) and what each can
  and cannot do; admin accounts and renter accounts as fully separate identities that are
  never merged; organization-level branding and supported-locale-set configuration
- Business rules
- Acceptance criteria
- Error scenarios
- Non-functional requirements
- Open questions, including: confirm the Ukrainian data-retention law minimum period
  before anonymizing a renter's identifying fields after a deletion request (BR-01.6)

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- JWT/token implementation details
