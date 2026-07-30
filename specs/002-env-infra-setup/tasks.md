# Tasks: Environment & Infrastructure Setup

**Input**: Design documents from `/specs/002-env-infra-setup/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: pnpm monorepo scaffold with Nx orchestration — the container that every subsequent task builds into.

- [X] T001 Create pnpm workspace configuration in pnpm-workspace.yaml
- [X] T002 Create root package.json with pnpm workspace scripts and Nx dependency in package.json
- [X] T003 [P] Create Nx configuration in nx.json
- [X] T004 [P] Create base TypeScript configuration in tsconfig.base.json
- [X] T005 [P] Create root ESLint configuration in .eslintrc.js
- [X] T006 [P] Create Prettier configuration in .prettierrc
- [X] T007 [P] Create root .gitignore (node_modules, dist, .env, .env.stage, coverage)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Three app shells (NestJS, Next.js, Python bot) and two shared packages. Minimal code — just enough structure for CI to lint, typecheck, and test against.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Create NestJS API shell with src/main.ts and src/app.module.ts in apps/api/
- [X] T009 [P] Create Next.js admin panel shell with next.config.js in apps/admin-panel/
- [X] T010 [P] Create Python telegram-bot shell with pyproject.toml and src/ in apps/telegram-bot/
- [X] T011 [P] Create shared i18n package with empty uk/common.json and en/common.json in packages/i18n/
- [X] T012 [P] Create shared config package with src/ directory and package.json in packages/config/
- [X] T013 [P] Implement Zod-based environment variable validation schema in packages/config/src/env.ts that fails startup on missing or malformed values per FR-008/FR-009

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — CI blocks a broken or insecure pull request (Priority: P1) 🎯 MVP

**Goal**: Every pull request must pass lint, typecheck, unit tests, e2e tests, and secret scan before merge. No partial-green merge permitted.

**Independent Test**: Open a PR with a lint violation → merge blocked. Fix it → PR becomes mergeable. All 5 gates independently verifiable.

### Implementation for User Story 1

- [X] T014 Create GitHub Actions CI workflow with 5 parallel jobs (lint, typecheck, test:unit, test:e2e, secret-scan) in .github/workflows/ci.yml
- [X] T015 [P] [US1] Configure ESLint for apps/api with Nx boundary rules in apps/api/.eslintrc.js
- [X] T016 [P] [US1] Configure ESLint for apps/admin-panel in apps/admin-panel/.eslintrc.js
- [X] T017 [P] [US1] Add TypeScript typecheck target to apps/api in apps/api/tsconfig.json
- [X] T018 [P] [US1] Add TypeScript typecheck target to apps/admin-panel in apps/admin-panel/tsconfig.json
- [X] T019 [P] [US1] Configure Jest for unit tests in apps/api in apps/api/jest.config.ts
- [X] T020 [P] [US1] Configure Jest for unit tests in apps/admin-panel in apps/admin-panel/jest.config.ts
- [X] T021 [US1] Create CI-specific Docker Compose for ephemeral e2e test infrastructure (Postgres + Redis) in apps/api/docker-compose.e2e.yml per FR-015
- [X] T022 [US1] Configure NestJS e2e test harness with containerized Postgres/Redis in apps/api/test/jest-e2e.json
- [X] T023 [US1] Create secret scanning script that detects credential-shaped values in .github/scripts/secret-scan.sh
- [X] T024 [US1] Verify CI pipeline passes on empty commit (quickstart V4) — open PR, confirm all 5 gates green

**Checkpoint**: CI gates are operational — no broken or insecure code can reach mainline

---

## Phase 4: User Story 2 — Production and stage stay fully isolated (Priority: P2)

**Goal**: Two completely isolated environments with separate data stores, separate credentials, and no cross-contamination path.

**Independent Test**: Write a marker to stage DB → confirm it doesn't exist in production DB. Both environments start and stop independently.

### Implementation for User Story 2

- [X] T025 [P] [US2] Create Docker Compose file for production environment with all 6 services (api, admin-panel, telegram-bot, postgres, redis, minio) in docker-compose.yml
- [X] T026 [P] [US2] Create PostgreSQL init script for non-superuser app role in docker/postgres/init.sql
- [X] T027 [P] [US2] Create production environment variable template in .env.example
- [X] T028 [P] [US2] Create stage environment variable template in .env.stage.example
- [X] T029 [P] [US2] Create systemd unit for stage API with watchmedo auto-restart in systemd/rentiq-api-stage.service
- [X] T030 [P] [US2] Create systemd unit for stage bot with watchmedo auto-restart in systemd/rentiq-bot-stage.service
- [X] T031 [P] [US2] Document stage Redis and MinIO host-native configuration in .env.stage.example (separate ports: Redis 6380, MinIO 9002/9003; separate bucket: rentiq-stage)
- [X] T032 [P] [US2] Create production database backup cron job with daily pg_dump and 30-day retention in scripts/backup-prod.sh
- [X] T033 [P] [US2] Create stage database backup cron job with weekly pg_dump and 14-day retention in scripts/backup-stage.sh

**Checkpoint**: Both environments can start, run, and stop independently with zero shared data stores

---

## Phase 5: User Story 3 — Database schema changes ship safely (Priority: P3)

**Goal**: Schema changes are captured as generated migration artifacts, reviewed via PR, applied automatically in production (pre-start) and manually in stage.

**Independent Test**: Introduce a trivial schema change → confirm migration is generated (not hand-written), reviewable in PR diff, auto-applies in production startup, and requires manual step in stage.

### Implementation for User Story 3

- [X] T034 [P] [US3] Create Drizzle ORM configuration with prod and stage database URLs in apps/api/drizzle.config.ts
- [X] T035 [P] [US3] Create migration directory structure in apps/api/src/infra/database/migrations/
- [X] T036 [US3] Add db:generate and db:migrate npm scripts to apps/api/package.json
- [X] T037 [US3] Create Docker entrypoint that runs migrations automatically before starting the API in docker/api-entrypoint.sh
- [X] T038 [US3] Add startup schema validation to NestJS app that fails on pending migrations in apps/api/src/main.ts
- [X] T039 [US3] Verify migration tooling works end-to-end (quickstart V6) — generate test migration, confirm reviewable, confirm auto-apply in prod entrypoint

**Checkpoint**: Schema changes flow safely through both environments with zero drift risk

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and hardening across all user stories

- [X] T040 [P] Write development environment setup documentation in docs/dev-setup.md
- [X] T041 Run full quickstart.md validation scenarios (V1–V6) and fix any failures
- [X] T042 Verify cross-environment isolation (quickstart V3) — write marker to stage, confirm absent from production
- [X] T043 Verify missing env var fails startup (quickstart V5) — start API without DATABASE_URL, confirm non-zero exit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (CI gates) should be completed first — it protects all subsequent work
  - US2 and US3 can proceed in parallel after US1 is verified
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — Should run after US1 to get CI protection
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — Should run after US1 to get CI protection; independent of US2

### Within Each User Story

- Models/entities before services
- Services before endpoints/config
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005, T006, T007 (Setup configs) can all run in parallel
- T009, T010, T011, T012 (App shells and packages) can all run in parallel
- T014, T015, T016, T017, T018, T019, T020 (US1 lint/typecheck/test configs) can all run in parallel
- T025, T026, T027, T028, T029, T030, T031, T032, T033 (US2 environment files and backups) can all run in parallel
- T034, T035 (US3 Drizzle config and migration dir) can run in parallel

---

## Parallel Example: User Story 1

```bash
# All lint/typecheck/test configs for US1 can be created simultaneously:
Task: "Configure ESLint for apps/api in apps/api/.eslintrc.js"
Task: "Configure ESLint for apps/admin-panel in apps/admin-panel/.eslintrc.js"
Task: "Add TypeScript typecheck target to apps/api in apps/api/tsconfig.json"
Task: "Add TypeScript typecheck target to apps/admin-panel in apps/admin-panel/tsconfig.json"
Task: "Configure Jest for unit tests in apps/api in apps/api/jest.config.ts"
Task: "Configure Jest for unit tests in apps/admin-panel in apps/admin-panel/jest.config.ts"
```

---

## Parallel Example: User Story 2

```bash
# All environment isolation files can be created simultaneously:
Task: "Create Docker Compose for production in docker-compose.yml"
Task: "Create Postgres init script in docker/postgres/init.sql"
Task: "Create .env.example"
Task: "Create .env.stage.example"
Task: "Create systemd unit for API in systemd/rentiq-api-stage.service"
Task: "Create systemd unit for bot in systemd/rentiq-bot-stage.service"
Task: "Document stage Redis and MinIO config in .env.stage.example"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (monorepo scaffold)
2. Complete Phase 2: Foundational (app shells + packages)
3. Complete Phase 3: User Story 1 (CI pipeline with all 5 gates)
4. **STOP and VALIDATE**: Push empty commit, confirm all CI gates pass
5. All subsequent code is now protected by CI

### Incremental Delivery

1. Setup + Foundational → Monorepo scaffolded, app shells exist
2. Add US1 (CI gates) → Test independently → All PRs now gated (MVP!)
3. Add US2 (Environment isolation) → Test independently → Two environments run side by side
4. Add US3 (Migration tooling) → Test independently → Schema changes flow safely
5. Polish → Documentation + quickstart validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (CI pipeline) — must complete first
   - After US1: Developer A: User Story 2, Developer B: User Story 3 (parallel)
3. Both stories complete with CI protection from US1

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
