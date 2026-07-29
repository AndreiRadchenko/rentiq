Create a functional specification for the Payments (Monobank + Checkbox) capability of
rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-06.1 through BR-06.5 and BR-07.1 through BR-07.6. Do not restate them;
reference them.

Focus on business behavior only.

Include:
- User stories
- Functional requirements: payment confirmation is fully automatic, driven by the
  gateway's signed webhook, with periodic reconciliation as a fallback for lost or delayed
  webhooks — no manual admin approval step; every inbound webhook must be cryptographically
  verified before any business effect is applied, and a webhook that fails verification is
  rejected and logged; payment status changes are idempotent — a duplicate notification
  never double-applies effects, and a terminal state is never silently overwritten by a
  stale late-arriving failure, though a previously-failed attempt may be superseded by a
  later success on the same checkout link; every successful payment (initial and
  surcharge top-up) must produce a fiscal receipt, a legal requirement independent of
  whether the renter requests one; fiscal issuance is asynchronous and must never delay
  the renter receiving locker access confirmation; the fiscal cashier-shift lifecycle is
  automatically managed around the organization's maintenance window with no manual daily
  admin action; recoverable fiscal failures are retried automatically within a bounded
  window, after which the failure is escalated to admins; the renter automatically
  receives their fiscal receipt link as soon as it is confirmed
- Business rules
- Acceptance criteria
- Error scenarios (duplicate webhook delivery, gateway unreachable, verification failure)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Monobank/Checkbox protocol/signature details
