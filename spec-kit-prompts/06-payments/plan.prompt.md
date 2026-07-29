Create an implementation plan for the Payments (Monobank + Checkbox) specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.8 payments, ADR-007, ADR-013 —
one reconciliation owner) and docs/roadmap/implementation-roadmap.md (Phase 6 — Payments
deliverables, stage-validation checklist, and exit criteria).

Preserve module boundaries: payments does not depend on rentals; rentals calls
payments.InvoiceService synchronously for the initial invoice and payments subscribes to
rentals' SurchargeRequired event for top-ups — never the reverse dependency.

Include:
- Architecture impact
- Required modules: payments
- Domain model: PaymentTransaction entity (type INITIAL|TOPUP, purchaseReference,
  externalInvoiceId, status PENDING|PROCESSING|SUCCESS|FAILED|EXPIRED); FiscalReceipt
  child entity (provider, status, retryDeadlineAt); FiscalRetryPolicy domain service
- Database changes: payment_transactions, fiscal_receipts tables; unique index on
  external_invoice_id
- Ports: PaymentGateway (createInvoice, getStatus, verifyWebhook, getPublicKey) implemented
  by MonobankGateway; FiscalGateway (createReceipt, getReceiptStatus, openShift,
  closeShift) implemented by CheckboxGateway; both credentials resolved per-org
- APIs: POST /payments/webhook/monobank (signature-verified inbound),
  GET /payments/:invoiceId/status
- Events: PaymentInvoiceCreated, PaymentSucceeded, PaymentFailed, PaymentExpired,
  FiscalizationDeferred, ReceiptFiscalized, FiscalizationFailed
- Background jobs: ReconciliationService (@Cron every 2 minutes, polling PENDING
  transactions older than 2 minutes); Checkbox shift auto-close cron triggered at the
  organization's maintenance window start
- Testing strategy: reproduce Phase 6's stage-validation checklist as integration/contract
  tests (test-mode Monobank invoice + QR, webhook verified on a stage URL, Checkbox
  sandbox receipt, shift auto-close and deferred/retried fiscalization, reconciliation
  sweep on a deliberately delayed webhook, surcharge invoice created asynchronously); send
  the same webhook payload twice and confirm the rental transitions only once
- Risks: webhook delivery to local dev requires a tunnel (ngrok/Cloudflare Tunnel);
  Checkbox sandbox requires live credentials obtained before starting this phase
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 6's exit criteria

Do not generate production code.
