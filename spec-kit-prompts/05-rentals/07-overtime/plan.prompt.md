Create an implementation plan for the Overtime specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.6 pricing —
OvertimeCalculator, ADR-009) and docs/roadmap/implementation-roadmap.md (Phase 5 —
Rentals, overtime-calculation portion of deliverables and exit criteria).

Preserve module boundaries: OvertimeCalculator lives in pricing as a pure domain service;
rentals calls it through pricing's public interface at finish time — it never
re-implements banding logic itself.

Include:
- Architecture impact
- Required modules: pricing (OvertimeCalculator), rentals (caller)
- Domain model: OvertimeCalculator.calculate(bookingDayType, paidDurationMinutes,
  actualDurationMinutes, tariffs[]) → { bandDurationMinutes, totalPrice, surchargeAmount }
- Database changes: none new — reads existing tariffs table
- APIs: none new — invoked internally from RentalFulfilmentService.confirmFinish
- Events: none published directly — result feeds SurchargeRequired in 08-surcharge
- Background jobs: none
- Testing strategy: exhaustive unit tests for OvertimeCalculator as a pure function —
  exact-duration case, mid-band overtime, exact-band-boundary case, weekday vs weekend
  tariff selection using the booking's locked-in day type
- Risks: tariff-band semantics are an open question (BR-04.4) — plan must not hard-code
  band count assumptions beyond what tariffs configure
- Migration considerations: none (greenfield)
- Task breakdown matching the overtime-calculation portion of Phase 5's exit criteria
  (overtime surcharge computed correctly for a test rental that exceeds paid duration)

Do not generate production code.
