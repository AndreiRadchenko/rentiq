# API Contracts: Cross-Tenant Support Access (Impersonation)

**Date**: 2026-08-10
**Feature**: 007-cross-tenant-support-access

## Cross-Tenant Support Access Header

### Request Header: `x-org-id`

**Purpose**: Per-request tenant selection for cross-tenant support access. A `SUPER_ADMIN`
support operator acts on behalf of a target organization by attaching this header to any
tenant-scoped request.

**Rules** (BR-01.7, ADR-014):

| Condition | Behavior |
|---|---|
| Header absent | Request runs in the actor's own tenant context (JWT `org_id`). Unchanged behavior. |
| Header present, actor role `SUPER_ADMIN`, org exists + ACTIVE | `200` — request runs in the target org's tenant context; `impersonatorSub` recorded; audited. |
| Header present, actor role ≠ `SUPER_ADMIN` | `403 IMPERSONATION_FORBIDDEN` |
| Header present, org does not exist | `404 ORG_NOT_FOUND` |
| Header present, org SUSPENDED | `403 ORG_SUSPENDED` |

**Example**:

```bash
curl -s http://localhost:3002/api/v1/stations \
  -H "Authorization: Bearer <SUPER_ADMIN access token>" \
  -H "x-org-id: 40948aba-43bc-4f71-8571-71eae1206566"
```

## New Error Codes

All error responses use the standard ApiError envelope (correlationId, code, message,
timestamp).

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `IMPERSONATION_FORBIDDEN` | 403 | `x-org-id` sent by an actor without the `SUPER_ADMIN` role |
| `ORG_NOT_FOUND` | 404 | `x-org-id` targets an organization that does not exist |
| `ORG_SUSPENDED` | 403 | `x-org-id` targets a suspended organization |

**Example responses**:

```json
{
  "correlationId": "e229bd5e-a442-41db-b44a-e9b6043ed259",
  "code": "IMPERSONATION_FORBIDDEN",
  "message": "Acting on behalf of an organization requires a SUPER_ADMIN role",
  "timestamp": "2026-08-10T11:11:00.242Z"
}
```

```json
{
  "correlationId": "f0c19f00-0000-0000-0000-000000000000",
  "code": "ORG_SUSPENDED",
  "message": "Organization is suspended",
  "timestamp": "2026-08-10T11:11:05.686Z"
}
```

## Audit Trail

Each impersonated request emits a structured audit entry:

```json
{
  "action": "ImpersonationActivated",
  "actorId": "<SUPER_ADMIN account id>",
  "orgId": "<target org id>",
  "payload": {
    "impersonatorSub": "<SUPER_ADMIN account id>",
    "impersonatorRole": "SUPER_ADMIN",
    "targetOrgId": "<target org id>",
    "method": "GET",
    "path": "/api/v1/stations"
  }
}
```

The entry is attributable (impersonator + target + method + path) and distinct from the
target tenant's own activity.
