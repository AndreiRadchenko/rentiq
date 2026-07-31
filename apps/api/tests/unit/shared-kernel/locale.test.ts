import { LocaleValueObject, Locale } from '../../../src/shared-kernel/domain/value-objects/locale';

describe('Locale', () => {
  describe('from', () => {
    it('should create Locale with valid value', () => {
      const locale = LocaleValueObject.from('uk');
      expect(locale.toString()).toBe('uk');
    });

    it('should reject invalid locale', () => {
      expect(() => LocaleValueObject.from('fr')).toThrow('Invalid locale');
    });
  });

  describe('default', () => {
    it('should return uk as default', () => {
      const locale = LocaleValueObject.default();
      expect(locale.toString()).toBe(Locale.UK);
    });
  });

  describe('equals', () => {
    it('should return true for equal locales', () => {
      const a = LocaleValueObject.from('uk');
      const b = LocaleValueObject.from('uk');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different locales', () => {
      const a = LocaleValueObject.from('uk');
      const b = LocaleValueObject.from('en');
      expect(a.equals(b)).toBe(false);
    });
  });
});
