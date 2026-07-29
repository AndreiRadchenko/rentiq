Create an implementation plan for the Telegram Bot specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.14 telegram-bot, ADR-004, ADR-006)
and docs/roadmap/implementation-roadmap.md (Phase 8 — Telegram Bot: approach, the legacy
removal/retention table, module layout, and exit criteria).

Preserve module boundaries: the bot is not a NestJS module — it is a separate deployable
process communicating with apps/api exclusively via the public REST API.

Include:
- Architecture impact
- Required structure: apps/telegram-bot/ with flows/ (registration, booking,
  finish_rental, support, my_rentals), api_client/ (auth, rentals, locations, media, base
  httpx async client with JWT attach and error handling), session/ (Redis-backed aiogram
  FSM storage), i18n/ (uk.json, en.json — UI-only strings), bot.py
- Domain model: none — conversation FSM state only, no domain aggregates
- Database changes: none — the bot has no direct database access
- APIs consumed: POST /auth/telegram/exchange, the rentals/locations/media endpoints
  defined in prior specs
- Events: none — the bot neither publishes nor subscribes to domain events
- Background jobs: none in the bot; reuse backend BullMQ/Cron jobs already delivered in
  prior phases
- Testing strategy: reproduce the roadmap's legacy-removal table as an explicit checklist
  (what is ported vs. stripped from suppoint-bot); a real Telegram user completes a full
  rental end-to-end through the stripped bot with no direct DB connection in the bot
  process; verify FSM state survives a bot restart via Redis
- Risks: separate Telegram bot tokens are required per environment before this phase
  begins (@rentiqprodbot, @rentiqstagebot)
- Migration considerations: port FSM and photo-handling logic from
  handlers/finishRent.py and handlers/rent.py; do not port handlers/start.py (admin panel,
  replaced by apps/admin-panel); port ECDSA/shift-management reference logic from
  services/payments/*.py into the backend gateways (owned by 06-payments), not the bot
- Task breakdown matching Phase 8's exit criteria

Do not generate production code.
