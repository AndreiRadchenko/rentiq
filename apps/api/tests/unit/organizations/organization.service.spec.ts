import { HttpStatus } from '@nestjs/common';
import { OrganizationService } from '../../../src/organizations/application/organization.service';
import { AdminAccountService } from '../../../src/iam/application/admin-account/admin-account.service';
import {
  FakeAdminAccountRepository,
  FakeEventBus,
  FakeOrganizationRepository,
  FakePasswordHasher,
  makeOrganization,
} from '../helpers/fakes';
import { makeCryptoService } from '../helpers/locations-fakes';

function buildService() {
  const organizationRepository = new FakeOrganizationRepository();
  const adminAccountRepository = new FakeAdminAccountRepository();
  const eventBus = new FakeEventBus();
  const passwordHasher = new FakePasswordHasher();
  const adminAccountService = new AdminAccountService(
    adminAccountRepository,
    eventBus,
    passwordHasher,
  );
  const service = new OrganizationService(
    organizationRepository,
    adminAccountService,
    eventBus,
    passwordHasher,
    makeCryptoService(),
  );
  return { service, organizationRepository, adminAccountRepository, eventBus };
}

const BASE_INPUT = {
  name: 'RentIQ Dev',
  slug: 'rentiq-dev',
  adminEmail: 'admin@rentiq.dev',
  adminPassword: 'change-me',
  telegramBotSecret: 'secret',
};

async function expectApiError(promise: Promise<unknown>, code: string, status: number) {
  try {
    await promise;
    throw new Error(`Expected ApiException ${code} to be thrown`);
  } catch (error) {
    expect(error).toHaveProperty('code', code);
    expect((error as { getStatus(): number }).getStatus()).toBe(status);
  }
}

describe('OrganizationService.create (T029/T047: org bootstrap)', () => {
  it('creates the org, bootstraps an ORG_ADMIN and publishes OrganizationCreated', async () => {
    const { service, organizationRepository, adminAccountRepository, eventBus } = buildService();

    const result = await service.create(BASE_INPUT);

    expect(result.organization.slug).toBe('rentiq-dev');
    expect(result.organization.status).toBe('ACTIVE');
    expect(result.bootstrapAdmin.role).toBe('ORG_ADMIN');
    expect(result.bootstrapAdmin.email).toBe('admin@rentiq.dev');

    const saved = organizationRepository.store.get(result.organization.id);
    expect(saved?.currentState.telegramConfig.botSecretHash).toBe('hashed:secret');
    expect(adminAccountRepository.store.has(result.bootstrapAdmin.id)).toBe(true);
    expect(eventBus.events.map((e) => e.constructor.name)).toContain('OrganizationCreated');
  });

  it('normalizes the slug and enforces uniqueness case-insensitively', async () => {
    const { service, organizationRepository } = buildService();
    organizationRepository.store.set('20000000-0000-4000-8000-0000000000aa', makeOrganization('rentiq-dev'));

    await expectApiError(
      service.create({ ...BASE_INPUT, slug: 'RENTIQ-DEV' }),
      'SLUG_TAKEN',
      HttpStatus.CONFLICT,
    );
  });

  it('rejects a malformed slug or empty name', async () => {
    const { service } = buildService();
    await expectApiError(
      service.create({ ...BASE_INPUT, slug: 'bad slug!' }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
    await expectApiError(
      service.create({ ...BASE_INPUT, name: '  ' }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
  });

  it('rejects unsupported locales and non-default defaultLocale (BR-02.2)', async () => {
    const { service } = buildService();
    await expectApiError(
      service.create({ ...BASE_INPUT, supportedLocales: ['fr'] }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
    await expectApiError(
      service.create({ ...BASE_INPUT, supportedLocales: ['uk'], defaultLocale: 'en' }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
  });
});

describe('OrganizationService.updateBranding (T033)', () => {
  it('updates branding and publishes OrganizationBrandingChanged', async () => {
    const { service, organizationRepository, eventBus } = buildService();
    const org = makeOrganization();
    organizationRepository.store.set(org.id, org);

    const updated = await service.updateBranding(org.id, {
      businessName: 'Brand New',
      primaryColor: '#123456',
      supportedLocales: ['uk'],
      defaultLocale: 'uk',
    });

    expect(updated.currentState.branding.businessName).toBe('Brand New');
    expect(updated.currentState.branding.primaryColor).toBe('#123456');
    expect(eventBus.events.map((e) => e.constructor.name)).toContain('OrganizationBrandingChanged');
  });

  it('rejects a malformed primaryColor', async () => {
    const { service, organizationRepository } = buildService();
    const org = makeOrganization();
    organizationRepository.store.set(org.id, org);

    await expectApiError(
      service.updateBranding(org.id, { primaryColor: 'red' }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
  });

  it('rejects branding changes on a suspended org', async () => {
    const { service, organizationRepository } = buildService();
    const org = makeOrganization();
    org.suspend();
    organizationRepository.store.set(org.id, org);

    await expectApiError(
      service.updateBranding(org.id, { businessName: 'X' }),
      'ORG_SUSPENDED',
      HttpStatus.FORBIDDEN,
    );
  });
});

describe('OrganizationService maintenance window (T037)', () => {
  it('sets a window with a default timezone', async () => {
    const { service, organizationRepository } = buildService();
    const org = makeOrganization();
    organizationRepository.store.set(org.id, org);

    const updated = await service.setMaintenanceWindow(org.id, {
      startTime: '02:00',
      endTime: '04:00',
    });

    expect(updated.currentState.maintenanceWindow).toEqual({
      startTime: '02:00',
      endTime: '04:00',
      timezone: 'Europe/Kyiv',
    });
  });

  it('rejects start >= end or malformed times', async () => {
    const { service, organizationRepository } = buildService();
    const org = makeOrganization();
    organizationRepository.store.set(org.id, org);

    await expectApiError(
      service.setMaintenanceWindow(org.id, { startTime: '04:00', endTime: '02:00' }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
    await expectApiError(
      service.setMaintenanceWindow(org.id, { startTime: '25:00', endTime: '26:00' }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
  });
});

describe('OrganizationService.suspend', () => {
  it('suspends and publishes OrganizationSuspended', async () => {
    const { service, organizationRepository, eventBus } = buildService();
    const org = makeOrganization();
    organizationRepository.store.set(org.id, org);

    const suspended = await service.suspend(org.id);

    expect(suspended.isSuspended).toBe(true);
    expect(eventBus.events.map((e) => e.constructor.name)).toContain('OrganizationSuspended');
  });

  it('is idempotent for an already-suspended org', async () => {
    const { service, organizationRepository, eventBus } = buildService();
    const org = makeOrganization();
    org.suspend();
    organizationRepository.store.set(org.id, org);

    await service.suspend(org.id);

    expect(eventBus.events.map((e) => e.constructor.name)).not.toContain('OrganizationSuspended');
  });
});

describe('OrganizationService.getDefaultOrgId', () => {
  it('resolves the seeded default org by slug', async () => {
    const { service, organizationRepository } = buildService();
    const org = makeOrganization('rentiq');
    organizationRepository.store.set(org.id, org);

    expect(await service.getDefaultOrgId()).toBe(org.id);
  });

  it('returns null when no default org exists', async () => {
    const { service } = buildService();
    expect(await service.getDefaultOrgId()).toBeNull();
  });
});
