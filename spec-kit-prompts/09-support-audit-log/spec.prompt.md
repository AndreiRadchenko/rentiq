Create a functional specification for the Support + Audit Log capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-11.1, BR-11.2, BR-12.1, BR-12.2, BR-12.3, BR-12.6, BR-12.7. Do not
restate them; reference them.

Focus on business behavior only.

Include:
- User stories
- Functional requirements: a renter can file a free-text problem report at any time,
  optionally linked to a specific rental and optionally with a photo, with no booking
  required; an open report can be resolved by any admin with at least station-operator
  privilege for the affected station; every sensitive admin action (manual locker
  open/close, force-close or cancel a rental, write off a surcharge, create/disable an
  admin account, change organization branding or rotate credentials) must be recorded in
  an audit trail attributing the action to a specific admin, with a mandatory reason where
  the action is destructive or financial; the audit trail is append-only and never
  hard-deleted before its minimum retention period
- Business rules
- Acceptance criteria
- Error scenarios (an admin attempting to view/resolve a report or audit entry outside
  their permitted scope)
- Non-functional requirements
- Open questions, including: confirm the Ukrainian legal minimum retention period for
  audit/fiscal-adjacent records (BR-12.7)

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Decorator/interceptor implementation details
