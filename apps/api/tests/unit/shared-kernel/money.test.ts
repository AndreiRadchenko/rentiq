import { Money } from '../../../src/shared-kernel/domain/value-objects/money';
import { Currency } from '../../../src/shared-kernel/domain/value-objects/currency';

describe('Money', () => {
  describe('from', () => {
    it('should create Money with valid amount and currency', () => {
      const money = Money.from(1000, Currency.UAH);
      expect(money.getAmountMinor()).toBe(1000);
      expect(money.getCurrency()).toBe(Currency.UAH);
    });

    it('should reject invalid currency', () => {
      expect(() => Money.from(1000, 'USD' as Currency)).toThrow('Invalid currency');
    });

    it('should reject negative amount', () => {
      expect(() => Money.from(-100, Currency.UAH)).toThrow('non-negative integer');
    });

    it('should reject non-integer amount', () => {
      expect(() => Money.from(10.5, Currency.UAH)).toThrow('non-negative integer');
    });
  });

  describe('add', () => {
    it('should add two Money values with same currency', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(500, Currency.UAH);
      const result = a.add(b);
      expect(result.getAmountMinor()).toBe(1500);
      expect(result.getCurrency()).toBe(Currency.UAH);
    });

    it('should throw when adding different currencies', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(500, Currency.EUR);
      expect(() => a.add(b)).toThrow('Currency mismatch');
    });
  });

  describe('subtract', () => {
    it('should subtract two Money values with same currency', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(300, Currency.UAH);
      const result = a.subtract(b);
      expect(result.getAmountMinor()).toBe(700);
    });

    it('should throw when subtracting results in negative', () => {
      const a = Money.from(100, Currency.UAH);
      const b = Money.from(300, Currency.UAH);
      expect(() => a.subtract(b)).toThrow('Insufficient funds');
    });

    it('should throw when subtracting different currencies', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(300, Currency.EUR);
      expect(() => a.subtract(b)).toThrow('Currency mismatch');
    });
  });

  describe('equals', () => {
    it('should return true for equal Money values', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(1000, Currency.UAH);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different amounts', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(2000, Currency.UAH);
      expect(a.equals(b)).toBe(false);
    });

    it('should return false for different currencies', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(1000, Currency.EUR);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('isGreaterThan', () => {
    it('should return true when greater', () => {
      const a = Money.from(2000, Currency.UAH);
      const b = Money.from(1000, Currency.UAH);
      expect(a.isGreaterThan(b)).toBe(true);
    });

    it('should return false when equal', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(1000, Currency.UAH);
      expect(a.isGreaterThan(b)).toBe(false);
    });

    it('should throw when comparing different currencies', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(1000, Currency.EUR);
      expect(() => a.isGreaterThan(b)).toThrow('Currency mismatch');
    });
  });

  describe('isLessThan', () => {
    it('should return true when less', () => {
      const a = Money.from(500, Currency.UAH);
      const b = Money.from(1000, Currency.UAH);
      expect(a.isLessThan(b)).toBe(true);
    });

    it('should return false when equal', () => {
      const a = Money.from(1000, Currency.UAH);
      const b = Money.from(1000, Currency.UAH);
      expect(a.isLessThan(b)).toBe(false);
    });
  });
});
