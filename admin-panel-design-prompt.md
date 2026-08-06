Я хочу розробити дизайн веб адмін панелі для проекту Rentiq. в файлі GREENFIELD_ARCHITECTURE описані основні бізнес правила та архітектурні особливості проекту.  На основі GREENFIELD_ARCHITECTURE створи промпт для claude design та Google stitch для створення адаптивного дизайну адмін панелі проекту Rentiq. цей промпт я буду безпосередньо передавати в claude design та Google stitch


Design a responsive, modern web admin dashboard for "Rentiq" — a multi-tenant 
SUP (stand-up paddleboard) equipment rental platform with smart-lock-controlled 
lockers at physical stations. The admin panel is a Next.js application talking 
to a REST API, used by three role types with different permission levels.

## Product context

Rentiq lets renters book lockers containing rental equipment at physical 
stations, pay via Monobank, unlock the locker remotely via Home Assistant 
smart-lock integration, and return equipment with photo verification. Each 
organization is a white-label operator with its own branding, stations, 
pricing, and payment credentials. The admin panel is where staff manage 
stations, lockers, pricing, rentals, payments, and support tickets.

## User roles (design distinct views/permissions for each)

1. SUPERADMIN — cross-organization access. Manages the list of organizations, 
   white-label branding, payment/fiscal credential rotation, and can view 
   audit logs and analytics across all orgs. Uses an org-switcher in the header.
2. ORGADMIN — full control within one organization: stations, lockers, 
   tariffs/pricing, renters, rentals, payments, notifications, support tickets, 
   analytics, and org-scoped audit log.
3. STATIONOPERATOR — restricted access limited to assigned stations only: 
   can view/manage lockers and rentals at those stations, manually open/close 
   lockers for maintenance, and resolve support reports. No access to pricing, 
   branding, or user management.

## Core screens to design

1. **Login screen** — username/password JWT auth, clean minimal form, Rentiq 
   branding, "forgot password" link.

2. **Dashboard (home)** — role-aware overview with:
   - Key stat cards: rentals today/this week/this month, revenue today/week/
     month, active rentals count, stations online vs offline
   - Live station status grid (active/inactive, visible/hidden, health status 
     with a connectivity indicator — green/red/yellow)
   - Recent activity feed (new rentals, payments, alerts)
   - Quick alerts banner for unauthorized door-open security events

3. **Stations list & detail view**
   - Table/grid of stations: name, address, working status (Working/
     Maintenance), active toggle, visible-to-client toggle, health/connectivity 
     status, last health check timestamp
   - Station detail page: nested locker list showing each locker's status 
     (Available/Reserved/AwaitingPayment/Rented/Maintenance), assigned 
     inventory kit + tariff warning if misconfigured, Home Assistant connection 
     config, auto-relock delay setting
   - Manual open/close locker buttons (clearly marked as an audited admin 
     action, distinct from renter actions)

4. **Lockers management** — filterable table across stations by status, 
   quick actions to flag maintenance, assign inventory kit type

5. **Tariffs / pricing screen** — table of price rules by equipment kit type, 
   day type (weekday/weekend), and duration bands; add/edit modal with 
   duration + price inputs; per-organization scoping

6. **Rentals list & detail view**
   - Filterable/searchable table: renter, station, locker, status (Reserved, 
     AwaitingPayment, AwaitingPickup, Active, AwaitingSurchargePayment, 
     Completed, Cancelled), duration, price, overtime/surcharge flag
   - Detail drawer/page showing full status history timeline (append-only 
     audit trail), live countdown for active rentals, force-complete/cancel 
     actions (admin-only, requires confirmation, clearly audited)
   - Surcharge management: view pending surcharges, write-off/cancel action

7. **Payments screen** — transaction list with status (Pending/Processing/
   Success/Failed/Expired), linked fiscal receipt status, filters by date/
   organization, receipt PDF/link access

8. **Renters (users) list** — searchable table: name, phone, telegram-linked 
   status, registration date, active rental count, consent timestamp

