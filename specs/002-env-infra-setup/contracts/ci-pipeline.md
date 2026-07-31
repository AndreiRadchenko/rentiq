# CI Pipeline Contract

Phase 0 exposes no external APIs. The only "contract" is the CI pipeline's gate interface.

## Trigger

Every pull request targeting the `main` branch.

## Gates

| Gate | What it checks | Command pattern | Blocks merge? |
|---|---|---|---|
| Lint | Nx boundary rules + ESLint | `nx run-many --target=lint --all` | Yes |
| Typecheck | TypeScript compilation | `nx run-many --target=typecheck --all` (`tsc --noEmit`) | Yes |
| Unit tests | Jest unit test suite | `nx run-many --target=test:unit --all` | Yes |
| E2E tests | NestJS e2e against containerized DB | `nx run api:test:e2e` | Yes |
| Secret scan | Diff scan for credential-shaped values | Custom script or third-party action | Yes |

## Merge Eligibility

- All 5 gates must pass. No partial-green merge. No override path.
- Results visible on every push (NFR-006).
- Branch protection rules on `main` enforce this.

## Failure Behavior

- Each gate reports independently.
- Any single failure blocks merge (FR-005).
- No "merge with one red check" override (spec acceptance scenario 7).

## E2E Test Isolation

- E2E tests run against containerized Postgres/Redis (Docker Compose services in CI).
- Never against stage or production data stores (FR-015).
- CI containers are ephemeral — created per-run, destroyed after.
