# Feature Specification: IAM + Organizations

**Feature Branch**: `005-iam-organizations`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Create a functional specification for the IAM + Organizations capability of rentiq. Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as context — see BR-01.1 through BR-01.6 and BR-02.1, BR-02.2. Do not restate them; reference them. Focus on business behavior only. Include: user stories; functional requirements (renter registration and explicit informed consent as a precondition for any booking; permanent binding of a renter to exactly one organization; renter locale selection at registration and change at any time; the three-tier admin role hierarchy and what each can and cannot do; admin accounts and renter accounts as fully separate identities that are never merged; organization-level branding and supported-locale-set configuration); business rules; acceptance criteria; error scenarios; non-functional requirements; open questions, including confirming the Ukrainian data-retention law minimum period before anonymizing a renter's identifying fields after a deletion request (BR-01.6)."

## Context

This capability corresponds to Phase 2 of the implementation roadmap (`docs/roadmap/implementation-roadmap.md`, "Phase 2 — IAM + Organizations"): admin login and the multi-tenant organization model working end-to-end. It is the capability that defines **who may act in the system** — renters and three tiers of admins — and **the boundaries they act within** — one organization per renter, full isolation between organizations, and branding/localization configured per organization.

The business rules are defined in `docs/domain/business-rules.md` (BR-01.1–BR-01.6, BR-02.1–BR-02.2) and the multi-tenancy and locale mechanisms in `docs/architecture/greenfield-architecture.md` (ADR-006, ADR-012, §4.3, §4.4). This spec does not restate those documents; it derives testable business behavior from them and references them. Database schema, API endpoint shapes, module/class structure, and token mechanics are explicitly out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Renter registration with explicit informed consent (Priority: P1)

