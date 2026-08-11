import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { tariffs } from './schema/tariffs.schema';
import { Tariff, TariffState, DuplicateTariffError } from '../../domain/tariff.aggregate';
import { TariffRepository as TariffRepositoryPort } from '../../application/ports/tariff.repository';
import type { DayType } from '../../domain/day-type';

@Injectable()
export class DrizzleTariffRepository implements TariffRepositoryPort {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async save(tariff: Tariff): Promise<void> {
    const state = tariff.currentState;
    const row = this.mapState(state);
    const existing = await this.db
      .select({ id: tariffs.id })
      .from(tariffs)
      .where(eq(tariffs.id, row.id))
      .limit(1);
    try {
      if (existing[0]) {
        await this.db.update(tariffs).set(row).where(eq(tariffs.id, row.id));
      } else {
        await this.db.insert(tariffs).values(row);
      }
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existingByKey = await this.findExistingByKey(
          state.orgId,
          state.kitType,
          state.dayType,
          state.durationMinutes,
        );
        throw new DuplicateTariffError(existingByKey?.id ?? '');
      }
      throw error;
    }
  }

  async findById(orgId: string, id: string): Promise<Tariff | null> {
    const rows = await this.db
      .select()
      .from(tariffs)
      .where(and(eq(tariffs.id, id), eq(tariffs.orgId, orgId)))
      .limit(1);
    return rows[0] ? Tariff.reconstitute(this.mapRow(rows[0])) : null;
  }

  async list(orgId: string, filter?: { kitType?: string; dayType?: DayType }): Promise<Tariff[]> {
    const conditions = [eq(tariffs.orgId, orgId), isNull(tariffs.deletedAt)];
    if (filter?.kitType) conditions.push(eq(tariffs.kitType, filter.kitType));
    if (filter?.dayType) conditions.push(eq(tariffs.dayType, filter.dayType));
    const rows = await this.db
      .select()
      .from(tariffs)
      .where(and(...conditions))
      .orderBy(asc(tariffs.durationMinutes));
    return rows.map((row) => Tariff.reconstitute(this.mapRow(row)));
  }

  async findForQuote(
    orgId: string,
    kitType: string,
    dayType: DayType,
    durationMinutes: number,
  ): Promise<Tariff | null> {
    const rows = await this.db
      .select()
      .from(tariffs)
      .where(
        and(
          eq(tariffs.orgId, orgId),
          eq(tariffs.kitType, kitType),
          eq(tariffs.dayType, dayType),
          eq(tariffs.durationMinutes, durationMinutes),
          isNull(tariffs.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ? Tariff.reconstitute(this.mapRow(rows[0])) : null;
  }

  async listForKitType(orgId: string, kitType: string, dayType: DayType): Promise<Tariff[]> {
    const rows = await this.db
      .select()
      .from(tariffs)
      .where(
        and(
          eq(tariffs.orgId, orgId),
          eq(tariffs.kitType, kitType),
          eq(tariffs.dayType, dayType),
          isNull(tariffs.deletedAt),
        ),
      )
      .orderBy(asc(tariffs.durationMinutes));
    return rows.map((row) => Tariff.reconstitute(this.mapRow(row)));
  }

  async findExistingByKey(
    orgId: string,
    kitType: string,
    dayType: DayType,
    durationMinutes: number,
  ): Promise<Tariff | null> {
    const rows = await this.db
      .select()
      .from(tariffs)
      .where(
        and(
          eq(tariffs.orgId, orgId),
          eq(tariffs.kitType, kitType),
          eq(tariffs.dayType, dayType),
          eq(tariffs.durationMinutes, durationMinutes),
          isNull(tariffs.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ? Tariff.reconstitute(this.mapRow(rows[0])) : null;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const code = (error as { code?: string }).code;
      return code === '23505';
    }
    return false;
  }

  private mapRow(row: typeof tariffs.$inferSelect): TariffState {
    return {
      id: row.id,
      orgId: row.orgId,
      kitType: row.kitType,
      dayType: row.dayType as TariffState['dayType'],
      durationMinutes: row.durationMinutes,
      priceMinor: row.priceMinor,
      currency: row.currency,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    };
  }

  private mapState(state: TariffState): typeof tariffs.$inferInsert {
    return {
      id: state.id,
      orgId: state.orgId,
      kitType: state.kitType,
      dayType: state.dayType,
      durationMinutes: state.durationMinutes,
      priceMinor: state.priceMinor,
      currency: state.currency,
      createdAt: state.createdAt,
      deletedAt: state.deletedAt,
    };
  }
}
