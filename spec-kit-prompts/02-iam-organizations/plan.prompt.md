Create an implementation plan for the IAM + Organizations specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.3 iam, §4.4 organizations) and
docs/roadmap/implementation-roadmap.md (Phase 2 — IAM + Organizations deliverables and
exit criteria).

Preserve module boundaries: iam and organizations are separate modules; organizations
depends on iam only through its public application-service interface.

Include:
- Architecture impact
- Required modules: iam, organizations
- Domain model: AdminAccount aggregate (id, orgId nullable, email, passwordHash, role,
  assignedStationIds, locale, status); Renter aggregate (id, orgId, telegramId nullable,
  phone, name, consentGivenAt, locale, status); Organization aggregate with
  BrandingConfig, PaymentGatewayCredentialsRef, TelegramBotConfig, MaintenanceWindow,
  CheckboxConfig value objects
- Database changes: organizations, admin_accounts, renters tables
- APIs: POST /auth/login, POST /auth/refresh, POST /auth/telegram/exchange,
  POST /renters/register, GET /renters/me, POST /organizations,
  PATCH /organizations/:id/branding, POST /organizations/:id/maintenance-window
- Events: RenterRegistered, AdminAccountCreated, AdminAccountDisabled,
  OrganizationCreated, OrganizationSuspended, OrganizationBrandingChanged
- Background jobs: none
- Testing strategy: unit tests for AuthService (JWT RS256, 15-min access / 7-day refresh),
  RenterService, AdminAccountService; integration test for the full login → create-org →
  register-renter → telegram-exchange flow
- Risks
- Migration considerations: none (greenfield); seed one SUPER_ADMIN and one organization
  ("rentiq-dev", slug "rentiq") for local development
- Task breakdown matching Phase 2's exit criteria (admin logs in via Postman, receives
  JWT, creates a second organization; renter registers and receives a renter JWT via the
  exchange endpoint), including nestjs-i18n locale-resolution middleware wiring

Do not generate production code.
