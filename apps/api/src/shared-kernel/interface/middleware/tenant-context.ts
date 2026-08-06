import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

export interface TenantStore {
  orgId?: string;
  role?: string;
  locale?: string;
  sub?: string;
  tokenType?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

@Injectable()
export class TenantContext {
  static getOrgId(): string | undefined {
    return asyncLocalStorage.getStore()?.orgId;
  }

  static getRole(): string | undefined {
    return asyncLocalStorage.getStore()?.role;
  }

  static getLocale(): string | undefined {
    return asyncLocalStorage.getStore()?.locale;
  }

  static getSubject(): string | undefined {
    return asyncLocalStorage.getStore()?.sub;
  }

  static getTokenType(): string | undefined {
    return asyncLocalStorage.getStore()?.tokenType;
  }

  static run(orgId: string | TenantStore, callback: () => unknown): unknown {
    const store: TenantStore =
      typeof orgId === 'string' ? { orgId } : { ...orgId };
    return asyncLocalStorage.run(store, callback);
  }
}
