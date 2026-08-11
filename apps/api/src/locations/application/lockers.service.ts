import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { EntityId } from '../../shared-kernel/domain/value-objects/entity-id';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';
import { AuditableLogger } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { Locker } from '../domain/locker.aggregate';
import { LOCKER_REPOSITORY, LockerRepository } from './ports/locker.repository';
import { STATION_REPOSITORY, StationRepository } from './ports/station.repository';
import { INVENTORY_KIT_REPOSITORY, InventoryKitRepository } from './ports/inventory-kit.repository';

export interface CreateLockerInput {
  stationId: string;
  name: string;
  haLockEntityId: string;
  haDoorSensorEntityId: string;
}

export interface UpdateLockerInput {
  name?: string;
  haLockEntityId?: string;
  haDoorSensorEntityId?: string;
  inventoryKitId?: string | null;
  status?: 'AVAILABLE' | 'MAINTENANCE';
}

export interface LockerWithKit {
  locker: Locker;
  kitType: string | null;
  misconfigured: boolean;
}

@Injectable()
export class LockersService {
  constructor(
    @Inject(LOCKER_REPOSITORY) private readonly lockers: LockerRepository,
    @Inject(STATION_REPOSITORY) private readonly stations: StationRepository,
    @Inject(INVENTORY_KIT_REPOSITORY) private readonly kits: InventoryKitRepository,
    private readonly audit: AuditableLogger,
  ) {}

  async create(input: CreateLockerInput, actorId: string): Promise<Locker> {
    const orgId = this.requireOrgId();
    const station = await this.stations.findById(orgId, input.stationId);
    if (!station) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.STATION_NOT_FOUND, 'locations.station_not_found');
    }
    if (!input.name?.trim()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'locations.locker_name_required');
    }
    const locker = Locker.create({
      id: EntityId.generate().toString(),
      stationId: input.stationId,
      name: input.name,
      haLockEntityId: input.haLockEntityId,
      haDoorSensorEntityId: input.haDoorSensorEntityId,
    });
    await this.lockers.save(locker);
    this.audit.log('LockerCreated', actorId, orgId, { lockerId: locker.id, stationId: input.stationId });
    return locker;
  }

  async update(id: string, input: UpdateLockerInput, actorId: string): Promise<Locker> {
    const orgId = this.requireOrgId();
    const locker = await this.lockers.findById(orgId, id);
    if (!locker) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.LOCKER_NOT_FOUND, 'locations.locker_not_found');
    }
    if (input.name !== undefined) locker.update({ name: input.name });
    if (input.haLockEntityId !== undefined || input.haDoorSensorEntityId !== undefined) {
      locker.updateHaEntityIds(
        input.haLockEntityId ?? locker.haLockEntityId,
        input.haDoorSensorEntityId ?? locker.haDoorSensorEntityId,
      );
    }
    if (input.inventoryKitId !== undefined) {
      const currentKit = await this.kits.findByLocker(orgId, id);
      if (input.inventoryKitId === null) {
        if (currentKit) {
          currentKit.reassignTo(null);
          await this.kits.save(currentKit);
        }
        locker.unassignKit();
      } else {
        const kit = await this.kits.findById(orgId, input.inventoryKitId);
        if (!kit) {
          throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.KIT_NOT_FOUND, 'locations.kit_not_found');
        }
        if (currentKit && currentKit.id !== kit.id) {
          currentKit.reassignTo(null);
          await this.kits.save(currentKit);
        }
        if (kit.lockerId !== id) {
          kit.reassignTo(id);
          await this.kits.save(kit);
        }
        locker.assignKit(kit.id);
      }
    }
    if (input.status !== undefined) {
      if (input.status === 'MAINTENANCE') locker.setMaintenance();
      else locker.setAvailable();
    }
    await this.lockers.save(locker);
    this.audit.log('LockerUpdated', actorId, orgId, { lockerId: locker.id });
    return locker;
  }

  async listForStation(stationId: string): Promise<LockerWithKit[]> {
    const orgId = this.requireOrgId();
    const lockers = await this.lockers.listForStation(orgId, stationId);
    const result: LockerWithKit[] = [];
    for (const locker of lockers) {
      const kit = locker.inventoryKitId ? await this.kits.findById(orgId, locker.inventoryKitId) : null;
      const misconfigured = locker.inventoryKitId == null || kit == null;
      result.push({ locker, kitType: kit?.kitType ?? null, misconfigured });
    }
    return result;
  }

  async getById(id: string): Promise<Locker> {
    const orgId = this.requireOrgId();
    const locker = await this.lockers.findById(orgId, id);
    if (!locker) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.LOCKER_NOT_FOUND, 'locations.locker_not_found');
    }
    return locker;
  }

  private requireOrgId(): string {
    const orgId = TenantContext.getOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_NOT_FOUND, 'auth.tenant_not_found');
    }
    return orgId;
  }
}
