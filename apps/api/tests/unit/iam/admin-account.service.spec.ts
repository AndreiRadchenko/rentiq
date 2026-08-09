import { HttpStatus } from '@nestjs/common';
import { AdminAccountService } from '../../../src/iam/application/admin-account/admin-account.service';
import {
  FakeAdminAccountRepository,
  FakeEventBus,
  FakePasswordHasher,
  makeAdminAccount,
} from '../helpers/fakes';

function buildService() {
  const adminAccountRepository = new FakeAdminAccountRepository();
  const eventBus = new FakeEventBus();
  const service = new AdminAccountService(
    adminAccountRepository,
    eventBus,
    new FakePasswordHasher(),
  );
  return { service, adminAccountRepository, eventBus };
}

async function expectApiError(promise: Promise<unknown>, code: string, status: number) {
  try {
    await promise;
    throw new Error(`Expected ApiException ${code} to be thrown`);
  } catch (error) {
    expect(error).toHaveProperty('code', code);
    expect((error as { getStatus(): number }).getStatus()).toBe(status);
  }
}

describe('AdminAccountService.createAdmin', () => {
  it('creates an active account and publishes AdminAccountCreated', async () => {
    const { service, adminAccountRepository, eventBus } = buildService();

    const summary = await service.createAdmin({
      orgId: '20000000-0000-4000-8000-000000000002',
      email: '  OPERATOR@rentiq.dev ',
      password: 'pw',
      role: 'STATION_OPERATOR',
    });

    expect(summary.email).toBe('operator@rentiq.dev');
    expect(summary.role).toBe('STATION_OPERATOR');
    expect(adminAccountRepository.store.get(summary.id)?.currentState.status).toBe('ACTIVE');
    expect(eventBus.events.map((e) => e.constructor.name)).toContain('AdminAccountCreated');
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    const { service, adminAccountRepository } = buildService();
    adminAccountRepository.store.set('10000000-0000-4000-8000-000000000001', makeAdminAccount());

    await expectApiError(
      service.createAdmin({
        orgId: '20000000-0000-4000-8000-000000000002',
        email: 'ADMIN@rentiq.dev',
        password: 'pw',
        role: 'STATION_OPERATOR',
      }),
      'VALIDATION_ERROR',
      HttpStatus.CONFLICT,
    );
  });
});

describe('AdminAccountService.disable (T052, DR-002 no-lockout)', () => {
  const ORG_ID = '20000000-0000-4000-8000-000000000002';

  it('blocks disabling the last active ORG_ADMIN of an org', async () => {
    const { service, adminAccountRepository } = buildService();
    const account = makeAdminAccount({ orgId: ORG_ID, role: 'ORG_ADMIN' });
    adminAccountRepository.store.set(account.id, account);

    await expectApiError(
      service.disable(ORG_ID, account.id),
      'FORBIDDEN',
      HttpStatus.CONFLICT,
    );
    expect(account.currentState.status).toBe('ACTIVE');
  });

  it('allows disabling an ORG_ADMIN when another active one remains', async () => {
    const { service, adminAccountRepository, eventBus } = buildService();
    const first = makeAdminAccount({ id: '10000000-0000-4000-8000-000000000101', orgId: ORG_ID, role: 'ORG_ADMIN' });
    const second = makeAdminAccount({ id: '10000000-0000-4000-8000-000000000102', orgId: ORG_ID, role: 'ORG_ADMIN' });
    adminAccountRepository.store.set(first.id, first);
    adminAccountRepository.store.set(second.id, second);

    const summary = await service.disable(ORG_ID, first.id);

    expect(summary.id).toBe(first.id);
    expect(first.currentState.status).toBe('DISABLED');
    expect(eventBus.events.map((e) => e.constructor.name)).toContain('AdminAccountDisabled');
  });

  it('ignores orgId for a null-org (SUPER_ADMIN) account lookup', async () => {
    const { service, adminAccountRepository } = buildService();
    const account = makeAdminAccount({ orgId: null, role: 'SUPER_ADMIN' });
    adminAccountRepository.store.set(account.id, account);

    await service.disable(null, account.id);
    expect(account.currentState.status).toBe('DISABLED');
  });

  it('is idempotent for an already-disabled account', async () => {
    const { service, adminAccountRepository, eventBus } = buildService();
    const account = makeAdminAccount({ orgId: ORG_ID, role: 'STATION_OPERATOR' });
    account.disable();
    adminAccountRepository.store.set(account.id, account);

    const summary = await service.disable(ORG_ID, account.id);

    expect(summary.id).toBe(account.id);
    expect(eventBus.events.map((e) => e.constructor.name)).not.toContain('AdminAccountDisabled');
  });
});
