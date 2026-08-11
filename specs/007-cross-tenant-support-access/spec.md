# Feature Specification: Cross-Tenant Support Access (Impersonation)

**Feature Branch**: `007-cross-tenant-support-access`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Support impersonation pattern — SUPER_ADMIN acts on behalf of a tenant via an `x-org-id` header, gated to SUPER_ADMIN only, with org existence/ACTIVE validation and full audit trace."

**Source references**: `docs/domain/business-rules.md` BR-01.7; `docs/architecture/greenfield-architecture.md` ADR-014, Security Architecture §10; `docs/roadmap/implementation-roadmap.md` Phase 11. These are referenced, not restated.

## Clarifications

### Session 2026-08-10

- Q: How is the impersonated tenant selected? → A: Per-request HTTP header `x-org-id`. There is no session-level impersonation toggle.
- Q: Does impersonation change the actor's role? → A: No. A `SUPER_ADMIN` keeps role `SUPER_ADMIN` while acting on a tenant's data.
- Q: What happens when a non-SUPER_ADMIN sends `x-org-id`? → A: The request is rejected with `403 IMPERSONATION_FORBIDDEN` — the header is not silently ignored, to make mistakes obvious.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - SUPER_ADMIN Supports a Tenant Without Touching Its Credentials (Priority: P1)

When a tenant reports an issue that requires privileged access to their data, a
SUPER_ADMIN support operator can view and operate on that tenant's resources directly from
the admin panel, without the tenant handing over its admin credentials. The operator
explicitly selects the target organization per request; the system only honors that selection
for the global support role, validates that the target organization actually exists and is
active, and records every such access for accountability.

**Why this priority**: Cross-tenant access is the highest-risk privilege in the system — it
bypasses normal tenant isolation. If gating, validation, or audit fail, one tenant's data can
be read or modified by mistake, without a trace. This is the security gateway for the support
workflow in Phase 11.

**Independent Test**: Log in as SUPER_ADMIN, send any tenant-scoped request (e.g. list
stations) with `x-org-id: <rentiq org>`; the request succeeds and returns only that
organization's data. Repeat the same request with a non-SUPER_ADMIN token — it is rejected.
Repeat with a nonexistent org and with a suspended org — rejected with the documented codes.
The support operator's own account id and the target org are visible in the audit trail for
every impersonated request.

**Acceptance Scenarios**:

1. **Given** a SUPER_ADMIN actor and an existing ACTIVE organization, **When** they send a
   tenant-scoped request with `x-org-id: <orgId>`, **Then** the request executes in that
   organization's tenant context and returns only its data.
2. **Given** an ORG_ADMIN or STATION_OPERATOR or renter actor, **When** they send a request
   with `x-org-id`, **Then** the request is rejected with `403 IMPERSONATION_FORBIDDEN`.
3. **Given** a SUPER_ADMIN actor, **When** they send `x-org-id` for an organization that does
   not exist, **Then** the request is rejected with `404 ORG_NOT_FOUND`.
4. **Given** a SUPER_ADMIN actor, **When** they send `x-org-id` for an organization whose
   status is SUSPENDED, **Then** the request is rejected with `403 ORG_SUSPENDED`.
5. **Given** a SUPER_ADMIN actor, **When** they send an impersonated request, **Then** an
   `ImpersonationActivated` audit entry records the impersonator's account id, the target
   org id, and the request method/path.
6. **Given** a SUPER_ADMIN impersonating a tenant, **When** their tenant context is inspected
   downstream, **Then** the effective org is the target org and the impersonator's identity
   (`impersonatorSub`) is present and distinguishable from the tenant's own operations.
7. **Given** any actor, **When** they send a request without `x-org-id`, **Then** behavior is
   unchanged — the request runs in the actor's own tenant context (its JWT `org_id`).

---

### User Story 2 - Support Access Is Never Confused With Tenant-Owned Activity (Priority: P2)

The audit trail must unambiguously distinguish a support operator acting on behalf of a
tenant from the tenant's own operations. A tenant reviewing its own audit history must never
see support operator activity attributed to its own users, and support operators must be able
to reconstruct exactly which operator did what, in which tenant, at which time.

**Why this priority**: Accountability is the trust foundation for cross-tenant access. If an
impersonated action is recorded as a tenant-local action, the tenant cannot prove or audit
what the platform did, and the platform cannot defend itself against abuse claims.

