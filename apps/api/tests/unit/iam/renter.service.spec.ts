import { HttpStatus } from '@nestjs/common';
import { RenterService } from '../../../src/iam/application/renter/renter.service';
import { ConsentStatementRegistry } from '../../../src/iam/application/renter/consent-statement.registry';
import { RenterAnonymizer } from '../../../src/iam/application/renter/renter-anonymizer';
import { RenterRegistered } from '../../../src/iam/infrastructure/events/renter-registered.event';
import {
  FakeRenterRepository,
  FakeOrganizationRepository,
  FakeEventBus,
  FakeJwtTokenService,
  makeOrganization,
  asJwtService,
} from '../helpers/fakes';

function buildService() {
  const renterRepository = new FakeRenterRepository();
  const organizationRepository = new FakeOrganizationRepository();
  const org = makeOrganization();
  organizationRepository.store.set(org.id, org);
  const eventBus = new FakeEventBus();
  const jwt = new FakeJwtTokenService();
  const registry = new ConsentStatementRegistry();
  const anonymizer = new RenterAnonymizer(renterRepository);
  const service = new RenterService(
    renterRepository,
    organizationRepository,
    eventBus,
    asJwtService(jwt),
    registry,
    anonymizer,
  );
  return { service, renterRepository, organizationRepository, eventBus, jwt, registry, org };
}

async function expectApiError(promise: Promise<unknown>, code: string, status: number) {
  try {
    await promise;
    throw new Error(`Expected ApiException ${code} to be thrown`);
  } catch (error) {
    expect(error).toHaveProperty('code', code);
    expect(error).toHaveProperty('getStatus');
    expect((error as { getStatus(): number }).getStatus()).toBe(status);
  }
}

