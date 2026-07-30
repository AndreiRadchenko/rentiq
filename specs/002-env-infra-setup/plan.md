# Implementation Plan: Environment & Infrastructure Setup

**Branch**: `002-env-infra-setup` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-env-infra-setup/spec.md`

## Summary

Phase 0 establishes the monorepo scaffold, two fully isolated environments (containerized production, host-native stage), CI quality gates, and database migration tooling — with no business application code. Every deliverable in this phase is a prerequisite for all subsequent phases: the monorepo structure that modules build into, the environments they deploy to, and the CI pipeline that gates their merge. The plan follows ADR-011 (per-environment deployment topology), the roadmap's Phase 0 deliverables (0.1–0.5), and the constitution's architectural constraints.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS for `apps/api` NestJS, `apps/admin-panel` Next.js); Python 3.12+ for `apps/telegram-bot`

**Primary Dependencies**: pnpm (workspace manager), Nx (monorepo orchestration + boundary enforcement), NestJS (API framework), Next.js (admin panel), Drizzle ORM (schema + migrations), Docker Compose (production), systemd/watchmedo (stage)

**Storage**: PostgreSQL 16 (two instances: prod + stage), Redis 7 (two instances), MinIO (two buckets: `rentiq-prod`, `rentiq-stage`)

**Testing**: Jest (unit), NestJS testing utilities (e2e), containerized Postgres/Redis for e2e isolation

**Target Platform**: Linux (single host per ADR-011)

**Project Type**: pnpm monorepo with Nx; modular monolith (`apps/api`) + two thin client processes (`apps/admin-panel`, `apps/telegram-bot`) + shared packages

**Performance Goals**: N/A for this phase — infrastructure scaffolding only

**Constraints**: Two environments on one host (ADR-011); no application code in this phase; secrets never committed (FR-007); CI must pass on an empty commit

**Scale/Scope**: 3 apps, 2 shared packages, ~5 CI jobs, 2 environment configurations, 1 migration toolchain

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Modular Monolith | ✅ COMPLIANT | Phase 0 creates the scaffold (`apps/api` NestJS shell) but no business modules; monorepo structure supports the architecture |
| II. Hexagonal Isolation | ✅ COMPLIANT | No gateway ports defined yet; scaffold only |
| III. Domain-Driven / Money | ✅ COMPLIANT | No domain code in this phase |
| IV. Event-Driven | ✅ COMPLIANT | No cross-module calls in this phase |
| V. Module Boundaries | ✅ COMPLIANT | Nx `enforce-module-boundaries` lint rules configured in deliverable 0.1 |
| VI. Multi-Tenant | ✅ COMPLIANT | No business tables in this phase; `org_id` pattern deferred to Phase 1+ |
| VII. PostgreSQL + Drizzle | ✅ COMPLIANT | Drizzle ORM tooling configured in deliverable 0.5; no schema yet |
| VIII. Process-Isolated Clients | ✅ COMPLIANT | `apps/telegram-bot` and `apps/admin-panel` configured as separate processes |
| IX. Backend-Owned i18n | ✅ COMPLIANT | `packages/i18n` scaffolded with `uk/` and `en/` locale folders |
| X. Security by Default | ✅ COMPLIANT | Secret scanning in CI (FR-006/FR-007); `.env` files gitignored |

**Post-Phase-1 re-evaluation**: Will assess once `shared-kernel` entities (Money, EntityId) and i18n contracts are defined.

## Project Structure

### Documentation (this feature)

```text
specs/002-env-infra-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output (resolves deferred OQs)
├── data-model.md        # Phase 1 output (environment config model)
├── quickstart.md        # Phase 1 output (validation guide)
├── contracts/           # Phase 1 output (CI pipeline contract)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
rentiq/
├── apps/
│   ├── api/                         # NestJS modular monolith (shell only in Phase 0)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.build.json
│   ├── admin-panel/                 # Next.js (app router, shell only)
│   │   ├── src/
│   │   ├── next.config.js
│   │   └── tsconfig.json
│   └── telegram-bot/                # Python (shell only)
│       ├── pyproject.toml
│       └── src/
├── packages/
│   ├── i18n/                        # Shared locale files
│   │   ├── uk/
│   │   │   └── common.json          # empty {}
│   │   └── en/
│   │       └── common.json          # empty {}
│   └── config/                      # Shared configuration utilities
│       ├── src/
│       └── package.json
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI pipeline (lint, typecheck, test:unit, test:e2e, secret-scan)
├── docker/
│   └── postgres/
│       └── init.sql                 # Creates non-superuser app role
├── docker-compose.yml               # Production environment
├── .env.example                     # Production env var template
├── .env.stage.example               # Stage env var template
├── .env                             # (gitignored) actual secrets
├── .env.stage                       # (gitignored) actual stage secrets
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── tsconfig.base.json
├── pnpm-workspace.yaml
├── nx.json
├── package.json
└── turbo.json                       # (if using Turborepo; otherwise Nx config)
```

**Structure Decision**: pnpm monorepo with Nx, matching architecture doc §11 (Folder Structure). Three app shells, two shared packages. No NestJS business modules in this phase — only the scaffold that later phases build into.

## Complexity Tracking

No constitution violations — this phase is purely structural scaffolding and configuration. All principles are satisfied by the setup itself or deferred to phases that introduce business code.

## Phase 0: Research

### Resolved Open Questions

**OQ-2: Production deployment trigger**
- Decision: Production deployment requires a **separate, explicit deploy action** — it is NOT triggered automatically on merge to mainline.
- Rationale: Automatic deployment on merge couples code review to production push, which is inappropriate for a small-team ops model where an operator must verify staging first. The CI pipeline gates merge eligibility; a separate deploy step (manual or scripted) gates production rollout.
- Alternatives considered: Auto-deploy on merge (rejected — too risky for small team; no staging verification gate).

**OQ-4: Migration review depth**
- Decision: Standard pull-request code review is **sufficient for all generated migrations**. No additional sign-off step is introduced.
- Rationale: Drizzle-generated migrations are deterministic diffs of the schema — they don't contain hand-written logic. Reviewing the schema change in the PR diff is the meaningful review; the generated SQL is a mechanical artifact. Destructive changes (column drops, data migrations) are caught by reviewing the schema diff, not by a separate approval gate.
- Alternatives considered: Dedicated migration sign-off for destructive changes (rejected — over-engineered for small team; schema diff review is sufficient).

**OQ-5: Database backup cadence**
- Decision: **Production**: daily automated `pg_dump` with 30-day retention. **Stage**: weekly automated backup with 14-day retention (stage data is disposable; backups are for convenience, not disaster recovery).
- Rationale: Stage is explicitly disposable per ADR-011 — its data is re-creatable from seed scripts. Production backup cadence follows standard small-team best practices for a system with moderate data volume.
- Alternatives considered: No backups for stage (rejected — weekly backup is trivial to set up and occasionally useful); continuous WAL archiving (rejected — over-engineered for current scale).

### Technology Research

**Monorepo tooling**: pnpm workspaces + Nx. Nx provides `enforce-module-boundaries` lint rules that mechanically enforce the constitution's Principle V (module boundaries). pnpm is specified in the architecture doc (§9.1, §11). Nx handles task orchestration (build, lint, test) across workspaces.

**Migration tooling**: `drizzle-kit generate` produces migration files from schema diffs; `drizzle-kit migrate` applies them. Migration files are committed to git (constitution Principle VII). Production applies migrations via a pre-start step (`npm run db:migrate` in Docker entrypoint). Stage migrations are run manually by the operator.

**CI pipeline**: GitHub Actions (or equivalent). Five jobs: `lint` (Nx boundary checks + ESLint), `typecheck` (`tsc --noEmit` for all TS workspaces), `test:unit` (Jest), `test:e2e` (NestJS e2e against containerized Postgres/Redis via Docker Compose services), `secret-scan` (detects credential-shaped values in diffs). All jobs must pass before merge — branch protection rules enforce this.

**Secret handling**: `.env` and `.env.stage` files are gitignored. `.env.example` and `.env.stage.example` are committed (contain variable names and descriptions, no real values). Secret scanning in CI catches accidental commits. The application resolves secret references (`*_ref` fields in DB) to env-var values at runtime (architecture doc §9.5).

**Stage environment**: Host-native services via systemd unit files with `watchmedo auto-restart` for development iteration (architecture doc §9.3). Non-production ports for Postgres (5433), Redis (6380), MinIO (9002/9003). Separate `rentiq-stage` database, Redis DB index, and MinIO bucket.

## Phase 1: Design

### Data Model (`data-model.md`)

Phase 0 has no business entities. The data model captures the **environment configuration** that governs all later phases.

#### Entities

**Environment** (not a DB table — a deployment-time concept)
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

**Configuration** (env-var-based, not persisted)
| Variable Category | Examples | Committed? |
|---|---|---|
| Database connection | `DATABASE_URL` | No (`.env` gitignored) |
| Redis connection | `REDIS_URL` | No |
| Object storage | `MINIO_ENDPOINT`, `MINIO_BUCKET` | No |
| External service refs | `MONOBANK_API_KEY`, `TELEGRAM_BOT_TOKEN`, `HA_TOKEN` | No |
| Application config | `NODE_ENV`, `LOG_LEVEL` | Yes (in `.env.example`) |

**Migration Artifact** (generated, committed to git)
| Attribute | Notes |
|---|---|
| Source | `drizzle-kit generate` from schema diff |
| Location | `apps/api/src/infra/database/migrations/` |
| Review | Same PR review as code changes |
| Application | Auto (production, pre-start), manual (stage, operator) |

### Contracts (`contracts/`)

This phase exposes **no external APIs or endpoints**. The only "contract" is the CI pipeline's gate interface — what checks run and what blocks merge.

#### CI Pipeline Contract

**Trigger**: Every pull request targeting `main`

| Gate | Command | Blocks Merge? |
|---|---|---|
| Lint | `nx run-many --target=lint --all` (boundary checks + ESLint) | Yes |
| Typecheck | `nx run-many --target=typecheck --all` (`tsc --noEmit`) | Yes |
| Unit tests | `nx run-many --target=test:unit --all` (Jest) | Yes |
| E2E tests | `nx run api:test:e2e` (against containerized Postgres/Redis) | Yes |
| Secret scan | Diff scan for credential-shaped values | Yes |

**Merge eligibility**: All 5 gates must pass. No partial-green merge. No override path.

**Failure behavior**: Each gate reports independently; any single failure blocks merge. Results visible on every push (NFR-006).

### Quickstart Validation Guide (`quickstart.md`)

#### Prerequisites
- Docker and Docker Compose installed
- Node.js LTS and pnpm installed
- Python 3.12+ installed (for stage telegram-bot)
- PostgreSQL, Redis, MinIO installed on host (for stage)
- Git

#### Validation Scenarios

**V1: Production environment starts**
```bash
cp .env.example .env   # Fill in dummy values for local validation
docker compose up -d
docker compose ps      # All services should be "Up"
```
Expected: All 6 services (api, admin-panel, telegram-bot, postgres, redis, minio) start. Postgres accessible. MinIO console accessible at :9001.

**V2: Stage environment starts**
```bash
cp .env.stage.example .env.stage   # Fill in dummy values
# Ensure host Postgres, Redis, MinIO are running on non-prod ports
# Create stage database
psql -p 5433 -c "CREATE DATABASE \"rentiq-stage\";"
# Create stage MinIO bucket (via mc or console)
# Start stage services
systemctl start rentiq-api-stage
systemctl start rentiq-bot-stage
```
Expected: Stage API starts. Stage Postgres database accessible and empty. Stage MinIO bucket exists.

**V3: Both environments coexist without cross-contamination**
```bash
# Write a marker to stage
psql -p 5433 -d rentiq-stage -c "CREATE TABLE test_marker (id int); INSERT INTO test_marker VALUES (42);"
# Verify production DB does not have it
docker compose exec postgres psql -U rentiq -d rentiq -c "SELECT * FROM test_marker;"
```
Expected: Production query fails (table does not exist). No cross-contamination.

**V4: CI passes on empty commit**
```bash
git commit --allow-empty -m "ci: validate pipeline on empty commit"
git push origin 002-env-infra-setup
# Open PR → all 5 gates should pass
```
Expected: Lint, typecheck, unit, e2e, and secret-scan all green. PR is mergeable.

**V5: Missing env var fails startup**
```bash
# Start API without DATABASE_URL
DATABASE_URL= node apps/api/dist/main.js
```
Expected: Process exits with non-zero code and clear error message identifying missing `DATABASE_URL`.

**V6: Migration tooling works**
```bash
cd apps/api
npx drizzle-kit generate --name test_migration
ls src/infra/database/migrations/   # Should contain the generated migration
npx drizzle-kit migrate             # Should apply (or report no changes)
```
Expected: Migration file generated. `drizzle-kit migrate` runs without error.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Stage port conflicts with existing services | Stage services fail to bind ports | Document required ports in `.env.stage.example`; validate port availability in quickstart |
| Docker Compose version incompatibility | Production environment fails to start | Pin Docker Compose spec version in `docker-compose.yml`; test with Docker Engine LTS |
| Nx `enforce-module-boundaries` false positives on empty shells | CI lint fails on scaffold with no modules | Configure boundary rules to allow empty module directories; add baseline test |
| Python telegram-bot dependency conflicts with host Python | Stage bot fails to start | Use `pyproject.toml` with pinned dependencies; document Python version requirement |
| Secret scanning false positives on `.env.example` | CI blocks merge on legitimate example files | Exclude `.env.example` and `.env.stage.example` from secret-scan patterns |
| MinIO retention lifecycle rules misconfigured | Prod data deleted prematurely or never cleaned | Test lifecycle rules in quickstart V2; document expected behavior |

## Migration Considerations

None — greenfield. No existing database, no existing CI, no existing deployment pipeline. All tooling is set up from scratch.
