import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { lockers } from './schema/lockers.schema';
import { inventoryKits } from './schema/inventory-kits.schema';
import { Locker, LockerState } from '../../domain/locker.aggregate';
import { LockerRepository as LockerRepositoryPort } from '../../application/ports/locker.repository';

@Injectable()
export class DrizzleLockerRepository implements LockerRepositoryPort {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async save(locker: Locker): Promise<void> {
    const state = locker.currentState;
    const row = this.mapState(state);
    const existing = await this.db
      .select({ id: lockers.id })
      .from(lockers)
      .where(eq(lockers.id, row.id))
      .limit(1);
    if (existing[0]) {
      await this.db.update(lockers).set(row).where(eq(lockers.id, row.id));
    } else {
      await this.db.insert(lockers).values(row);
    }
  }

  async findById(orgId: string, id: string): Promise<Locker | null> {
    const rows = await this.db
      .select({
        locker: lockers,
        kitId: inventoryKits.id,
      })
      .from(lockers)
      .leftJoin(inventoryKits, eq(inventoryKits.lockerId, lockers.id))
      .where(eq(lockers.id, id))
      .limit(1);

    return rows[0] ? Locker.reconstitute(this.mapRow(rows[0].locker, rows[0].kitId)) : null;
  }

  async findByDoorSensorEntityId(stationId: string, sensorEntityId: string): Promise<Locker | null> {
    const rows = await this.db
      .select({
        locker: lockers,
        kitId: inventoryKits.id,
      })
      .from(lockers)
      .leftJoin(inventoryKits, eq(inventoryKits.lockerId, lockers.id))
      .where(
        and(
          eq(lockers.stationId, stationId),
          eq(lockers.haDoorSensorEntityId, sensorEntityId),
          isNull(lockers.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? Locker.reconstitute(this.mapRow(rows[0].locker, rows[0].kitId)) : null;
  }

  async listForStation(orgId: string, stationId: string): Promise<Locker[]> {
    const rows = await this.db
      .select({ locker: lockers, kitId: inventoryKits.id })
      .from(lockers)
      .leftJoin(inventoryKits, eq(inventoryKits.lockerId, lockers.id))
      .where(and(eq(lockers.stationId, stationId), isNull(lockers.deletedAt)));
    return rows.map((row) => Locker.reconstitute(this.mapRow(row.locker, row.kitId)));
  }

  async listAvailableForStation(orgId: string, stationId: string): Promise<Locker[]> {
    const rows = await this.db
      .select({ locker: lockers, kitId: inventoryKits.id })
      .from(lockers)
      .leftJoin(inventoryKits, eq(inventoryKits.lockerId, lockers.id))
      .where(
        and(
          eq(lockers.stationId, stationId),
          eq(lockers.status, 'AVAILABLE'),
          isNull(lockers.currentRentalId),
          isNull(lockers.deletedAt),
        ),
      );
    return rows.map((row) => Locker.reconstitute(this.mapRow(row.locker, row.kitId)));
  }

  async reserveAtomic(orgId: string, lockerId: string, rentalId: string): Promise<boolean> {
    const result = await this.db
      .update(lockers)
      .set({ currentRentalId: rentalId, status: 'RESERVED' })
      .where(
        and(
          eq(lockers.id, lockerId),
          isNull(lockers.currentRentalId),
          isNull(lockers.deletedAt),
        ),
      );
    return (result.rowCount ?? 0) > 0;
  }

  async release(orgId: string, lockerId: string): Promise<boolean> {
    const result = await this.db
      .update(lockers)
      .set({ currentRentalId: null, status: 'AVAILABLE' })
      .where(and(eq(lockers.id, lockerId), isNull(lockers.deletedAt)));
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: typeof lockers.$inferSelect, kitId: string | null): LockerState {
    return {
      id: row.id,
      stationId: row.stationId,
      name: row.name,
      status: row.status as LockerState['status'],
      haLockEntityId: row.haLockEntityId,
      haDoorSensorEntityId: row.haDoorSensorEntityId,
      currentRentalId: row.currentRentalId,
      inventoryKitId: kitId,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    };
  }

  private mapState(state: LockerState): typeof lockers.$inferInsert {
    return {
      id: state.id,
      stationId: state.stationId,
      name: state.name,
      status: state.status,
      haLockEntityId: state.haLockEntityId,
      haDoorSensorEntityId: state.haDoorSensorEntityId,
      currentRentalId: state.currentRentalId,
      createdAt: state.createdAt,
      deletedAt: state.deletedAt,
    };
  }
}
