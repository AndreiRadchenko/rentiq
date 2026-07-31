# API Contracts: Shared Kernel + Foundation

**Date**: 2026-07-31
**Feature**: 004-shared-kernel-foundation

## Health Check Endpoint

### GET /api/v1/health

**Purpose**: Report system readiness and dependency status.

**Authentication**: None (public endpoint — load balancers and monitoring systems need unauthenticated access).

**Response (200 OK)**:

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok"
}
```

**Response (503 Service Unavailable)**:

```json
{
  "status": "error",
  "db": "ok",
  "redis": "error",
  "details": {
    "redis": {
      "status": "down",
      "message": "Connection refused"
    }
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| status | string | Overall system status: `"ok"` or `"error"` |
| db | string | PostgreSQL status: `"ok"` or `"error"` |
| redis | string | Redis status: `"ok"` or `"error"` |
| details | object (optional) | Per-dependency error details (only present when status is `"error"`) |

**Behavior**:
- When all dependencies are healthy: return 200 with `"status": "ok"`
- When any dependency is unhealthy: return 503 with `"status": "error"` and per-dependency details
- The health check must respond within 100ms (p95) — if a dependency check times out, report it as unhealthy
- The health check must not itself fail or hang (FR-013)

---

## Error Envelope

All error responses across the API follow this uniform structure.

**Response Body**:

```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "TENANT_NOT_FOUND",
  "message": "Organization not found",
  "timestamp": "2026-07-31T12:00:00.000Z"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| correlationId | string (UUID) | Unique request identifier for log correlation |
| code | string | Machine-readable error code (e.g., `TENANT_NOT_FOUND`, `CURRENCY_MISMATCH`) |
| message | string | Localized human-readable error message (uk or en) |
| timestamp | string (ISO 8601) | When the error occurred |

**Error Codes** (Phase 1 scope):

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TENANT_NOT_FOUND` | 403 | Request has no valid organization context |
| `CURRENCY_MISMATCH` | 400 | Monetary operation attempted with different currencies |
| `INVALID_CURRENCY` | 400 | Currency code not in {UAH, EUR} |
| `VALIDATION_ERROR` | 400 | Request input failed validation |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no details exposed) |

**Note**: `INTERNAL_ERROR` must never expose stack traces, database errors, or internal identifiers (FR-016).

---

## Pagination

All paginated list endpoints follow this structure.

**Request Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number (1-indexed) |
| pageSize | integer | 20 | Items per page (max: 100) |

**Response Body**:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| items | array | List of items on the current page |
| total | integer | Total number of items matching the query |
| page | integer | Current page number (1-indexed) |
| pageSize | integer | Number of items per page |

**Note**: Phase 1 defines the DTOs only. No paginated endpoints exist yet — they are added by later modules.
