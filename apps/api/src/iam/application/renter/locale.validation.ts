export const SUPPORTED_SYSTEM_LOCALES = ['uk', 'en'] as const;

export function isKnownLocale(locale: string): boolean {
  return (SUPPORTED_SYSTEM_LOCALES as readonly string[]).includes(locale);
}

export function validateLocaleAgainstOrg(
  locale: string,
  orgSupportedLocales: string[],
): void {
  if (!isKnownLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  if (!orgSupportedLocales.includes(locale)) {
    throw new Error(
      `Locale ${locale} is not supported by this organization; supported: ${orgSupportedLocales.join(', ')}`,
    );
  }
}
