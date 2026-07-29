Create a project constitution for rentiq, a greenfield multi-tenant SaaS platform for
time-based rental of physical equipment stored in smart lockers (v1 domain: SUP board
rental in Ukraine).

The constitution should define permanent engineering principles rather than
implementation details for any specific feature.

Use these constraints:

- NestJS Modular Monolith: one deployable process, 12+ internal modules, each following
  Clean Architecture layering (domain / application / infrastructure / interface).
- Hexagonal Architecture: external systems (Home Assistant, Monobank, Checkbox, MinIO,
  Telegram) are only ever accessed through named ports (SmartLockGateway, PaymentGateway,
  FiscalGateway, ObjectStorageGateway, NotificationChannel), never called directly from
  domain or application code.
- Domain-Driven Design: aggregates, entities, value objects, domain events, domain
  services. Money is always a Money(amountMinor, currency) value object — integer minor
  units, never float or text.
- Event-driven module communication: modules publish/subscribe domain events for side
  effects across module boundaries; synchronous calls are allowed only through another
  module's public application-service interface, never its repository or domain layer.
- Strong module boundaries mechanically enforced (Nx enforce-module-boundaries): no module
  imports another module's domain/ or infrastructure/ layer; no module reads another
  module's database tables directly.
- Multi-tenancy from day one: every business table carries org_id; a TenantContext
  (AsyncLocalStorage) propagates the current org from the JWT through every repository
  call automatically.
- PostgreSQL + Drizzle ORM only. No direct SQL outside repositories. Migrations generated
  via drizzle-kit and committed to git; never hand-edited.
- Telegram Bot is a separate deployable process and a REST client only — no direct
  database access, no business logic, no payment or fiscal calls, no HA calls.
- No business logic in controllers. Domain layer has zero framework (NestJS) dependencies.
  Application layer coordinates use cases; infrastructure implements ports.
- Backend-managed internationalization: all user-facing business messages (errors,
  notifications, status text) are returned by the API in the caller's locale (uk primary,
  en secondary). Client apps (bot, admin panel) own only their own UI-chrome strings.
- Security by default: JWT (RS256) auth, role-based access control (SUPER_ADMIN,
  ORG_ADMIN, STATION_OPERATOR), tenant isolation enforced at the data-access layer, an
  append-only audit log for sensitive admin actions.
- Financial and audit data integrity: payment_transactions, fiscal_receipts,
  audit_log_entries, rental_status_history are append-only / status-transition-only —
  never hard-deleted, retained a minimum of 1 year.
- Testability first: domain logic requires unit tests; APIs require integration tests;
  external provider integrations (Monobank, Checkbox, Home Assistant) require contract
  tests against a mock/sandbox.
- Incremental development: the system is built and demoed phase by phase (see
  docs/roadmap/implementation-roadmap.md); every phase ends in a working, if incomplete,
  system — no big-bang integration.
- ADRs required for any architectural change (new module, new cross-module dependency,
  new external integration pattern). Public API documented with OpenAPI.

Do not mention rentals, reservations, payments, or any other specific feature by name.
