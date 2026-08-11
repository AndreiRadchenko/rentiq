import { OvertimeCalculator } from '../../../src/pricing/domain/overtime-calculator.service';

const TARIFFS = [
  { durationMinutes: 60, priceMinor: 10000 },
  { durationMinutes: 120, priceMinor: 18000 },
  { durationMinutes: 180, priceMinor: 24000 },
];

describe('OvertimeCalculator band-rounding arithmetic', () => {
  const calc = new OvertimeCalculator();

  it('zero surcharge when within paid band', () => {
    const result = calc.calculate({
      bookingDayType: 'WEEKDAY',
      paidDurationMinutes: 120,
      actualDurationMinutes: 90,
      tariffs: TARIFFS,
    });
    expect(result.surchargeAmount).toBe(0);
    expect(result.bandDurationMinutes).toBe(120);
  });

  it('rounds actual duration up to nearest band and computes surcharge', () => {
    const result = calc.calculate({
      bookingDayType: 'WEEKDAY',
      paidDurationMinutes: 60,
      actualDurationMinutes: 130,
      tariffs: TARIFFS,
    });
    expect(result.bandDurationMinutes).toBe(180);
    expect(result.totalPrice).toBe(24000);
    expect(result.surchargeAmount).toBe(24000 - 10000);
  });

  it('surcharge = difference between actual band price and paid band price', () => {
    const result = calc.calculate({
      bookingDayType: 'WEEKDAY',
      paidDurationMinutes: 120,
      actualDurationMinutes: 150,
      tariffs: TARIFFS,
    });
    expect(result.bandDurationMinutes).toBe(180);
    expect(result.surchargeAmount).toBe(24000 - 18000);
  });

  it('exact band boundary rounds to that band (no surcharge)', () => {
    const result = calc.calculate({
      bookingDayType: 'WEEKDAY',
      paidDurationMinutes: 120,
      actualDurationMinutes: 120,
      tariffs: TARIFFS,
    });
    expect(result.bandDurationMinutes).toBe(120);
    expect(result.surchargeAmount).toBe(0);
  });
});
