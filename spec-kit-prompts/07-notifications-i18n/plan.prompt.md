Create an implementation plan for the Notifications + i18n specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.10 notifications, §6 full event
catalog and subscriber list, §8 internationalization architecture) and
docs/roadmap/implementation-roadmap.md (Phase 7 — Notifications + i18n deliverables,
required translation coverage, and exit criteria).

Preserve module boundaries: notifications is a pure event subscriber — nothing depends on
it, and only its TelegramChannel is allowed to call the Telegram Bot API for push.

Include:
- Architecture impact
- Required modules: notifications
- Domain model: NotificationRecord entity (recipientType, recipientId, channel, template,
  payload, status) — tracking only, no business consequence
- Database changes: notification_records table
- Ports: NotificationChannel (send(recipient, template, payload, locale)) implemented by
  TelegramChannel v1; PushChannel/EmailChannel/SmsChannel registered as disabled stubs
- APIs: POST /notifications/broadcast (org admin)
- Events subscribed: the full catalog from §6 — RenterRegistered, RentalPaymentRequested,
  RentalPickupReady, RentalStarted, RentalOvertimeWarningIssued, RentalOvertimeDetected,
  SurchargeRequired, RentalFinished, RentalCancelled, UnverifiedFinishAccepted,
  PaymentSucceeded, FiscalizationDeferred, ReceiptFiscalized, FiscalizationFailed,
  SurchargeInvoiceCreationFailed, UnauthorizedDoorOpenDetected, StationHealthChanged,
  ProblemReported, ProblemResolved
- Background jobs: surcharge reminder BullMQ delayed job, re-queued on each cycle until
  the surcharge is settled
- Testing strategy: for each event in the catalog, assert the correct template renders in
  both uk and en; register a renter with locale en, complete a rental flow, and confirm
  all Telegram notifications arrive in English, then repeat in Ukrainian
- Risks
- Migration considerations: none (greenfield); fill packages/i18n/locales/{uk,en}/
  notifications.json with every template string required by the translation-coverage
  checklist before this phase ships
- Task breakdown matching Phase 7's exit criteria

Do not generate production code.
