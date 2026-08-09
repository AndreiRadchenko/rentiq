import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { sign, verify, SignOptions, JwtPayload } from 'jsonwebtoken';
import { Env } from '../config/env';

export type AdminRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'STATION_OPERATOR';
export type TokenSubjectType = 'admin' | 'renter';

export interface AccessTokenInput {
  sub: string;
  orgId: string | null;
  role?: AdminRole | null;
  locale: string;
  type: TokenSubjectType;
}

export interface RefreshTokenInput {
  sub: string;
  orgId: string | null;
  role?: AdminRole | null;
  locale: string;
  subjectType: TokenSubjectType;
}

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  orgId: string | null;
  role?: AdminRole | null;
  locale: string;
  type: TokenSubjectType;
  tokenType: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  orgId: string | null;
  role?: AdminRole | null;
  locale: string;
  subjectType: TokenSubjectType;
  tokenType: 'refresh';
}

export type VerifiedTokenPayload = AccessTokenPayload | RefreshTokenPayload;

@Injectable()
export class JwtTokenService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessTtlSecondsValue: number;
  private readonly refreshTtlSecondsValue: number;

  constructor(@Inject('ENV_CONFIG') config: Env) {
    this.privateKey = config.JWT_PRIVATE_KEY;
    this.publicKey = config.JWT_PUBLIC_KEY;
    this.accessTtlSecondsValue = config.JWT_ACCESS_TTL_SECONDS;
    this.refreshTtlSecondsValue = config.JWT_REFRESH_TTL_SECONDS;
  }

  signAccessToken(input: AccessTokenInput): string {
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.accessTtlSecondsValue,
    };
    return sign(
      {
        orgId: input.orgId,
        role: input.role ?? null,
        locale: input.locale,
        type: input.type,
        tokenType: 'access',
      } as never,
      this.privateKey,
      { ...options, subject: input.sub },
    );
  }

  signRefreshToken(input: RefreshTokenInput): string {
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.refreshTtlSecondsValue,
    };
    return sign(
      {
        orgId: input.orgId,
        role: input.role ?? null,
        locale: input.locale,
        subjectType: input.subjectType,
        tokenType: 'refresh',
        jti: randomUUID(),
      } as never,
      this.privateKey,
      { ...options, subject: input.sub },
    );
  }

  verify(token: string): VerifiedTokenPayload {
    try {
      return verify(token, this.publicKey, { algorithms: ['RS256'] }) as VerifiedTokenPayload;
    } catch {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
  }

  get accessTtlSeconds(): number {
    return this.accessTtlSecondsValue;
  }
}
