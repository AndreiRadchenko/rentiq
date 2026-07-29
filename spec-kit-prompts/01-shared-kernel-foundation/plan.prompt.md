Create an implementation plan for the Shared Kernel + Foundation specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.2 shared-kernel, ADR-002,
ADR-012) and docs/roadmap/implementation-roadmap.md (Phase 1 — Shared Kernel + Foundation
deliverables and exit criteria).

Preserve module boundaries: shared-kernel must never contain business logic; every other
module depends on it, it depends on nothing else.

Include:
- Architecture impact
- Required modules: shared-kernel NestJS module
- Domain model: Money(amountMinor, currency) VO with add/subtract/equals; EntityId<T>
  (UUID wrapper), OrgId, PhoneNumber, Locale VOs; DomainEvent abstract base class +
  EventBus port with in-process EventBusImpl (@nestjs/event-emitter); TenantContext
  (AsyncLocalStorage-based) + TenantMiddleware reading orgId from JWT; Result<T, E>
  utility; @AuditableAction(action: string) decorator stub (interceptor wired in a later
  phase); ApiError envelope type + global exception filter; pagination request/response
  DTOs
- Database changes: Drizzle database connection module with Zod-validated config
- APIs: GET /health returning { status, db, redis }
- Events: none published yet — EventBus infrastructure only
- Background jobs: none
- Testing strategy: unit tests for Money arithmetic, TenantContext propagation, Result
  helper; integration test that a broken .env fails startup
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 1's exit criteria (GET /api/v1/health returns 200; Zod
  validation rejects an intentionally broken .env)

Do not generate production code.
