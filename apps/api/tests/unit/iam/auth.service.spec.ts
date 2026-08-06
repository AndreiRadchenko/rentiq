import { HttpStatus } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/iam/application/auth/auth.service';
import { PasswordHasher } from '../../../src/shared-kernel/infrastructure/crypto/password-hasher';
import { JwtTokenService } from '../../../src/shared-kernel/infrastructure/jwt/jwt-token.service';
import { Env } from '../../../src/shared-kernel/infrastructure/config/env';
import { Organization } from '../../../src/organizations/domain/organization';
import {
  FakeAdminAccountRepository,
  FakeRenterRepository,
  FakeOrganizationRepository,
  makeAdminAccount,
} from '../helpers/fakes';

function buildAuthEnv(): Env {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    JWT_PRIVATE_KEY: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
    JWT_PUBLIC_KEY: publicKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 604800,
  } as unknown as Env;
}

async function makeOrg() {
  return Organization.create({
    id: '20000000-0000-4000-8000-000000000002',
    name: 'rentiq-dev',
    slug: 'rentiq',
    branding: {
      logoUrl: null,
      primaryColor: null,
      businessName: 'rentiq-dev',
      supportedLocales: ['uk', 'en'],
      defaultLocale: 'uk',
    },
    paymentCredsRef: { gateway: '', secretRef: '', enabled: false },
    telegramConfig: { botSecretHash: await bcrypt.hash('secret', 4), botUsername: 'bot' },
    maintenanceWindow: null,
    checkboxConfig: null,
  });
}

async function buildService() {
  const adminAccountRepository = new FakeAdminAccountRepository();
  const renterRepository = new FakeRenterRepository();
  const organizationRepository = new FakeOrganizationRepository();
  const org = await makeOrg();
  organizationRepository.store.set(org.id, org);
  const jwtTokenService = new JwtTokenService(buildAuthEnv());
  const passwordHasher = new PasswordHasher();

  const admin = makeAdminAccount({
    email: 'admin@rentiq.dev',
    passwordHash: await bcrypt.hash('change-me', 4),
    role: 'ORG_ADMIN',
    orgId: org.id,
  });
  adminAccountRepository.store.set(admin.id, admin);

  const service = new AuthService(
    adminAccountRepository,
    renterRepository,
    organizationRepository,
    jwtTokenService,
    passwordHasher,
  );

  return { service, adminAccountRepository, renterRepository, organizationRepository, jwtTokenService, org, admin };
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

describe('AuthService.login (US3: admin auth, NFR-009 uniform error)', () => {
  it('returns an access + refresh token pair for valid credentials', async () => {
    const { service, org } = await buildService();
    const result = await service.login('admin@rentiq.dev', 'change-me');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(900);
    expect(result.admin).toEqual({
      id: expect.any(String),
      orgId: org.id,
      role: 'ORG_ADMIN',
      email: 'admin@rentiq.dev',
    });

    const payload = service['jwtTokenService'].verify(result.accessToken) as { type: string; orgId: string | null };
    expect(payload.type).toBe('admin');
    expect(payload.orgId).toBe(org.id);
  });

  it('returns the identical error for a wrong password and an unknown email', async () => {
    const { service } = await buildService();

    const wrongPassword = await service.login('admin@rentiq.dev', 'wrong').catch((e) => e);
    const unknownEmail = await service.login('nobody@rentiq.dev', 'change-me').catch((e) => e);

    expect(wrongPassword).toHaveProperty('code', 'INVALID_CREDENTIALS');
    expect(unknownEmail).toHaveProperty('code', 'INVALID_CREDENTIALS');
    expect(wrongPassword.messageKey).toBe(unknownEmail.messageKey);
  });

  it('rejects a disabled account with INVALID_CREDENTIALS', async () => {
    const { service, adminAccountRepository, admin } = await buildService();
    admin.disable();
    await adminAccountRepository.save(admin);

    await expectApiError(
      service.login('admin@rentiq.dev', 'change-me'),
      'INVALID_CREDENTIALS',
      HttpStatus.UNAUTHORIZED,
    );
  });
});

describe('AuthService.refresh (US3: rotation)', () => {
  it('rotates the refresh token and reissues a pair', async () => {
    const { service, jwtTokenService } = await buildService();
    const login = await service.login('admin@rentiq.dev', 'change-me');
    const rotated = await service.refresh(login.refreshToken);

    expect(rotated.accessToken).toBeDefined();
    expect(rotated.refreshToken).not.toBe(login.refreshToken);
    expect(rotated.admin.email).toBe('admin@rentiq.dev');

    const payload = jwtTokenService.verify(rotated.refreshToken) as { tokenType: string };
    expect(payload.tokenType).toBe('refresh');
  });

  it('rejects reuse of an already-rotated token', async () => {
    const { service } = await buildService();
    const login = await service.login('admin@rentiq.dev', 'change-me');

    await service.refresh(login.refreshToken);
    await expectApiError(
      service.refresh(login.refreshToken),
      'INVALID_REFRESH_TOKEN',
      HttpStatus.UNAUTHORIZED,
    );
  });

  it('rejects a garbage or access token', async () => {
    const { service } = await buildService();
    await expectApiError(
      service.refresh('garbage-token'),
      'INVALID_REFRESH_TOKEN',
      HttpStatus.UNAUTHORIZED,
    );
  });
});

describe('AuthService.telegramExchange (US1: bot session → renter JWT)', () => {
  it('exchanges a valid bot secret + telegramId for a renter JWT', async () => {
    const { service, renterRepository, org } = await buildService();
    const Renter = (await import('../../../src/iam/domain/renter')).Renter;
    const renter = Renter.register({
      id: '30000000-0000-4000-8000-000000000003',
      orgId: org.id,
      telegramId: 123456789,
      phone: '+380501234567',
      name: 'Олег',
      consentGivenAt: new Date(),
      consentVersion: 'v1',
      locale: 'uk',
    });
    await renterRepository.save(renter);

    const result = await service.telegramExchange('secret', 123456789);
    expect(result.renter.id).toBe(renter.id);
    expect(result.renter.orgId).toBe(org.id);
    expect(result.accessToken).toContain('.');
    const payload = service['jwtTokenService'].verify(result.accessToken) as { type: string };
    expect(payload.type).toBe('renter');
  });

  it('rejects an invalid bot secret with BOT_SECRET_INVALID', async () => {
    const { service } = await buildService();
    await expectApiError(
      service.telegramExchange('wrong-secret', 123456789),
      'BOT_SECRET_INVALID',
      HttpStatus.UNAUTHORIZED,
    );
  });

  it('rejects an unknown telegramId with RENTER_NOT_REGISTERED', async () => {
    const { service } = await buildService();
    await expectApiError(
      service.telegramExchange('secret', 999999),
      'RENTER_NOT_REGISTERED',
      HttpStatus.FORBIDDEN,
    );
  });

  it('rejects a disabled renter with RENTER_DISABLED', async () => {
    const { service, renterRepository, org } = await buildService();
    const { Renter } = await import('../../../src/iam/domain/renter');
    const renter = Renter.register({
      id: '30000000-0000-4000-8000-000000000003',
      orgId: org.id,
      telegramId: 123456789,
      phone: '+380501234567',
      name: 'Олег',
      consentGivenAt: new Date(),
      consentVersion: 'v1',
      locale: 'uk',
    });
    renter.disableByAdmin();
    await renterRepository.save(renter);

    await expectApiError(
      service.telegramExchange('secret', 123456789),
      'RENTER_DISABLED',
      HttpStatus.FORBIDDEN,
    );
  });
});
