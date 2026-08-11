# Feature Specification: Locations + Pricing

**Feature Branch**: `006-locations-pricing`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Create a functional specification for the Locations + Pricing capability of rentiq."

**Source references**: `docs/domain/business-rules.md` BR-03.1–BR-03.7 and BR-04.1–BR-04.5; `docs/architecture/greenfield-architecture.md` modules `locations` (§4.5) and `pricing` (§4.6), ADR-009. These are referenced, not restated.

## Clarifications

### Session 2026-08-09

- Q: Health-check interval & debounce defaults (Open Question 2)? → A: 60s interval; 2 consecutive failures → OFFLINE; 1 success → ONLINE; org-global defaults (not per-station configurable).
- Q: Visible-but-inactive renter presentation (Open Question 3)? → A: Show station name with a "temporarily unavailable" label; lockers not selectable.
- Q: Auto-relock default delay & acceptance tolerance? → A: Default 30 seconds; acceptance tolerance +5 seconds.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Renter Sees Only Bookable Lockers with Correct Prices (Priority: P1)

A Renter browsing available stations via the Telegram bot should only ever be offered
lockers that are genuinely bookable — an active, visible, WORKING station with an assigned
inventory kit and at least one tariff for that kit type and the current day type — and the
price they see for each duration option must be the correct tariff for their organization,
kit type, and day type. No free-form duration entry is possible; the Renter picks from a
fixed, admin-configured set of duration options.

**Why this priority**: This is the gateway to the entire rental flow. If the Renter is shown
a non-bookable locker or a wrong price, every downstream step (reservation, payment,
pickup) is compromised. Correct bookability filtering and pricing quotation is the
foundational behavior of the platform.

**Independent Test**: With a single active+visible+WORKING station, one locker with an
assigned kit, and one tariff row for that kit type and today's day type, the Renter can open
the bot, see exactly that locker, and be quoted the exact tariff price for each configured
duration option. No other locker appears.

**Acceptance Scenarios**:

1. **Given** a station that is active, visible, WORKING, with a locker that has an assigned
   kit and a tariff exists for that kit type on today's day type, **When** the Renter
   requests available lockers, **Then** the locker is offered and each configured duration
   option shows the matching tariff price.
2. **Given** a station that is active but hidden (visible=false), **When** the Renter
   requests available lockers, **Then** no locker from that station is offered.
3. **Given** a station whose operational status is MAINTENANCE, **When** the Renter requests
   available lockers, **Then** no locker from that station is offered.
4. **Given** a locker with no inventory kit assigned, **When** the Renter requests available
   lockers, **Then** that locker is not offered (and the admin is warned per BR-03.2).
5. **Given** a kit type with no tariff defined for the current day type, **When** the Renter
   requests available lockers, **Then** that locker is not offered (and the admin is warned
   per BR-03.2).
6. **Given** a locker currently reserved, rented, or in maintenance, **When** the Renter
   requests available lockers, **Then** that locker is not offered.
7. **Given** the Renter is selecting a duration, **When** they view the options, **Then**
   only the admin-configured duration options are presented and free-form duration entry is
   not possible.

---

### User Story 2 - Admin Manages Stations, Lockers, and Tariffs (Priority: P1)

An ORG_ADMIN can create and configure stations (name, address, connectivity settings), add
lockers to stations, assign inventory kits to lockers, and define tariffs per kit type, day
type, and duration. The admin can independently toggle a station's active flag and its
visible-to-clients flag. The admin can add or remove duration options by adding or removing
tariff rows. Changing a tariff never retroactively affects in-progress or completed rentals.

**Why this priority**: Without admin-managed stations, lockers, kits, and tariffs, there is
nothing for the Renter to book. This story is the data-entry counterpart to Story 1 and is
equally foundational.

**Independent Test**: An ORG_ADMIN can create a station, add two lockers, assign a kit to
each, define tariffs for 60/120/180 minutes for WEEKDAY and WEEKEND, and then — as a Renter
— see those lockers offered with the correct prices. The admin can then hide the station
and confirm it disappears from the Renter's view.

**Acceptance Scenarios**:

1. **Given** an ORG_ADMIN, **When** they create a station with name, address, and
   connectivity config, **Then** the station is persisted with `isActive=true`,
   `isVisibleToClients=false`, `workingStatus=WORKING`, `healthStatus=UNKNOWN` by default.