**Independent Test**: Perform one impersonated action as SUPER_ADMIN on a tenant, then query
the audit stream; the entry identifies the impersonator (`impersonatorSub`), the target org,
and is tagged as impersonation, while a tenant-local admin action in the same org produces a
distinct entry with no impersonator marker.

**Acceptance Scenarios**:

1. **Given** an impersonated action, **When** it is written to the audit log, **Then** the
   action code is `ImpersonationActivated` and the payload includes `impersonatorSub`,
   `targetOrgId`, method, and path.
2. **Given** a tenant-local action, **When** it is written to the audit log, **Then** it
   carries no impersonator marker and is attributed to the acting tenant user.
3. **Given** a SUPER_ADMIN impersonating a tenant, **When** the impersonated request is
   processed, **Then** the tenant's own context (`sub`, `orgId`) is restored after the request
   completes and never leaks into subsequent requests.

---

### Edge Cases

- **Empty or whitespace `x-org-id` header value**: Treated as absent — no impersonation.
- **Multiple `x-org-id` headers**: First value wins; behavior is identical to a single header.
- **Impersonation while the target org is being suspended mid-request**: The request that was
  already validated completes; the next request re-validates and is rejected.
- **Impersonation with no valid token**: Rejected as unauthenticated by the existing auth
  middleware before impersonation logic runs; if a token is present but malformed the actor is
  not a verified SUPER_ADMIN and the header is rejected with `IMPERSONATION_FORBIDDEN`.
- **SUPER_ADMIN impersonating, then tenant context inspected after the response**: AsyncLocalStorage
  isolation guarantees the outer JWT-derived context is restored; no cross-request leakage.
- **Very large `x-org-id`**: Treated as a non-existent org id → `404 ORG_NOT_FOUND`; no
  expensive parsing.
- **Impersonated request to a tenant-local resource the target org does not own**: Normal
  tenant-scoped 404 behavior applies — impersonation grants tenant-scope, not
  cross-resource bypass.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST honor the `x-org-id` HTTP header as a per-request tenant
  selection **only** when the authenticated actor's token type is `admin` and role is
  `SUPER_ADMIN` (BR-01.7).
- **FR-002**: The system MUST reject any request carrying `x-org-id` whose actor is not a
  `SUPER_ADMIN` with HTTP `403` and error code `IMPERSONATION_FORBIDDEN` (BR-01.7).
- **FR-003**: Before honoring impersonation, the system MUST verify the target organization
  exists; otherwise reject with HTTP `404` and code `ORG_NOT_FOUND` (BR-01.7).
- **FR-004**: Before honoring impersonation, the system MUST verify the target organization is
  `ACTIVE` (not `SUSPENDED`); otherwise reject with HTTP `403` and code `ORG_SUSPENDED`
  (BR-01.7).
- **FR-005**: The impersonated request MUST execute with `orgId` set to the target
  organization and MUST carry the impersonator's identity (`impersonatorSub`) so downstream
  code and the audit trail can distinguish impersonated activity (ADR-014).
- **FR-006**: Every impersonated request MUST be recorded in the audit log with action
  `ImpersonationActivated`, the impersonator's account id, the target org id, and the request
  method and path (BR-01.7).
- **FR-007**: Impersonation MUST NOT alter the actor's role; the effective role remains
  `SUPER_ADMIN` (BR-01.7).
- **FR-008**: Requests without `x-org-id` MUST behave exactly as before: the tenant context is
  the actor's JWT `org_id` (which may be absent for SUPER_ADMIN), and tenant-scoped operations
  reject a missing context with the existing `TENANT_NOT_FOUND` behavior.
- **FR-009**: The tenant context MUST be restored to the outer (JWT-derived) store after the
  impersonated request completes — impersonation must not leak across requests.
- **FR-010**: The impersonation decision MUST happen in a middleware that runs after JWT
  verification so it reads the verified `request.auth`, and it MUST live in the
  `organizations` module (which owns the organization repository) (ADR-014).

### Key Entities

- **ImpersonationContext**: A per-request tenant context override consisting of a target
  `orgId` and the impersonator's `sub`, carried in `TenantStore` (AsyncLocalStorage). Not
  persisted — it is derived from the `x-org-id` header on each request.
- **Audit record (ImpersonationActivated)**: Structured log line capturing action,
  `impersonatorSub`, `targetOrgId`, method, and path for each impersonated request.

## Business Rules

This specification is governed by BR-01.7 (Cross-Tenant Support Access) and ADR-014
(Impersonation Middleware) in `docs/domain/business-rules.md` and
`docs/architecture/greenfield-architecture.md`. Those rules are the authoritative source; this
specification operationalizes them as functional requirements and acceptance criteria and does
not redefine or override them. Where this specification and the source docs conflict, the
source docs win.

