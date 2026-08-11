# Business Rules — rentiq

**Version**: 1.1 (post-grilling refinement)
**Source**: Reverse-engineered from `suppoint-bot` legacy codebase + grilling session decisions.
**Status**: Authoritative specification. All rules are behavior statements, not implementation details.
**Confidence**: 92%. Remaining open items are marked with `[OPEN]`.

---

## Domain Context

**rentiq** is a platform for managing short-term rental of physical equipment (initially Stand-Up
Paddleboards, SUPs) stored in smart lockers at outdoor stations. The system orchestrates:

- Renter registration and booking via Telegram
- Physical locker access via Home Assistant smart-lock controllers
- Payment collection via Monobank Acquiring
- Fiscal receipt issuance via Checkbox.ua (legally required under Ukrainian fiscal law)
- Admin operations via a web panel

**Market**: Ukraine. Primary currency: UAH. Primary language: Ukrainian.
**Scale target**: Multi-tenant (white-label), multiple organizations, multiple stations per org.

---

## BR-01 — Identity & Registration

### BR-01.1 Renter Registration
A person becomes a **Renter** by providing their name, phone number, and giving explicit informed
consent to personal-data processing. Registration is required before any booking can be made.
No booking, locker access, or payment is possible for an unregistered person.

### BR-01.2 Renter-to-Organization Binding
A Renter is permanently bound to exactly one Organization — the operator whose entry point (Telegram
bot, white-label web link) they used to register. A Renter cannot switch organizations without a
new registration.

### BR-01.3 Renter Locale
At registration, the Renter selects a preferred language from the set of locales the Organization
supports. All system messages (notifications, errors, instructions) sent to this Renter are
delivered in that locale. The Renter can change their locale at any time.

### BR-01.4 Admin Accounts Are Not Renters
Admin accounts are completely separate from Renter accounts. An admin cannot rent equipment
using their admin account. An admin may also be a Renter under a separate account — these
identities are never merged.

### BR-01.5 Admin Roles
Three admin roles exist, with strictly hierarchical permissions:
- **SUPER_ADMIN**: cross-organization; can create/manage organizations, onboard new operators.
- **ORG_ADMIN**: full control within one organization (stations, lockers, tariffs, renters,
  admin accounts, analytics).
- **STATION_OPERATOR**: operational access to assigned stations only (open/close lockers manually,
  view rental status, resolve support reports). Cannot manage pricing, branding, or other users.

### BR-01.6 Data Retention for Renters
Renters are never hard-deleted from the system as long as they have any rental, payment, or
fiscal record. Deactivation is done by changing the renter's status to disabled. If a data
deletion request is received (right to erasure), financial and fiscal records must be retained
for the legally required period; personally identifying fields (name, phone) may be anonymized
after that period. `[OPEN: confirm Ukrainian data-retention law minimum period]`

### BR-01.7 Cross-Tenant Support Access (Impersonation)
Only a `SUPER_ADMIN` may act on behalf of another organization. Support impersonation is
signalled per-request by the `x-org-id` HTTP header:
- If `x-org-id` is absent, the request runs in the actor's own tenant context (the `org_id`
  from the access token, if any).
- If `x-org-id` is present, it is honored **only** when the authenticated actor has role
  `SUPER_ADMIN`. Any other role sending `x-org-id` is rejected with `403 IMPERSONATION_FORBIDDEN`.
- The target organization must exist (`404 ORG_NOT_FOUND`) and be `ACTIVE` (`403 ORG_SUSPENDED`).
- Every impersonated request is written to the audit log with action `ImpersonationActivated`
  and both the impersonator (`sub`) and the target organization recorded. The impersonated
  identity is never mixed into the target tenant's own audit trail.
- Impersonation does not change the actor's role; a `SUPER_ADMIN` acting on a tenant's data
  keeps role `SUPER_ADMIN`, which is broader than any tenant-local role.

---

## BR-02 — Organizations

### BR-02.1 White-Label Operator
Each Organization represents one business operator. It has its own branding (logo, colors, name),
its own Telegram bot, its own payment-gateway merchant accounts, and its own tariff schedule.
Two white-label organizations sharing the same platform have complete data isolation — neither
can see the other's renters, rentals, or revenue.

