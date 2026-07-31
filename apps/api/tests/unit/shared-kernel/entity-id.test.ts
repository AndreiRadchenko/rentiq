import { EntityId } from '../../../src/shared-kernel/domain/value-objects/entity-id';

describe('EntityId', () => {
  describe('generate', () => {
    it('should generate a new UUID', () => {
      const id = EntityId.generate();
      expect(id.toString()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique IDs', () => {
      const id1 = EntityId.generate();
      const id2 = EntityId.generate();
      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('from', () => {
    it('should wrap a valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id = EntityId.from(uuid);
      expect(id.toString()).toBe(uuid);
    });

    it('should throw for invalid UUID', () => {
      expect(() => EntityId.from('invalid-uuid')).toThrow('Invalid UUID');
    });
  });

  describe('equals', () => {
    it('should return true for equal IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id1 = EntityId.from(uuid);
      const id2 = EntityId.from(uuid);
      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for different IDs', () => {
      const id1 = EntityId.generate();
      const id2 = EntityId.generate();
      expect(id1.equals(id2)).toBe(false);
    });
  });
});
