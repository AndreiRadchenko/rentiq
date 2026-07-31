import { PhoneNumber } from '../../../src/shared-kernel/domain/value-objects/phone-number';

describe('PhoneNumber', () => {
  describe('from', () => {
    it('should create PhoneNumber with valid E.164 format', () => {
      const phone = PhoneNumber.from('+380501234567');
      expect(phone.toString()).toBe('+380501234567');
    });

    it('should reject invalid phone number', () => {
      expect(() => PhoneNumber.from('12345')).toThrow('Invalid phone number');
    });

    it('should reject phone number without + prefix', () => {
      expect(() => PhoneNumber.from('380501234567')).toThrow('Invalid phone number');
    });
  });

  describe('equals', () => {
    it('should return true for equal phone numbers', () => {
      const a = PhoneNumber.from('+380501234567');
      const b = PhoneNumber.from('+380501234567');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different phone numbers', () => {
      const a = PhoneNumber.from('+380501234567');
      const b = PhoneNumber.from('+380501234568');
      expect(a.equals(b)).toBe(false);
    });
  });
});
