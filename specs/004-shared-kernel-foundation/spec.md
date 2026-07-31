# Feature Specification: Shared Kernel + Foundation

**Feature Branch**: `004-shared-kernel-foundation`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Create a functional specification for the Shared Kernel + Foundation capability of rentiq. Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as context — see ADR-002 (money as integer minor units) and ADR-012 (org_id on every table + TenantContext). Do not restate them; reference them. Focus on business behavior only. Frame this as the set of platform-wide guarantees every later capability depends on, not as a technical component list."

## Context

This capability corresponds to Phase 1 of the implementation roadmap (`docs/roadmap/implementation-roadmap.md`, "Phase 1 — Shared Kernel + Foundation"). It is the architectural skeleton that every subsequent module will build upon. While the deliverables are technical in nature, this spec focuses exclusively on the **business guarantees** that this foundation must uphold — the invariants that all later capabilities rely on, and that must be correct from day one.

The money-as-integer-minor-units decision (ADR-002) and the org_id-on-every-table multi-tenancy model (ADR-012) are already made and are not re-litigated here. This spec defines the observable behavior those decisions must produce in practice.

## User Scenarios & Testing *(mandatory)*

<!--
  "Users" in this phase are the platform itself and the later capabilities that will
  build on these guarantees. The scenarios are framed as platform-wide invariants that
  must hold true regardless of which capability is active.
-->

### User Story 1 - Every request is scoped to exactly one organization (Priority: P1)

The platform guarantees that every request processed by the system belongs to exactly one organization, and that the organization's identity is carried reliably through the entire request lifecycle. No request can accidentally see, modify, or affect data belonging to a different organization — this isolation is automatic, not dependent on individual developers remembering to filter.

**Why this priority**: Multi-tenant data isolation is the single most critical invariant. If this guarantee fails, the platform cannot safely serve multiple organizations — which is its core value proposition. Every later capability depends on this being correct by construction.

**Independent Test**: Can be fully tested by making a request as Organization A and verifying that Organization A's context is correctly propagated; then attempting to access Organization B's data within the same request context and confirming it is inaccessible — regardless of what code path is taken.

**Acceptance Scenarios**:

1. **Given** a request arrives with a valid token identifying Organization A, **When** any repository or data-access operation executes within that request, **Then** the operation is automatically filtered to Organization A's data — no explicit per-query filtering is required from the calling code.
2. **Given** a request arrives with a valid token identifying Organization A, **When** code attempts to explicitly pass a different organization identifier to a data-access operation, **Then** the system ignores the explicit identifier and uses the organization from the request context instead.
3. **Given** two concurrent requests arrive — one for Organization A and one for Organization B, **When** they execute simultaneously, **Then** neither request can observe or modify the other's data, even if they touch the same database tables.
4. **Given** a request arrives without any organization context, **When** any data-access operation is attempted, **Then** the system refuses to proceed and returns an error rather than operating on unscoped data.

---

### User Story 2 - All monetary values are exact and carry explicit currency (Priority: P1)

The platform guarantees that every monetary value stored, calculated, or transmitted is represented as an integer number of minor units (e.g., 1000 = ₴10.00) paired with an explicit currency code. No monetary value can ever be a floating-point number, and no monetary value can exist without a currency.

**Why this priority**: Financial accuracy is a trust requirement. Rounding errors or missing currencies in any calculation — pricing, payments, refunds, surcharges — would directly cause monetary loss or legal non-compliance. This guarantee must be structural, not a convention developers remember to follow.

**Independent Test**: Can be fully tested by creating a monetary value, performing arithmetic operations (addition, subtraction, comparison), and verifying that every intermediate and final result remains an integer with an explicit currency — with no floating-point representation appearing at any point.

**Acceptance Scenarios**:

1. **Given** a monetary amount of 1000 minor units in UAH, **When** an addition of 500 minor units in UAH is performed, **Then** the result is exactly 1500 minor units in UAH — no rounding, no precision loss.
2. **Given** a monetary amount of 1000 minor units in UAH, **When** a subtraction of 300 minor units in UAH is performed, **Then** the result is exactly 700 minor units in UAH — no rounding, no precision loss.
3. **Given** two monetary amounts in different currencies (e.g., 1000 UAH and 500 USD), **When** a direct comparison or arithmetic operation is attempted, **Then** the system refuses the operation and reports a currency mismatch — it never silently converts or mixes currencies.
4. **Given** a monetary amount is constructed without a currency, **When** validation occurs, **Then** the system rejects the value as incomplete — a monetary amount without a currency is never accepted anywhere in the system.

