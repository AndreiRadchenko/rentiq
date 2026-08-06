import { ConsentStatementRegistry } from '../../../src/iam/application/renter/consent-statement.registry';
import { Renter } from '../../../src/iam/domain/renter';

function renterWithConsent(version: string): Renter {
  return Renter.register({
    id: '30000000-0000-4000-8000-000000000001',
    orgId: '20000000-0000-4000-8000-000000000002',
    phone: '+380501234567',
    name: 'Олег',
    consentGivenAt: new Date(),
    consentVersion: version,
    locale: 'uk',
  });
}

describe('Re-consent gating (US1/FR-024, DR-005)', () => {
  it('a material change invalidates standing consent and requires re-consent', () => {
    const registry = new ConsentStatementRegistry();
    registry.publish({ version: 'v2', materialChange: true });

    expect(registry.isCurrent('v2')).toBe(true);
    expect(registry.requiresReConsent('v1')).toBe(true);
    expect(registry.requiresReConsent('v2')).toBe(false);
  });

  it('an editorial-only change never triggers re-consent', () => {
    const registry = new ConsentStatementRegistry();
    registry.publish({ version: 'v2', materialChange: false });

    expect(registry.requiresReConsent('v1')).toBe(false);
  });

  it('a pending re-consent blocks new bookings via the canBook invariant', () => {
    const registry = new ConsentStatementRegistry();
    registry.publish({ version: 'v2', materialChange: true });

    const renter = renterWithConsent('v1');
    const blocked = registry.requiresReConsent(renter.consentVersion);
    expect(blocked).toBe(true);
    expect(renter.canBook(blocked)).toBe(false);
  });

  it('re-consenting to the current statement restores booking ability', () => {
    const registry = new ConsentStatementRegistry();
    registry.publish({ version: 'v2', materialChange: true });

    const renter = renterWithConsent('v1');
    renter.reConsent('v2');
    const blocked = registry.requiresReConsent(renter.consentVersion);
    expect(blocked).toBe(false);
    expect(renter.canBook(blocked)).toBe(true);
  });

  it('re-consent never deletes or anonymizes the renter', () => {
    const renter = renterWithConsent('v1');
    const nameBefore = renter.currentState.name;
    const phoneBefore = renter.currentState.phone;

    renter.reConsent('v1');
    renter.reConsent('v2');

    expect(renter.currentState.status).toBe('ACTIVE');
    expect(renter.currentState.name).toBe(nameBefore);
    expect(renter.currentState.phone).toBe(phoneBefore);
  });
});
