# Data Model: Environment & Infrastructure Setup

Phase 0 has no business entities. This document captures the **environment configuration model** that governs all later phases.

## Entities

### Environment (deployment-time concept, not a DB table)

| Attribute | Values | Notes |
|---|---|---|
| Name | `production`, `stage` | Fixed by ADR-011 |
| Topology | containerized (prod), host-native (stage) | Fixed by ADR-011 |
| Database | `rentiq` (prod), `rentiq-stage` (stage) | Separate Postgres instances |
| Cache | Redis DB 0 (prod), Redis DB 1 or port 6380 (stage) | Separate instances |
| Object Store | `rentiq-prod` bucket (prod), `rentiq-stage` bucket (stage) | Separate MinIO buckets |
| API port | 3000 (prod, internal to Docker) | N/A for stage (host-native) |
| Admin panel port | 3001 (prod, internal to Docker) | N/A for stage (host-native) |
| Bot process | Python (prod, container) | Python (stage, host-native, watchmedo) |

### Configuration (env-var-based, not persisted)

| Variable Category | Examples | Committed? |
|---|---|---|
| Database connection | `DATABASE_URL` | No (`.env` gitignored) |
| Redis connection | `REDIS_URL` | No |
| Object storage | `MINIO_ENDPOINT`, `MINIO_BUCKET` | No |
| External service refs | `MONOBANK_API_KEY`, `TELEGRAM_BOT_TOKEN`, `HA_TOKEN` | No |
| Application config | `NODE_ENV`, `LOG_LEVEL` | Yes (in `.env.example`) |

### Migration Artifact (generated, committed to git)

| Attribute | Notes |
|---|---|
| Source | `drizzle-kit generate` from schema diff |
| Location | `apps/api/src/infra/database/migrations/` |
| Review | Same PR review as code changes |
| Application | Auto (production, pre-start), manual (stage, operator) |

## Relationships

```
Environment 1──* Configuration (env vars)
Environment 1──* DataStore (database, cache, object store)
Environment 1──* Deployment (trigger, migration step)
Environment 1──* MigrationArtifact (applied in order)
```

## Validation Rules

- Every Environment MUST have its own DataStore instances (FR-002)
- Configuration values MUST be validated at startup via Zod schemas (FR-008/FR-009)
- MigrationArtifact files MUST be generated, never hand-edited (FR-010)
- Production MigrationArtifact MUST be applied before binary starts serving (FR-012)
- Stage MigrationArtifact MUST be applied manually before deploy (FR-014)
