Create a functional specification for the Notifications + i18n capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-13.1 through BR-13.4 and BR-14.1 through BR-14.4. Do not restate them;
reference them.

Focus on business behavior only.

Include:
- User stories
- Functional requirements: only this capability is ever allowed to push a message to a
  renter or admin — all notifications are triggered by domain events, no other module
  calls a push channel directly; every notification is delivered in the recipient's own
  stored locale (renter or admin); the delivery mechanism is abstracted so that new
  channels (mobile push, email, SMS) can be added later without changing notification
  logic, with Telegram as the only active channel in v1; an org admin can send a manual
  broadcast to all renters in their organization; locale is resolved in order — the user's
  own stored locale, then the organization's default locale, then a system default
- Business rules
- Acceptance criteria, including full translation coverage for: rental lifecycle messages
  (reservation confirmed, pay link, ready for pickup, overtime warning, overtime started,
  finish confirmed, surcharge required, surcharge reminders), payment messages (payment
  link, receipt delivered, fiscalization deferred, failed), admin alerts (station offline,
  unauthorized door, unverified finish, fiscal failure), and renter-facing error messages
  (locker unavailable, unpaid surcharge blocks booking, maintenance window active, door
  open at finish)
- Error scenarios (channel delivery failure)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Translation file format/library choice
