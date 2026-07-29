Create an implementation plan for the Multi-Tenant Hardening specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (ADR-012 — row-level multi-tenancy)
and docs/roadmap/implementation-roadmap.md (Phase 11 — Multi-Tenant Hardening
deliverables and exit criteria).

Preserve module boundaries: this phase adds tests and, optionally, database-level
policies — it does not introduce new business modules.

Include:
- Architecture impact
- Required work: onboard a second real or test organization via the admin panel
- Domain model: none new
- Database changes: none required by default; evaluate Postgres Row-Level Security
  policies keyed on the JWT-derived tenant context, to be applied without schema changes
  if a second organization has contractual data-isolation requirements
- APIs: none new
- Events: none new
- Background jobs: none new
- Testing strategy: build the cross-tenant isolation automated e2e test suite exactly as
  listed in Phase 11 — GET /rentals/active for a renter of org A returns zero results for
  org B's rentals; GET /analytics/summary for an admin of org A shows only org A's
  revenue; GET /audit-log for an admin of org A returns no entries from org B; a webhook
  for org A's payment does not advance org B's rental; confirm auth/telegram/exchange
  rejects a renter presenting org A's bot secret against an org B renter
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 11's exit criteria (cross-tenant test suite passes in CI
  with two organizations active)

Do not generate production code.
