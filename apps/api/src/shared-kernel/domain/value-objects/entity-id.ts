import { v4 as uuidv4 } from 'uuid';

export class EntityId<T extends string = string> {
  protected constructor(private readonly value: string) {}

  static generate<T extends string>(): EntityId<T> {
    return new EntityId<T>(uuidv4());
  }

  static from<T extends string>(value: string): EntityId<T> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`Invalid UUID: ${value}`);
    }
    return new EntityId<T>(value);
  }

  equals(other: EntityId<T>): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
