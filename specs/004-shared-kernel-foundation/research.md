# Research: Shared Kernel + Foundation

**Date**: 2026-07-31
**Feature**: 004-shared-kernel-foundation

## Research Tasks

### RQ-1: Health Check Approach (OQ-1)

**Question**: Should the health endpoint's dependency checks be active (ping-based) or passive (track last-successful-operation timestamps)?

**Decision**: Active (ping-based) — the health controller directly pings PostgreSQL and Redis on each request.

**Rationale**:
- Phase 1 has no business traffic yet, so passive tracking (last-successful-operation) would have no data to report
- Active checks provide deterministic, real-time status — no stale data risk
- @nestjs/terminus provides built-in health indicators (DatabaseHealthIndicator, RedisHealthIndicator) that do exactly this
- Passive tracking is an optimization for high-traffic systems; not needed at this scale

**Alternatives considered**:
- Passive (track last-successful-operation timestamps): Rejected — adds complexity with no benefit at current scale; can be layered on later if needed
- Hybrid (active + passive): Rejected — over-engineered for foundation phase

**Implementation**: Use @nestjs/terminus `HealthCheckService` with `TypeOrmHealthIndicator` (or Drizzle equivalent) and `RedisHealthIndicator`. Each check performs a lightweight ping.

---

### RQ-2: Health Check Latency Target (OQ-2)

**Question**: What is the maximum acceptable latency for the health check response?

**Decision**: 100ms p95 target for the health endpoint response.

**Rationale**:
- Health checks are called by load balancers, orchestrators, and monitoring — they must be fast
- PostgreSQL ping (SELECT 1) typically completes in <5ms on a healthy connection
- Redis ping typically completes in <1ms
- NestJS overhead + serialization: ~10-20ms
- 100ms p95 provides ample headroom; the spec's "within 5 seconds" is a hard ceiling, not a target

**Alternatives considered**:
- 500ms p95: Too generous — would mask connection-pool exhaustion or slow DNS
- 50ms p95: Too aggressive — may cause false negatives under normal load
- No target (just "fast enough"): Rejected — without a measurable target, SC-004 cannot be verified

---

### RQ-3: Error Envelope Fields (OQ-3)

**Question**: Should the error envelope include a request ID for correlation? What fields should "request context" contain?

**Decision**: Yes — the error envelope includes `correlationId` (UUID), `code` (string), `message` (localized string), and `timestamp` (ISO 8601).

**Rationale**:
- Architecture doc §4.2 specifies `ApiError` envelope with `correlationId`, `code`, `message`
- `correlationId` enables log correlation across distributed traces — essential for debugging
- `code` is a machine-readable error identifier (e.g., `TENANT_NOT_FOUND`, `CURRENCY_MISMATCH`)
- `message` is a localized human-readable message (per Principle IX — Backend-Owned Internationalization)
- `timestamp` enables client-side logging and debugging

**Alternatives considered**:
- Without correlationId: Rejected — makes debugging across distributed systems nearly impossible
- With stack trace in production: Rejected — violates FR-016 (no internal details exposed)
- With HTTP status code in body: Redundant — HTTP status is already in the response header; body contains machine-readable `code`

---

### RQ-4: Currency Validation Strategy

**Question**: How should the system validate that currency codes are in the allowed set {UAH, EUR}?

**Decision**: Validate at the Money value object construction time — Money.from(amountMinor, currency) throws/rejects if currency is not in the allowed set.

**Rationale**:
- Defense in depth: validation happens at the earliest possible point (domain layer)
- Cannot accidentally bypass: every Monetary value must go through the constructor
- Clear error message: "Invalid currency: USD. Allowed: UAH, EUR"
- Consistent with Principle III (Domain-Driven Modeling & Money Integrity)

**Alternatives considered**:
- Validate only at API boundary: Rejected — leaves domain layer vulnerable to invalid data
- Validate at database level (CHECK constraint): Useful as secondary defense, but not primary
- Validate in middleware: Rejected — middleware doesn't know about Money value objects

---

### RQ-5: TenantContext Propagation Mechanism

**Question**: How does TenantContext ensure orgId is available in every repository call without manual parameter passing?

**Decision**: AsyncLocalStorage (Node.js built-in) stores orgId per-request. Repository base class reads from TenantContext automatically.

**Rationale**:
- AsyncLocalStorage is the standard Node.js mechanism for request-scoped data
- No manual parameter passing — repositories call `TenantContext.getOrgId()` internally
- Works with async/await, Promise.all, and other async patterns
- Constitution Principle VI requires this: "TenantContext (AsyncLocalStorage) MUST be populated from the authenticated JWT at the start of every request and MUST be the sole source every repository call uses to scope org_id filtering"

**Alternatives considered**:
- Pass orgId as parameter: Rejected — violates Principle VI (caller discipline)
- Thread-local storage (C++ addon): Rejected — AsyncLocalStorage is the idiomatic Node.js solution
- Request object injection: Rejected — doesn't work outside the HTTP layer (e.g., in event handlers, cron jobs)

---

## Summary of Decisions

| Decision | Choice | Impact |
|----------|--------|--------|
| Health check approach | Active (ping-based) | Simple, deterministic, uses @nestjs/terminus |
| Health check latency | 100ms p95 | Measurable target for SC-004 |
| Error envelope | correlationId + code + message + timestamp | Aligns with architecture doc §4.2 |
| Currency validation | Money constructor validates against {UAH, EUR} | Defense in depth at domain layer |
| TenantContext propagation | AsyncLocalStorage + repository base class | Automatic org-scoping, no manual passing |
