Create a functional specification for the WebSockets + Mobile Readiness capability of
rentiq.

Use docs/architecture/greenfield-architecture.md only as context. Do not restate it;
reference it.

Focus on business behavior only — these are platform-level policy/requirement statements,
not implementation.

Include:
- User stories
- Functional requirements: the admin dashboard must reflect locker status changes, rental
  start/finish, and station health changes live, without requiring a page refresh; the
  platform commits to a stable, documented v1 API contract as the foundation for a future
  mobile client, with an explicit policy for what counts as a breaking change
- Business rules
- Acceptance criteria
- Error scenarios (real-time connection drop and recovery)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- WebSocket protocol/library details
- OpenAPI generation tooling details
