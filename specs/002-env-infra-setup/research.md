# Research: Environment & Infrastructure Setup

## Resolved Open Questions

### OQ-2: Production deployment trigger

- **Decision**: Production deployment requires a **separate, explicit deploy action** — it is NOT triggered automatically on merge to mainline.
- **Rationale**: Automatic deployment on merge couples code review to production push, which is inappropriate for a small-team ops model where an operator must verify staging first. The CI pipeline gates merge eligibility; a separate deploy step (manual or scripted) gates production rollout.
- **Alternatives considered**: Auto-deploy on merge (rejected — too risky for small team; no staging verification gate).

### OQ-4: Migration review depth

- **Decision**: Standard pull-request code review is **sufficient for all generated migrations**. No additional sign-off step is introduced.
- **Rationale**: Drizzle-generated migrations are deterministic diffs of the schema — they don't contain hand-written logic. Reviewing the schema change in the PR diff is the meaningful review; the generated SQL is a mechanical artifact. Destructive changes (column drops, data migrations) are caught by reviewing the schema diff, not by a separate approval gate.
- **Alternatives considered**: Dedicated migration sign-off for destructive changes (rejected — over-engineered for small team; schema diff review is sufficient).

### OQ-5: Database backup cadence

- **Decision**: **Production**: daily automated `pg_dump` with 30-day retention. **Stage**: weekly automated backup with 14-day retention (stage data is disposable; backups are for convenience, not disaster recovery).
- **Rationale**: Stage is explicitly disposable per ADR-011 — its data is re-creatable from seed scripts. Production backup cadence follows standard small-team best practices for a system with moderate data volume.
- **Alternatives considered**: No backups for stage (rejected — weekly backup is trivial to set up and occasionally useful); continuous WAL archiving (rejected — over-engineered for current scale).

## Technology Research

### Monorepo tooling

**Decision**: pnpm workspaces + Nx.

pnpm is specified in the architecture doc (§9.1, §11) as the workspace manager. Nx provides `enforce-module-boundaries` lint rules that mechanically enforce the constitution's Principle V (module boundaries). Nx also handles task orchestration (build, lint, test) across workspaces.

**Alternatives considered**: Turborepo (rejected — Nx has stronger boundary enforcement and better NestJS integration); Yarn workspaces (rejected — pnpm specified in architecture).

### Migration tooling

**Decision**: `drizzle-kit generate` + `drizzle-kit migrate`.

`drizzle-kit generate` produces migration files from schema diffs; `drizzle-kit migrate` applies them. Migration files are committed to git (constitution Principle VII). Production applies migrations via a pre-start step (`npm run db:migrate` in Docker entrypoint). Stage migrations are run manually by the operator.

**Alternatives considered**: TypeORM migrations (rejected — Drizzle specified in architecture as sole ORM); Knex migrations (rejected — Drizzle specified); raw SQL scripts (rejected — violates Principle VII).

### CI pipeline

**Decision**: GitHub Actions (or equivalent) with 5 parallel jobs.

Jobs: `lint` (Nx boundary checks + ESLint), `typecheck` (`tsc --noEmit` for all TS workspaces), `test:unit` (Jest), `test:e2e` (NestJS e2e against containerized Postgres/Redis via Docker Compose services), `secret-scan` (detects credential-shaped values in diffs). All jobs must pass before merge — branch protection rules enforce this.

**Alternatives considered**: CircleCI (rejected — GitHub Actions is more common for open-source); separate CI per app (rejected — monorepo needs unified pipeline).

### Secret handling

**Decision**: `.env` files gitignored; `.env.example` committed; CI secret scanning.

`.env` and `.env.stage` files are gitignored. `.env.example` and `.env.stage.example` are committed (contain variable names and descriptions, no real values). Secret scanning in CI catches accidental commits. The application resolves secret references (`*_ref` fields in DB) to env-var values at runtime (architecture doc §9.5).

**Alternatives considered**: HashiCorp Vault (rejected — over-engineered for v1; architecture doc §9.5 explicitly defers to Vault as "Future"); AWS Secrets Manager (rejected — same rationale).

### Stage environment

**Decision**: Host-native services via systemd units with `watchmedo auto-restart`.

Per ADR-011 and architecture doc §9.3. Non-production ports for Postgres (5433), Redis (6380), MinIO (9002/9003). Separate `rentiq-stage` database, Redis DB index, and MinIO bucket. Watchmedo provides file-watching auto-restart for development iteration.

**Alternatives considered**: Containerized stage (rejected — ADR-011 explicitly chose host-native for stage to minimize operational friction); Docker Compose for both (rejected — ADR-011 rationale explicitly rejects this for stage).
