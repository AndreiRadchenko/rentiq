Create an implementation plan for the Support + Audit Log specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.11 support, §4.13 audit-log) and
docs/roadmap/implementation-roadmap.md (Phase 9 — Support + Audit Log deliverables and
exit criteria).

Preserve module boundaries: support depends on iam, organizations, media only; audit-log
is a cross-cutting consumer that nothing else depends on.

Include:
- Architecture impact
- Required modules: support, audit-log
- Domain model: ProblemReport aggregate (renterId, rentalId nullable, description,
  attachmentAssetId nullable, status NEW|RESOLVED); AuditLogEntry entity (actorType,
  actorId, action, targetType, targetId, metadata, occurredAt)
- Database changes: problem_reports, audit_log_entries tables (audit_log_entries
  append-only)
- APIs: POST /support/reports (multipart: description + optional photo),
  GET /support/reports?status=NEW, PATCH /support/reports/:id/resolve,
  GET /audit-log?actorId=&from=&to=&targetType=&targetId=
- Events: ProblemReported, ProblemResolved
- Background jobs: audit log retention job (@Cron daily) flagging entries older than the
  org-configurable retentionDays (default 365); hard delete only after the configurable
  window, never earlier
- Testing strategy: wire the @AuditableAction interceptor and decorate exactly the
  sensitive methods listed in Phase 9's deliverables (RentalFulfilmentService.forceClose,
  SurchargeRepository.cancel, LockersService.adminOpen/adminClose,
  StationsService.toggleVisibility/toggleActive, AdminAccountService.create/disable,
  OrganizationService.updateBranding/rotateCredentials); force-close a rental as an admin,
  query the audit log, confirm the entry shows the admin's ID, action
  RENTAL_FORCE_CLOSED, and the rental ID; verify an unauthorized admin (a
  STATION_OPERATOR at a different station) cannot see the entry
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 9's exit criteria

Do not generate production code.
