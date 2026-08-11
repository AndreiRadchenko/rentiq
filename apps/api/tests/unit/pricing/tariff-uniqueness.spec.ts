import { Tariff } from '../../../src/pricing/domain/tariff.aggregate';
import { DuplicateTariffError } from '../../../src/pricing/domain/tariff.aggregate';

const BASE = {
  id: '00000000-0000-4000-8000-000000000001',
  orgId: '00000000-0000-4000-8000-0000000000aa',
  kitType: 'SUP_BOARD',
  dayType: 'WEEKDAY' as const,
  durationMinutes: 60,
  priceMinor: 10000,
  currency: 'UAH',
};

describe('Tariff aggregate (FR-026/FR-027)', () => {
  it('lockPrice() returns a Money snapshot unaffected by later mutation (FR-027)', () => {
    const tariff = Tariff.create(BASE);
    const snapshot = tariff.lockPrice();
    tariff.updatePrice(25000);
    expect(snapshot.getAmountMinor()).toBe(10000);
    expect(tariff.currentState.priceMinor).toBe(25000);
  });

  it('softDelete marks deletedAt and isDeleted becomes true', () => {
    const tariff = Tariff.create(BASE);
    expect(tariff.isDeleted).toBe(false);
    tariff.softDelete();
    expect(tariff.isDeleted).toBe(true);
    expect(tariff.currentState.deletedAt).not.toBeNull();
  });

  it('key fields are immutable — only price/currency mutable via updatePrice', () => {
    const tariff = Tariff.create(BASE);
    expect(tariff.kitType).toBe('SUP_BOARD');
    expect(tariff.dayType).toBe('WEEKDAY');
    expect(tariff.durationMinutes).toBe(60);
    tariff.updatePrice(15000, 'EUR');
    expect(tariff.currentState.priceMinor).toBe(15000);
    expect(tariff.currentState.currency).toBe('EUR');
    expect(tariff.kitType).toBe('SUP_BOARD');
    expect(tariff.durationMinutes).toBe(60);
  });

  it('DuplicateTariffError carries the existingTariffId', () => {
    const err = new DuplicateTariffError('existing-id');
    expect(err.existingTariffId).toBe('existing-id');
    expect(err).toBeInstanceOf(DuplicateTariffError);
  });

  it('rejects non-positive durationMinutes on create', () => {
    expect(() => Tariff.create({ ...BASE, durationMinutes: 0 })).toThrow();
    expect(() => Tariff.create({ ...BASE, durationMinutes: -5 })).toThrow();
  });

  it('rejects negative priceMinor on create', () => {
    expect(() => Tariff.create({ ...BASE, priceMinor: -1 })).toThrow();
  });
});
