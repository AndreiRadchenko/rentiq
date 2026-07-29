<!--
Sync Impact Report
==================
Version change: (unratified template) → 1.0.0
Rationale for MAJOR (1.0.0 initial): first concrete ratification of the project
constitution — all placeholder tokens replaced with substantive, testable principles.

Modified principles: N/A (initial ratification; no prior concrete version existed)

Added sections:
- Core Principles I–X (Modular Monolith with Enforced Clean Layering; Hexagonal
  Isolation via Named Ports; Domain-Driven Modeling & Money Integrity; Event-Driven
  Cross-Module Communication; Mechanically Enforced Module Boundaries; Multi-Tenant
  Isolation by Default; Sole Persistence Path: PostgreSQL + Drizzle; Process-Isolated,
  Thin Client Surfaces; Backend-Owned Internationalization; Security and Data Integrity
  by Default)
- Quality & Verification Standards (Section 2)
- Delivery Workflow (Section 3)
- Governance (amendment procedure, versioning policy, compliance review)

Removed sections: none

Templates requiring updates:
- .specify/templates/plan-template.md — ✅ no changes required (Constitution Check
  gate is already generic/dynamic: "[Gates determined based on constitution file]")
- .specify/templates/spec-template.md — ✅ no changes required (feature-agnostic;
  no principle-specific mandatory sections introduced that aren't already covered by
  Functional Requirements / Key Entities / Success Criteria structure)
- .specify/templates/tasks-template.md — ✅ no changes required (task categorization
  by user story remains compatible; testability principle already supported by the
  optional Tests phase per story)
- .opencode/commands/speckit.*.md — ✅ reviewed, no outdated agent-specific
  references found requiring changes

Follow-up TODOs: none — no placeholders were deferred.
-->

# Rentiq Constitution

## Core Principles

### I. Modular Monolith with Enforced Clean Layering

The system MUST ship as a single deployable NestJS process composed of 12 or more
internal modules; splitting modules into separate services is out of scope until an
ADR justifies it. Every module MUST be internally layered as domain / application /
infrastructure / interface. The domain layer MUST have zero framework (NestJS)
dependencies. The application layer MUST coordinate use cases and depend only on the
domain layer and named ports. Infrastructure MUST implement ports/adapters; nothing
outside infrastructure may depend on adapter internals. The interface layer
(controllers) MUST contain no business logic — it only translates transport concerns
into calls on application services.

Rationale: this preserves the option to extract any module into its own service later
without a rewrite, and keeps business rules testable independent of the web framework.

### II. Hexagonal Isolation via Named Ports

Domain and application code MUST NOT call any external system directly. All access to
smart-lock control, payment processing, fiscal receipt issuance, object storage, or
outbound notification delivery MUST go through a named port interface owned by the
consuming module: `SmartLockGateway`, `PaymentGateway`, `FiscalGateway`,
`ObjectStorageGateway`, `NotificationChannel`. Concrete adapters for each external
system live only in infrastructure and MUST be swappable without touching domain or
application code.

Rationale: keeps business logic testable without live external dependencies and
isolates the blast radius of third-party API and protocol changes to one adapter.

### III. Domain-Driven Modeling & Money Integrity

Business state MUST be modeled with aggregates, entities, value objects, domain
events, and domain services — never as anemic DTOs manipulated entirely by external
services. Every monetary amount MUST be represented as a `Money(amountMinor,
currency)` value object using integer minor units. Floats and free-text
representations of money are forbidden anywhere in domain code, application code, or
persisted schema, with no exceptions.

Rationale: prevents an entire class of rounding and precision defects and keeps
business rules colocated with the data they govern rather than scattered across
services.

### IV. Event-Driven Cross-Module Communication

Side effects that cross module boundaries MUST be triggered by publishing and
subscribing to domain events, not by direct invocation between modules. The only
synchronous cross-module call permitted is through another module's public
application-service interface. Calling another module's repository or domain layer
directly is forbidden, with no exceptions.

Rationale: keeps modules independently deployable and extractable, and prevents
hidden coupling through another module's internal implementation details.

### V. Mechanically Enforced Module Boundaries

Module boundaries MUST be enforced by tooling (Nx `enforce-module-boundaries` or an
equivalent lint rule), not by convention or code review alone. The build MUST fail if
a module imports another module's `domain/` or `infrastructure/` layer, or if a
module's repository queries a database table owned by another module.

Rationale: manual review cannot reliably catch boundary violations at scale; the
constraint must be a compile/lint-time gate, not a social norm.

### VI. Multi-Tenant Isolation by Default

Every business table MUST carry an `org_id` column from its first migration — tenancy
is never retrofitted onto an existing table. A `TenantContext` (`AsyncLocalStorage`)
MUST be populated from the authenticated JWT at the start of every request and MUST be
the sole source every repository call uses to scope `org_id` filtering. Handlers and
services MUST NOT pass `org_id` as an ad hoc parameter or rely on caller discipline.

