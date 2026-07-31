import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

interface TenantStore {
  orgId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

@Injectable()
export class TenantContext {
  static getOrgId(): string | undefined {
    const store = asyncLocalStorage.getStore();
    return store?.orgId;
  }

  static run<T>(orgId: string, callback: () => T): T {
    return asyncLocalStorage.run({ orgId }, callback);
  }
}
