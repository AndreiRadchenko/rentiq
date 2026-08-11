import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { EntityId } from '../../shared-kernel/domain/value-objects/entity-id';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';
import { EVENT_BUS, EventBus } from '../../shared-kernel/application/ports/event-bus';
import { AuditableLogger } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { CryptoService } from '../../shared-kernel/infrastructure/crypto/crypto.service';
import { Station } from '../domain/station.aggregate';
import { STATION_REPOSITORY, StationRepository } from './ports/station.repository';
import { LOCKER_REPOSITORY, LockerRepository } from './ports/locker.repository';
import { StationCreated } from '../domain/events/station-created.event';
import { StationVisibilityChanged } from '../domain/events/station-visibility-changed.event';
import type { StationWorkingStatus } from '../infrastructure/drizzle/schema/stations.schema';

export interface CreateStationInput {
  name: string;
  address?: string | null;
  haUrlOrIp: string;
  haToken: string;
  haWebhookSecret: string;
  autoLockDelaySec?: number;
  sortOrder?: number;
}

export interface UpdateStationInput {
  name?: string;
  address?: string | null;
  isActive?: boolean;
  isVisibleToClients?: boolean;
  workingStatus?: StationWorkingStatus;
  autoLockDelaySec?: number;
  haUrlOrIp?: string;
  haToken?: string;
  haWebhookSecret?: string;
  sortOrder?: number;
}

@Injectable()
export class StationsService {
  constructor(
    @Inject(STATION_REPOSITORY) private readonly stations: StationRepository,
    @Inject(LOCKER_REPOSITORY) private readonly lockers: LockerRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly audit: AuditableLogger,
    private readonly crypto: CryptoService,
  ) {}

  async create(input: CreateStationInput, actorId: string): Promise<Station> {
    const orgId = this.requireOrgId();
    if (!input.name?.trim()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'locations.station_name_required');
    }
    if (!input.haUrlOrIp?.trim()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.STATION_HA_URL_INVALID, 'locations.ha_url_invalid');
    }
    if (!input.haToken?.trim()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.STATION_TOKEN_REF_EMPTY, 'locations.token_ref_empty');
    }
    if (!input.haWebhookSecret?.trim()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'locations.webhook_secret_required');
    }
    if (input.autoLockDelaySec !== undefined && (!Number.isInteger(input.autoLockDelaySec) || input.autoLockDelaySec <= 0)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.STATION_AUTOLOCK_INVALID, 'locations.autolock_invalid');
    }

    const station = Station.create({
      id: EntityId.generate().toString(),
      orgId,
      name: input.name,
      address: input.address ?? null,
      haUrlOrIp: input.haUrlOrIp,
      haToken: input.haToken,
      haWebhookSecret: input.haWebhookSecret,
      autoLockDelaySec: input.autoLockDelaySec,
      sortOrder: input.sortOrder,
    });

    await this.stations.save(station);
    this.audit.log('StationCreated', actorId, orgId, { stationId: station.id, name: station.name });
    await this.eventBus.publish(new StationCreated(station.id, orgId, station.name, actorId));
    return station;
  }

  async update(id: string, input: UpdateStationInput, actorId: string): Promise<Station> {
    const orgId = this.requireOrgId();
    const station = await this.stations.findById(orgId, id);
    if (!station) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.STATION_NOT_FOUND, 'locations.station_not_found');
    }

    if (input.autoLockDelaySec !== undefined && (!Number.isInteger(input.autoLockDelaySec) || input.autoLockDelaySec <= 0)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.STATION_AUTOLOCK_INVALID, 'locations.autolock_invalid');
    }

    if (input.name !== undefined) station.update({ name: input.name });
    if (input.address !== undefined) station.update({ address: input.address });
    if (input.sortOrder !== undefined) station.update({ sortOrder: input.sortOrder });
    if (input.isActive !== undefined) station.setActive(input.isActive);
    if (input.isVisibleToClients !== undefined) station.setVisible(input.isVisibleToClients);
    if (input.workingStatus !== undefined) station.setWorkingStatus(input.workingStatus);
    if (input.haUrlOrIp !== undefined && input.haToken !== undefined && input.autoLockDelaySec !== undefined) {
      station.updateHaConfig(input.haUrlOrIp, input.haToken, input.autoLockDelaySec, input.haWebhookSecret);
    }

    await this.stations.save(station);
    const state = station.currentState;
    this.audit.log('StationUpdated', actorId, orgId, { stationId: station.id });
    await this.eventBus.publish(
      new StationVisibilityChanged(
        station.id,
        orgId,
        actorId,
        state.isActive,
        state.isVisibleToClients,
        state.workingStatus,
      ),
    );
    return station;
  }

  async getById(id: string): Promise<Station> {
    const orgId = this.requireOrgId();
    const station = await this.stations.findById(orgId, id);
    if (!station) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.STATION_NOT_FOUND, 'locations.station_not_found');
    }
    return station;
  }

  async listAdmin(): Promise<Station[]> {
    return this.stations.listAdmin(this.requireOrgId());
  }

  async listBookable(): Promise<Station[]> {
    return this.stations.listBookable(this.requireOrgId());
  }

  async countAvailableLockers(stationId: string): Promise<number> {
    const orgId = this.requireOrgId();
    const lockers = await this.lockers.listAvailableForStation(orgId, stationId);
    return lockers.length;
  }

  private requireOrgId(): string {
    const orgId = TenantContext.getOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_NOT_FOUND, 'auth.tenant_not_found');
    }
    return orgId;
  }
}
