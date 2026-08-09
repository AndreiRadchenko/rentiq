import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtTokenService, AccessTokenPayload } from '../../infrastructure/jwt/jwt-token.service';
import { TenantContext } from './tenant-context';

export interface AuthenticatedRequest extends Request {
  auth?: AccessTokenPayload;
}

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    let payload: AccessTokenPayload;
    try {
      const verified = this.jwtTokenService.verify(token);
      if (verified.tokenType !== 'access') {
        next();
        return;
      }
      payload = verified as AccessTokenPayload;
    } catch {
      next();
      return;
    }

    (req as AuthenticatedRequest).auth = payload;

    const store = {
      orgId: payload.orgId ?? undefined,
      role: payload.role ?? undefined,
      locale: payload.locale ?? undefined,
      sub: payload.sub,
      tokenType: payload.type,
    };

    TenantContext.run(store, () => {
      next();
    });
  }
}
