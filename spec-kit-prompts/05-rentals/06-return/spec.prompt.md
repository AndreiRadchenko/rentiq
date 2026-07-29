Create a functional specification for the Return capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-09.1, BR-09.2, BR-09.3. Do not restate them; reference them.

Focus on business behavior only. Scope: the physical act of finishing a rental — photo
submission and door-sensor verification. Explicitly out of scope: overtime/surcharge
computation (spec-kit-prompts/05-rentals/07-overtime, 08-surcharge).

Include:
- User stories
- Functional requirements: to complete a rental, the renter must submit a photo of the
  returned equipment inside its locker, stored permanently and viewable by admins; the
  system verifies the door-closed state via the physical door sensor for each locker in
  the rental before accepting the finish, and must not mark the rental finished while any
  locker's door sensor reports open; if the door-sensor check is unavailable (e.g. the
  controller is offline), the system accepts the finish anyway with an unverified flag,
  immediately notifies admins, and the rental still completes
- Business rules
- Acceptance criteria
- Error scenarios (door sensor reports open, controller unreachable)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- Home Assistant protocol details