A person opens the entry point of a specific operator (e.g., that operator's Telegram bot). Before they can rent anything, they must provide their name and phone number and actively confirm that they understand and agree to how their personal data will be processed. Consent must be an affirmative action — never pre-ticked or implied. Only after confirmation is a Renter identity created, permanently bound to that operator's organization, and only from that moment can the person book lockers. Until then, every attempt to book, open a locker, or pay is refused and routed back to registration.

**Why this priority**: The registration and consent gate is the foundation of everything else. Without it there are no renters, no bookings, and no rental revenue. It is also the platform's core legal obligation under Ukrainian data-protection law, so it must be correct before any other capability is built.

**Independent Test**: Can be fully tested by walking a fresh person through the registration flow with and without confirming consent, then attempting a booking in each case. Delivers the guarantee that every booking in the system belongs to a registered, consenting renter.

**Acceptance Scenarios**:

1. **Given** a person who has never registered interacts with the system, **When** they attempt to book a locker, **Then** they are routed to registration and cannot proceed to booking until registration and consent are completed.
2. **Given** the registration flow presents a personal-data processing statement, **When** the person submits name and phone without actively confirming consent, **Then** registration is rejected and no renter identity is created.
3. **Given** a person provides their name and phone and actively confirms consent, **When** registration completes, **Then** a Renter identity is created bound to that operator's organization, the consent timestamp is recorded, and the person can immediately book.
4. **Given** a person declines consent, **When** the flow ends, **Then** no identity is created and nothing is stored that could be used for booking; the person may re-attempt registration at any later time.

---

### User Story 2 - A renter is permanently bound to exactly one organization (Priority: P1)

A person who registers through Organization A's entry point is A's renter, permanently. There is no mechanism to transfer, merge, or switch that identity to Organization B. If the person wants to rent from Organization B, they register afresh through B's entry point, which produces a separate identity that belongs to B. Organization A's record of the original renter — including its rental and payment history — is untouched by any of this.

**Why this priority**: The one-renter-one-organization binding is the backbone of multi-tenant data integrity. Allowing a renter to float between organizations would make per-organization histories, debts, and analytics unsound. It must hold before the platform can safely serve more than one operator.

**Independent Test**: Can be fully tested by registering a renter under Organization A, attempting to switch them to Organization B (expecting rejection), then registering the same person under Organization B and confirming two separate identities with independent histories.

**Acceptance Scenarios**:

1. **Given** a renter registered via Organization A's entry point, **When** they request to be moved to Organization B, **Then** the request is rejected and the renter is told that renting from Organization B requires a new registration through B's entry point.
2. **Given** a person who is already a renter of Organization A registers via Organization B's entry point, **When** registration completes, **Then** a separate renter identity under Organization B is created and the Organization A identity and its history remain unchanged.
3. **Given** a renter of Organization A, **When** any of their operations executes, **Then** the operation is scoped to Organization A and can never read, modify, or affect another organization's data.

---

### User Story 3 - Three-tier admin role hierarchy (Priority: P1)

Operator staff log in as administrators, each holding one of three roles with strictly hierarchical permissions:

- **SUPER_ADMIN** — platform level, cross-organization: creates and manages organizations and onboards operators.
- **ORG_ADMIN** — full control within one organization: stations, lockers, tariffs, renters, admin accounts, analytics.
- **STATION_OPERATOR** — operational access to assigned stations only: manually open/close lockers, view rental status, resolve support reports.

Each role inherits the capabilities of the roles below it within its own scope. A STATION_OPERATOR can never manage pricing, branding, or other users, and can never see or touch anything outside their assigned stations. A role check is enforced at every access path — there is no way to reach a privileged action through a different route.

**Why this priority**: Administrators are the other human actors in the system and the only ones who can change configuration and handle exceptions. The role hierarchy bounds what an individual can do and see, which is the primary control against both accidental and malicious damage. It is as foundational as registration and must exist before any org manages real renters.

**Independent Test**: Can be fully tested by logging in as each role and exercising a matrix of actions (manage org, manage pricing/branding/users, operate assigned vs. unassigned stations) and verifying each outcome matches the role's scope.

**Acceptance Scenarios**:

1. **Given** a logged-in SUPER_ADMIN, **When** they create an organization and an ORG_ADMIN account for it, **Then** both succeed and the new organization exists with its ORG_ADMIN.
2. **Given** a logged-in ORG_ADMIN, **When** they manage stations, lockers, tariffs, renters, and admin accounts within their own organization, **Then** all of these succeed.
3. **Given** a logged-in ORG_ADMIN, **When** they attempt any action on another organization's data, **Then** the action is denied.
4. **Given** a logged-in STATION_OPERATOR assigned to stations X and Y, **When** they open/close lockers, view rental status, and resolve support reports for X and Y, **Then** all of these succeed.
5. **Given** a logged-in STATION_OPERATOR, **When** they attempt to change pricing, edit branding, manage users, or access any station not assigned to them, **Then** the attempt is denied.

---

### User Story 4 - Renter locale selection and change at any time (Priority: P2)

At registration the renter chooses their language from the set of locales their organization supports. Every system message — notification, error, instruction — is then delivered to that renter in the chosen language. The renter can change their locale at any time, and the change applies to all messages sent afterwards, immediately.

**Why this priority**: Delivery of correct-language messages is a day-one trust requirement for renters, but it depends on registration (US1) and on the organization's supported-locale configuration (US6) already existing. It is therefore P2 rather than P1.

**Independent Test**: Can be fully tested by registering a renter with locale `uk`, triggering a booking-related notification, then changing the renter's locale to `en` and triggering another notification; both messages must arrive in the expected language.

**Acceptance Scenarios**:

1. **Given** an organization supports `{uk, en}` and a person registers, **When** they select `uk`, **Then** all subsequent system messages to them are delivered in Ukrainian.
2. **Given** a registered renter currently in locale `uk`, **When** they change their locale to `en`, **Then** all system messages sent after the change are delivered in English.
3. **Given** an organization supports `{uk, en}`, **When** a renter attempts to select a locale outside that set (e.g., `de`), **Then** the selection is rejected.

---

### User Story 5 - Admin and renter identities are separate and never merged (Priority: P2)

Admin accounts and renter accounts are two completely different identity types. An administrator cannot rent equipment using their admin account — the system simply refuses. If an administrator also wants to rent, they register as a renter like anyone else, producing a second, separate identity. Even when the same human holds both, the two identities are never merged, linked as the same account, or conflated in any operation.

**Why this priority**: Identity separation is a privacy and accountability guarantee: an admin identity carries elevated privileges that must never leak into, or be confused with, a personal rental identity. It depends on US1 and US3 both existing, so it is P2.

**Independent Test**: Can be fully tested by logging in as an admin and attempting a booking (expecting refusal), then registering the same person as a renter and confirming a fully separate renter identity with its own booking capability.

**Acceptance Scenarios**:

1. **Given** a logged-in admin, **When** they attempt to book a locker with their admin account, **Then** the attempt is denied.
2. **Given** a person who is both an ORG_ADMIN and a renter of the same organization, **When** they use both accounts, **Then** the two identities remain distinct — separate permissions, separate rental histories, separate records — and are never merged.
3. **Given** an admin views renter records, **When** a renter record for a person who is also an admin is displayed, **Then** the system shows only the renter identity and never exposes or merges the person's admin identity.

---

### User Story 6 - Organization branding and supported-locale-set configuration (Priority: P2)

Each organization is an independent white-label operator. A SUPER_ADMIN sets up an organization and its operators configure it: a business name, logo, and colors that appear at the organization's customer touchpoints, and a set of supported locales that bounds which languages its renters may choose. Two organizations sharing the platform are fully isolated — neither can see the other's renters, rentals, or revenue. When an organization adds a new locale to its supported set, existing renters keep their current locale; they are never forcibly migrated.

**Why this priority**: Multi-organization operation is the platform's core value proposition, but the platform functions with a single organization (the seeded dev org) before branding and locale configuration are complete. It is therefore P2 rather than P1.

**Independent Test**: Can be fully tested by creating a second organization, setting its branding and locale set, registering a renter under it, and confirming the renter sees only that organization's branding and only its supported locales — with zero visibility of the first organization's data.

**Acceptance Scenarios**:

1. **Given** a new organization is created, **When** its branding (business name, logo, colors) is configured, **Then** the organization's customer touchpoints reflect that branding.
2. **Given** an organization's supported locale set is `{uk}`, **When** a person registers with it, **Then** only Ukrainian is offered as a choice.
3. **Given** an organization with supported locale set `{uk}` adds `en`, **When** existing renters with locale `uk` are checked, **Then** they retain `uk` and may switch to `en` only if they choose to.
4. **Given** two organizations A and B exist on the platform, **When** any admin or renter of A performs any operation, **Then** B's renters, rentals, and revenue are never visible or accessible, and vice versa.

---

### User Story 7 - Renter data deletion and anonymization (Priority: P3)

When a renter submits a data deletion request (right to erasure), the system does not hard-delete them. The renter is deactivated — disabled so that no further bookings are possible — while their financial and fiscal records are retained for the confirmed 3-year retention period. Only after that period elapses are the renter's identifying fields (name, phone) anonymized; the financial and fiscal records themselves remain intact and audit-consistent. A renter with an active rental or an unpaid surcharge cannot submit a deletion request at all until those obligations are settled.

**Why this priority**: Correctness here is legally mandatory, but it only matters once real renters and real financial records exist, which requires several earlier capabilities. It is therefore P3, but the retention/anonymization behavior is specified now because the registration flow must record everything needed to honor it later.

**Independent Test**: Can be fully tested by submitting a deletion request for a renter with a settled, completed rental, confirming the renter is disabled immediately, and confirming that anonymization of identifying fields occurs automatically after the 3-year retention period and never before; and by confirming that a renter with an open obligation cannot submit a deletion request.

**Acceptance Scenarios**:

1. **Given** a renter with settled rental, payment, or fiscal history submits a deletion request, **When** the request is processed, **Then** the renter is disabled and can no longer book.
2. **Given** a disabled renter whose 3-year retention period has elapsed, **When** the automatic anonymization runs, **Then** the renter's identifying fields are anonymized while financial and fiscal records remain intact.
3. **Given** a disabled renter whose 3-year retention period has not yet elapsed, **When** the automatic anonymization runs, **Then** the renter's identifying fields remain unchanged.
4. **Given** a renter with an active rental or an unpaid surcharge submits a deletion request, **When** the request is received, **Then** it is rejected with a clear message, and the renter may re-request deletion once all obligations are settled.

---

### Edge Cases (Error Scenarios)

- **Registration without consent confirmation**: The person submits name and phone but never actively confirms consent — registration must be rejected, and no identity, draft, or partial record that could be used for booking may be created.
- **Registration with missing name or phone**: The person omits either field — registration is rejected with a clear message in the organization's default locale; nothing is persisted.
- **Duplicate registration in the same organization**: A person who is already a renter of the organization — recognized by their phone number — attempts to register again through any of the organization's entry points; they are recognized as already registered and no duplicate identity is created.
- **Renter requests to switch organizations**: Rejected; the renter is informed that a new registration through the target organization's entry point is required (BR-01.2).
- **Locale change to an unsupported locale**: Rejected with the list of locales the organization supports (BR-02.2).
- **Locale change during an active rental**: Allowed at any time (BR-01.3); messages already generated before the change are not retroactively re-sent.
- **STATION_OPERATOR with no assigned stations**: Can log in but has no operational scope; every station operation is denied.
- **Last active ORG_ADMIN**: The system must never allow an active organization to be left with no active ORG_ADMIN; disabling or demoting the last one is denied.
- **Cross-organization access attempts**: Any attempt by an admin of one organization to read or change another organization's data is denied and recorded in the audit trail (BR-02.1).
- **Admin attempting to book with an admin account**: Denied (BR-01.4); an admin who wants to rent must register as a renter.
- **Locked-out admin**: An admin who has lost their password can recover it self-service via the registered recovery channel without operator intervention; repeated failed reset attempts are rate-limited (FR-026, NFR-009).
- **Deletion request while obligations are open**: If the renter has an active rental or an unpaid surcharge, the deletion request is rejected with a clear message; the renter may re-request once all obligations are settled (BR-01.6).
- **Deletion of a renter with no records**: Follows the same deactivate → retain → anonymize path as any other renter — no special-case immediate erasure.
- **Admin-initiated disable vs. deletion-request disable**: An ORG_ADMIN may disable a renter directly (reversible by re-enabling); a renter disabled via a deletion request can never be re-enabled or book again. A disabled renter cannot book in either case (FR-029, FR-022).
- **Deletion request after a statement change**: A renter who has not re-consented to a changed statement attempts to request deletion — the request is processed normally; failure to re-consent never triggers deletion or anonymization on its own (DR-005).
- **Editorial statement change**: A wording-only revision that does not alter the scope of data collected or shared is published — no re-consent prompt is sent to any renter (FR-024, DR-005).
- **Anonymization run before the 3-year retention period has elapsed**: The run must skip any renter whose retention period has not expired and retry on a later run — it must never anonymize early.
- **Anonymization of a renter with records**: Identifying fields (name, phone) are anonymized, but the renter's financial and fiscal records remain in place, linked to the anonymized identity, never deleted (BR-01.6).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a person to register as a Renter only after providing their name, phone number, and actively confirming explicit informed consent to personal-data processing (BR-01.1).
- **FR-002**: The system MUST record the timestamp of consent and MUST NOT create a renter identity without an affirmative consent confirmation.
- **FR-003**: The system MUST refuse any booking, locker access, or payment attempt by a person who is not a registered, consenting renter (BR-01.1).
- **FR-004**: The system MUST permanently bind each Renter to exactly the organization whose entry point they registered through (BR-01.2).
- **FR-005**: The system MUST reject any request to move, merge, or transfer a Renter to a different organization; the only path is a new registration through the target organization's entry point (BR-01.2).
- **FR-006**: At registration, the Renter MUST select a locale from the organization's supported set (BR-01.3, BR-02.2).
- **FR-007**: The system MUST deliver every system message to a Renter in the Renter's currently stored locale (BR-01.3).
- **FR-008**: The system MUST allow a Renter to change their locale at any time and MUST apply the change to all messages sent after the change (BR-01.3).
- **FR-009**: The system MUST maintain exactly three admin roles — SUPER_ADMIN, ORG_ADMIN, STATION_OPERATOR — and enforce their permission scopes on every access path (BR-01.5).
- **FR-010**: A SUPER_ADMIN MUST be able to create and manage organizations and onboard operators, across all organizations.
- **FR-011**: An ORG_ADMIN MUST be able to manage stations, lockers, tariffs, renters, admin accounts, and analytics within their own organization.
- **FR-012**: A STATION_OPERATOR MUST be able to manually open/close lockers, view rental status, and resolve support reports at their assigned stations only, and MUST be denied any management of pricing, branding, or users, and any access to stations outside their assignment (BR-01.5).
- **FR-013**: The admin role hierarchy MUST be strictly hierarchical — each role inherits the capabilities of the roles below it within its scope (BR-01.5).
- **FR-014**: Admin accounts and Renter accounts MUST be separate identity types that are never merged; an admin MUST NOT be able to rent equipment using an admin account (BR-01.4).
- **FR-015**: A person who is both an admin and a renter MUST hold two separate identities with separate permissions and separate histories (BR-01.4).
- **FR-016**: The system MUST allow each Organization to configure its own branding (business name, logo, colors) and MUST reflect it at the Organization's customer touchpoints (BR-02.1).
- **FR-017**: The system MUST allow each Organization to configure its supported locale set, and Renters MAY only choose from that set (BR-02.2).
- **FR-018**: When an Organization adds a locale to its supported set, existing Renters whose locale is not in the new set MUST retain their current locale (BR-02.2).
- **FR-019**: Organizations MUST be fully isolated from each other — no Organization can see another's renters, rentals, or revenue (BR-02.1).
- **FR-020**: The system MUST NOT hard-delete any Renter, regardless of rental, payment, or fiscal history; deactivation MUST instead change the Renter's status to disabled (BR-01.6).
- **FR-021**: On a data deletion request, the system MUST retain financial and fiscal records for the confirmed 3-year retention period and MUST anonymize the Renter's identifying fields (name, phone) only after that period elapses (BR-01.6).
- **FR-022**: A disabled Renter MUST NOT be able to make new bookings.
- **FR-023**: The system MUST bind each Renter's consent to the specific version of the personal-data processing statement that was in effect at registration.
- **FR-024**: When a change is made to the scope of personal data collected or the parties it is shared with, the system MUST prompt affected Renters to re-consent; a Renter who does not re-consent MUST be prevented from making new bookings but MUST NOT be deleted or anonymized. Purely editorial or wording changes that do not alter the scope of data collected or shared MUST NOT trigger re-consent.
- **FR-025**: The system MUST reject a data deletion request from a Renter who has an active rental or an unpaid surcharge until those obligations are settled (BR-01.6).
- **FR-026**: The system MUST allow an admin to recover their password through a self-service reset using a registered recovery channel (email, SMS, or phone) that is independent of the renter-facing Telegram channel.
- **FR-027**: A password reset MUST require a verification step that proves control of the recovery channel before it takes effect, and MUST be recorded in the audit trail with the affected admin identity (NFR-006).
- **FR-028**: The system MUST recognize a returning person by their phone number within the organization, regardless of entry point, and MUST NOT create a duplicate renter identity when a person already registered with that phone registers again through the same organization.
- **FR-029**: An ORG_ADMIN MUST be able to disable a Renter directly (e.g., policy or abuse), distinct from the deletion-request path, and MUST be able to re-enable such a Renter. A Renter disabled via a deletion request MUST NOT be re-enableable.

### Business Rules

The authoritative rules live in `docs/domain/business-rules.md` and are not restated here. The table maps each source rule to the behavior this spec requires of the IAM + Organizations capability. Rules below are referenced by number; the corresponding FRs above make each one testable.

| Source | Rule in force for this capability | Required by |
|---|---|---|
| BR-01.1 | Registration is the unconditional precondition for any booking, locker access, or payment | FR-001, FR-002, FR-003 |
| BR-01.2 | A renter is permanently bound to exactly one organization and cannot switch without a new registration | FR-004, FR-005 |
| BR-01.3 | Locale is chosen at registration, changeable at any time, and governs all message delivery to the renter | FR-006, FR-007, FR-008 |
| BR-01.4 | Admin accounts are not renter accounts and the two identities are never merged | FR-014, FR-015 |
| BR-01.5 | Three strictly hierarchical admin roles with defined scopes | FR-009, FR-010, FR-011, FR-012, FR-013 |
| BR-01.6 | No hard delete for renters with records; deactivation, retention, then anonymization of identifying fields | FR-020, FR-021, FR-022, FR-025 |
| BR-02.1 | Each organization is a white-label operator with its own branding and complete data isolation | FR-016, FR-019 |
| BR-02.2 | Each organization configures its supported locale set; renters may only choose from it | FR-006, FR-017, FR-018 |

The following rules are derived in this spec (from BR-01.1, BR-01.5, BR-01.6 and the project constitution, Principle X) and add the detail needed for testable behavior:

- **DR-001 (Consent evidence)**: Consent MUST be an affirmative act by the person — never pre-selected, implied, or bundled — and MUST be recorded with a timestamp, bound to the statement version in effect, and retained as immutable evidence as long as the renter's records exist.
- **DR-002 (No admin lockout)**: An active organization MUST never be left with zero active ORG_ADMIN accounts; disabling or demoting the last active ORG_ADMIN is denied.
- **DR-003 (Locale-change immediacy)**: A locale change takes effect on the first message sent after the change is confirmed; already-generated messages are not re-sent in the new locale.
- **DR-004 (Identity-separation invariant)**: No operation in the system may merge, link, convert, or conflate an admin identity with a renter identity.
- **DR-005 (Re-consent on material statement change)**: Consent is valid only for the statement version it was given to. A change to the scope of data collected or the parties it is shared with invalidates standing consent for new bookings until the renter re-consents; a change that is purely editorial or wording-only does not. Failure to re-consent never triggers deletion or anonymization — it only blocks new bookings.

### Non-Functional Requirements

- **NFR-001 (Tenant isolation)**: Every organization-scoped operation MUST be isolated by construction, including under concurrency — a concurrent request can never observe or modify another organization's data (ADR-012).
- **NFR-002 (Consent integrity)**: Consent records MUST be immutable and MUST be retained for as long as the related renter data exists.
- **NFR-003 (Authorization completeness)**: Role checks MUST be enforced on every access path to a protected capability, so a capability granted to a role behaves identically regardless of how it is reached.
- **NFR-004 (Localization completeness)**: 100% of renter-facing business messages MUST be available in every locale the renter's organization supports; a renter MUST never receive a message in an unrequested language (ADR-006).
- **NFR-005 (Compliance automation)**: Retention-expiry detection and anonymization MUST run automatically, without any manual admin step, and MUST never anonymize before the 3-year retention period elapses.
- **NFR-006 (Auditability)**: Creation and removal of admin accounts, role changes, organization configuration changes, consent, and anonymization MUST be recorded in an append-only audit trail with the acting identity (BR-12.6, BR-12.7).
- **NFR-007 (Registration usability)**: 90% of renters MUST be able to complete registration (name, phone, consent, locale) in under 3 minutes.
- **NFR-008 (Privacy by design)**: The system MUST collect only the personal data required by BR-01.1 (name, phone) plus the locale preference — nothing additional.
- **NFR-009 (Recovery security)**: Password recovery MUST require proof of control of the registered recovery channel, MUST be rate-limited against brute-force attempts, and MUST never reveal whether a given admin email/phone exists in the system.

### Key Entities

- **Renter**: A person registered through one organization's entry point, bound permanently to that organization. Carries name, phone, locale, consent timestamp, and status (`ACTIVE` / `DISABLED`). Phone is the recognition key within the organization — a duplicate registration with the same phone is recognized, never duplicated. A disabled Renter can be re-enabled only when the disable was admin-initiated (FR-029), never when it came from a deletion request. Cannot exist without recorded consent. Never hard-deleted (BR-01.6).
- **AdminAccount**: An operator's staff identity with exactly one of three roles (SUPER_ADMIN, ORG_ADMIN, STATION_OPERATOR). SUPER_ADMIN belongs to no single organization; ORG_ADMIN and STATION_OPERATOR belong to exactly one. STATION_OPERATOR additionally carries the set of stations it may operate. Carries a registered recovery channel (email, SMS, or phone) used for password recovery. Never a renter identity.
- **Organization**: A white-label operator with its own branding (business name, logo, colors), supported locale set, and entry points. The unit of tenancy: all renter and operator data is scoped to it and isolated from every other organization (BR-02.1).
- **ConsentRecord**: The immutable, timestamped evidence that a person affirmatively agreed to personal-data processing at registration; the precondition for every other renter capability (BR-01.1).
- **Locale**: A value object representing a supported language (v1: `uk`, `en`). Renter and admin locale preferences are stored separately from organization-level configuration (BR-01.3, BR-02.2).

## Acceptance Criteria

- **AC-001**: 100% of bookings, locker accesses, and payments belong to a renter with a recorded consent timestamp — a person without affirmative consent cannot register, and an unregistered person cannot book, open a locker, or pay.
- **AC-002**: 100% of renters are bound to exactly one organization — no request to switch organizations ever succeeds, and registering through a second organization's entry point always produces a separate identity.
- **AC-003**: Every renter-facing message is delivered in the renter's current locale — after a locale change, the very next message uses the new locale.
- **AC-004**: The three-role matrix is enforced without exception — SUPER_ADMIN and ORG_ADMIN can perform their full scopes; STATION_OPERATOR is denied pricing, branding, user management, and any non-assigned station access; no privileged action is reachable by another route.
- **AC-005**: An admin account can never make a booking, and an admin identity is never merged with a renter identity, even when the same person holds both.
- **AC-006**: Two organizations on the platform have zero mutual visibility — each sees only its own renters, rentals, and revenue.
- **AC-007**: An organization's branding (name, logo, colors) and supported locale set are applied to its touchpoints and honored for all of its renters; adding a locale never forces a migration of existing renters.
- **AC-008**: A data deletion request from a renter with settled obligations results in immediate deactivation, never hard deletion, and automatic anonymization of identifying fields only after the 3-year retention period; a request from a renter with an active rental or unpaid surcharge is rejected until those obligations are settled.
- **AC-009**: A locked-out admin can recover their password through the registered recovery channel without operator intervention, and no reset succeeds without proof of channel control.
- **AC-010**: An ORG_ADMIN can disable a renter directly and later re-enable them; a renter disabled via a deletion request can never be re-enabled and can never book again.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of bookings, locker accesses, and payments are performed by registered, consenting renters — zero exceptions across all test and production flows.
- **SC-002**: 100% of renters belong to exactly one organization — zero cases of a renter appearing under multiple organizations and zero successful switch requests.
- **SC-003**: 100% of renter-facing messages are delivered in the renter's current locale — zero wrong-locale deliveries in the automated two-locale test suite.
- **SC-004**: 100% of role-boundary violations (e.g., STATION_OPERATOR attempting pricing/branding/user management; ORG_ADMIN accessing another organization) are denied and recorded — zero unauthorized successes.
- **SC-005**: 100% of identity-separation checks pass — zero operations ever executed with a merged or conflated admin/renter identity.
- **SC-006**: 100% of an organization's touchpoints reflect its configured branding immediately after a branding change.
- **SC-007**: 100% of deletion requests from renters with settled obligations result in (a) immediate deactivation and (b) automatic anonymization of identifying fields after the 3-year retention period (plus a small automated tolerance) — no renter is ever hard-deleted, and zero deletion requests from renters with open obligations are accepted.
- **SC-008**: An automated two-organization test run shows zero cross-organization data visibility in both directions.
- **SC-009**: 100% of locked-out admins can complete password recovery in under 5 minutes without operator intervention, and 100% of resets require proof of control of the recovery channel — zero resets without it.
- **SC-010**: 100% of statement changes that alter the scope of data collected or shared trigger a re-consent prompt to every affected renter, and 100% of editorial-only changes trigger none.
- **SC-011**: 100% of admin-initiated renter disables are reversible by re-enabling, and 100% of deletion-request disables are permanent.

## Assumptions

- Registration entry points are the organization's Telegram bot and its white-label web link (BR-01.2); each entry point belongs to exactly one organization.
- A single versioned standard personal-data processing statement is presented at registration, in the renter's selected locale; per-organization customization of the statement is a later enhancement.
- Default supported locales are Ukrainian (`uk`) and English (`en`) (BR-14.1); each organization configures its own subset as its supported set.
- "Strictly hierarchical" (BR-01.5) is interpreted as each role inheriting the capabilities of all roles below it within its scope.
- A person may hold separate renter identities in different organizations (one per organization); the same phone number is permitted to register with multiple organizations.
- All deletion requests follow the same deactivate → retain → anonymize path, regardless of whether the renter has any rental, payment, or fiscal records (confirmed 2026-07-31).
- The retention period for financial/fiscal records before anonymization is 3 years, confirmed by the product owner on 2026-07-31 (BR-01.6).
- Locale change is permitted at any time, including during an active rental (BR-01.3).
- Admin password recovery uses a registered recovery channel (email, SMS, or phone) that may require adding a delivery channel beyond Telegram for admin-facing messages; the delivery mechanism itself is owned by the notifications capability.
- Organization suspension (status `SUSPENDED`, SUPER_ADMIN-managed) and maintenance-window configuration are in scope this phase (per roadmap Phase 2 / BR-02.3); maintenance-window *enforcement* (payment blocking, fiscal shift handling) and payment-credential rotation are owned by later capabilities. Branding and supported-locale-set configuration are in scope per the feature request.

## Clarifications

### Session 2026-07-31

- Q: What is the Ukrainian data-retention minimum period before anonymizing a renter's identifying fields after a deletion request (BR-01.6 `[OPEN]`)? → A: **3 years**. Applied to FR-021, DR-001, NFR-005, AC-008, SC-007, and the Assumptions.
- Q: Must consent be versioned, and must renters re-consent when the personal-data processing statement changes? → A: **Yes — versioned consent; re-consent required on a material statement change.** Applied as FR-023, FR-024, DR-001, and new DR-005. A renter who does not re-consent is blocked from new bookings but is never deleted or anonymized.
- Q: May a deletion request proceed while the renter has an active rental or unpaid surcharge? → A: **No — the request is rejected until all obligations are settled.** Applied as FR-025, US7, AC-008, SC-007, and the Edge Cases.
- Q: How should a lost admin password be recovered? → A: **Self-service reset via a registered recovery channel (email/SMS/phone), independent of the renter-facing Telegram channel.** Applied as FR-026, FR-027, NFR-009, AC-009, SC-009, Key Entities (AdminAccount), and the Edge Cases.
- Q: May a renter with no rental, payment, or fiscal records be fully deleted on request? → A: **No — every deletion follows the same deactivate → retain → anonymize path regardless of records.** Applied as FR-020, Key Entities (Renter), SC-007, and the Edge Cases; OQ-4 closed.
- Q: What counts as a "material change" to the consent statement for re-consent purposes? → A: **Only changes to the scope of data collected or the parties it is shared with; editorial/wording changes do not trigger re-consent.** Applied as FR-024, DR-005, SC-010, and the Edge Cases.
- Q: How is a returning renter recognized within the same organization? → A: **By phone number, regardless of entry point.** Applied as FR-028, Key Entities (Renter), and the Edge Cases.
- Q: May an admin disable a renter directly, and is that reversible? → A: **Yes — ORG_ADMIN can disable and re-enable a renter directly (policy/abuse); this is distinct from the irreversible deletion-request disable.** Applied as FR-029, AC-010, SC-011, Key Entities (Renter), and the Edge Cases.

## Open Questions

None outstanding.
