import { Renter } from '../../../src/iam/domain/renter';

function activeRenter(): Renter {
  return Renter.register({
    id: '30000000-0000-4000-8000-000000000001',
    orgId: '20000000-0000-4000-8000-000000000002',
    phone: '+380501234567',
    name: 'Олег',
    consentGivenAt: new Date(),
    consentVersion: 'v1',
    locale: 'uk',
  });
}

describe('Renter disable transitions (US7: FR-020/FR-022/FR-029)', () => {
  it('admin-initiated disable is reversible via re-enable', () => {
    const renter = activeRenter();
    renter.disableByAdmin();
    expect(renter.status).toBe('DISABLED');
    expect(renter.disableReason).toBe('ADMIN');

    renter.reEnable();
    expect(renter.status).toBe('ACTIVE');
    expect(renter.disableReason).toBeNull();
  });

  it('deletion-request disable is permanent and cannot be re-enabled', () => {
    const renter = activeRenter();
    renter.disableByDeletionRequest();
    expect(renter.status).toBe('DISABLED');
    expect(renter.disableReason).toBe('DELETION_REQUEST');

    expect(() => renter.reEnable()).toThrow();
    expect(renter.status).toBe('DISABLED');
  });

  it('a disabled renter cannot book', () => {
    const renter = activeRenter();
    expect(renter.canBook(false)).toBe(true);
    renter.disableByAdmin();
    expect(renter.canBook(false)).toBe(false);
  });

  it('never hard-deletes: state retains id and orgId after disable', () => {
    const renter = activeRenter();
    renter.disableByDeletionRequest();
    expect(renter.id).toBeDefined();
    expect(renter.orgId).toBeDefined();
    expect(renter.currentState.consentGivenAt).toBeInstanceOf(Date);
  });
});
