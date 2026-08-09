# AGENTS.md

Be concise and direct. Skip preamble, explanations of what you're about to do, and 
summaries of what you did. Output only the final answer, code, or result — no 
step-by-step reasoning, no restating the task, no closing recap.


## Tool behavior notes

**Glob limitation**: The `glob` tool skips dot-prefixed directories (`.specify/`, `.opencode/`, etc.). When searching for files in dot-prefixed paths, use `bash` with `ls` or the `read` tool directly instead of relying on `glob`.

## Repo stage — read this first

This repo currently contains **no application code** — no `package.json`, no `apps/`, no
build/test/lint tooling. It is 100% in the spec-authoring stage for a system that does not
exist yet. Do not assume any of the modules, endpoints, or file layouts described in
`docs/` are implemented — they are a plan, not a codebase. 

## Source of truth

Three docs define the entire system design. Read the relevant one before making any
technical claim or writing a spec/plan:

- `docs/architecture/greenfield-architecture.md` — module boundaries, ADRs (numbered
  decisions — cite by number, e.g. ADR-008), database schema, event catalog, API design.
- `docs/domain/business-rules.md` — numbered business rules (`BR-01` … `BR-14`); some are
  explicitly flagged `[OPEN]` (unresolved, needs product-owner confirmation) — don't treat
  those as settled.
- `docs/roadmap/implementation-roadmap.md` — the 13 delivery phases (0–12), each with
  deliverables and an exit criteria checklist. Phase order encodes real dependencies
  (see the roadmap's Dependency Timeline) — don't reorder without reason.

If these three docs ever conflict with each other or with generated specs, the
architecture/business-rules docs win (they're the hand-authored source; specs are derived).

## Spec-Kit workflow (this repo uses two related-but-different things)

1. **The actual Spec Kit tool** is installed (`.specify/`, OpenCode-integrated slash
   commands in `.opencode/commands/speckit.*.md`): `/speckit.constitution`,
   `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`,
   `/speckit.checklist`, `/speckit.analyze`, `/speckit.implement`, `/speckit.converge`,
   `/speckit.taskstoissues`. Use these slash commands for any spec/plan/task work instead
   of hand-editing files — they keep dependent templates in sync and each command has a
   strict scope guard (e.g. `/speckit.constitution` must not touch application/spec files).
   Running `/speckit.specify` creates a new numbered feature dir under `specs/` on a new
   git branch (see `.specify/scripts/bash/create-new-feature.sh`) — none exist yet.
2. **`.specify/memory/constitution.md` is still the unfilled template** (placeholder
   tokens like `[PRINCIPLE_1_NAME]`) — the project constitution has not been ratified.
   Run `/speckit.constitution` before running `/speckit.specify` on anything; use
   `spec-kit-prompts/constitution.prompt.md` as the input.
3. **`spec-kit-prompts/`** is a hand-authored prompt bank (not a Spec Kit artifact) mapping
   1:1 to the roadmap's phases 00–12, each with `spec.prompt.md` + `plan.prompt.md` meant
   to be pasted as the argument to `/speckit.specify` / `/speckit.plan`. Phase 5 (Rentals)
   is split into 9 independent sub-capability folders
   (`05-rentals/01-rental-registration` … `09-rental-history`) — the split between
   adjacent ones (e.g. Registration vs. Reservation, Overtime vs. Surcharge) is an
   inferred boundary, not something stated in the source docs; each folder's
   `spec.prompt.md` states its own in/out-of-scope notes — respect them rather than
   re-deriving scope from the roadmap yourself.
4. `initprompt.md` and `spec-kit-init.md` at the repo root are historical/meta — they
   record the original request and the bootstrap prompt that generated
   `spec-kit-prompts/`. They're provenance, not living config; no need to keep them in
   sync with anything.

## Planned (not yet real) tech stack — for context only

Per the architecture doc's ADRs, when implementation starts it will be: NestJS modular
monolith (Clean/Hexagonal layering per module: `domain/application/infrastructure/
interface`), PostgreSQL + Drizzle ORM (migrations generated via `drizzle-kit`, never
hand-edited), pnpm + Nx monorepo with `enforce-module-boundaries` lint rules, Telegram bot
as a **separate process, REST-client-only** (no DB access, no business logic), money
always as integer minor units, `org_id` + `TenantContext` (AsyncLocalStorage) on every
request, external systems (Home Assistant, Monobank, Checkbox, MinIO) only ever behind
named ports/gateways, financial/audit tables append-only (never hard-deleted). Don't
scaffold any of this speculatively — it's driven out phase-by-phase via the Spec Kit
workflow above, starting with Phase 0 in the roadmap.