2. **Given** an existing station, **When** the admin sets `isVisibleToClients=true`
   while leaving `isActive=true`, **Then** the station becomes bookable to renters (subject
   to health and bookability conditions).
3. **Given** an existing station, **When** the admin sets `isActive=false` while leaving
   `isVisibleToClients=true`, **Then** the station shows to renters as temporarily
   unavailable (BR-03.6).
4. **Given** a kit type and day type, **When** the admin defines a tariff for duration 60
   minutes at price ₴100, **Then** that duration option becomes available to renters and
   quotes ₴100.
5. **Given** a tariff exists, **When** the admin deletes it (soft delete), **Then** that
   duration option is no longer offered to renters, but in-progress and completed rentals
   retain their locked-in price (BR-04.5).
6. **Given** an in-progress rental locked in at ₴100, **When** the admin changes the
   tariff to ₴150, **Then** the in-progress rental's price remains ₴100.

---

### User Story 3 - Station Connectivity Auto-Monitoring and Recovery (Priority: P2)

The system periodically checks whether each station's controller is reachable. If a
station's controller becomes unreachable, the station is automatically flagged inactive and
admins are notified. When the controller becomes reachable again, the station is
automatically reactivated. This is independent of the admin's manual `isActive` toggle —
connectivity monitoring is an automatic overlay.

**Why this priority**: Physical stations at outdoor locations experience intermittent
connectivity. Automatic detection and recovery prevents offering lockers at a station whose
controller is down (which would lead to failed locker opens and a bad Renter experience)
without requiring manual admin intervention on every transient outage.

**Independent Test**: With a station whose controller is unreachable, the system flags it
inactive and notifies the admin within the configured check interval; when the controller
returns, the station is reactivated automatically and the admin is notified, all without
manual action.

**Acceptance Scenarios**:

1. **Given** an active station whose controller is reachable, **When** the periodic health
   check runs, **Then** the station's `healthStatus` remains ONLINE and no alert is sent.
2. **Given** an active station, **When** the controller becomes unreachable and a health
   check fails, **Then** the station is automatically flagged inactive, `healthStatus`
   transitions to OFFLINE, and admins are notified.
3. **Given** a station flagged inactive due to connectivity loss, **When** the controller
   becomes reachable again and a subsequent health check succeeds, **Then** the station is
   automatically reactivated (restored to its prior admin-intended active state),
   `healthStatus` transitions to ONLINE, and admins are notified of recovery.
4. **Given** a station that the admin manually set to `isActive=false`, **When** the
   controller recovers, **Then** the station is NOT auto-reactivated to active — the
   admin's manual override is respected; only the connectivity-driven inactivation is
   cleared.

---

### User Story 4 - Automatic Locker Re-Lock (Priority: P2)

Any locker that is opened — whether by a Renter during a valid rental, by an admin
manually, or for any other reason — is automatically re-locked after a configurable
per-station delay, even if no explicit close command is ever sent. A locker that was opened
will always eventually be locked.

**Why this priority**: Physical security of the equipment is a core invariant. A locker
left open indefinitely exposes equipment to theft. The auto-relock guarantee must hold
regardless of whether the closer (Renter, admin, system) sends an explicit close.

**Independent Test**: Open a locker (via Renter action or admin manual open) and do not
send a close command; after the configured per-station auto-lock delay elapses, the locker
is locked automatically.

**Acceptance Scenarios**:

1. **Given** a locker that was opened by a Renter during a valid rental, **When** no close
   command is sent, **Then** the locker is automatically re-locked after the station's
   configured `autoLockDelaySeconds`.
2. **Given** a locker opened by an admin manually, **When** no close command is sent,
   **Then** the locker is automatically re-locked after the configured delay.
3. **Given** a locker that was opened and then explicitly closed before the delay,
   **When** the auto-lock timer fires, **Then** no double-lock error occurs (the lock
   command is idempotent — locking an already-locked locker is a no-op).

---

### User Story 5 - Unauthorized Door Open Detection and Alerting (Priority: P2)

If a locker's door sensor reports "open" but there is no active or pickup-ready rental
associated with that locker, the system treats this as a security event and alerts admins
immediately. This applies regardless of time of day, maintenance mode, or any other
condition.

**Why this priority**: An unexpected door open may indicate theft, tampering, or a hardware
fault. Immediate admin alerting is the only mitigation available for an unattended outdoor
station.

