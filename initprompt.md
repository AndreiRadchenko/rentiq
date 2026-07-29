i want to implement project with github spec-kit  https://github.com/github/spec-kit
create spec-kit-init.md file wich will contain prompt whom goals will:

create project structure

create .md files to use with spec-kit as prompt at different spec-kit workflow stage:
- constitution.md

with given implementation project roadmap create specification and plan promt for every implementation stage:

  - split Rental stage into multiple specifications/plans

      Rental Registration

      Reservation

      Payment initiation

      Pickup

      Active Rental

      Return

      Overtime

      Surcharge

      Rental History
      Each becomes an independent spec.


For each of roadmap stage create  specifications and plan prompt as md file i can use later with Spec Kit.

consider all docs we've created
consider next blueprint example for spec-kit promp creation:

Given your project, I'd treat **Spec Kit as a requirements and planning framework**, while your architecture document remains the technical blueprint. The three stages have very different goals:

| Stage | Goal | Output | Focus |
|--------|------|--------|-------|
| Constitution | Define project principles | `constitution.md` | How the team builds software |
| Specification | Define what to build | `spec.md` | Business requirements |
| Plan | Define how this feature will be built | `plan.md`, `research.md`, `tasks.md` | Technical implementation |

The biggest mistake people make is putting architecture into the specification, or business requirements into the plan.

---

# 1. Constitution

Think of this as the project's "laws."

It should almost never mention a specific feature.

Instead it defines permanent engineering rules.

For your project, examples would be:

## Architecture principles

- Modular Monolith
- DDD
- Clean Architecture
- Hexagonal Architecture
- Event-driven between modules
- Multi-tenancy from day one

---

## Code quality

- No business logic in controllers
- Domain layer has no NestJS dependencies
- Application layer coordinates use cases
- Infrastructure implements ports

---

## Database

- PostgreSQL only
- Drizzle ORM
- No direct SQL outside repositories
- Money stored in integer minor units

---

## Module boundaries

- Modules communicate only through public interfaces
- Never import another module's infrastructure
- Never read another module's database tables

---

## Testing

- Domain logic requires unit tests
- Integration tests for APIs
- Contract tests for external providers

---

## External integrations

- Home Assistant behind SmartLockGateway
- Monobank behind PaymentGateway
- Checkbox behind FiscalGateway

---

## Security

- JWT
- RBAC
- Tenant isolation
- Audit log

---

## Documentation

- ADR required for architectural changes
- Public API documented with OpenAPI

---

### Prompt for Constitution

I would give Spec Kit something like:

> Create a project constitution for a greenfield SUP rental platform.
>
> The constitution should define permanent engineering principles rather than implementation details.
>
> Use these constraints:
>
> - NestJS Modular Monolith
> - DDD
> - Clean Architecture
> - Hexagonal Architecture
> - Event-driven module communication
> - PostgreSQL + Drizzle
> - Multi-tenancy from day one
> - Telegram Bot as REST client only
> - No business logic in controllers
> - Strong module boundaries
> - Incremental development
> - Testability first
> - Security by default
> - ADRs required for architectural changes

Notice there is **no mention of rentals**.

---

# 2. Specification

Specification answers only one question:

> What does the system need to do?

It should avoid implementation details.

Suppose you're implementing Reservations.

A specification should describe:

- User story
- Business rules
- Acceptance criteria
- Edge cases
- Non-functional requirements

Example:

> A renter selects one or more lockers.

Then

> Locker becomes reserved for 10 minutes.

Then

> Other renters cannot reserve it.

Then

> Reservation expires automatically.

Then

> Payment starts.

No mention of:

- NestJS
- PostgreSQL
- Redis
- Cron
- BullMQ

Those belong later.

---

### Prompt for Specification

For your Reservation feature:

> Create a functional specification for the Reservation capability.
>
> Use the architecture document only as context.
>
> Focus on business behavior.
>
> Do not describe implementation.
>
> Include:
>
> - User stories
> - Functional requirements
> - Business rules
> - Acceptance criteria
> - Error scenarios
> - Non-functional requirements
> - Open questions
>
> Exclude:
>
> - Database design
> - NestJS modules
> - API endpoints
> - Classes
> - Services

---

Another example

Payments

> Create a specification for Payment Processing.
>
> Include Monobank integration, webhook verification, idempotency, payment retries, surcharge payments and fiscalization.
>
> Do not design implementation.

---

# 3. Plan

This is where architecture finally comes in.

The plan says

> Given the specification and the architecture, how will we build it?

Here implementation details belong.

For Reservations the plan might include:

Research

- Reservation race conditions
- PostgreSQL locking
- Partial unique indexes

Architecture

- Rentals module
- Pricing module
- Events

Database

- Reservation table changes

API

- POST /rentals

Jobs

- Reservation expiration

Tests

- Unit
- Integration
- Concurrent reservations

Migration

- None (greenfield)

---

### Prompt for Plan

For your project, I'd use something like:

> Create an implementation plan for the Reservation specification.
>
> Follow the project constitution.
>
> Follow the Greenfield Architecture document.
>
> Preserve module boundaries.
>
> Include:
>
> - Architecture impact
> - Required modules
> - Domain model
> - Database changes
> - APIs
> - Events
> - Background jobs
> - Testing strategy
> - Risks
> - Migration considerations
> - Task breakdown
>
> Do not generate production code.

---

# The complete workflow

For your project, each feature should flow like this:

```text
Architecture
        │
        ▼
Constitution (project laws)
        │
        ▼
Specification (business requirements)
        │
        ▼
Plan (technical design)
        │
        ▼
Tasks
        │
        ▼
Implementation
        │
        ▼
Review
```

The important dependency is one-way: the **Constitution** constrains every **Specification** and **Plan**, while the **Specification** defines *what* to build and the **Plan** defines *how* to build it within those constraints.

## How I'd adapt this for your project

Your architecture document is already unusually complete. I would **not** ask Spec Kit to invent architecture. Instead, I'd use it like this:

- **Constitution:** distilled from your architecture into stable engineering rules that rarely change.
- **Specification:** written for one capability at a time (e.g., "Admin Authentication", "Locker Reservation", "Payment Processing", "Rental Return").
- **Plan:** generated from the specification while explicitly referencing your architecture document and constitution, producing implementation steps and tasks that stay consistent with your modular monolith, DDD boundaries, and multi-tenant design.

That approach lets your architecture remain the long-lived source of truth while Spec Kit drives detailed planning and implementation feature by feature.