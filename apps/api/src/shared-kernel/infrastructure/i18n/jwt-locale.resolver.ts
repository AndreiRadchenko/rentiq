import { Injectable, ExecutionContext } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { TenantContext } from '../../interface/middleware/tenant-context';

@Injectable()
export class JwtLocaleResolver {
  readonly name = 'jwtLocale';

  resolve(_context: ExecutionContext | I18nContext): string | undefined {
    const locale = TenantContext.getLocale();
    if (locale) {
      return locale;
    }
    return undefined;
  }
}