**Independent Test**: With a locker that has no active or pickup-ready rental, trigger the
door sensor to report open; the admin receives an immediate alert identifying the station
and locker.

**Acceptance Scenarios**:

1. **Given** a locker with no active or pickup-ready rental (status AVAILABLE), **When** the
   door sensor reports open, **Then** an `UnauthorizedDoorOpenDetected` event is published
   and admins are alerted immediately with station and locker identification.
2. **Given** a locker with an active rental, **When** the door sensor reports open,
   **Then** no unauthorized-open alert is raised (the open is expected).
3. **Given** the station is in MAINTENANCE mode, **When** an unauthorized door open occurs,
   **Then** the alert is still raised immediately (maintenance mode does not suppress it).

---

### User Story 6 - Encrypted Credential Storage (Priority: P3)

Each station has its own controller URL and connection token. The token is stored encrypted
in the database (AES-256-GCM via `CryptoService`), never as raw plaintext. Administrators
can rotate a token by updating it via the API; the new value is encrypted on the server and
the raw token never appears in API responses (masked to last 4 chars).

**Why this priority**: Credential hygiene is a security baseline. Per-station token isolation
limits blast radius if one station's token is compromised.

**Independent Test**: Create a station and inspect the persisted DB row; `ha_token_encrypted`
is ciphertext, not the raw token. The API response shows `haToken: "****xxxx"` (masked). The
`HomeAssistantGateway` receives the decrypted token in memory only (via `StationRepository`).

**Acceptance Scenarios**:

1. **Given** a new station being created, **When** the admin provides a controller URL and
   token, **Then** the URL is stored plaintext and the token is stored encrypted
   (`ha_token_encrypted`); the raw token is not persisted as plaintext in the DB.
2. **Given** an existing station, **When** the admin rotates the token via PATCH, **Then** a
   new encrypted value is stored and the old token is no longer used.
3. **Given** any station, **When** any component needs the token to communicate with the
   controller, **Then** it is decrypted by the repository at read time and held in memory
   only — never serialized to API responses or logs.

---

### Edge Cases

- **Station active+visible but controller unreachable at the moment a Renter tries to open a
  locker**: The connectivity monitor should have already flagged the station inactive,
  removing it from bookability. If the outage happens between booking and open, the open
  attempt fails gracefully with a user-facing message and an admin alert.
- **Tariff changed between reservation and payment (within the reservation window)**: The
  price is locked at the moment the Renter selects their duration (BR-04.5), so the change
  does not affect the in-flight quote.
- **Day type boundary (booking created Friday 23:55, return Saturday)**: Day type is
  determined solely by the booking creation date (BR-04.2), so a Friday booking is priced
  as WEEKDAY even if returned on a weekend.
- **All tariff rows for a kit type removed**: The locker is no longer offered; the admin is
  warned per BR-03.2 that the locker is misconfigured.
- **Kit reassigned from one locker to another**: Historical rental records referencing the
  kit are unaffected (BR-04.1); the new locker becomes bookable if it meets all other
  conditions.
- **Health check flapping (rapidly reachable/unreachable)**: Repeated state changes must
  not flood admins with alerts; a debouncing or stabilization approach is assumed (see
  Assumptions).
- **Auto-relock delay set to zero or an extremely large value**: Must be treated as a
  configuration error and warned to the admin, not silently accepted.
- **Duplicate tariff row (same org, kit type, day type, duration)**: Must be rejected at
  creation time — the uniqueness constraint is part of the pricing model.

## Requirements *(mandatory)*

### Functional Requirements

#### Bookability

- **FR-001**: The system MUST offer a locker for booking to a Renter only when ALL of the
  following are simultaneously true (BR-03.2): (a) the parent station's effective
  `isActive` is true (`adminIntendedIsActive = true AND healthStatus != OFFLINE`,
  per FR-008/FR-010); (b) the parent station is visible to clients; (c) the parent
  station's operational status is WORKING; (d) the locker has an inventory kit assigned;
  (e) at least one tariff exists for that kit type and the current day type; (f) the
  locker's own status is AVAILABLE.
- **FR-002**: The system MUST visually warn admins in the admin panel when a locker fails
  condition (d) (no kit assigned) or condition (e) (no tariff for kit type / day type),
  because such a locker will never appear to renters (BR-03.2).