Rationale: centralizing tenant scoping in one propagation mechanism removes an entire
category of cross-tenant data-leak bugs that recur whenever each call site is
individually responsible for filtering.

### VII. Sole Persistence Path: PostgreSQL + Drizzle

PostgreSQL accessed exclusively through Drizzle ORM is the only persistence mechanism.
Raw or direct SQL outside a repository is forbidden. Schema changes MUST be expressed
as `drizzle-kit`-generated migrations committed to git. Hand-edited migrations are
forbidden; a migration that no longer matches its generated diff MUST be regenerated,
not patched.

Rationale: a single generated migration history is the only reliable way to guarantee
schema and code never drift apart silently.

### VIII. Process-Isolated, Thin Client Surfaces

Any bot or chat-based client (e.g., the Telegram bot) MUST run as its own deployable
process and MUST act purely as a REST client of the core API. Such clients MUST NOT
hold direct database access, MUST NOT contain business logic, and MUST NOT call any
external gateway (payment, fiscal, smart-lock, or otherwise) directly — every such
call is proxied through the core API.

Rationale: keeps the trust boundary and business logic in exactly one place, so client
surfaces can be added, replaced, or scaled independently without touching invariants.

### IX. Backend-Owned Internationalization

All user-facing business messages — errors, notifications, status text — MUST be
produced by the API in the caller's locale, with Ukrainian (`uk`) as the primary
locale and English (`en`) as secondary. Client applications (bot, admin panel, or any
future client) own only their own UI-chrome strings (button labels, static screen
text); they MUST NOT hardcode or re-implement translation of business messages.

Rationale: keeps a single source of truth for business terminology and prevents
divergent, inconsistent translations from accumulating across clients.

### X. Security and Data Integrity by Default

Authentication MUST use JWT signed with RS256. Authorization MUST be role-based across
at minimum `SUPER_ADMIN`, `ORG_ADMIN`, and `STATION_OPERATOR`. Tenant isolation MUST be
enforced at the data-access layer (Principle VI), not only in application-level
checks. Sensitive administrative actions MUST be recorded in an append-only audit log.
Tables holding financial transactions, fiscal documents, audit entries, or
status-transition history MUST be append-only or status-transition-only — hard deletes
are forbidden — and MUST be retained for a minimum of one year.

Rationale: security and financial/audit integrity are not features to bolt on later;
retrofitting them after real data exists is unsafe and often impossible.

## Quality & Verification Standards

Domain logic MUST have unit test coverage — it is the cheapest layer to test and the
most damaging to leave untested. Every public API endpoint MUST have integration test
coverage. Every external provider integration (smart-lock, payment, fiscal, or any
future gateway) MUST have contract tests run against a mock or sandbox, never
validated only against production credentials. The public API MUST be documented with
OpenAPI, kept current as part of the same change that alters the endpoint, not as a
deferred follow-up. Any architectural change — a new module, a new cross-module
dependency, or a new external integration pattern — MUST be recorded as an ADR before
or alongside the change that introduces it.

## Delivery Workflow

The system MUST be built and demoed phase by phase, per the phase plan in
`docs/roadmap/implementation-roadmap.md`. Phase order encodes real dependencies and
MUST NOT be reordered without an ADR explaining why. Every phase MUST end in a
working system, even if functionally incomplete — big-bang integration (merging
multiple phases' work without an intermediate working state) is forbidden.

## Governance

This constitution supersedes any other engineering guidance in this repository. Where
this document conflicts with other repository docs on matters of engineering practice,
this constitution wins; `docs/architecture/greenfield-architecture.md` and
`docs/domain/business-rules.md` remain the source of truth for business/domain and
architectural-decision content, per `AGENTS.md`.

Amendments require: (1) a written proposal describing the change and its rationale;
(2) updating this file only through the `/speckit.constitution` command, never by
hand-editing outside that workflow; (3) a version bump following semantic versioning —
MAJOR for backward-incompatible removal or redefinition of a principle, MINOR for a
new principle or materially expanded guidance, PATCH for clarification or wording
fixes; and (4) a propagation check against `.specify/templates/plan-template.md`,
`.specify/templates/spec-template.md`, `.specify/templates/tasks-template.md`, and this
repository's Spec Kit command files.

Every spec, plan, and task list produced via the Spec Kit workflow MUST pass a
Constitution Check gate; any violation MUST either be justified in that artifact's
Complexity Tracking section or the artifact MUST be revised to comply. Compliance is
reviewed at each phase boundary (see the exit criteria in
`docs/roadmap/implementation-roadmap.md`) in addition to per-pull-request review.

**Version**: 1.0.0 | **Ratified**: 2026-07-29 | **Last Amended**: 2026-07-29
</content>
