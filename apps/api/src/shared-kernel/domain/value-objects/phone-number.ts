export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static from(value: string): PhoneNumber {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(value)) {
      throw new Error(`Invalid phone number: ${value}. Must be in E.164 format (e.g., +380501234567)`);
    }
    return new PhoneNumber(value);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
