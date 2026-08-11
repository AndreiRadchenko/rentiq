import { InventoryKit } from '../../domain/inventory-kit.entity';

export const INVENTORY_KIT_REPOSITORY = 'INVENTORY_KIT_REPOSITORY';

export interface InventoryKitRepository {
  save(kit: InventoryKit): Promise<void>;
  findById(orgId: string, id: string): Promise<InventoryKit | null>;
  listForStation(orgId: string, stationId: string): Promise<InventoryKit[]>;
  findByLocker(orgId: string, lockerId: string): Promise<InventoryKit | null>;
}
