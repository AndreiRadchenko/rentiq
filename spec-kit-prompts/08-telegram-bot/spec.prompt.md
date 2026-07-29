Create a functional specification for the Telegram Bot capability of rentiq.

Use docs/architecture/greenfield-architecture.md only as context — see ADR-004 (bot as
separate deployable REST client) and ADR-006 (bot does not translate domain content). Do
not restate them; reference them.

Focus on business behavior only — describe the bot purely as a rental interface from the
renter's point of view.

Include:
- User stories: registration, booking (choose station → choose lockers → choose duration
  → receive pay link), finish-rental (submit photo → confirm door closed), filing a
  support request, viewing my rentals
- Functional requirements: the bot must behave as a thin client — no direct database
  access, no business-rule evaluation, no payment or fiscal processing, no direct smart-
  lock calls, no legacy SQLite dependency; all business content shown to the renter
  (prices, times, error messages) arrives pre-translated from the backend in the renter's
  locale; the bot's own UI-chrome strings (button labels, screen structure) may be
  bot-managed; conversation state must survive a bot process restart without losing the
  renter's place in a flow
- Business rules
- Acceptance criteria
- Error scenarios (backend unreachable mid-flow, bot restart mid-flow)
- Non-functional requirements
- Open questions

Exclude:
- Python/aiogram implementation details
- REST endpoint paths
- Redis/FSM storage configuration
