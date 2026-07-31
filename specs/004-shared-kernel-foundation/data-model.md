# Data Model: Shared Kernel + Foundation

**Date**: 2026-07-31
**Feature**: 004-shared-kernel-foundation

## Value Objects

### Money

**Purpose**: Represent monetary amounts as integer minor units with explicit currency. Enforce exact arithmetic and currency matching.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| amountMinor | integer | ≥ 0 | Amount in minor units (e.g., 1000 = ₴10.00) |
| currency | Currency enum | Required, one of {UAH, EUR} | ISO 4217-style code |

**Methods**:
- `add(other: Money): Money` — adds two Money values; throws if currencies differ
- `subtract(other: Money): Money` — subtracts two Money values; throws if currencies differ
- `equals(other: Money): boolean` — compares amountMinor and currency
- `isGreaterThan(other: Money): boolean` — compares amounts; throws if currencies differ
- `isLessThan(other: Money): boolean` — compares amounts; throws if currencies differ
- `static from(amountMinor: number, currency: Currency): Money` — factory with validation

**Invariants**:
- `amountMinor` is always an integer (no floats, no decimals)
- `currency` is always one of {UAH, EUR}
- Two Money values can only be compared or combined if they share the same currency
- `Money.from()` rejects negative amounts (amountMinor ≥ 0)

---

### Currency

**Purpose**: Enum of supported currency codes.

| Value | Description |
|-------|-------------|
| UAH | Ukrainian Hryvnia (₴) |
| EUR | Euro (€) |

**Note**: Future currencies require a code change and migration. The allowed set is intentionally small for v1.

---

### EntityId<T>

**Purpose**: Type-safe UUID wrapper that prevents mixing IDs of different entity types.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| value | string (UUID v4) | Valid UUID format | The wrapped UUID |

**Methods**:
- `static generate(): EntityId<T>` — creates a new random UUID
- `static from(value: string): EntityId<T>` — wraps an existing UUID (validates format)
- `equals(other: EntityId<T>): boolean` — compares UUID values
- `toString(): string` — returns the raw UUID string

**Type Parameter**: `T` is a phantom type tag (e.g., `'OrgId'`, `'RenterId'`) that prevents assigning an OrgId where a RenterId is expected.

---

### OrgId

**Purpose**: Type-safe identifier for Organization entities.

**Extends**: `EntityId<'OrgId'>`

**Note**: Every business table carries an `org_id` foreign key of this type. TenantContext stores the current OrgId.

---

### PhoneNumber

**Purpose**: Represent and validate phone numbers.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| value | string | E.164 format (e.g., +380501234567) | International phone number |

**Methods**:
- `static from(value: string): PhoneNumber` — validates and wraps
- `equals(other: PhoneNumber): boolean`
- `toString(): string`

**Invariants**:
- Must match E.164 format: `+` followed by 1-15 digits
- No spaces, no dashes, no parentheses in stored value

---

### Locale

**Purpose**: Represent user interface language preference.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| value | string | One of {uk, en} | BCP 47 language tag (simplified) |

**Methods**:
- `static from(value: string): Locale` — validates against allowed set
- `equals(other: Locale): boolean`
- `toString(): string`

**Invariants**:
- Only `uk` (Ukrainian) and `en` (English) are allowed
- Default is `uk` if not specified

---

### TimeWindow

**Purpose**: Represent a maintenance window (start time, end time within a day).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| startTime | string (HH:MM) | 24-hour format | Window start time |
| endTime | string (HH:MM) | 24-hour format | Window end time |
| timezone | string | IANA timezone (default: Europe/Kyiv) | Timezone for the window |

**Note**: TimeWindow is defined here for future use by the organizations module. Phase 1 only defines the value object; no business logic uses it yet.

---

## Domain Events

### DomainEvent (Abstract Base)

**Purpose**: Base class for all domain events.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| eventId | EntityId | Auto-generated | Unique event identifier |
| occurredAt | Date | Auto-generated | Timestamp of event occurrence |
| eventType | string | Required | Discriminator for event type |

**Note**: Phase 1 defines the base class only. Concrete events are defined in later phases.

---

## Repository Patterns

**No repositories in Phase 1.** shared-kernel defines the TenantContext mechanism but does not contain any repository implementations. Repositories belong to the modules that own the data (e.g., organizations module owns the Organization repository).

**Repository Base Pattern** (documented for later phases):
- Every repository reads `orgId` from `TenantContext.getOrgId()` automatically
- Repository queries are always scoped to the current tenant
- No repository method accepts `orgId` as a parameter

---

## Database Tables

**No tables in Phase 1.** shared-kernel provides the Drizzle connection module and config validation, but does not define any business tables. Tables are created by the modules that own the data.

**Future pattern** (per architecture doc §4.2):
- Every business table carries `org_id` as a foreign key
- `org_id` is set from TenantContext, never from caller input
- Financial/audit tables are append-only (Principle X)
