# Feature Specification: Environment & Infrastructure Setup

**Feature Branch**: `002-env-infra-setup`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Create a functional specification for the Environment & Infrastructure Setup capability of rentiq. Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as context — see ADR-011 (per-environment deployment topology). Do not restate them; reference them. Focus on operational/non-functional behavior only (this phase has no end-user-facing business behavior). Include: operational requirements for two fully isolated environments (containerized production, host-native stage) with completely separate data stores; a CI gating requirement that every pull request must pass lint, typecheck, unit tests, and e2e tests before merge with no merge on red; a secret-handling requirement that secrets are never committed to the repository; a database migration requirement that migrations are generated and reviewed, never hand-edited, run automatically before the new binary starts in production, and run manually before each stage deployment; acceptance criteria; error scenarios; non-functional requirements; and open questions. Exclude exact docker-compose.yml or GitHub Actions YAML content, specific tool version pins, and folder-by-folder monorepo layout."

## Context

This capability corresponds to Phase 0 of the implementation roadmap (`docs/roadmap/implementation-roadmap.md`, "Phase 0 — Environment & Infrastructure Setup"). It has **no end-user-facing business behavior** — no renters, org admins, or station operators interact with anything described here. The "actors" in the scenarios below are developers, operators, and the automated CI system.

The deployment topology decision is already made and is not re-litigated here: two environments share one host, production is containerized and stage runs host-native, and both have fully separate data stores (`docs/architecture/greenfield-architecture.md`, ADR-011). Configuration validation and secrets-reference conventions are likewise already decided (architecture doc §9.4 Configuration Validation, §9.5 Secrets Management) and are referenced, not restated. No business rule in `docs/domain/business-rules.md` governs this phase.

## User Scenarios & Testing *(mandatory)*

<!--
  "Users" in this phase are developers and operators, and the CI system acting on their
  behalf — not end users of the rental product.
-->

### User Story 1 - CI blocks a broken or insecure pull request (Priority: P1)

A developer opens a pull request. Before it can be merged into the mainline branch, the change must automatically pass a fixed set of quality gates. If any gate fails, or if the change would introduce a committed secret, the pull request cannot be merged — regardless of who approves it or how urgent the change is.

**Why this priority**: This is the single control that protects every other phase of the roadmap from regressions and credential leaks from day one. Nothing else in this capability matters if broken or insecure code can still reach the mainline branch.

**Independent Test**: Can be fully tested by opening a pull request that intentionally fails one gate (e.g., a lint violation, a type error, a failing unit test, a failing e2e test, or a file containing a secret-shaped value) and confirming the merge is blocked; then fixing the issue and confirming the same pull request becomes mergeable once every gate is green.

**Acceptance Scenarios**:

1. **Given** a pull request with a lint violation, **When** the CI pipeline runs, **Then** the lint check fails and the pull request is blocked from merging.
2. **Given** a pull request with a type error, **When** the CI pipeline runs, **Then** the typecheck fails and the pull request is blocked from merging.
3. **Given** a pull request with a failing unit test, **When** the CI pipeline runs, **Then** the unit test check fails and the pull request is blocked from merging.
4. **Given** a pull request with a failing end-to-end test, **When** the CI pipeline runs, **Then** the e2e check fails and the pull request is blocked from merging.
5. **Given** a pull request that adds a file containing a credential-shaped value (API key, token, password), **When** the CI pipeline runs, **Then** the secret check fails and the pull request is blocked from merging.
6. **Given** a pull request where lint, typecheck, unit tests, e2e tests, and the secret check all pass, **When** the CI pipeline completes, **Then** the pull request is eligible to merge.
7. **Given** a pull request where every other gate passes but exactly one gate is still red, **When** a reviewer attempts to merge, **Then** the merge is blocked (no partial-green merge is permitted).

---

### User Story 2 - Production and stage stay fully isolated from each other (Priority: P2)

An operator runs, restarts, or reconfigures one environment (production or stage) without any risk of it reading, writing, or otherwise affecting the other environment's data. Each environment has its own complete set of data stores; there is no shared database, cache, or object storage between them.

