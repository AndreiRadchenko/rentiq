import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { adminAccounts } from '../database/admin-accounts.schema';
import { AdminAccount, AdminAccountState } from '../../domain/admin-account';
import { AdminAccountRepository as AdminAccountRepositoryPort } from '../../application/ports/admin-account.repository';

@Injectable()
export class AdminAccountRepository implements AdminAccountRepositoryPort {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async findByEmail(email: string): Promise<AdminAccount | null> {
    const rows = await this.db
      .select()
      .from(adminAccounts)
      .where(eq(adminAccounts.email, email))
      .limit(1);
    return rows[0] ? AdminAccount.reconstitute(this.mapRow(rows[0])) : null;
  }

  async findById(id: string): Promise<AdminAccount | null> {
    const rows = await this.db
      .select()
      .from(adminAccounts)
      .where(eq(adminAccounts.id, id))
      .limit(1);
    return rows[0] ? AdminAccount.reconstitute(this.mapRow(rows[0])) : null;
  }

  async findByOrgAndId(orgId: string, id: string): Promise<AdminAccount | null> {
    const rows = await this.db
      .select()
      .from(adminAccounts)
      .where(and(eq(adminAccounts.id, id), eq(adminAccounts.orgId, orgId)))
      .limit(1);
    return rows[0] ? AdminAccount.reconstitute(this.mapRow(rows[0])) : null;
  }

  async countActiveOrgAdmins(orgId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(adminAccounts)
      .where(
        and(
          eq(adminAccounts.orgId, orgId),
          eq(adminAccounts.role, 'ORG_ADMIN'),
          eq(adminAccounts.status, 'ACTIVE'),
        ),
      );
    return rows.length;
  }

  async save(account: AdminAccount): Promise<void> {
    const state = account.currentState;
    const row = this.mapState(state);
    const existing = await this.db.select().from(adminAccounts).where(eq(adminAccounts.id, row.id)).limit(1);
    if (existing[0]) {
      await this.db.update(adminAccounts).set(row).where(eq(adminAccounts.id, row.id));
    } else {
      await this.db.insert(adminAccounts).values(row);
    }
  }

  private mapRow(row: typeof adminAccounts.$inferSelect): AdminAccountState {
    return {
      id: row.id,
      orgId: row.orgId,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as AdminAccountState['role'],
      assignedStationIds: row.assignedStationIds ?? [],
      locale: row.locale,
      status: row.status as AdminAccountState['status'],
      recoveryChannel: (row.recoveryChannel as AdminAccountState['recoveryChannel']) ?? null,
      createdAt: row.createdAt,
    };
  }

  private mapState(state: AdminAccountState): typeof adminAccounts.$inferInsert {
    return {
      id: state.id,
      orgId: state.orgId,
      email: state.email,
      passwordHash: state.passwordHash,
      role: state.role,
      assignedStationIds: state.assignedStationIds,
      locale: state.locale,
      status: state.status,
      recoveryChannel: state.recoveryChannel,
    };
  }
}