describe('RenterService.register (US1: consent + identity)', () => {
  it('rejects registration without explicit consent with CONSENT_REQUIRED and creates no identity', async () => {
    const { service, renterRepository } = buildService();
    await expectApiError(
      service.register({
        name: 'Олег',
        phone: '+380501234567',
        consentGiven: false,
        consentVersion: 'v1',
        locale: 'uk',
      }),
      'CONSENT_REQUIRED',
      HttpStatus.BAD_REQUEST,
    );
    expect(renterRepository.store.size).toBe(0);
  });

  it('rejects a missing name with VALIDATION_ERROR and creates no identity', async () => {
    const { service, renterRepository } = buildService();
    await expectApiError(
      service.register({
        name: '',
        phone: '+380501234567',
        consentGiven: true,
        consentVersion: 'v1',
        locale: 'uk',
      }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
    expect(renterRepository.store.size).toBe(0);
  });

  it('rejects an invalid phone with VALIDATION_ERROR and creates no identity', async () => {
    const { service, renterRepository } = buildService();
    await expectApiError(
      service.register({
        name: 'Олег',
        phone: '12345',
        consentGiven: true,
        consentVersion: 'v1',
        locale: 'uk',
      }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
    expect(renterRepository.store.size).toBe(0);
  });

  it('rejects an unknown consent version with VALIDATION_ERROR', async () => {
    const { service, renterRepository } = buildService();
    await expectApiError(
      service.register({
        name: 'Олег',
        phone: '+380501234567',
        consentGiven: true,
        consentVersion: 'v99',
        locale: 'uk',
      }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
    expect(renterRepository.store.size).toBe(0);
  });

  it('rejects a stale known consent version with RE_CONSENT_REQUIRED', async () => {
    const { service, renterRepository, registry } = buildService();
    registry.publish({ version: 'v2', materialChange: true });
    await expectApiError(
      service.register({
        name: 'Олег',
        phone: '+380501234567',
        consentGiven: true,
        consentVersion: 'v1',
        locale: 'uk',
      }),
      'RE_CONSENT_REQUIRED',
      HttpStatus.BAD_REQUEST,
    );
    expect(renterRepository.store.size).toBe(0);
  });

  it('creates an identity, mints a renter JWT and publishes RenterRegistered', async () => {
    const { service, renterRepository, eventBus, jwt, org } = buildService();
    const result = await service.register({
      name: 'Олег',
      phone: '+380501234567',
      consentGiven: true,
      consentVersion: 'v1',
      locale: 'uk',
    });

    expect(result.alreadyRegistered).toBe(false);
    expect(result.accessToken).toBe(`access:renter:${result.renter.id}`);
    expect(result.expiresIn).toBe(900);
    expect(result.renter.currentState).toMatchObject({
      orgId: org.id,
      name: 'Олег',
      phone: '+380501234567',
      consentVersion: 'v1',
      locale: 'uk',
      status: 'ACTIVE',
    });
    expect(result.renter.currentState.consentGivenAt).toBeInstanceOf(Date);

    const stored = renterRepository.store.get(`${org.id}:${result.renter.id}`);
    expect(stored).toBeDefined();

    expect(jwt.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: result.renter.id, orgId: org.id, type: 'renter' }),
    );
    expect(eventBus.events).toHaveLength(1);
    expect(eventBus.events[0]).toBeInstanceOf(RenterRegistered);
  });

  it('recognizes a returning phone as alreadyRegistered with the same identity and no duplicate row', async () => {
    const { service, renterRepository, org } = buildService();
    const first = await service.register({
      name: 'Олег',
      phone: '+380501234567',
      consentGiven: true,
      consentVersion: 'v1',
      locale: 'uk',
    });
    const second = await service.register({
      name: 'Олег',
      phone: '+380501234567',
      consentGiven: true,
      consentVersion: 'v1',
      locale: 'uk',
    });

    expect(second.alreadyRegistered).toBe(true);
    expect(second.renter.id).toBe(first.renter.id);
    expect(renterRepository.store.size).toBe(1);
    expect(renterRepository.store.get(`${org.id}:${first.renter.id}`)).toBeDefined();
  });

  it('returns RENTER_DISABLED when the phone is bound to a disabled renter', async () => {
    const { service, renterRepository } = buildService();
    const first = await service.register({
      name: 'Олег',
      phone: '+380501234567',
      consentGiven: true,
      consentVersion: 'v1',
      locale: 'uk',
    });
    first.renter.disableByAdmin();
    await renterRepository.save(first.renter);

    await expectApiError(
      service.register({
        name: 'Олег',
        phone: '+380501234567',
        consentGiven: true,
        consentVersion: 'v1',
        locale: 'uk',
      }),
      'RENTER_DISABLED',
      HttpStatus.FORBIDDEN,
    );
  });

  it('rejects a locale outside the org supported set with VALIDATION_ERROR', async () => {
    const { service, renterRepository } = buildService();
    await expectApiError(
      service.register({
        name: 'Олег',
        phone: '+380501234567',
        consentGiven: true,
        consentVersion: 'v1',
        locale: 'fr',
      }),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
    expect(renterRepository.store.size).toBe(0);
  });
});

describe('RenterService profile operations', () => {
  it('returns the profile for an existing renter', async () => {
    const { service } = buildService();
    const result = await service.register({
      name: 'Олег',
      phone: '+380501234567',
      consentGiven: true,
      consentVersion: 'v1',
      locale: 'uk',
    });
    const profile = await service.getProfile(result.renter.currentState.orgId, result.renter.id);
    expect(profile.id).toBe(result.renter.id);
    expect(profile.status).toBe('ACTIVE');
  });

  it('returns NOT_FOUND for a missing renter', async () => {
    const { service, org } = buildService();
    await expectApiError(
      service.getProfile(org.id, '00000000-0000-4000-8000-000000000000'),
      'NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );
  });

  it('changes the locale and rejects an unsupported one', async () => {
    const { service, org } = buildService();
    const result = await service.register({
      name: 'Олег',
      phone: '+380501234567',
      consentGiven: true,
      consentVersion: 'v1',
      locale: 'uk',
    });
    const updated = await service.changeLocale(org.id, result.renter.id, 'en');
    expect(updated.locale).toBe('en');

    await expectApiError(
      service.changeLocale(org.id, result.renter.id, 'fr'),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
  });

  it('re-consents to the current statement and rejects unknown versions', async () => {
    const { service, org } = buildService();
    const result = await service.register({
      name: 'Олег',
      phone: '+380501234567',
      consentGiven: true,
      consentVersion: 'v1',
      locale: 'uk',
    });

    await expectApiError(
      service.reConsent(org.id, result.renter.id, 'v99'),
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );

    const reConsented = await service.reConsent(org.id, result.renter.id, 'v1');
    expect(reConsented.consentVersion).toBe('v1');
  });
});
