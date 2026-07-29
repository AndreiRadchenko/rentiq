Create an implementation plan for the Environment & Infrastructure Setup specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (ADR-011) and
docs/roadmap/implementation-roadmap.md (Phase 0 — Environment & Infrastructure Setup,
deliverables 0.1–0.5 and exit criteria).

Preserve module boundaries: this phase produces no NestJS business modules — it produces
the monorepo scaffold, CI, and environment configuration that every later module depends
on.

Include:
- Architecture impact
- Required scaffolding: pnpm workspace + Nx at repo root, apps/api (NestJS),
  apps/admin-panel (Next.js), apps/telegram-bot (Python), packages/i18n, packages/config;
  Nx enforce-module-boundaries lint rules
- Production environment: docker-compose.yml covering postgres:16, redis:7, minio:latest,
  api, admin-panel, telegram-bot, nginx; dedicated non-superuser Postgres role; Redis with
  password auth + AOF; MinIO rentiq-prod bucket with retention lifecycle rules; nginx TLS
  termination; .env.example
- Stage environment: host-native Postgres/Redis/MinIO at non-production ports;
  rentiq-stage database/bucket; .env.stage.example; systemd unit templates
  (rentiq-api-stage.service, rentiq-bot-stage.service, watchmedo auto-restart)
- CI pipeline jobs: lint, typecheck, test:unit, test:e2e (containerized Postgres/Redis);
  secret scanning
- Database changes: none yet — set up drizzle-kit generate/migrate tooling only
- APIs: none yet
- Events: none yet
- Background jobs: none yet
- Testing strategy: CI must pass on an empty commit
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 0's exit criteria (docker compose up starts all services;
  CI passes on an empty commit; both Postgres databases accessible and empty; MinIO
  console accessible)

Do not generate production code.
