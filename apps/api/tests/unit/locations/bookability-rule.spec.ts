import { BookabilityRule } from '../../../src/locations/domain/bookability-rule';

const ALL_TRUE = {
  station: { isActive: true, isVisibleToClients: true, workingStatus: 'WORKING' },
  locker: { inventoryKitId: 'kit-1', status: 'AVAILABLE', currentRentalId: null },
  tariffsForToday: [{ durationMinutes: 60 }],
};

function withStation(override: Partial<typeof ALL_TRUE.station>) {
  return { ...ALL_TRUE, station: { ...ALL_TRUE.station, ...override } };
}
function withLocker(override: Partial<typeof ALL_TRUE.locker>) {
  return { ...ALL_TRUE, locker: { ...ALL_TRUE.locker, ...override } };
}

describe('BookabilityRule.evaluate (FR-001)', () => {
  it('returns true when all 6 conditions hold', () => {
    expect(BookabilityRule.evaluate(ALL_TRUE)).toBe(true);
  });

  it('condition (a): inactive station → false', () => {
    expect(BookabilityRule.evaluate(withStation({ isActive: false }))).toBe(false);
  });

  it('condition (b): hidden station → false', () => {
    expect(BookabilityRule.evaluate(withStation({ isVisibleToClients: false }))).toBe(false);
  });

  it('condition (c): MAINTENANCE working status → false', () => {
    expect(BookabilityRule.evaluate(withStation({ workingStatus: 'MAINTENANCE' }))).toBe(false);
  });

  it('condition (d): locker without kit → false', () => {
    expect(BookabilityRule.evaluate(withLocker({ inventoryKitId: null }))).toBe(false);
  });

  it('condition (e): no tariffs for today → false', () => {
    expect(BookabilityRule.evaluate({ ...ALL_TRUE, tariffsForToday: [] })).toBe(false);
  });

  it('condition (f): non-AVAILABLE locker → false', () => {
    expect(BookabilityRule.evaluate(withLocker({ status: 'RENTED' }))).toBe(false);
  });

  it('condition (f): locker with active rental → false', () => {
    expect(BookabilityRule.evaluate(withLocker({ currentRentalId: 'rental-1' }))).toBe(false);
  });
});
