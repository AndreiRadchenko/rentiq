import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../../../shared-kernel/infrastructure/database/connection';
import { CryptoService } from '../../../shared-kernel/infrastructure/crypto/crypto.service';
import { stations } from './schema/stations.schema';
import { Station, StationState } from '../../domain/station.aggregate';
import { StationRepository as StationRepositoryPort } from '../../application/ports/station.repository';

@Injectable()
export class DrizzleStationRepository implements StationRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly crypto: CryptoService,
  ) {}

  async save(station: Station): Promise<void> {
    const state = station.currentState;
    const row = this.mapState(state);
    const existing = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(eq(stations.id, row.id))
      .limit(1);
    if (existing[0]) {
      await this.db.update(stations).set(row).where(eq(stations.id, row.id));
    } else {
      await this.db.insert(stations).values(row);
    }
  }

  async findById(orgId: string, id: string): Promise<Station | null> {
    const rows = await this.db
      .select()
      .from(stations)
      .where(and(eq(stations.id, id), eq(stations.orgId, orgId)))
      .limit(1);
    return rows[0] ? Station.reconstitute(this.mapRow(rows[0])) : null;
  }

  async findByIdUnscoped(id: string): Promise<Station | null> {
    const rows = await this.db
      .select()
      .from(stations)
      .where(eq(stations.id, id))
      .limit(1);
    return rows[0] ? Station.reconstitute(this.mapRow(rows[0])) : null;
  }

  async listAdmin(orgId: string): Promise<Station[]> {
    const rows = await this.db
      .select()
      .from(stations)
      .where(and(eq(stations.orgId, orgId), isNull(stations.deletedAt)))
      .orderBy(asc(stations.sortOrder), asc(stations.name));
    return rows.map((row) => Station.reconstitute(this.mapRow(row)));
  }

  async listBookable(orgId: string): Promise<Station[]> {
    const rows = await this.db
      .select()
      .from(stations)
      .where(
        and(
          eq(stations.orgId, orgId),
          eq(stations.isActive, true),
          eq(stations.isVisibleToClients, true),
          eq(stations.workingStatus, 'WORKING'),
          isNull(stations.deletedAt),
        ),
      )
      .orderBy(asc(stations.sortOrder), asc(stations.name));
    return rows.map((row) => Station.reconstitute(this.mapRow(row)));
  }

  private mapRow(row: typeof stations.$inferSelect): StationState {
    return {
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      address: row.address,
      workingStatus: row.workingStatus as StationState['workingStatus'],
      isActive: row.isActive,
      adminIntendedIsActive: row.adminIntendedIsActive,
      isVisibleToClients: row.isVisibleToClients,
      sortOrder: row.sortOrder,
      haUrlOrIp: row.haUrlOrIp,
      haToken: this.crypto.decrypt(row.haTokenEncrypted),
      haWebhookSecret: this.crypto.decrypt(row.haWebhookSecretEncrypted),
      autoLockDelaySec: row.autoLockDelaySec,
      healthStatus: row.healthStatus as StationState['healthStatus'],
      lastHealthCheckAt: row.lastHealthCheckAt,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    };
  }

  private mapState(state: StationState): typeof stations.$inferInsert {
    return {
      id: state.id,
      orgId: state.orgId,
      name: state.name,
      address: state.address,
      workingStatus: state.workingStatus,
      isActive: state.isActive,
      adminIntendedIsActive: state.adminIntendedIsActive,
      isVisibleToClients: state.isVisibleToClients,
      sortOrder: state.sortOrder,
      haUrlOrIp: state.haUrlOrIp,
      haTokenEncrypted: this.crypto.encrypt(state.haToken),
      haWebhookSecretEncrypted: this.crypto.encrypt(state.haWebhookSecret),
      autoLockDelaySec: state.autoLockDelaySec,
      healthStatus: state.healthStatus,
      lastHealthCheckAt: state.lastHealthCheckAt,
      createdAt: state.createdAt,
      deletedAt: state.deletedAt,
    };
  }
}