**Why this priority**: Cross-environment contamination (e.g., a stage bug corrupting production data, or a production credential leaking into stage) is the single highest-impact operational failure this phase must prevent structurally, before any application code exists.

**Independent Test**: Can be fully tested by starting both environments side by side, writing a distinguishable marker record into stage's data stores, and confirming that record is not visible from, or reachable by, the production environment (and vice versa) — without needing any business feature to exist yet.

**Acceptance Scenarios**:

1. **Given** production and stage are both running, **When** a value is written to stage's database, **Then** that value is not readable from production's database (and there is no configuration path that would make it so).
2. **Given** production and stage are both running, **When** their respective configurations are inspected, **Then** every data-store connection target (database, cache, object storage) is distinct between the two environments — none are shared.
3. **Given** the production environment is stopped, restarted, or rebuilt, **When** it comes back up, **Then** the stage environment's data and availability are unaffected.
4. **Given** an operator is configuring stage, **When** they use any environment-specific credential (e.g., a payment-provider test key, a bot token), **Then** that credential is distinct from the equivalent production credential and cannot be used to act against the production environment.

---

### User Story 3 - Database schema changes ship safely in both environments (Priority: P3)

A developer changes the data schema. The change is captured as a generated migration artifact and goes through the same review as any other code change — it is never edited by hand after generation. When the change reaches production, the migration is applied automatically as part of bringing up the new version, before that version starts handling traffic. When the change reaches stage, an operator applies the migration manually as a distinct step before deploying the new version.

**Why this priority**: Getting this workflow right early prevents an entire class of "schema drift" incidents once real application modules start landing in later phases; it is lower priority than the CI gate and environment isolation because no schema exists to migrate yet.

