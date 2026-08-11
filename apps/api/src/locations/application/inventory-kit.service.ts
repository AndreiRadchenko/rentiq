import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { EntityId } from '../../shared-kernel/domain/value-objects/entity-id';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';
import { AuditableLogger } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { InventoryKit } from '../domain/inventory-kit.entity';
import { INVENTORY_KIT_REPOSITORY, InventoryKitRepository } from './ports/inventory-kit.repository';
import { STATION_REPOSITORY, StationRepository } from './ports/station.repository';
import { LOCKER_REPOSITORY, LockerRepository } from './ports/locker.repository';

export interface CreateKitInput {
  stationId: string;
  name: string;
  kitType: string;
}

export interface UpdateKitInput {
  name?: string;
  kitType?: string;
  lockerId?: string | null;
}

@Injectable()
export class InventoryKitService {
  constructor(
    @Inject(INVENTORY_KIT_REPOSITORY) private readonly kits: InventoryKitRepository,
    @Inject(STATION_REPOSITORY) private readonly stations: StationRepository,
    @Inject(LOCKER_REPOSITORY) private readonly lockers: LockerRepository,
    private readonly audit: AuditableLogger,
  ) {}

  async create(input: CreateKitInput, actorId: string): Promise<InventoryKit> {
    const orgId = this.requireOrgId();
    const station = await this.stations.findById(orgId, input.stationId);
    if (!station) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.STATION_NOT_FOUND, 'locations.station_not_found');
    }
    const kit = InventoryKit.create({
      id: EntityId.generate().toString(),
      stationId: input.stationId,
      name: input.name,
      kitType: input.kitType,
    });
    await this.kits.save(kit);
    this.audit.log('InventoryKitCreated', actorId, orgId, { kitId: kit.id, stationId: input.stationId });
    return kit;
  }

  async update(id: string, input: UpdateKitInput, actorId: string): Promise<InventoryKit> {
    const orgId = this.requireOrgId();
    const kit = await this.kits.findById(orgId, id);
    if (!kit) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.KIT_NOT_FOUND, 'locations.kit_not_found');
    }
    kit.update({ name: input.name, kitType: input.kitType });
    if (input.lockerId !== undefined) {
      if (input.lockerId === null) {
        kit.reassignTo(null);
      } else {
        const locker = await this.lockers.findById(orgId, input.lockerId);
        if (!locker) {
          throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.LOCKER_NOT_FOUND, 'locations.locker_not_found');
        }
        const currentKit = await this.kits.findByLocker(orgId, input.lockerId);
        if (currentKit && currentKit.id !== kit.id) {
          currentKit.reassignTo(null);
          await this.kits.save(currentKit);
        }
        kit.reassignTo(input.lockerId);
      }
    }
    await this.kits.save(kit);
    this.audit.log('InventoryKitUpdated', actorId, orgId, { kitId: kit.id });
    return kit;
  }

  async retire(id: string, actorId: string): Promise<void> {
    const orgId = this.requireOrgId();
    const kit = await this.kits.findById(orgId, id);
    if (!kit) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.KIT_NOT_FOUND, 'locations.kit_not_found');
    }
    kit.retire();
    await this.kits.save(kit);
    this.audit.log('InventoryKitRetired', actorId, orgId, { kitId: kit.id });
  }

  private requireOrgId(): string {
    const orgId = TenantContext.getOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_NOT_FOUND, 'auth.tenant_not_found');
    }
    return orgId;
  }
}
