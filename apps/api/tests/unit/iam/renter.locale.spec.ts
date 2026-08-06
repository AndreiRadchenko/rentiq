import { Renter } from '../../../src/iam/domain/renter';
import { validateLocaleAgainstOrg } from '../../../src/iam/application/renter/locale.validation';

function renter(locale = 'uk'): Renter {
  return Renter.register({
    id: '30000000-0000-4000-8000-000000000001',
    orgId: '20000000-0000-4000-8000-000000000002',
    phone: '+380501234567',
    name: 'Олег',
    consentGivenAt: new Date(),
    consentVersion: 'v1',
    locale,
  });
}

describe('Renter locale (US4: selection + change at any time, BR-02.2)', () => {
  it('defaults to uk', () => {
    expect(renter().currentState.locale).toBe('uk');
  });

  it('accepts a locale inside the org supported set', () => {
    expect(() => validateLocaleAgainstOrg('uk', ['uk', 'en'])).not.toThrow();
    expect(() => validateLocaleAgainstOrg('en', ['uk', 'en'])).not.toThrow();
  });

  it('rejects a locale outside the org supported set (BR-02.2)', () => {
    expect(() => validateLocaleAgainstOrg('fr', ['uk', 'en'])).toThrow();
    expect(() => validateLocaleAgainstOrg('uk', ['en'])).toThrow();
  });

  it('rejects a locale outside the system known set', () => {
    expect(() => validateLocaleAgainstOrg('xx', ['uk', 'en', 'xx'])).toThrow();
  });

  it('allows changing the locale at any time (DR-003)', () => {
    const r = renter('uk');
    r.changeLocale('en');
    expect(r.currentState.locale).toBe('en');
    r.changeLocale('uk');
    expect(r.currentState.locale).toBe('uk');
  });
});
