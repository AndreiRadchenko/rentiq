import { Injectable, NestMiddleware, Inject, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiException } from '../../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../../shared-kernel/interface/dto/api-error';
import { TenantContext, TenantStore } from '../../../shared-kernel/interface/middleware/tenant-context';
import { AuthenticatedRequest } from '../../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { AuditableLogger } from '../../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import {
  ORGANIZATION_REPOSITORY,
  OrganizationRepository,
} from '../../application/ports/organization.repository';

const IMPERSONATION_HEADER = 'x-org-id';

@Injectable()
export class ImpersonationMiddleware implements NestMiddleware {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
    private readonly audit: AuditableLogger,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const headerOrgId = req.headers[IMPERSONATION_HEADER];

    if (!headerOrgId) {
      next();
      return;
    }

    const auth = (req as AuthenticatedRequest).auth;

    if (!auth || auth.type !== 'admin' || auth.role !== 'SUPER_ADMIN') {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        ErrorCode.IMPERSONATION_FORBIDDEN,
        'auth.impersonation_forbidden',
      );
    }

    const orgId = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;
    const org = await this.organizationRepository.findById(orgId);

    if (!org) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ORG_NOT_FOUND,
        'organizations.org_not_found',
      );
    }

    if (org.isSuspended) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ORG_SUSPENDED,
        'organizations.org_suspended',
      );
    }

    this.audit.log('ImpersonationActivated', auth.sub, orgId, {
      impersonatorSub: auth.sub,
      impersonatorRole: auth.role,
      targetOrgId: orgId,
      method: req.method,
      path: req.originalUrl,
    });

    const store: TenantStore = {
      orgId,
      role: auth.role,
      locale: auth.locale,
      sub: auth.sub,
      tokenType: auth.type,
      impersonatorSub: auth.sub,
    };

    TenantContext.run(store, () => {
      next();
    });
  }
}
