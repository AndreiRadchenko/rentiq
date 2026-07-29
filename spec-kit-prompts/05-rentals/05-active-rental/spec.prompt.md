Create a functional specification for the Active Rental capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-08.4, BR-08.5, BR-08.6. Do not restate them; reference them.

Focus on business behavior only. Scope: the live duration countdown and renter visibility
while a rental is active or awaiting pickup.

Include:
- User stories
- Functional requirements: while a rental is active, the renter receives a notification
  when exactly 5 minutes of paid duration remain; when the paid duration fully elapses,
  the renter receives a notification that overtime charges are now accumulating; a renter
  can view all of their currently active or awaiting-pickup rentals at any time, including
  time remaining or accumulated overtime, live
- Business rules
- Acceptance criteria
- Error scenarios
- Non-functional requirements (timing precision of the warning/overtime notifications)
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Event names
