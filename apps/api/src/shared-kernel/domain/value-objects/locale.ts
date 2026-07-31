export const Locale = {
  UK: 'uk',
  EN: 'en',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

const ALLOWED_LOCALES: Locale[] = [Locale.UK, Locale.EN];

export class LocaleValueObject {
  private constructor(private readonly value: Locale) {}

  static from(value: string): LocaleValueObject {
    if (!ALLOWED_LOCALES.includes(value as Locale)) {
      throw new Error(`Invalid locale: ${value}. Allowed: ${ALLOWED_LOCALES.join(', ')}`);
    }
    return new LocaleValueObject(value as Locale);
  }

  static default(): LocaleValueObject {
    return new LocaleValueObject(Locale.UK);
  }

  equals(other: LocaleValueObject): boolean {
    return this.value === other.value;
  }

  toString(): Locale {
    return this.value;
  }
}
