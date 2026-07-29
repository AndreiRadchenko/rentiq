Create an implementation plan for the Analytics + Admin Panel specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.12 analytics — direct queries and
daily_org_stats rollup) and docs/roadmap/implementation-roadmap.md (Phase 10 — Analytics +
Admin Panel deliverables and exit criteria).

Preserve module boundaries: analytics is read-only with no upstream sync dependencies;
nothing depends on it. admin-panel is a separate Next.js app, not a NestJS module.

Include:
- Architecture impact
- Required modules: analytics (backend); apps/admin-panel (Next.js)
- Domain model: AnalyticsQueryService (direct SQL for today/week/month); StatsRollupJob
  subscribing to RentalFinished/PaymentSucceeded, updating daily_org_stats
- Database changes: daily_org_stats table (orgId, statDate, rentalsCount, revenueMinor,
  surchargeRevenueMinor)
- APIs: GET /analytics/summary, GET /analytics/export?format=csv
- Events subscribed: RentalFinished, PaymentSucceeded
- Background jobs: StatsRollupJob
- Admin panel deliverables: authentication (login, refresh, protected routes), dashboard
  (rental counts, revenue, live active rentals), stations view, locker detail, rentals
  list/detail, tariffs CRUD, users management, audit log view, support queue, org
  settings; next-intl wired with uk + en
- Testing strategy: admin logs into the panel, dashboard shows today's rental count and
  revenue, opens a rental with a finish photo (displays via MinIO pre-signed URL from
  04-media-assets), exports the last 30 days of rentals to CSV
- Risks
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 10's exit criteria

Do not generate production code.
