import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { I18nMiddleware } from 'nestjs-i18n';

@Injectable()
export class I18nBridgeMiddleware implements NestMiddleware {
  constructor(private readonly i18nMiddleware: I18nMiddleware) {}

  use(req: Request, res: Response, next: NextFunction): void {
    void this.i18nMiddleware.use(req, res, next);
  }
}