---

### User Story 3 - The application refuses to start with invalid or missing configuration (Priority: P1)

The platform guarantees that the application will not start unless every required configuration value is present and valid. If any configuration is missing, malformed, or invalid, the application fails immediately with a clear error identifying exactly what is wrong — it never starts in a partially-configured or silently-degraded state.

**Why this priority**: A silently-degraded startup creates hidden failures that only manifest at runtime, often in production, often under load. Fail-fast startup is the only reliable way to catch configuration problems before they cause user-visible harm.

**Independent Test**: Can be fully tested by removing or corrupting a single required configuration value and confirming the application fails to start with a clear error message identifying the specific problem — then fixing that value and confirming successful startup.

**Acceptance Scenarios**:

1. **Given** a required configuration value (e.g., database connection string) is missing from the environment, **When** the application attempts to start, **Then** it fails immediately with an error message identifying the missing value.
2. **Given** a required configuration value is present but malformed (e.g., a non-numeric value where a number is expected), **When** the application attempts to start, **Then** it fails immediately with an error message identifying the invalid value and its expected format.
3. **Given** all required configuration values are present and valid, **When** the application starts, **Then** it begins accepting traffic normally — no deferred or lazy configuration validation occurs later.
4. **Given** an optional configuration value is missing, **When** the application starts, **Then** it uses a documented default value and starts successfully — optional values do not block startup.

---

### User Story 4 - The system exposes a health signal covering itself and its dependencies (Priority: P2)

The platform guarantees that a health check is available that reports the system's own readiness and the status of its critical dependencies (database, cache). Consumers of the platform (load balancers, monitoring systems, operators) can query this endpoint at any time to determine whether the system is healthy, degraded, or unavailable.

**Why this priority**: Health visibility is essential for operational confidence, but it depends on the foundation being built first (database connection, cache connection). It is lower priority than the isolation and monetary guarantees but higher than API shape consistency.

**Independent Test**: Can be fully tested by querying the health endpoint when all dependencies are available (expecting healthy status), then simulating a database outage and confirming the health endpoint reports the degraded status.

**Acceptance Scenarios**:

1. **Given** the application is running and all dependencies (database, cache) are reachable, **When** the health endpoint is queried, **Then** the response indicates a healthy status for all components.
2. **Given** the application is running but the database is unreachable, **When** the health endpoint is queried, **Then** the response indicates an unhealthy status specifically for the database component — the overall status reflects the degradation.
3. **Given** the application is running but the cache is unreachable, **When** the health endpoint is queried, **Then** the response indicates an unhealthy status specifically for the cache component — the overall status reflects the degradation.
4. **Given** the application is in the process of starting up, **When** the health endpoint is queried before startup completes, **Then** the response indicates that the system is not yet ready to serve traffic.

---

### User Story 5 - Error and pagination responses are consistent across the entire API (Priority: P2)

The platform guarantees that every error response and every paginated response follows a consistent, predictable shape across the entire API. Consumers never encounter a new error format when calling a different endpoint — the contract is uniform.

**Why this priority**: Consistent response shapes reduce integration friction for all consumers (Telegram bot, admin panel, future clients). It is lower priority than the core isolation and financial guarantees because it affects usability, not correctness.

**Independent Test**: Can be fully tested by triggering errors on multiple different endpoints and verifying they all return the same response structure; then paginating through multiple different list endpoints and verifying they all return the same pagination structure.

**Acceptance Scenarios**:

1. **Given** any request that results in a validation error, **When** the error response is returned, **Then** it follows a uniform structure containing at minimum an error code, a human-readable message, and the request context — regardless of which endpoint produced the error.
2. **Given** any request that results in a not-found error, **When** the error response is returned, **Then** it follows the same uniform error structure as validation errors.
3. **Given** any request that results in a server error, **When** the error response is returned, **Then** it follows the same uniform error structure — internal implementation details (stack traces, database errors) are never exposed to the caller.
4. **Given** any endpoint that returns a list of items, **When** the response includes pagination, **Then** the pagination follows a uniform structure containing the items, total count, current page, and page size — regardless of which endpoint is being called.

