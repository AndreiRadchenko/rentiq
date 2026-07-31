import { ok, err } from '../../../src/shared-kernel/domain/result';

describe('Result', () => {
  describe('Ok', () => {
    it('should create an Ok result', () => {
      const result = ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
    });

    it('should unwrap the value', () => {
      const result = ok(42);
      expect(result.unwrap()).toBe(42);
    });

    it('should map the value', () => {
      const result = ok(42);
      const mapped = result.map((x) => x * 2);
      expect(mapped.unwrap()).toBe(84);
    });

    it('should flatMap the value', () => {
      const result = ok(42);
      const flatMapped = result.flatMap((x) => ok(x * 2));
      expect(flatMapped.unwrap()).toBe(84);
    });
  });

  describe('Err', () => {
    it('should create an Err result', () => {
      const result = err('error');
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
    });

    it('should unwrap with error', () => {
      const result = err('error');
      expect(() => result.unwrap()).toThrow('Called unwrap on Err');
    });

    it('should map without changing error', () => {
      const result = err('error');
      const mapped = result.map(() => 42);
      expect(mapped.isErr()).toBe(true);
    });
  });
});
