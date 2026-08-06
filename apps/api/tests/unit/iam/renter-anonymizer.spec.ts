import {
  RenterAnonymizer,
  RENTER_RETENTION_YEARS,
  ANONYMOUS_RENTER_NAME,
  ANONYMOUS_PHONE_PREFIX,
  RenterAnonymizationTarget,
} from '../../../src/iam/application/renter/renter-anonymizer';

function target(overrides: Partial<RenterAnonymizationTarget> = {}): RenterAnonymizationTarget {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    orgId: '20000000-0000-4000-8000-000000000002',
    status: 'DISABLED',
    consentGivenAt: new Date('2020-01-01T00:00:00.000Z'),
    name: 'Олег',
    phone: '+380501234567',
    ...overrides,
  };
}

describe('RenterAnonymizer (T062: DR-005 deletion anonymization)', () => {
  const anonymize = jest.fn<Promise<void>, [string, string, string, string]>();

  beforeEach(() => {
    anonymize.mockReset();
  });

  function build(now: Date) {
    const writer = { anonymize };
    const service = new RenterAnonymizer(writer);
    return { service, now };
  }

  it('never anonymizes an active renter', async () => {
    const { service, now } = build(new Date('2030-01-01T00:00:00.000Z'));
    const done = await service.anonymizeIfEligible(target({ status: 'ACTIVE' }), now);

    expect(done).toBe(false);
    expect(anonymize).not.toHaveBeenCalled();
  });

  it('keeps the record when the retention period has not elapsed', async () => {
    const consentGivenAt = new Date('2023-01-01T00:00:00.000Z');
    const beforeDeadline = new Date(consentGivenAt);
    beforeDeadline.setUTCFullYear(beforeDeadline.getUTCFullYear() + RENTER_RETENTION_YEARS - 1);
    const { service } = build(beforeDeadline);

    const done = await service.anonymizeIfEligible(target({ consentGivenAt }), beforeDeadline);

    expect(done).toBe(false);
    expect(anonymize).not.toHaveBeenCalled();
  });

  it('anonymizes exactly at the retention deadline', async () => {
    const consentGivenAt = new Date('2020-01-01T00:00:00.000Z');
    const atDeadline = new Date(consentGivenAt);
    atDeadline.setUTCFullYear(atDeadline.getUTCFullYear() + RENTER_RETENTION_YEARS);
    const { service } = build(atDeadline);

    const done = await service.anonymizeIfEligible(target({ consentGivenAt }), atDeadline);

    expect(done).toBe(true);
    expect(anonymize).toHaveBeenCalledWith(
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      ANONYMOUS_RENTER_NAME,
      ANONYMOUS_PHONE_PREFIX,
    );
  });
});