---

### Edge Cases (Error Scenarios)

- **TenantContext propagation failure**: If the request context loses its organization identifier midway through processing (e.g., due to an unhandled async boundary), the system must fail the request rather than proceeding with unscoped data access.
- **Currency mismatch in aggregation**: When aggregating monetary amounts from multiple records (e.g., total revenue), if any record has a different currency than the others, the aggregation must fail with a clear error rather than silently mixing currencies or converting at an arbitrary rate.
- **Configuration validation race**: If a configuration value changes while the application is running (e.g., a secret rotation), the application must not crash — but it must not silently accept invalid state either. Configuration is validated at startup; runtime re-validation is out of scope for this phase.
- **Health endpoint under partial dependency failure**: If only one of several dependencies is down, the health endpoint must report the specific failing component while still responding — it must not fail entirely because one dependency is unavailable.
- **Error response for unknown error types**: If an error occurs that does not match any known error category, the system must return a generic server error in the same uniform shape rather than a raw/unformatted response.
- **Unsupported currency code**: If a monetary value is constructed with a currency code other than `UAH` or `EUR`, the system must reject it during validation with a clear error — it must never accept, store, or process an unrecognized currency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every request processed by the system MUST be scoped to exactly one organization via a request-level context that is populated from the authenticated token and propagated automatically to all data-access operations — individual code paths MUST NOT pass organization identifiers manually.
- **FR-002**: The system MUST refuse to process any data-access operation that has no organization context — unscoped data access is never permitted under any circumstance.
- **FR-003**: Organization context MUST be the sole mechanism for scoping data access; the system MUST ignore any explicitly-passed organization identifier that differs from the one in the request context.
- **FR-004**: All monetary values MUST be represented as integer minor units (e.g., 1000 = ₴10.00) with an explicit currency code — floating-point representations of money are forbidden at every layer (storage, calculation, transmission).
- **FR-004a**: The system MUST accept only `UAH` and `EUR` as valid currency codes. Any monetary value constructed with a currency code outside this set MUST be rejected by validation.
- **FR-005**: Arithmetic operations on monetary values MUST preserve exact integer precision — no rounding, no truncation, no precision loss at any intermediate step.
- **FR-006**: The system MUST refuse monetary operations where the two operands have different currencies — cross-currency arithmetic is never silently performed; an explicit conversion step with a defined exchange rate is required.
- **FR-007**: A monetary value constructed without a currency MUST be rejected by validation — the currency is a mandatory part of every monetary value.
- **FR-008**: At process startup, the system MUST validate that every required configuration value is present and well-formed before accepting any traffic.
- **FR-009**: If any required configuration value is missing or malformed at startup, the system MUST fail to start immediately with a clear error identifying the specific problem — it MUST NOT start in a degraded, partially-configured, or silently-defaulted state.
- **FR-010**: Optional configuration values MUST have documented defaults and MUST NOT block startup when absent.
- **FR-011**: The system MUST expose a health check that reports its own readiness status and the status of its critical dependencies (database, cache).
- **FR-012**: The health check MUST report per-dependency status (healthy/unhealthy for each dependency) and an overall status that reflects the worst component status.
- **FR-013**: The health check MUST respond even when the system is not fully ready (e.g., during startup or when dependencies are down) — it MUST NOT itself fail or hang.
- **FR-014**: All error responses across the entire API MUST follow a uniform structure containing at minimum: an error code, a human-readable message, and the request context.
- **FR-015**: All paginated list responses across the entire API MUST follow a uniform structure containing at minimum: the list of items, total count, current page number, and page size.
- **FR-016**: Error responses MUST NOT expose internal implementation details (stack traces, database error messages, internal identifiers) to the caller.
- **FR-017**: The system MUST support user-facing messages in multiple locales, with Ukrainian (`uk`) as the primary locale and English (`en`) as secondary — error messages returned by the health check and error envelope MUST be localizable.

### Non-Functional Requirements