9. **Support / problem reports** — queue of open reports with renter info, 
   description, optional photo attachment, mark-resolved action

10. **Organizations management** (SUPERADMIN only) — list/create orgs, edit 
    branding (logo, primary color, business name), payment gateway credential 
    rotation, Telegram bot config per org

11. **Audit log viewer** — filterable table (actor, action, target, timestamp) 
    for sensitive actions like force-close, surcharge write-off, station 
    toggles, admin account changes

12. **Analytics/reporting screen** — charts for rental counts and revenue over 
    time (today/week/month toggle), exportable CSV/XLSX button

13. **Admin account management** (ORGADMIN/SUPERADMIN) — create/edit admin 
    accounts, assign role, assign stations for STATIONOPERATOR role

## Design system requirements

- Clean, professional SaaS aesthetic — think Linear, Vercel dashboard, or 
  Retool: neutral background, one accent brand color (customizable per org), 
  generous whitespace, subtle shadows/borders instead of heavy skeuomorphism
- Left sidebar navigation with collapsible sections, icon + label, active 
  state highlight, role-based menu items (hide pricing/branding for 
  STATIONOPERATOR)
- Top bar: organization switcher (SUPERADMIN), search, notifications bell, 
  user avatar/menu
- Status badges with consistent color coding: green (active/success/paid), 
  yellow (pending/awaiting), red (failed/offline/security alert), gray 
  (cancelled/disabled)
- Data-dense tables with sorting, filtering, pagination — this product is 
  operations-heavy, prioritize scanability over decoration
- Real-time indicators (live countdown timers on active rentals, pulsing dot 
  for online stations) shown as static mockup states (e.g., "12:34 remaining")
- Dark mode variant is a nice-to-have but not required

## Responsive behavior

- Design for desktop-first (primary use case: staff at a desk), but must 
  degrade gracefully to tablet (sidebar collapses to icons-only or a 
  hamburger drawer) and mobile (tables convert to stacked cards, bottom 
  nav or hamburger menu, single-column layout)
- Provide at minimum: desktop (1440px), tablet (768px), and mobile (390px) 
  breakpoint views for the Dashboard, Stations, and Rentals screens

## Deliverables

Please generate: a design system/style guide (colors, typography, spacing, 
component states), the Dashboard, Stations list + detail, Rentals list + 
detail, and Tariffs screens at desktop resolution, plus mobile responsive 
variants for Dashboard and Rentals.



Для Claude Design можна вставити цей промпт як єдине повідомлення — інструмент задасть уточнюючі питання перед побудовою, після чого зможе експортувати прототип у Claude Code для реалізації. Для Google Stitch варто передати той самий текст, але при потребі скоротити секцію “Deliverables” до 2-3 екранів за раз, оскільки Stitch зазвичай працює краще з фокусованими, покроковими запитами, ніж з одним величезним промптом на весь застосунок


Ось окремі, вужчі промпти — по одному на кожен екран. Кожен побудований на конкретних бізнес-правилах і структурі даних із вашого документа, а не на загальних припущеннях, тож можна передавати їх у Stitch по черзі для точнішого контролю над кожним екраном.[1]

## 0. Промпт для дизайн-системи (запустити першим)

```
Create a design system style guide for "Rentiq" — a B2B SaaS admin dashboard 
for managing a smart-lock equipment rental network. Style: clean, professional, 
data-dense operations tool (like Linear or Vercel dashboard, not consumer-app 
playful). 

Define:
- Color palette: neutral gray/white background, one customizable brand accent 
  color, and semantic status colors — green (active/success/paid), amber 
  (pending/awaiting), red (failed/offline/security alert), gray (cancelled/
  disabled)
- Typography: clean sans-serif, clear hierarchy for headings, table text, 
  and small metadata labels
- Core components: sidebar nav item (default/active/hover), top bar, stat 
  card, status badge/pill, data table row, primary/secondary/destructive 
  buttons, toggle switch, dropdown filter, modal, confirmation dialog for 
  destructive actions
- Spacing and corner-radius scale for a consistent, compact but readable feel
```

