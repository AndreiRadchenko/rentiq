Create an implementation plan for the WebSockets + Mobile Readiness specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md and
docs/roadmap/implementation-roadmap.md (Phase 12 — WebSockets + Mobile Readiness
deliverables). Note explicitly in the plan: this is not a rearchitecture — the event bus
and REST API contracts already support it.

Preserve module boundaries: the WebSocket gateway subscribes to existing domain events
only — it introduces no new cross-module dependencies.

Include:
- Architecture impact
- Required work: WebSocket gateway on apps/api (/ws/admin) subscribing to
  LockerStatusChanged, RentalStarted, RentalFinished, StationHealthChanged, pushing to
  connected admin clients scoped by orgId
- Domain model: none new
- Database changes: none
- APIs: OpenAPI spec generated and published (apps/api → openapi.json) as the contract
  document for a future mobile app SDK
- Events subscribed: LockerStatusChanged, RentalStarted, RentalFinished,
  StationHealthChanged
- Background jobs: none
- Testing strategy: admin panel connects to the WebSocket and rental counts/locker status
  badges update live without a page refresh; API versioning review confirming the v1
  contract is stable, with a documented breaking-change policy
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 12's deliverables

Do not generate production code.
