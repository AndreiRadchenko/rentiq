Create a functional specification for the Environment & Infrastructure Setup capability of
rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see ADR-011 (per-environment deployment topology). Do not restate them;
reference them.

Focus on operational/non-functional behavior only (this phase has no end-user-facing
business behavior).

Include:
- Operational requirements: two fully isolated environments (containerized production,
  host-native stage) with completely separate data stores.
- CI gating requirement: every pull request must pass lint, typecheck, unit tests, and
  e2e tests before merge; no merge on red.
- Secret-handling requirement: secrets are never committed to the repository.
- Database migration requirement: migrations are generated and reviewed, never
  hand-edited, and run automatically before the new binary starts in production; run
  manually before each stage deployment.
- Acceptance criteria
- Error scenarios (e.g. missing required env var must fail startup, not degrade silently)
- Non-functional requirements
- Open questions

Exclude:
- Exact docker-compose.yml or GitHub Actions YAML content
- Specific tool version pins
- Folder-by-folder monorepo layout (that belongs in the plan)
