import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedRequest } from '../middleware/jwt-auth.middleware';
import { ApiException } from '../dto/api-exception';
import { ErrorCode } from '../dto/api-error';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;

    if (!auth) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'auth.unauthorized');
    }

    if (auth.type !== 'admin') {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'auth.forbidden');
    }

    if (!auth.role || !requiredRoles.includes(auth.role)) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'auth.forbidden');
    }

    return true;
  }
}