- **FR-003**: The current day type MUST be determined solely by the calendar date of the
  booking creation, not the return date (BR-04.2).

#### Station Active / Visible Control

- **FR-004**: Admins MUST be able to independently control a station's `isActive` flag and
  its `isVisibleToClients` flag as two separate toggles, not a single on/off switch
  (BR-03.6).
- **FR-005**: When a station is active but hidden, the system MUST NOT offer its lockers to
  renters, but the station remains operational for admin purposes (soft launch, pre-opening)
  (BR-03.6).
- **FR-006**: When a station is visible but inactive (flagged), the system MUST present the
  station to renters by name with a "temporarily unavailable" label and its lockers MUST NOT
  be selectable; the station is not hidden (BR-03.6).

#### Connectivity Monitoring

- **FR-007**: The system MUST periodically test whether each station's controller is
  reachable (BR-03.3).
- **FR-008**: When a station's controller is unreachable, the system MUST set
  `healthStatus = OFFLINE` (which makes the *effective* `isActive` false for
  bookability purposes, without mutating `adminIntendedIsActive`) and notify admins
  (BR-03.3). Bookability is derived from `adminIntendedIsActive AND healthStatus !=
  OFFLINE`, not by overwriting the admin's active flag.
- **FR-009**: When a previously-unreachable station's controller becomes reachable again,
  the system MUST set `healthStatus = ONLINE` (which restores the effective `isActive`
  to `adminIntendedIsActive`) and notify admins of recovery (BR-03.3). If the admin had
  set `adminIntendedIsActive = false`, the station remains inactive (FR-010).
- **FR-010**: Automatic connectivity-driven inactivation MUST NOT override an admin's manual
  `isActive=false` setting; recovery clears only the connectivity hold, not the manual
  override.
- **FR-011**: The system MUST persist the station's `healthStatus` (ONLINE / OFFLINE /
  UNKNOWN) and the timestamp of the last health check.

#### Locker Auto-ReLock

- **FR-012**: Opening any locker MUST always schedule an automatic re-lock after a
  configurable per-station delay (BR-03.4).
- **FR-013**: A locker that was opened MUST always be re-locked eventually, even if no
  explicit close command is sent (BR-03.4).
- **FR-014**: The auto-relock delay MUST be configurable per station. The default value for
  a newly created station MUST be 30 seconds. Values of zero or negative MUST be rejected
  at configuration time (see Edge Cases).
- **FR-015**: An explicit close command received before the auto-relock timer fires MUST
  cancel the pending auto-relock (or the subsequent lock command MUST be idempotent so that
  no error occurs from locking an already-locked locker).

#### Unauthorized Door Open

- **FR-016**: If a locker's door sensor reports open and there is no active or pickup-ready
  rental associated with that locker, the system MUST publish an
  `UnauthorizedDoorOpenDetected` event and alert admins immediately (BR-03.5).
- **FR-017**: The unauthorized-door-open alert MUST be raised regardless of time of day,
  maintenance mode, or any other condition (BR-03.5).
- **FR-018**: An expected door open (locker has an active or pickup-ready rental) MUST NOT
  trigger the unauthorized-open alert.

#### Credential Storage

- **FR-019**: Each station's controller connection token MUST be stored encrypted in the
  database (AES-256-GCM via `CryptoService`), never as raw plaintext (BR-03.7). A single
  `MASTER_KEY` in `.env` is the only secret outside the DB.
- **FR-020**: Each station MUST have its own controller URL and token; there is no global
  controller configuration (BR-03.7). Each station also has its own HA webhook secret.
- **FR-021**: The system MUST decrypt the token only at the moment of use (when
  `HomeAssistantGateway` issues a command), never persist the plaintext in business data or
  API responses. API responses mask token fields to the last 4 characters.

#### Pricing Structure

- **FR-022**: A tariff MUST be defined by the combination: Organization + Kit Type + Day
  Type (WEEKDAY / WEEKEND) + Duration (in minutes) = Price (BR-04.2).
- **FR-023**: Day types MUST be limited to WEEKDAY and WEEKEND (BR-04.2).
- **FR-024**: Duration options offered to renters MUST be a fixed, admin-configurable set;
  there MUST be no free-form duration input (BR-04.3).
- **FR-025**: Admins MUST add or remove duration options by adding or removing tariff rows
  (BR-04.3).