## 1. Login screen

```
Design a login screen for "Rentiq" admin panel — a B2B SaaS for managing 
smart-lock rental stations. Fields: email/username and password (JWT-based 
auth, no social login). Include a "forgot password" link, a subtle Rentiq 
logo placeholder, and a clean split-screen layout (form on one side, 
branded illustration or gradient panel on the other). Minimal, professional, 
neutral color palette with one accent color for the primary button. 
Responsive: stacks to full-width single column on mobile.
```

## 2. Dashboard (overview)

```
Design a dashboard home screen for "Rentiq" admin panel (rental equipment 
management SaaS). Layout: left sidebar navigation (Dashboard, Stations, 
Lockers, Tariffs, Rentals, Payments, Renters, Support, Analytics, 
Organizations, Audit Log, Admins), top bar with organization switcher, 
search, notification bell, user avatar.

Main content:
- Row of 4 stat cards: "Rentals Today/Week/Month" (with toggle), "Revenue" 
  (with toggle), "Active Rentals" (live count), "Stations Online" (e.g. "8/10")
- A station status grid below: cards showing station name, a colored dot for 
  connectivity health (green=online, red=offline), active/inactive toggle 
  state, visible/hidden badge
- A red alert banner area for urgent security events (e.g. "Unauthorized door 
  open detected at Station 3") that can appear above the stats
- A recent activity feed on the right sidebar: latest rentals started, 
  payments completed, support tickets opened, each with a timestamp

Responsive: sidebar collapses to icon-only rail on tablet, becomes a bottom 
nav or hamburger drawer on mobile; stat cards stack to a 2-column then 
1-column grid.
```

## 3. Stations list

```
Design a "Stations" list screen for the Rentiq admin panel. A data table with 
columns: Station Name, Address, Working Status (badge: Working/Maintenance), 
Active toggle switch, Visible to Clients toggle switch, Health/Connectivity 
(colored dot + "last checked X min ago"), Locker Count, and a row action 
menu (Edit, View Lockers). Include a filter bar above the table (filter by 
status, active state, search by name) and a "+ Add Station" primary button 
top-right. Sortable column headers. Pagination at the bottom.

Note: active and visible-to-clients are independent toggles — a station can 
be active-but-hidden (soft launch) or visible-but-flagged-inactive (outage). 
Show this clearly with two separate toggle columns, not one combined status.

Responsive: on mobile, convert table rows into stacked cards showing the 
same fields vertically.
```

## 4. Station detail view

```
Design a station detail page for the Rentiq admin panel, opened from the 
Stations list. Header: station name, address, edit button, working status 
badge, active/visible toggles.

Sections:
- "Connection" panel: Home Assistant URL/IP, connection token reference 
  (masked), auto-relock delay setting (seconds), health status with last 
  check timestamp
- "Lockers" table nested below: Locker Name, Status badge (Available/
  Reserved/Awaiting Payment/Rented/Maintenance — each a distinct color), 
  assigned Inventory Kit type (or a warning icon + "No kit/tariff configured" 
  if missing), and two action buttons per row: "Open" and "Close" (manual 
  admin actions, visually marked as audited with a small shield/lock icon)
- A confirmation modal for the manual open/close action, showing text like 
  "This manual action will be recorded in the audit log"

Responsive: nested locker table becomes stacked cards on mobile, connection 
panel becomes a collapsible accordion section.
```

## 5. Lockers management (cross-station)

```
Design a "Lockers" management screen for the Rentiq admin panel — a 
cross-station filterable table view (not nested inside one station). 
Columns: Locker Name, Station (name, clickable), Status badge (Available/
Reserved/Awaiting Payment/Rented/Maintenance), Inventory Kit Type (or 
"Unconfigured" warning badge), row actions (Assign Kit, Flag Maintenance, 
Open, Close).

Top filter bar: filter by Station, filter by Status, search. Include an 
"Unconfigured lockers" quick-filter chip that highlights lockers missing a 
kit/tariff, since these must never be rentable and admins need to spot them 
fast. Empty state and warning states use amber/red accents.

Responsive: table collapses to cards on mobile; filter bar becomes a 
collapsible filter drawer.
```