- **NFR-001 (Fail-fast over degrade)**: The system MUST always prefer failing fast and loudly (refusing to start, rejecting a request) over continuing in a degraded, partially-functional, or silently-misconfigured state.
- **NFR-002 (Tenant isolation by construction)**: Tenant isolation MUST be enforced by the propagation mechanism itself, not by individual developers remembering to apply filters — the guarantee is structural, not behavioral.
- **NFR-003 (Financial precision)**: Monetary calculations MUST maintain integer-exact precision with no floating-point representation at any point in the system — the guarantee is absolute, not "usually correct."
- **NFR-004 (Consistency)**: Error and pagination response shapes MUST be identical across every API endpoint — consumers must never encounter a new format for a different endpoint.
- **NFR-005 (Operational visibility)**: The health endpoint MUST provide enough granularity to identify which specific dependency is failing, not just a binary healthy/unhealthy overall status.
- **NFR-006 (Configuration as a gate)**: Configuration validation at startup is a hard gate, not a soft warning — the system treats missing or invalid configuration as a fatal condition, not an advisory.

### Key Entities

- **TenantContext**: The request-level propagation mechanism that carries the current organization identifier from the authenticated token through the entire request lifecycle to every data-access operation. Not a business entity — an infrastructure guarantee.
- **Money**: A value object representing a monetary amount as integer minor units paired with an explicit currency code. Enforces exact arithmetic and currency matching — no monetary value exists without both components. Only `UAH` and `EUR` are accepted as valid currency codes.
- **HealthStatus**: The composite status of the system and its dependencies, reported by the health check. Contains per-dependency status indicators and an overall readiness signal.
- **ApiError**: The uniform structure returned for all error conditions across the API, containing an error code, a localized human-readable message, and the request context.
- **PaginatedResponse**: The uniform structure returned for all paginated list endpoints, containing the items, total count, current page, and page size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of requests are scoped to exactly one organization — zero incidents of cross-tenant data access, regardless of code path or concurrency.
- **SC-002**: 100% of monetary values stored, calculated, or transmitted are integer minor units with an explicit currency — zero instances of floating-point money representation. 100% of monetary values use either `UAH` or `EUR` — zero instances of an unrecognized currency code being accepted.
- **SC-003**: 100% of process startups with a missing or malformed required configuration value result in an immediate startup failure — zero instances of a silently-degraded running process.
- **SC-004**: The health endpoint responds within 100ms (p95) under normal conditions and reports per-dependency status for all critical dependencies (database, cache) within 5 seconds of a dependency becoming unavailable.
- **SC-005**: 100% of error responses across the API follow the uniform error structure — zero instances of raw/unformatted error responses reaching callers.
- **SC-006**: 100% of paginated list responses across the API follow the uniform pagination structure — zero instances of ad-hoc pagination formats.

## Assumptions

- The multi-tenant isolation model (org_id on every table, TenantContext via AsyncLocalStorage) is already decided in ADR-012 and is not re-litigated — this spec defines the observable behavior those decisions must produce.
- The money-as-integer-minor-units model is already decided in ADR-002 and is not re-litigated — this spec defines the observable behavior those decisions must produce. The system supports UAH and EUR as the only valid currency codes; multi-currency expansion beyond these two is out of scope for this phase.
- Authentication (JWT) is handled by a separate capability (Phase 2 — IAM + Organizations) and is not described here — this spec assumes a valid token with an organization identifier is available.
- The health check covers database and cache as the two critical dependencies; other dependencies (object storage, external gateways) are added in later phases and are not in scope here.
- Localization support (Ukrainian primary, English secondary) is wired at this foundation level so that all subsequent capabilities inherit it; specific translated strings are added per-capability.
- This phase has no end-user-facing features — no renters, org admins, or station operators interact with anything described here. The "users" are the platform itself and the later capabilities that depend on these guarantees.

## Clarifications

### Session 2026-07-31

- Q: Should the system support only UAH, or should it support multiple currencies from day one? → A: UAH + EUR — the system accepts only these two currencies; all others are rejected.

## Open Questions

- **OQ-1 (DEFERRED to plan)**: Should the health endpoint's dependency checks be active (ping-based) or passive (track last-successful-operation timestamps)? The answer affects implementation complexity and accuracy but does not change the spec-level guarantee.
- **OQ-2 (DEFERRED to plan)**: What is the maximum acceptable latency for the health check response? The spec requires it to respond "within 5 seconds" but the actual target should be tighter for operational use — defers to operational requirements.
- **OQ-3 (DEFERRED to plan)**: Should the error envelope include a request ID for correlation? The spec requires "request context" but does not specify which fields — defers to API design.