- **FR-026**: The system MUST reject a duplicate tariff row (same organization, kit type,
  day type, and duration) at creation time.
- **FR-027**: The price used for a rental MUST be locked in at the moment the Renter selects
  their duration; subsequent tariff changes MUST NOT retroactively affect in-progress or
  completed rentals (BR-04.5).
- **FR-028**: Each organization MUST maintain its own independent tariff table; tariffs are
  not shared across organizations (BR-04.2, BR-02.1).
- **FR-029**: A kit MUST have a `kitType` (e.g., SUP_BOARD, PADDLE) which is the key used to
  look up pricing (BR-04.1).
- **FR-030**: A kit MUST be reassignable to a different locker without deleting historical
  rental records that referenced it (BR-04.1).
- **FR-031**: All monetary values in pricing MUST be represented as integer minor units with
  an explicit currency (constitution Principle III); the default currency is UAH.

#### Operational Status

- **FR-032**: A station's operational `workingStatus` MUST be either WORKING or MAINTENANCE;
  lockers at a MAINTENANCE station MUST NOT be offered to renters (BR-03.2).
- **FR-033**: Admins MUST be able to set a station's `workingStatus` to MAINTENANCE (e.g.,
  for scheduled servicing), which removes its lockers from bookability without changing the
  active or visible flags.

### Key Entities

- **Station**: A physical grouping of lockers belonging to one organization. Carries name,
  address, operational status (WORKING / MAINTENANCE), an independently-controlled active
  flag, an independently-controlled visible-to-clients flag, sort order, per-station
   controller connection config (URL + encrypted token + webhook secret + auto-lock delay),
  health status (ONLINE / OFFLINE / UNKNOWN), and last-health-check timestamp.
- **Locker**: An individual physical compartment within a station. Carries a name, a
  bookability status (AVAILABLE / RESERVED / AWAITING_PAYMENT / AWAITING_PICKUP / RENTED /
  MAINTENANCE), controller lock and door-sensor entity identifiers, and a reference to the
  current rental holding it (nullable — null means available).
- **InventoryKit**: A piece of rental equipment assigned to a locker (assignment is
  nullable — a kit can exist unassigned). Carries a name and a `kitType` used for pricing
  lookup. Reassignable without affecting historical rentals.
- **Tariff**: A pricing rule keyed by organization + kit type + day type + duration in
  minutes, yielding a price (integer minor units + currency). Unique per that key
  combination. Soft-deletable. Per-organization.

## Business Rules

This specification is governed by BR-03.1 through BR-03.7 (Locations, Stations, Lockers)
and BR-04.1 through BR-04.5 (Inventory Kits and Tariffs) in `docs/domain/business-rules.md`.
Those rules are the authoritative source; this specification operationalizes them as
functional requirements and acceptance criteria and does not redefine or override them.
Where this specification and the business-rules doc conflict, the business-rules doc wins.

## Acceptance Criteria

1. **Bookability filtering**: Given a set of stations/lockers in varying states, the
   renter-facing list contains exactly those lockers satisfying all six conditions of
   BR-03.2 / FR-001 — no more, no less.
2. **Misconfiguration warning**: An admin viewing a locker with no kit or no tariff sees a
   clear visual warning that the locker will never appear to renters (FR-002).
3. **Independent active/visible**: An admin can set a station to active+hidden and to
   visible+inactive as distinct states, and each produces the renter-facing behavior
   described in FR-005 and FR-006.
4. **Connectivity auto-inactivation**: A station whose controller is unreachable is flagged
   inactive and removed from bookability within the configured check interval, and the admin
   is notified (FR-007, FR-008).
5. **Connectivity auto-recovery**: A station that recovers connectivity is reactivated to
   its admin-intended active state and the admin is notified, without manual action
   (FR-009); an admin-manually-deactivated station is not auto-reactivated (FR-010).
6. **Auto-relock guarantee**: An opened locker with no explicit close is locked within
   `autoLockDelaySeconds + 5s` of the configured delay (default 30s → locked within 35s)
   (FR-012, FR-013, FR-014).
7. **Idempotent close**: An explicit close followed by the auto-relock timer produces no
   error (FR-015).
8. **Unauthorized door-open alert**: A door-open on a locker with no active or pickup-ready
   rental produces an admin alert within 1 minute, regardless of maintenance mode or time of
   day (FR-016, FR-017).