## Acceptance Criteria

1. **SUPER_ADMIN impersonation works**: A SUPER_ADMIN with `x-org-id` for an existing ACTIVE
   org receives 200 and tenant-scoped data for that org only (FR-001, FR-005).
2. **Non-SUPER_ADMIN rejected**: ORG_ADMIN / STATION_OPERATOR / renter with `x-org-id`
   receives `403 IMPERSONATION_FORBIDDEN` (FR-002).
3. **Unknown org rejected**: SUPER_ADMIN with a nonexistent `x-org-id` receives
   `404 ORG_NOT_FOUND` (FR-003).
4. **Suspended org rejected**: SUPER_ADMIN with a suspended org's id receives
   `403 ORG_SUSPENDED` (FR-004).
5. **Audited**: Each impersonated request produces an `ImpersonationActivated` audit entry with
   impersonator + target + method/path (FR-006).
6. **Traceable identity**: The impersonated request's tenant context exposes
   `impersonatorSub` distinct from the target org's own subject (FR-005, FR-007).
7. **No behavior change without the header**: Requests without `x-org-id` behave exactly as
   before (FR-008).
8. **No leakage**: After an impersonated request, the outer JWT-derived tenant context is
   restored (FR-009).

## Error Scenarios

- **Non-SUPER_ADMIN sends `x-org-id`**: `403 IMPERSONATION_FORBIDDEN` with a localized message
  explaining the header is restricted to the SUPER_ADMIN role. Not silent, so the mistake is
  obvious.
- **Target org does not exist**: `404 ORG_NOT_FOUND`. A mistyped or stale org id fails
  loudly.
- **Target org suspended**: `403 ORG_SUSPENDED`. A support operator cannot act on a suspended
  tenant.
- **Header present but no valid auth**: Existing JWT middleware treats the request as
  unauthenticated; impersonation is never honored for unverified actors.

## Non-Functional Requirements

- **Security**: The `x-org-id` header is never trusted from an unverified actor; gating,
  existence, and ACTIVE checks run on the verified token's role, not on client-supplied
  claims (constitution Principle X).
- **Auditability**: All impersonated activity is recorded with full identity + target +
  method + path, and is distinguishable from tenant-local activity (constitution Principle X).
- **Isolation**: Impersonation grants scope within one organization only; it never grants
  access to data outside the target org, and it restores the original context after the
  request (constitution Principle VI).
- **Layering**: The impersonation decision belongs to the `organizations` module; the
  `shared-kernel` module exposes only the tenant context primitives and the audit logger, and
  must not depend on business modules (constitution Principles I, V).
- **Performance**: The additional cost per request is one indexed organization lookup only
  when `x-org-id` is present; no lookup when the header is absent.
- **Localization**: Error messages for the new codes are provided in both `uk` and `en`
  (constitution Principle IX).

## Open Questions

1. **Confirmation step for mutating impersonated requests** `[OPEN]`: ADR-014 notes that
   non-GET impersonated requests on sensitive resources may deserve an explicit confirmation
   step. Deferred until the support console (Phase 11) exists — the API contract already
   carries the header so a client-side confirm is possible without backend changes.

## Assumptions

- The `x-org-id` header is the only impersonation signal; there is no session-level
  impersonation toggle in this phase.
- The target org's ACTIVE/SUSPENDED status is read from the existing organization domain
  model; no new statuses are introduced.
- The audit log is currently the structured `AuditableLogger` output; persisting audit
  entries to the append-only `audit_log` table is wired in Phase 9 per the architecture doc.
  The `ImpersonationActivated` entry is emitted through the same mechanism as other
  auditable actions.
- Token type `admin` and role `SUPER_ADMIN` are the only acceptable combination for
  impersonation; `STATION_OPERATOR` belongs to a tenant and is not a support role.

## Dependencies

- **`organizations` module**: owns `ORGANIZATION_REPOSITORY` (org existence + status) and the
  `ImpersonationMiddleware`.
- **`shared-kernel`**: provides `TenantContext` (AsyncLocalStorage, `impersonatorSub`),
  `JwtAuthMiddleware` (verified `request.auth`), `ApiException` / `ApiErrorFilter`, and the
  global `AuditableLogger`.
- **`iam` module**: provides the JWT payload shape (type `admin`, role, sub) that the
  middleware reads.