## 6. Tariffs / pricing screen

```
Design a "Tariffs" (pricing) management screen for the Rentiq admin panel. 
A table listing price rules: Kit Type, Day Type (badge: Weekday/Weekend), 
Duration (e.g. "60 min", "4 hours"), Price (formatted currency, UAH), and 
edit/delete row actions. Group or filter by Kit Type using tabs or a 
dropdown at the top. Include a "+ Add Tariff" button that opens a side 
panel or modal with fields: Kit Type (dropdown), Day Type (toggle: Weekday/
Weekend), Duration (dropdown of fixed preset options, not free text), Price 
(currency input).

Note: pricing is scoped per-organization, so include a small note or org 
context indicator confirming which organization's tariffs are being edited.

Responsive: table becomes stacked cards; add/edit modal becomes full-screen 
on mobile.
```

## 7. Rentals list

```
Design a "Rentals" list screen for the Rentiq admin panel. A dense data 
table with columns: Renter Name/Phone, Station, Locker, Status badge 
(Reserved/Awaiting Payment/Awaiting Pickup/Active/Awaiting Surcharge 
Payment/Completed/Cancelled — each visually distinct color), Duration, 
Price, a small overtime/surcharge indicator icon when applicable, Created 
timestamp, and a row click to open detail.

Top filter bar: filter by Station, Status (multi-select), date range; 
search by renter name/phone. Show a live countdown chip (e.g. "12:34 
remaining" or "Overtime +8 min" in red) inline for Active rentals. 
Include an "Export" button (CSV/XLSX) top-right.

Responsive: table converts to stacked cards on mobile, with status badge 
and countdown chip prominent at the top of each card.
```

## 8. Rental detail view

```
Design a rental detail page/drawer for the Rentiq admin panel, opened from 
the Rentals list. Header: Renter name/phone, Station + Locker, current 
Status badge, live countdown or overtime indicator if active.

Sections:
- Summary info: base duration, base price, total time, created/started/
  finished timestamps
- "Status History" — a vertical timeline showing each status transition 
  with timestamp and who/what triggered it (system vs admin vs renter), 
  since this is an append-only audit trail
- "Surcharge" panel (shown only if applicable): amount owed, status 
  (Pending/Linked to Payment/Settled/Cancelled), a "Write off surcharge" 
  button requiring confirmation
- Admin action buttons at the bottom: "Force Complete" and "Cancel Rental", 
  both requiring a confirmation modal that warns "This action will be 
  recorded in the audit log" and optionally asks for a reason

Responsive: sections stack vertically on mobile; timeline becomes a 
condensed vertical list.
```

## 9. Payments screen

```
Design a "Payments" transactions screen for the Rentiq admin panel. A table 
with columns: Renter, Type (Initial/Top-up), Amount, Status badge (Pending/
Processing/Success/Failed/Expired), Fiscal Receipt status (badge: Not 
Started/Pending/Success/Failed, with a small receipt-link icon when 
available), Created/Paid timestamps.

Filter bar: date range, status filter, organization filter (for 
superadmin), search by renter or invoice ID. Row click opens a detail panel 
showing the checkout URL, external invoice ID, raw gateway status, and 
receipt PDF link/download button. Include a "Cancel Surcharge" admin action 
where relevant, with an audit confirmation modal.

Responsive: table to stacked cards; detail panel becomes full-screen 
overlay on mobile.
```

## 10. Renters list

