import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { createHash } from 'crypto';
import { ADMIN_ACCOUNT_REPOSITORY, AdminAccountRepository } from '../ports/admin-account.repository';
import { RENTER_REPOSITORY, RenterRepository } from '../ports/renter.repository';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '../../../organizations/application/ports/organization.repository';
import { JwtTokenService } from '../../../shared-kernel/infrastructure/jwt/jwt-token.service';
import { PasswordHasher } from '../../../shared-kernel/infrastructure/crypto/password-hasher';
import { ApiException } from '../../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../../shared-kernel/interface/dto/api-error';
import { Organization } from '../../../organizations/domain/organization';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: {
    id: string;
    orgId: string | null;
    role: string;
    email: string;
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: LoginResult['admin'];
}

export interface ExchangeResult {
  accessToken: string;
  expiresIn: number;
  renter: {
    id: string;
    orgId: string;
    name: string;
    locale: string;
    status: string;
  };
}

@Injectable()
export class AuthService {
  private readonly usedRefreshTokens = new Set<string>();

  constructor(
    @Inject(ADMIN_ACCOUNT_REPOSITORY) private readonly adminAccountRepository: AdminAccountRepository,
    @Inject(RENTER_REPOSITORY) private readonly renterRepository: RenterRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const account = await this.adminAccountRepository.findByEmail(normalizedEmail);

    const passwordMatches = account
      ? await this.passwordHasher.verify(password, account.passwordHash)
      : false;

    if (!account || !passwordMatches || !account.isActive) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'auth.invalid_credentials');
    }

    const accountState = account.currentState;
    const accessToken = this.jwtTokenService.signAccessToken({
      sub: account.id,
      orgId: accountState.orgId,
      role: accountState.role,
      locale: accountState.locale,
      type: 'admin',
    });
    const refreshToken = this.jwtTokenService.signRefreshToken({
      sub: account.id,
      orgId: accountState.orgId,
      role: accountState.role,
      locale: accountState.locale,
      subjectType: 'admin',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtTokenService.accessTtlSeconds,
      admin: {
        id: account.id,
        orgId: accountState.orgId,
        role: accountState.role,
        email: accountState.email,
      },
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    if (!refreshToken) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN, 'auth.invalid_refresh_token');
    }

    const fingerprint = this.fingerprint(refreshToken);
    if (this.usedRefreshTokens.has(fingerprint)) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN, 'auth.invalid_refresh_token');
    }

    let payload: { sub: string; orgId: string | null; role?: string | null; locale: string; tokenType: string };
    try {
      const verified = this.jwtTokenService.verify(refreshToken);
      if (verified.tokenType !== 'refresh') {
        throw new Error('Not a refresh token');
      }
      payload = verified as { sub: string; orgId: string | null; role?: string | null; locale: string; tokenType: string };
    } catch {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN, 'auth.invalid_refresh_token');
    }

    const account = await this.adminAccountRepository.findById(payload.sub);
    if (!account || !account.isActive) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'auth.invalid_credentials');
    }

    this.usedRefreshTokens.add(fingerprint);

    const accountState = account.currentState;
    const accessToken = this.jwtTokenService.signAccessToken({
      sub: account.id,
      orgId: accountState.orgId,
      role: accountState.role,
      locale: accountState.locale,
      type: 'admin',
    });
    const newRefreshToken = this.jwtTokenService.signRefreshToken({
      sub: account.id,
      orgId: accountState.orgId,
      role: accountState.role,
      locale: accountState.locale,
      subjectType: 'admin',
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.jwtTokenService.accessTtlSeconds,
      admin: {
        id: account.id,
        orgId: accountState.orgId,
        role: accountState.role,
        email: accountState.email,
      },
    };
  }

  async telegramExchange(botSecret: string, telegramId: number): Promise<ExchangeResult> {
    const organization = await this.findOrgByBotSecret(botSecret);
    if (!organization) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.BOT_SECRET_INVALID, 'auth.bot_secret_invalid');
    }

    const renter = await this.renterRepository.findByOrgAndTelegramId(organization.id, telegramId);
    if (!renter) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.RENTER_NOT_REGISTERED, 'renters.renter_not_registered');
    }
    if (renter.status === 'DISABLED') {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.RENTER_DISABLED, 'renters.renter_disabled');
    }

    const renterState = renter.currentState;
    const accessToken = this.jwtTokenService.signAccessToken({
      sub: renter.id,
      orgId: renterState.orgId,
      locale: renterState.locale,
      type: 'renter',
    });

    return {
      accessToken,
      expiresIn: this.jwtTokenService.accessTtlSeconds,
      renter: {
        id: renterState.id,
        orgId: renterState.orgId,
        name: renterState.name,
        locale: renterState.locale,
        status: renterState.status,
      },
    };
  }

  private async findOrgByBotSecret(botSecret: string): Promise<Organization | null> {
    const organizations = await this.organizationRepository.listAll();
    for (const organization of organizations) {
      const telegramConfig = organization.currentState.telegramConfig;
      if (!telegramConfig?.botSecretHash) {
        continue;
      }
      const matches = await this.passwordHasher.verify(botSecret, telegramConfig.botSecretHash);
      if (matches) {
        return organization;
      }
    }
    return null;
  }

  private fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
