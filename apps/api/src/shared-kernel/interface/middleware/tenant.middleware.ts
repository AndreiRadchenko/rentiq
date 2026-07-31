import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContext } from './tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const orgId = req.headers['x-org-id'] as string;

    if (orgId) {
      TenantContext.run(orgId, () => {
        next();
      });
    } else {
      next();
    }
  }
}