9. **No false unauthorized alert**: A door-open on a locker with an active or pickup-ready
   rental produces no unauthorized-open alert (FR-018).
10. **Encrypted token**: Inspecting the persisted DB row reveals only ciphertext
    (`ha_token_encrypted`), not the raw token; the API response masks it (`****xxxx`);
    the raw token is decrypted only in memory by the repository (FR-019, FR-021).
11. **Fixed duration options**: The Renter is presented only with admin-configured duration
    options; free-form duration entry is impossible (FR-024).
12. **Tariff uniqueness**: Attempting to create a duplicate tariff (same org, kit type, day
    type, duration) is rejected (FR-026).
13. **Price lock-in**: Changing a tariff after a rental has locked in a price does not change
    that rental's price (FR-027).
14. **Day type by booking date**: A booking created on a WEEKDAY is priced as WEEKDAY even if
    returned on a weekend (FR-003).
15. **Kit reassignment**: Reassigning a kit to a new locker does not alter historical rental
    records (FR-030).

## Error Scenarios

- **Locker open requested but controller unreachable**: The system cannot command the lock;
  the Renter receives a clear message that the station is temporarily unavailable, the
  attempt is logged, and admins are alerted. The rental is not advanced.
- **Health check itself fails (timeout, network error)**: Treated as unreachable — the
  station is flagged inactive per FR-008. Transient single-check failures are debounced
  (see Assumptions) to avoid false positives.
- **Auto-relock command fails (controller unreachable when timer fires)**: The failure is
  retried with backoff; persistent failure escalates to an admin alert. The intent to lock
  is retained until confirmed.
- **Door sensor reports UNKNOWN (neither open nor closed)**: Treated as not-open for the
  purpose of unauthorized-open detection (no false alert), but logged for admin awareness;
  the auto-relock is still scheduled if an open was commanded.
- **Tariff lookup miss for a bookable locker**: Should not occur if FR-002 warning is
  honored, but as a defensive measure, if a locker passes bookability but no tariff is found
  at quote time, the quote fails gracefully and the locker is removed from the offered list.
- **Secret store unavailable at token resolution time**: The controller operation fails; the
  Renter/admin receives a clear error; the failure is logged and retried if transient.
- **Duplicate tariff creation**: Rejected with a clear validation error identifying the
  conflicting existing tariff.
- **Auto-lock delay misconfigured (zero or negative)**: Rejected at station configuration
  time with a validation error.

## Non-Functional Requirements

- **Performance**: The renter-facing bookable-locker list must return within 2 seconds under
  normal load for an organization with up to 50 stations and 500 lockers.
- **Health-check timeliness**: A controller outage must be detected and the station flagged
  inactive within the configured check interval (default: 60 seconds) plus 2 consecutive
  failed checks (i.e., worst case ~3 minutes from outage to OFFLINE flag).
- **Alert latency**: Unauthorized-door-open and connectivity-loss alerts must reach admins
  within 1 minute of detection.
- **Availability of auto-relock**: The auto-relock guarantee must hold across process
  restarts — a locker opened before a restart must still be re-locked after the restart
  (absolute-deadline scheduling, per ADR-003's principle of restart-safe time-based
  behavior).
- **Multi-tenant isolation**: All station, locker, kit, and tariff data must be scoped to
  the calling organization; no cross-organization data leakage is permitted (constitution
  Principle VI).
- **Auditability**: Admin changes to station active/visible flags, working status,
  connectivity config, kit assignments, and tariffs MUST be marked auditable via the
  `@AuditableAction` decorator (applied in Phase 3) and recorded in the append-only
  audit log with the acting admin's identity (constitution Principle X). The
  `audit-log` subscriber that persists entries is wired in Phase 9; in Phase 3 the
  decorator emits a structured log line as a no-op placeholder until the subscriber is
  connected. No admin mutation in Phase 3 ships without the decorator applied.
- **Secret hygiene**: Raw controller tokens must never appear in application logs, audit
  logs, error messages, or API responses (BR-03.7).
- **Configurability**: Auto-lock delay, health-check interval, and alert debounce window
  must be configurable without code changes.
- **Testability**: Bookability filtering, pricing quotation, connectivity state
  transitions, auto-relock, and unauthorized-open detection must each be unit-testable in
  isolation using fakes for the controller gateway (constitution Quality & Verification
  Standards; hexagonal isolation per Principle II).