**Independent Test**: Can be fully tested by introducing a trivial schema change, confirming a migration artifact is generated (not hand-authored), confirming it is reviewable as a normal part of the pull request, then exercising a production-style deploy (migration runs automatically before the new binary begins serving) and a stage-style deploy (migration must be run manually first, and the new version does not silently proceed on a schema it doesn't match).

**Acceptance Scenarios**:

1. **Given** a developer changes the data schema, **When** they prepare their change, **Then** a migration artifact is generated from the schema change rather than written by hand.
2. **Given** a generated migration artifact, **When** the pull request is reviewed, **Then** the migration file is part of the reviewable diff like any other code change.
3. **Given** someone hand-edits a previously generated migration file, **When** this is identified in review, **Then** the change is treated as a defect and rejected before merge.
4. **Given** a production deployment of a new version with pending migrations, **When** the deployment proceeds, **Then** the migration is applied automatically and completes before the new binary begins serving traffic.
5. **Given** a production migration fails during a deployment, **When** this happens, **Then** the new binary does not start serving traffic on a partially migrated or mismatched schema.
6. **Given** a stage deployment with pending migrations, **When** an operator deploys the new version, **Then** the migration must have been run manually as a preceding, distinct step — it is not triggered automatically as part of the stage deploy.

---

### Edge Cases (Error Scenarios)

- **Missing required configuration/environment variable**: When any required configuration value (e.g., a database connection string, a required secret reference) is absent or malformed at process startup, the process **must fail to start** with a clear error identifying the missing/invalid value. It must never start in a partially-configured or silently-degraded state.
- **Partial CI gate failure**: If any one of lint, typecheck, unit tests, or e2e tests fails, the pull request is blocked from merging even if all other gates pass. There is no "merge with one red check" override path.
- **Secret accidentally staged for commit**: If a commit or pull request would introduce a value that looks like a credential/secret, this must be caught by the CI secret check and block the merge, independent of whether the author intended to commit it.
- **Hand-edited migration file**: A migration file that has been modified after generation (rather than regenerated from a schema change) must be identified during review and rejected before merge; it must not reach production or stage.
- **Production migration failure mid-deploy**: If the automatic pre-start migration step fails, the new binary must not start and must not begin serving traffic against an unknown or partially-migrated schema; the previous version's availability should not be endangered by a failed migration attempt. If the migration succeeds but the new binary subsequently fails its own startup/health check, no automatic rollback is attempted — an operator must investigate and resolve manually. Automatic rollback of irreversible schema changes is deliberately excluded.
- **Stage migration skipped**: If an operator deploys a new stage version without first running the pending migration manually, the new binary detects the schema mismatch at startup via its own validation (FR-009) and fails to start with a clear error identifying the pending migration — no separate pre-flight mechanism is required.
- **Cross-environment configuration mistake**: If an operator misconfigures production to point at a stage data store (or vice versa), this must be structurally prevented or immediately and visibly rejected — not a soft warning that allows startup to proceed.
- **Environment outage independence**: An outage, restart, or data-store failure in one environment must not cascade into, or degrade, the other environment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide two environments — production and stage — matching the topology decided in ADR-011 (production containerized, stage host-native), both capable of running on a single shared host without interfering with each other.
- **FR-002**: Production and stage MUST each have their own complete, independent set of data stores (relational database, cache, object storage); no data store instance, database name, or bucket may be shared between the two environments.
- **FR-003**: Every environment-specific credential (payment-provider keys, bot tokens, device/station tokens, etc.) MUST be distinct per environment; a stage credential must never grant access to a production resource or vice versa.
- **FR-004**: Every pull request targeting the mainline branch MUST automatically run, at minimum, a lint check, a typecheck, a unit test suite, and an end-to-end test suite.
- **FR-005**: A pull request MUST be blocked from merging unless every required check (lint, typecheck, unit tests, e2e tests, and secret scanning) reports success; a single failing check blocks the merge regardless of the state of the others.
- **FR-006**: The CI pipeline MUST include an automated check that detects credential-shaped values being introduced into the repository and blocks the merge if one is found.
- **FR-007**: Secrets (credentials, tokens, keys) MUST never be committed to the repository in any form; only non-secret references/placeholders (e.g., example configuration files without real values) may be committed.
- **FR-008**: At process startup, the system MUST validate that every required configuration value is present and well-formed before accepting traffic.
- **FR-009**: If a required configuration value is missing or malformed at startup, the system MUST fail to start (non-zero exit / crash) rather than start in a degraded, partially-configured, or silently-defaulted state.
- **FR-010**: Database schema changes MUST be captured as generated migration artifacts derived from the schema definition; migration files MUST NOT be hand-authored or hand-edited after generation.
- **FR-011**: Generated migration artifacts MUST go through the same review process as other code changes before being merged.
- **FR-012**: In production, pending migrations MUST be applied automatically as a step that completes before the new application binary begins serving traffic.
- **FR-013**: If the automatic production migration step fails, the new binary MUST NOT begin serving traffic.
- **FR-014**: In stage, pending migrations MUST be applied manually by an operator as a distinct step preceding each stage deployment; migration application MUST NOT be automatically triggered as part of a stage deploy.
- **FR-015**: The end-to-end test suite MUST run against isolated, disposable data-store instances dedicated to CI — never against stage's or production's actual data stores.

### Non-Functional Requirements

- **NFR-001 (Fail-fast over degrade)**: The system MUST always prefer failing fast and loudly (refusing to start, blocking a merge) over continuing in a degraded, partially-functional, or silently-misconfigured state.
- **NFR-002 (Isolation)**: No operational action taken in one environment (deploy, restart, data write, credential rotation) may have an observable effect on the other environment.
- **NFR-003 (Auditability)**: Every merge to mainline must be traceable to a pull request whose CI run recorded a pass/fail result for each required gate.
- **NFR-004 (Reproducibility)**: Bringing up either environment from a clean state must be a deterministic, repeatable operation that does not depend on undocumented manual steps beyond those explicitly defined as manual (e.g., the stage migration step).
- **NFR-005 (No implicit trust between environments)**: Configuration, credentials, and connection targets for one environment must never be usable as a fallback or default for the other environment.
- **NFR-006 (Timely gate feedback)**: CI gate results (lint, typecheck, unit, e2e, secret scan) must be available to the author on every push to a pull request, not only on demand or at merge time.

### Key Entities

- **Environment**: A named, isolated deployment context (`production` or `stage`) with its own configuration set, credentials, and data stores. Has a deployment topology (containerized vs. host-native) fixed by ADR-011.
- **CI Pipeline Run**: The set of automated gate results (lint, typecheck, unit tests, e2e tests, secret scan) produced for a given pull request state; determines merge eligibility.
- **Migration Artifact**: A generated, reviewable record of a schema change, applied automatically (production) or manually (stage) before the corresponding application version begins serving traffic.
- **Secret Reference**: A non-secret pointer (e.g., a configuration key name) that resolves to an actual credential value at runtime from an environment-specific source; distinct from the secret value itself, which is never committed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pull requests with at least one failing required check (lint, typecheck, unit, e2e, secret scan) are blocked from merging — zero exceptions.
- **SC-002**: 0 incidents of production and stage data cross-contamination (shared data store, leaked cross-environment credential) are observed across any deployment.
- **SC-003**: 100% of process startups with a missing or malformed required configuration value result in an immediate startup failure — 0% result in a degraded or silently-misconfigured running process.
- **SC-004**: 100% of merged schema changes are backed by a generated migration artifact; 0% are hand-edited after generation.
- **SC-005**: 100% of production deployments apply all pending migrations before the new version begins serving traffic; 0% of production deployments serve traffic against an unmigrated or partially-migrated schema.
- **SC-006**: 0 instances of a real secret value appearing anywhere in repository history.

## Clarifications

### Session 2026-07-29

- Q: How is schema drift detected on stage when code version outpaces DB state? → A: Startup-time detection only — the new binary's own schema validation catches drift and fails loudly; no separate pre-flight check.
- Q: If a production migration succeeds but the new binary fails startup, what happens? → A: Manual intervention only — no automatic rollback; consistent with small-team ops model and irreversible-change safety.
- Q: Does this spec need explicit observability requirements (logging, metrics) for CI and deployment operations? → A: No additional requirements needed — FR-009 (fail-fast) and NFR-006 (timely feedback) already cover the operational visibility concern;具体的 observability tooling belongs in the plan.

## Assumptions

- Both environments run on a single shared host per ADR-011; multi-host or multi-region topology is out of scope for this phase.
- The CI system referenced throughout is "a CI pipeline" in the abstract (e.g., GitHub Actions or an equivalent), consistent with the roadmap's "or equivalent" framing — this spec does not mandate a specific vendor.
- Required-configuration validation at startup follows the pattern already decided in the architecture doc (§9.4): a schema-driven validation layer rejects the process start on missing/malformed values. This spec does not redefine that mechanism, only the operational requirement that it exists and fails closed.
- Migration review is performed via the same pull-request code review used for all other changes; no additional specialized migration-approval role is introduced at this phase.
- Secret scanning is satisfied by some automated detection mechanism as part of the CI pipeline; this spec does not mandate a specific scanning tool.
- "Stage deployment" and "production deployment" are treated as distinct operational events with different migration triggers (manual vs. automatic), per the explicit requirement; the exact mechanism that initiates each deployment (manual command vs. automated pipeline trigger) is not defined by this spec.
- No renters, org admins, or station operators are affected by or aware of this capability; it is purely internal/operational.

## Open Questions

- **OQ-1 (RESOLVED)**: Stage schema drift is detected at startup by the application's own validation (FR-009). No separate pre-flight check mechanism is needed — consistent with NFR-001 (fail-fast over degrade).
- **OQ-2 (DEFERRED to plan)**: Is a production deployment triggered automatically on merge to mainline, or does it require a separate, explicit deploy action? Defers to `/speckit.plan` — the answer affects deployment pipeline design, not spec scope.
- **OQ-3 (RESOLVED)**: No automatic rollback. If a migration succeeds but the new binary fails startup/health, an operator investigates and resolves manually. Automatic rollback of irreversible schema changes is deliberately excluded.
- **OQ-4 (DEFERRED to plan)**: Is standard pull-request code review sufficient for all generated migrations, or do destructive/irreversible changes require additional sign-off? Defers to `/speckit.plan` — a governance detail, not a spec-level constraint.
- **OQ-5 (DEFERRED to plan)**: What is the expected backup/recovery cadence for each environment's relational database? Defers to `/speckit.plan` — an operational concern that doesn't block spec completeness.
