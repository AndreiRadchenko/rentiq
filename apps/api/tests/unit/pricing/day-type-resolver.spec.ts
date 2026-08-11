import { DayTypeResolver } from '../../../src/pricing/infrastructure/day-type-resolver';

describe('DayTypeResolver (FR-003)', () => {
  const resolver = new DayTypeResolver();

  it('Friday 23:55 Europe/Kyiv → WEEKDAY even though local time is Saturday (FR-003)', () => {
    const fridayLate = new Date('2026-08-07T23:55:00+03:00');
    expect(resolver.resolve(fridayLate, 'Europe/Kyiv')).toBe('WEEKDAY');
  });

  it('pure Saturday → WEEKEND', () => {
    const saturday = new Date('2026-08-08T12:00:00+03:00');
    expect(resolver.resolve(saturday, 'Europe/Kyiv')).toBe('WEEKEND');
  });

  it('Sunday → WEEKEND', () => {
    const sunday = new Date('2026-08-09T12:00:00+03:00');
    expect(resolver.resolve(sunday, 'Europe/Kyiv')).toBe('WEEKEND');
  });

  it('Monday → WEEKDAY', () => {
    const monday = new Date('2026-08-10T09:00:00+03:00');
    expect(resolver.resolve(monday, 'Europe/Kyiv')).toBe('WEEKDAY');
  });

  it('defaults to Europe/Kyiv timezone', () => {
    const saturday = new Date('2026-08-08T12:00:00+03:00');
    expect(resolver.resolve(saturday)).toBe('WEEKEND');
  });
});
