import { Currency } from '../../../src/shared-kernel/domain/value-objects/currency';
import { Money } from '../../../src/shared-kernel/domain/value-objects/money';

describe('Currency', () => {
  it('should have UAH and EUR values', () => {
    expect(Currency.UAH).toBe('UAH');
    expect(Currency.EUR).toBe('EUR');
  });

  it('should reject invalid currency in Money', () => {
    expect(() => Money.from(1000, 'USD' as Currency)).toThrow('Invalid currency');
  });
});
