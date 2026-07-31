import { TenantContext } from '../../../src/shared-kernel/interface/middleware/tenant-context';

describe('TenantContext', () => {
  it('should store and retrieve orgId', () => {
    TenantContext.run('org-123', () => {
      const orgId = TenantContext.getOrgId();
      expect(orgId).toBe('org-123');
    });
  });

  it('should return undefined when no orgId is set', () => {
    const orgId = TenantContext.getOrgId();
    expect(orgId).toBeUndefined();
  });

  it('should isolate contexts', () => {
    TenantContext.run('org-1', () => {
      expect(TenantContext.getOrgId()).toBe('org-1');

      TenantContext.run('org-2', () => {
        expect(TenantContext.getOrgId()).toBe('org-2');
      });

      expect(TenantContext.getOrgId()).toBe('org-1');
    });
  });

  it('should work with async operations', async () => {
    await TenantContext.run('org-async', async () => {
      const orgId = TenantContext.getOrgId();
      expect(orgId).toBe('org-async');
    });
  });
});
