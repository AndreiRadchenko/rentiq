import { AdminAccount } from '../../domain/admin-account';

export const ADMIN_ACCOUNT_REPOSITORY = 'ADMIN_ACCOUNT_REPOSITORY';

export interface AdminAccountRepository {
  findByEmail(email: string): Promise<AdminAccount | null>;
  findById(id: string): Promise<AdminAccount | null>;
  findByOrgAndId(orgId: string, id: string): Promise<AdminAccount | null>;
  countActiveOrgAdmins(orgId: string): Promise<number>;
  save(account: AdminAccount): Promise<void>;
}