## Open Questions

1. **Tariff duration band semantics** `[OPEN — forward reference]`: Per BR-04.4, the legacy
   system had tariff rows up to 240, 300, and 480 minutes that appear to be "day pass"
   tiers. The product owner must confirm what these duration bands (e.g.,
   60 / 120 / 180 / 240 / 300 / 480 minutes) represent — flat rental durations, day-pass
   tiers, or overtime ceiling bands. This is explicitly deferred to and resolved in the
   Overtime specification (`spec-kit-prompts/05-rentals/07-overtime`). Until then, this
   specification treats every tariff row as a flat rental-duration option and does not
   assign special semantics to any particular duration value.

2. **Health-check interval and debounce defaults** `[RESOLVED 2026-08-09]`: BR-03.3
   mandates periodic connectivity checks. Defaults are confirmed as: check every 60
   seconds; require 2 consecutive failures before flagging OFFLINE; require 1 success to
   clear to ONLINE. These are org-global defaults (not per-station configurable in this
   phase). See Clarifications 2026-08-09.

3. **Visible-but-inactive renter presentation** `[RESOLVED 2026-08-09]`: BR-03.6 states a
   visible+inactive station "shows to renters as temporarily unavailable." Confirmed: the
   station's name is shown to renters with a "temporarily unavailable" label, and its
   lockers are not selectable. The station is not hidden. See Clarifications 2026-08-09.

## Assumptions

- The `locations` and `pricing` modules depend on `shared-kernel` and `organizations` (per
  the module dependency graph in `docs/architecture/greenfield-architecture.md` §4.1); those
  modules are assumed to exist and to provide `OrgId`, `TenantContext`, `Money`, and the
  `CryptoService` (AES-256-GCM encryption, `MASTER_KEY` from `.env`).
- Per-tenant secrets (HA tokens, Monobank/Checkbox tokens) are encrypted in the DB by
  `CryptoService`; the `MASTER_KEY` is the only secret in `.env`. API responses mask token
  fields. See `docs/architecture/greenfield-architecture.md` §9.5 for the full secrets
  management design.
- The `SmartLockGateway` port (read door state, unlock, lock, is-reachable) is owned by the
  `locations` module and implemented by a Home Assistant adapter in infrastructure; the
  protocol details are out of scope per the user's instruction. Only the port's behavioral
  contract (the four operations and their failure semantics) is in scope.
- Connectivity health-check uses org-global defaults: 60-second interval, 2 consecutive
  failures to flag OFFLINE, 1 success to clear to ONLINE (see Clarifications 2026-08-09).
  Per-station tuning is out of scope for this phase.
- Auto-relock uses an absolute-deadline timestamp (consistent with ADR-003's
  restart-safe-timer principle) rather than a tick decrement, so the guarantee survives
  process restarts.
- Day type determination (WEEKDAY / WEEKEND) follows the organization's configured timezone
  (default `Europe/Kyiv`), consistent with the maintenance-window timezone handling in
  `organizations`.
- Monetary amounts use integer minor units with currency UAH by default (constitution
  Principle III); this specification does not introduce any float or free-text money
  representation.
- Kit types are free-form string labels (e.g., `SUP_BOARD`, `PADDLE`) managed by admins;
  there is no predefined enumerated set in this specification.
- Notification delivery to admins is via the `notifications` module (event-driven, per
  BR-13.1); the `locations` module publishes events and does not deliver notifications
  directly.

## Dependencies

- **`organizations` module**: provides the owning organization, its timezone, and the secret
  store abstraction referenced by station connectivity config.
- **`shared-kernel`**: provides `Money`, `OrgId`, `TenantContext`, `EventBus`, and `Result`
  types used throughout locations and pricing.
- **`notifications` module**: subscribes to `StationHealthChanged`,
  `UnauthorizedDoorOpenDetected`, and other locations events to deliver admin alerts
  (BR-13.1).
- **`audit-log` module**: records admin configuration changes to stations, lockers, kits,
  and tariffs (constitution Principle X).
- **Secret store**: external capability for per-station controller token storage (BR-03.7).
- **Smart-lock controller (Home Assistant)**: external system accessed via the
  `SmartLockGateway` port; its protocol details are out of scope.