### BR-02.2 Organization-Level Locale Set
Each Organization configures which locales it supports (e.g., `['uk', 'en']`). Renters of that
organization may only choose from this set. If the organization adds a new locale, existing
renters whose locale is not in the new set retain their current locale.

### BR-02.3 Maintenance Window
Each Organization may configure a daily **maintenance window** defined by a start time and end
time (e.g., 23:45–00:15 Kyiv time). This window governs two behaviors:

1. **No new initial-rental payment requests** may be created during this window. If a Renter
   attempts to pay for a new booking during the window, they receive a clear message:
   "Payments are unavailable until HH:MM. Please try again after that time."
   Already-in-progress surcharge (top-up) payments are NOT blocked and continue normally.

2. **Checkbox fiscal shift auto-close** occurs at the window start. Fiscal receipts that arrive
   during the window are automatically deferred (not failed) until the window ends, then retried.

The maintenance window must match the Checkbox cashier-shift lifecycle: the shift closes at
window start and re-opens at window end (or as soon as a successful payment arrives after
window end). Misconfiguration (window that doesn't match shift close time) is an admin error
that admins must be warned about.

---

## BR-03 — Locations, Stations, and Lockers

### BR-03.1 Equipment in Lockers
Physical rental equipment lives inside individual Lockers. Lockers are grouped into Stations.
Each Station belongs to one Organization.

### BR-03.2 Locker Bookability Conditions
A Locker is offered to Renters for booking only when ALL of the following are simultaneously true:
1. Its parent Station is administratively **active**.
2. Its parent Station is **visible to clients**.
3. Its parent Station's operational status is **WORKING** (not MAINTENANCE).
4. The Locker itself has an **Inventory Kit** assigned.
5. That Kit's type has at least one **Tariff** defined for the current day type.
6. The Locker's current status is **AVAILABLE** (not reserved, rented, or in maintenance).

Admins must be visually warned in the admin panel if a locker fails conditions 4 or 5
(misconfigured locker, will never appear to renters).

### BR-03.3 Station Active Status and Connectivity
Station "active" status is not purely an admin toggle. The system periodically tests whether
each station's Home Assistant controller is reachable. If HA is unreachable for a station,
that station is automatically flagged as inactive and admins are notified. The station is
automatically reactivated as soon as HA becomes reachable again.

### BR-03.4 Locker Door Auto-Relock
Opening any locker always schedules an automatic re-lock after a configurable delay (configured
per-station). A locker that was opened will always be re-locked eventually, even if no explicit
close command is sent.

### BR-03.5 Unauthorized Door Open
If a locker's door sensor reports "open" but there is no active or pickup-ready rental
associated with that locker, this is a security event. Admins must be alerted immediately.
This applies regardless of time of day, maintenance mode, or any other condition.

### BR-03.6 Admin Visibility Toggle
Admins can independently control `isActive` and `isVisibleToClients` on a station:
- Active + Hidden: operational but not yet visible to renters (soft launch, pre-opening).
- Visible + Inactive (flagged): station shows to renters as temporarily unavailable.
These two flags are independent controls, not a single on/off toggle.

### BR-03.7 HA Token Storage
Home Assistant connection tokens for each station are stored encrypted in the database
(AES-256-GCM envelope encryption via `CryptoService`), never as raw plaintext. Each station
has its own HA URL and token — there is no global HA config. The token is decrypted only at
the moment of use (when `HomeAssistantGateway` issues a command) and never appears in API
responses (masked to last 4 chars). A per-station HA webhook secret is stored the same way.

---

## BR-04 — Inventory Kits and Tariffs

### BR-04.1 Kit Type Assignment
Each Locker must have an Inventory Kit assigned before it can be rented. A Kit has a
`kitType` (e.g., `SUP_BOARD`, `PADDLE`) which is the key used to look up pricing. A Kit can
be reassigned to a different locker (e.g., after equipment is moved) without deleting
historical rental records that referenced it.

### BR-04.2 Tariff Structure
A tariff is defined by: Organization + Kit Type + Day Type + Duration (in minutes) = Price.
Day types are **WEEKDAY** and **WEEKEND** (determined solely by the calendar date of the booking
creation, not the return date). Each organization maintains its own tariff table.

### BR-04.3 Duration Options Are Configurable
Duration choices are a fixed, admin-configurable set of options (e.g., 60, 120, 180, 240, 300,
480 minutes). There is no free-form duration input for renters. Admins add or remove duration
options by adding or removing tariff rows.

### BR-04.4 Overtime Bands
`[OPEN: confirm with product owner]` The legacy system had tariff rows up to 240, 300, and 480
minutes. These appear to be "day pass" tiers rather than arbitrary values. The `OvertimeCalculator`
uses the same tariff table to find the appropriate band for total actual usage time (rounding
up to the next defined band). The `OvertimeCalculator` uses the day type of the original booking
to look up overtime pricing, not the day type at the time of return.

### BR-04.5 Pricing Isolation
Changing a tariff row does not retroactively affect in-progress or completed rentals. The price
used for a rental is locked in at the moment the Renter selects their duration.

---

## BR-05 — Booking and Reservation

### BR-05.1 Multi-Locker Booking
A Renter may book one or more lockers at a single station in one booking session. All selected
lockers are part of one Rental entity. The Renter pays a single invoice for the sum of all
selected lockers at the chosen duration.

### BR-05.2 Reservation Window
Selecting locker(s) reserves them (removes from availability for other Renters) for a bounded
window. If the Renter does not complete payment within this window, the reservation expires
automatically and all lockers become available again.

### BR-05.3 No New Booking with Unpaid Surcharge
A Renter who has any unpaid surcharge from a previous rental is blocked from starting a new
booking until each outstanding surcharge is settled. They are shown a direct payment link for
each outstanding surcharge when they attempt to book.

### BR-05.4 Atomic Reservation
Selecting multiple lockers in one booking is all-or-nothing: either all requested lockers are
successfully reserved or none are (and the Renter is told which lockers became unavailable in
the interim). Partial reservations are not allowed.

### BR-05.5 Exclusive Locker Reservation
At any point in time, a locker can belong to at most one active rental (any non-terminal status).
This must be enforced at the database level, not solely at the application level.

---

## BR-06 — Payment (Initial)

### BR-06.1 Automatic Payment Confirmation
Payment confirmation is fully automatic — driven by the payment gateway's signed webhook
notification, with a periodic fallback reconciliation pass for lost/delayed webhooks. There
is no manual admin approval step for standard initial payments.

### BR-06.2 Webhook Cryptographic Verification
All inbound payment-gateway webhooks must be cryptographically verified (ECDSA signature
against the gateway's public key, cached from a well-known endpoint) before any business
effect is applied. A webhook that fails verification is rejected and logged.

### BR-06.3 Idempotent Payment Status
Payment status changes are idempotent. A duplicate "payment succeeded" notification does not
double-apply effects (no double-unlock, no double fiscal receipt, no double notification).
A terminal state (`PAID`, `EXPIRED`) is never silently overwritten by a stale late-arriving
`FAILED` event. A previously-failed payment attempt may be superseded by a later success on
the same checkout link (customer retries payment).

### BR-06.4 Maintenance Window Payment Block
New initial-rental payment requests are blocked during the Organization's maintenance window
(see BR-02.3). The block is enforced by the `rentals` module before calling the payment
service, not inside the payment service itself.

### BR-06.5 Checkout on Payment Confirmation
On confirmed payment, all reserved lockers in that booking transition to "awaiting pickup," and
the Renter receives a notification with pickup instructions.

---

## BR-07 — Fiscal Compliance

### BR-07.1 Every Payment Must Be Fiscalized
Every successful payment (initial rental and surcharge top-up) must produce a fiscal receipt
through the Organization's registered Checkbox.ua fiscal provider. This is a legal requirement
under Ukrainian fiscal law, independent of whether the Renter requests it.

### BR-07.2 Fiscal Non-Blocking
Fiscal receipt issuance is asynchronous. It must never block or delay the Renter receiving
locker access confirmation.

### BR-07.3 Shift Lifecycle
The system automatically manages the Checkbox cashier-shift lifecycle:
- At maintenance window start: close the shift automatically.
- At maintenance window end (or on first successful payment after the window): open a new shift.
No manual daily admin action is required for shift management.

### BR-07.4 Fiscal Deferral During Maintenance Window
If a payment is confirmed just as the maintenance window begins (race condition), fiscal
issuance is automatically deferred. The Renter is notified that their receipt is coming
shortly but is delayed by a scheduled maintenance break. The system retries fiscalization
automatically once the window ends.

### BR-07.5 Fiscal Retry
If fiscalization fails for a recoverable reason (e.g., shift not yet open, temporary API
outage), it is retried automatically for a bounded window (configurable, default 15 minutes).
After the window expires with no success, the failure is escalated to admins.

### BR-07.6 Receipt Delivery
As soon as a fiscal receipt is confirmed successful, the Renter automatically receives a
notification containing the receipt URL (and PDF link if available). The Renter does not
need to ask for it.

---

## BR-08 — Pickup and Active Rental

### BR-08.1 Renter Self-Opens Locker
After payment confirmation, the Renter may open their locker(s) at any time from within the
Telegram bot — but only the lockers that are reserved for them in a confirmed, paid rental.

### BR-08.2 Rental Starts on First Open
Opening any locker in a rental for the first time transitions the rental to **ACTIVE** and
starts the rental duration countdown from that exact moment.

### BR-08.3 Automatic Start if Locker Never Opened
If the Renter never opens their locker(s) within a configurable grace period after payment
confirmation, the rental starts automatically anyway (the paid duration begins counting down).
This prevents indefinite holds on equipment at no cost.

### BR-08.4 Overtime Warning
While a rental is active, the Renter receives a push notification when exactly 5 minutes of
paid duration remain.

### BR-08.5 Overtime Notification
When the paid duration fully elapses, the Renter receives a notification indicating that
their rental is now accumulating overtime charges.

### BR-08.6 Active Rental View
A Renter can view all of their currently active or awaiting-pickup rentals at any time,
including time remaining or accumulated overtime, live.

---

## BR-09 — Return and Surcharge

### BR-09.1 Photo Required to Finish
To complete a rental, the Renter must submit a photo of the returned equipment inside its
locker. This photo is stored in permanent storage (MinIO). It is viewable by admins in the
admin panel. It serves as evidence that equipment was returned in acceptable condition.

### BR-09.2 Door Sensor Required to Finish
The system verifies the door-closed state with the physical door sensor for each locker in
the rental before accepting the finish. The rental must not be marked as finished while any
locker's door sensor reports open.

### BR-09.3 HA Offline Fallback
If the Home Assistant connection is unavailable at the time of finish, the system accepts the
finish anyway with a flag `doorStateVerified = false`. Admins are immediately notified of the
unverified finish so they can manually confirm the locker state. The rental status transitions
to COMPLETED regardless.

### BR-09.4 No Surcharge Within Tolerance
If actual usage time does not exceed the paid duration (within a small tolerance), the rental
completes immediately with no further payment.

### BR-09.5 Surcharge Calculation
If actual usage exceeds the paid duration, the system:
1. Rounds up actual usage to the nearest tariff band (using the booking's day type, see BR-04.4).
2. Computes the surcharge as: price of the rounded-up total duration minus the amount already paid.
3. If the computed surcharge is zero or negative, the rental completes with no charge.

### BR-09.6 Locker Released Immediately on Surcharge
If a surcharge is owed, all lockers in the rental are immediately released back to AVAILABLE.
The physical locker is not held hostage for an unpaid surcharge. The debt follows the Renter
(see BR-05.3) rather than the hardware.

### BR-09.7 Surcharge Invoice is Asynchronous
When a surcharge is computed, a `SurchargeRequired` domain event is published. The payments
module subscribes to this event and creates a top-up invoice asynchronously. The Renter is
notified of the payment link as soon as the invoice is created (via the notifications module).
The finish endpoint returns a success response immediately without waiting for the invoice
creation. If invoice creation fails transiently, it must be retried; persistent failure
requires admin attention.

### BR-09.8 Surcharge Reminders
A Renter with an unpaid surcharge is reminded on an escalating schedule:
- Shortly after the surcharge invoice is created.
- Again a few hours later (configurable).
- Once daily thereafter.
Until the surcharge is paid.

---

## BR-10 — Media Assets

### BR-10.1 Photo Storage
All photos submitted by Renters (finish-rental photos, support report attachments) are stored
in MinIO object storage. Photos are never stored only as Telegram `file_id` values — these are
bot-specific, expire, and are inaccessible from the admin panel.

### BR-10.2 Upload Flow
In v1, the Telegram bot downloads photo bytes from Telegram and POSTs them to the backend API.
The API stores the bytes in MinIO and returns a media asset reference. The bot does not upload
directly to MinIO.

### BR-10.3 Access Control
- Admins view photos via pre-signed URLs served by the admin panel (short-lived, authenticated).
- Renters see confirmation in Telegram at the time of upload (the bot acknowledges receipt).
- Photos are never publicly accessible via a guessable URL.

### BR-10.4 Retention
Finish-rental photos and support-report attachments are retained for a minimum of 1 year
(configurable per organization). Expired assets are automatically purged by a scheduled job.

---

## BR-11 — Support

### BR-11.1 Problem Report Submission
A Renter can file a free-text problem report at any time (optionally linking it to a specific
rental, optionally with a photo attachment). No booking is required to file a report.

### BR-11.2 Admin Resolution
Open reports are visible in the admin panel and can be marked as resolved by any admin with
at least STATION_OPERATOR role for the affected station.

---

## BR-12 — Admin Operations

### BR-12.1 Manual Locker Control
Admins can manually open or close any locker regardless of rental state (e.g., for maintenance
or emergency access). Manual admin actions are distinguishable from Renter-initiated actions
in the audit log and do not affect rental state (a manual admin open while a rental is active
does not reset the rental timer).

### BR-12.2 Force-Complete / Cancel Rental
Admins can force-complete or cancel any rental in exceptional situations (e.g., equipment
damage, renter dispute). These are irreversible, sensitive actions that must be attributed
to a specific admin and recorded in the audit log with a mandatory reason.

### BR-12.3 Surcharge Write-Off
Admins (ORG_ADMIN and above) can cancel (write off) an unpaid surcharge. This is a financial
action that must be recorded in the audit log with the cancelling admin's identity and a reason.
A written-off surcharge does not count as "unpaid" for the purposes of BR-05.3.

### BR-12.4 Dashboard Stats
Admins need at-a-glance statistics: rental counts and revenue for today, this week, and this
month. STATION_OPERATOR admins see only stats for their assigned stations.

### BR-12.5 Rental Export
ORG_ADMIN and above can export the full rental history for their organization to CSV/XLSX,
with date-range filtering.

### BR-12.6 Audit Log Access
ORG_ADMIN and above can query the audit log for their organization. SUPER_ADMIN can query
across all organizations.

### BR-12.7 Audit Log Retention
Audit log entries and rental status history are retained for a minimum of 1 year (aligned
with fiscal compliance retention). `[OPEN: confirm Ukrainian legal minimum for fiscal-adjacent records]`

---

## BR-13 — Notifications

### BR-13.1 Event-Driven Delivery
All notifications (Renter-facing and admin-facing) are triggered by domain events. No module
other than the notifications module directly calls the Telegram Bot API (or any future channel)
for push delivery. This is the only module allowed to push outbound messages.

### BR-13.2 Locale-Aware Messages
All Renter-facing notifications are delivered in the Renter's stored locale. Admin-facing
notifications are delivered in the admin's stored locale (default: Ukrainian).

### BR-13.3 Channel Abstraction
v1 delivers via Telegram only. Future channels (push notifications for mobile app, email,
SMS) are supported by registering new channel implementations — no notification logic changes
are required.

### BR-13.4 Admin Broadcast
ORG_ADMIN and above can send a manual broadcast message to all Renters in their organization
(e.g., service announcements, maintenance notices).

---

## BR-14 — Internationalization

### BR-14.1 Supported Locales (v1)
The system supports **Ukrainian (uk)** and **English (en)** out of the box. Additional locales
can be added by providing translation files.

### BR-14.2 Backend-Managed Translations
The backend API returns translated messages in the caller's locale. The Telegram bot does not
maintain its own string translations for domain messages (business errors, status descriptions,
notification content). UI-level labels and button text may be bot-managed, but business
messages come from the API.

### BR-14.3 Locale Resolution Order
When determining which locale to use for a response:
1. Locale from the authenticated user's JWT claim (stored in `renters.locale` or `admin_accounts.locale`).
2. If not set, the Organization's `defaultLocale`.
3. If not set, system default: `uk`.

### BR-14.4 Organization Locale Configuration
Each Organization configures its set of supported locales. Renters may only choose from this
set. Admins use the Admin Panel in their own locale (uk or en).
