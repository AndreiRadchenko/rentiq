import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { renters } from '../database/renters.schema';
import { Renter, RenterState } from '../../domain/renter';
import { RenterRepository as RenterRepositoryPort } from '../../application/ports/renter.repository';

@Injectable()
export class RenterRepository implements RenterRepositoryPort {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async findById(orgId: string, id: string): Promise<Renter | null> {
    const rows = await this.db
      .select()
      .from(renters)
      .where(and(eq(renters.id, id), eq(renters.orgId, orgId)))
      .limit(1);
    return rows[0] ? Renter.reconstitute(this.mapRow(rows[0])) : null;
  }

  async findByOrgAndPhone(orgId: string, phone: string): Promise<Renter | null> {
    const rows = await this.db
      .select()
      .from(renters)
      .where(and(eq(renters.orgId, orgId), eq(renters.phone, phone)))
      .limit(1);
    return rows[0] ? Renter.reconstitute(this.mapRow(rows[0])) : null;
  }

  async findByOrgAndTelegramId(orgId: string, telegramId: number): Promise<Renter | null> {
    const rows = await this.db
      .select()
      .from(renters)
      .where(and(eq(renters.orgId, orgId), eq(renters.telegramId, telegramId)))
      .limit(1);
    return rows[0] ? Renter.reconstitute(this.mapRow(rows[0])) : null;
  }

  async save(renter: Renter): Promise<void> {
    const state = renter.currentState;
    const row = this.mapState(state);
    const existing = await this.db.select().from(renters).where(eq(renters.id, row.id)).limit(1);
    if (existing[0]) {
      await this.db.update(renters).set(row).where(eq(renters.id, row.id));
    } else {
      await this.db.insert(renters).values(row);
    }
  }

  async anonymize(targetId: string, orgId: string, anonymousName: string, anonymousPhone: string): Promise<void> {
    const renter = await this.findById(orgId, targetId);
    if (!renter) {
      return;
    }
    renter.anonymize(anonymousName, anonymousPhone);
    await this.save(renter);
  }

  private mapRow(row: (typeof renters.$inferSelect)): RenterState {
    return {
      id: row.id,
      orgId: row.orgId,
      telegramId: row.telegramId,
      phone: row.phone,
      name: row.name,
      consentGivenAt: row.consentGivenAt,
      consentVersion: row.consentVersion,
      locale: row.locale,
      status: row.status as RenterState['status'],
      disableReason: row.disableReason as RenterState['disableReason'],
      createdAt: row.createdAt,
    };
  }

  private mapState(state: RenterState): typeof renters.$inferInsert {
    return {
      id: state.id,
      orgId: state.orgId,
      telegramId: state.telegramId,
      phone: state.phone,
      name: state.name,
      consentGivenAt: state.consentGivenAt,
      consentVersion: state.consentVersion,
      locale: state.locale,
      status: state.status,
      disableReason: state.disableReason,
    };
  }
}
