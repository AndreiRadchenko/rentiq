import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { inventoryKits } from './schema/inventory-kits.schema';
import { InventoryKit, InventoryKitState } from '../../domain/inventory-kit.entity';
import { InventoryKitRepository as InventoryKitRepositoryPort } from '../../application/ports/inventory-kit.repository';

@Injectable()
export class DrizzleInventoryKitRepository implements InventoryKitRepositoryPort {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async save(kit: InventoryKit): Promise<void> {
    const state = kit.currentState;
    const row = this.mapState(state);
    const existing = await this.db
      .select({ id: inventoryKits.id })
      .from(inventoryKits)
      .where(eq(inventoryKits.id, row.id))
      .limit(1);
    if (existing[0]) {
      await this.db.update(inventoryKits).set(row).where(eq(inventoryKits.id, row.id));
    } else {
      await this.db.insert(inventoryKits).values(row);
    }
  }

  async findById(orgId: string, id: string): Promise<InventoryKit | null> {
    const rows = await this.db
      .select()
      .from(inventoryKits)
      .where(eq(inventoryKits.id, id))
      .limit(1);
    return rows[0] ? InventoryKit.reconstitute(this.mapRow(rows[0])) : null;
  }

  async listForStation(orgId: string, stationId: string): Promise<InventoryKit[]> {
    const rows = await this.db
      .select()
      .from(inventoryKits)
      .where(eq(inventoryKits.stationId, stationId));
    return rows.map((row) => InventoryKit.reconstitute(this.mapRow(row)));
  }

  async findByLocker(orgId: string, lockerId: string): Promise<InventoryKit | null> {
    const rows = await this.db
      .select()
      .from(inventoryKits)
      .where(eq(inventoryKits.lockerId, lockerId))
      .limit(1);
    return rows[0] ? InventoryKit.reconstitute(this.mapRow(rows[0])) : null;
  }

  private mapRow(row: typeof inventoryKits.$inferSelect): InventoryKitState {
    return {
      id: row.id,
      stationId: row.stationId,
      lockerId: row.lockerId,
      name: row.name,
      kitType: row.kitType,
      createdAt: row.createdAt,
    };
  }

  private mapState(state: InventoryKitState): typeof inventoryKits.$inferInsert {
    return {
      id: state.id,
      stationId: state.stationId,
      lockerId: state.lockerId,
      name: state.name,
      kitType: state.kitType,
      createdAt: state.createdAt,
    };
  }
}
