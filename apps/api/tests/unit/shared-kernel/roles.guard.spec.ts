import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/shared-kernel/interface/guards/roles.guard';
import { JwtAuthGuard } from '../../../src/shared-kernel/interface/guards/jwt-auth.guard';
import { RenterAuthGuard } from '../../../src/shared-kernel/interface/guards/renter-auth.guard';
import { AuthenticatedRequest } from '../../../src/shared-kernel/interface/middleware/jwt-auth.middleware';

interface AuthLike {
  type: string;
  role?: string;
  orgId: string | null;
  locale: string;
}

function makeContext(auth: AuthLike | null, requiredRoles: string[] | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ auth } as AuthenticatedRequest),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(requiredRoles: string[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn(() => requiredRoles),
  } as unknown as Reflector;
}

async function expectApiError(fn: () => boolean, code: string, status: number) {
  try {
    fn();
    throw new Error(`Expected ApiException ${code} to be thrown`);
  } catch (error) {
    expect(error).toHaveProperty('code', code);
    expect((error as { getStatus(): number }).getStatus()).toBe(status);
  }
}

describe('RolesGuard role matrix (T027)', () => {
  it('allows any request when no roles are required', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    expect(guard.canActivate(makeContext(null, undefined))).toBe(true);
  });

  it('rejects an unauthenticated request', async () => {
    const guard = new RolesGuard(makeReflector(['ORG_ADMIN']));
    await expectApiError(
      () => guard.canActivate(makeContext(null, ['ORG_ADMIN'])),
      'INVALID_CREDENTIALS',
      HttpStatus.UNAUTHORIZED,
    );
  });

  it('rejects a role not present in the required list', async () => {
    const guard = new RolesGuard(makeReflector(['SUPER_ADMIN']));
    await expectApiError(
      () => guard.canActivate(makeContext({ type: 'admin', role: 'ORG_ADMIN', orgId: 'org', locale: 'uk' }, ['SUPER_ADMIN'])),
      'FORBIDDEN',
      HttpStatus.FORBIDDEN,
    );
  });

  it('allows an admin whose role matches', () => {
    const guard = new RolesGuard(makeReflector(['ORG_ADMIN', 'SUPER_ADMIN']));
    expect(
      guard.canActivate(makeContext({ type: 'admin', role: 'ORG_ADMIN', orgId: 'org', locale: 'uk' }, ['ORG_ADMIN', 'SUPER_ADMIN'])),
    ).toBe(true);
  });
});

describe('Token type enforcement (T039/T041: admin routes reject type=renter and vice versa)', () => {
  it('RolesGuard rejects a renter token on an admin route', async () => {
    const guard = new RolesGuard(makeReflector(['ORG_ADMIN']));
    await expectApiError(
      () => guard.canActivate(makeContext({ type: 'renter', role: 'ORG_ADMIN', orgId: 'org', locale: 'uk' }, ['ORG_ADMIN'])),
      'FORBIDDEN',
      HttpStatus.FORBIDDEN,
    );
  });

  it('RenterAuthGuard allows a renter token', () => {
    const guard = new RenterAuthGuard();
    expect(guard.canActivate(makeContext({ type: 'renter', role: 'STATION_OPERATOR', orgId: 'org', locale: 'uk' }, []))).toBe(true);
  });

  it('RenterAuthGuard rejects an admin token', async () => {
    const guard = new RenterAuthGuard();
    await expectApiError(
      () => guard.canActivate(makeContext({ type: 'admin', role: 'ORG_ADMIN', orgId: 'org', locale: 'uk' }, [])),
      'FORBIDDEN',
      HttpStatus.FORBIDDEN,
    );
  });

  it('JwtAuthGuard only checks presence of the auth payload', async () => {
    const guard = new JwtAuthGuard();
    expect(guard.canActivate(makeContext({ type: 'renter', role: 'STATION_OPERATOR', orgId: 'org', locale: 'uk' }, []))).toBe(true);
    await expectApiError(
      () => guard.canActivate(makeContext(null, [])),
      'INVALID_CREDENTIALS',
      HttpStatus.UNAUTHORIZED,
    );
  });
});
