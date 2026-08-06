import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { AuthenticatedRequest } from '../middleware/jwt-auth.middleware';
import { ApiException } from '../dto/api-exception';
import { ErrorCode } from '../dto/api-error';

@Injectable()
export class RenterAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, 'auth.unauthorized');
    }
    if (request.auth.type !== 'renter') {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'auth.forbidden');
    }
    return true;
  }
}
