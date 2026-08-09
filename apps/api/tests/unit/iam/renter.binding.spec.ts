import { Renter } from '../../../src/iam/domain/renter';

const ORG_A = '20000000-0000-4000-8000-00000000000a';
const ORG_B = '20000000-0000-4000-8000-00000000000b';

function register(orgId: string): Renter {
  return Renter.register({
    id: `30000000-0000-4000-8000-${orgId.slice(-12)}`,
    orgId,
    phone: '+380501234567',
    name: 'Олег',
    consentGivenAt: new Date(),
    consentVersion: 'v1',
    locale: 'uk',
  });
}

describe('Renter org binding (US2: permanently bound to one organization)', () => {
  it('binds orgId once from the registration context', () => {
    const renter = register(ORG_A);
    expect(renter.orgId).toBe(ORG_A);
    expect(renter.currentState.orgId).toBe(ORG_A);
  });

  it('exposes no mechanism to switch or transfer organizations', () => {
    const renter = register(ORG_A);
    expect(typeof (renter as unknown as Record<string, unknown>).changeOrg).toBe('undefined');
    expect(typeof (renter as unknown as Record<string, unknown>).transferTo).toBe('undefined');
  });

  it('produces fully separate identities when the same person registers in a second org', () => {
    const renterA = register(ORG_A);
    const renterB = register(ORG_B);
    expect(renterA.id).not.toBe(renterB.id);
    expect(renterA.orgId).not.toBe(renterB.orgId);
    expect(renterA.currentState.phone).toBe(renterB.currentState.phone);
  });
});