```
Design a "Renters" (customers) list screen for the Rentiq admin panel. A 
searchable table: Name, Phone, Telegram-linked indicator icon, Registration 
Date, Active Rentals count (badge if >0), Consent timestamp, Status 
(Active/Inactive). Search bar and a status filter at the top. Row click 
opens a simple detail view showing rental history and any outstanding 
surcharges for that renter.

Responsive: table to stacked cards, showing name/phone prominently and 
secondary info condensed below.
```

## 11. Support / problem reports

```
Design a "Support" screen for the Rentiq admin panel showing a queue of 
renter-submitted problem reports. Card or list layout: renter name, 
free-text description (truncated with "read more"), optional attached photo 
thumbnail, linked rental ID if applicable, status badge (New/Resolved), 
created timestamp, and a "Mark Resolved" button. Filter tabs: "Open" / 
"Resolved" / "All". New/unresolved reports should stand out visually 
(left border accent or badge color).

Responsive: list becomes a single-column card stack on mobile with the 
photo thumbnail and description compacted.
```

## 12. Organizations management (SUPERADMIN)

```
Design an "Organizations" management screen for the Rentiq admin panel, 
visible only to SUPERADMIN role. A table listing all white-label 
organizations: Name, Slug, Status (Active/Suspended), Branding preview 
(small color swatch + logo thumbnail), Created date, row actions (Edit, 
View). A "+ Create Organization" button opens a form/modal with: Name, 
Slug, Business Name, Logo upload, Primary Color picker, Supported Locales, 
Default Locale, and separate sections for "Payment Gateway Credentials" 
and "Telegram Bot Config" showing masked/reference values with a "Rotate 
Credentials" button rather than raw secret fields.

Responsive: table to cards; the create/edit form becomes a full-screen 
step-based flow on mobile.
```

## 13. Audit log viewer

```
Design an "Audit Log" viewer screen for the Rentiq admin panel (visible to 
SUPERADMIN/ORGADMIN only). A dense, read-only table: Timestamp, Actor 
(admin name/type icon: Admin/System/Renter), Action (e.g. "Force Closed 
Rental", "Cancelled Surcharge", "Toggled Station Visibility"), Target 
(type + ID, clickable to jump to that record), and an expandable row to 
show raw metadata (JSON) for that action. Filter bar: date range, actor, 
action type, target type. This should feel like a security/compliance 
tool — monospace font accents for IDs/metadata, minimal color, clear 
timestamp emphasis.

Responsive: table becomes a stacked timeline-style list on mobile, still 
showing actor, action, and timestamp clearly.
```

## 14. Analytics / reporting

```
Design an "Analytics" dashboard screen for the Rentiq admin panel. Top 
section: a date-range toggle (Today/This Week/This Month/Custom). Below, 
two charts side by side: a line or bar chart of "Rentals Over Time" and a 
line or bar chart of "Revenue Over Time" (with a secondary thinner line for 
surcharge revenue). Below the charts, a summary stat row: total rentals, 
total revenue, average rental duration, surcharge rate (%). Include an 
"Export Report" button (CSV/XLSX) top-right.

Responsive: charts stack vertically on tablet/mobile, full-width, with 
the date toggle becoming a dropdown instead of a segmented control.
```

## 15. Admin accounts management

```
Design an "Admin Accounts" management screen for the Rentiq admin panel 
(ORGADMIN/SUPERADMIN only). A table: Email, Role badge (Superadmin/Org 
Admin/Station Operator — distinct colors), Assigned Stations (shown as 
chips, only relevant for Station Operator role), Status (Active/Disabled), 
Created date. A "+ Add Admin" button opens a form: Email, Password, Role 
dropdown, and a conditional multi-select "Assign Stations" field that only 
appears when Role = Station Operator.

Responsive: table to cards; form becomes full-screen on mobile.
```

Рекомендую подавати їх у Stitch послідовно, починаючи з промпту №0 (дизайн-система), щоб задати єдину палітру та компоненти, а потім №2 (Dashboard) — після цього решта екранів вийдуть візуально узгодженими, оскільки Stitch зазвичай підхоплює стиль з попередніх генерацій у тому ж проєкті.

