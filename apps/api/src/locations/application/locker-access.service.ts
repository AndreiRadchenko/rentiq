import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';
import { EVENT_BUS, EventBus } from '../../shared-kernel/application/ports/event-bus';
import { Station } from '../domain/station.aggregate';
import { Locker } from '../domain/locker.aggregate';
import {
  SmartLockGateway,
  SmartLockGatewayFactory,
  GatewayUnreachableError,
  GatewayCommandError,
} from '../domain/smart-lock-gateway.port';
import { AutoRelockScheduler } from '../domain/auto-relock-scheduler.port';
import { STATION_REPOSITORY, StationRepository } from './ports/station.repository';
import { LOCKER_REPOSITORY, LockerRepository } from './ports/locker.repository';
import { LockerOpened, LockerActorType } from '../domain/events/locker-opened.event';
import { LockerClosed } from '../domain/events/locker-closed.event';

@Injectable()
export class LockerAccessService {
  constructor(
    @Inject(STATION_REPOSITORY) private readonly stations: StationRepository,
    @Inject(LOCKER_REPOSITORY) private readonly lockers: LockerRepository,
    @Inject('SMART_LOCK_GATEWAY_FACTORY') private readonly gatewayFactory: SmartLockGatewayFactory,
    @Inject('AUTO_RELOCK_SCHEDULER') private readonly relockScheduler: AutoRelockScheduler,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async openLocker(
    lockerId: string,
    actorType: LockerActorType,
    actorId: string | null,
    rentalId: string | null = null,
  ): Promise<void> {
    const { station, locker, gateway } = await this.resolve(lockerId);
    const haConfig = station.haConfig.toState();
    const gatewayInstance = gateway;
    try {
      await gatewayInstance.unlock(locker.haLockEntityId);
    } catch (error) {
      this.mapGatewayError(error);
    }
    const now = new Date();
    const orgId = station.orgId;
    await this.eventBus.publish(
      new LockerOpened(lockerId, station.id, orgId, actorType, actorId, rentalId, now.toISOString()),
    );
    const lockAt = new Date(now.getTime() + haConfig.autoLockDelaySeconds * 1000);
    await this.relockScheduler.schedule(lockerId, lockAt);
  }

  async closeLocker(
    lockerId: string,
    actorType: LockerActorType,
    actorId: string | null,
    rentalId: string | null = null,
  ): Promise<void> {
    const { station, locker, gateway } = await this.resolve(lockerId);
    try {
      await gateway.lock(locker.haLockEntityId);
    } catch (error) {
      this.mapGatewayError(error);
    }
    const now = new Date();
    await this.eventBus.publish(
      new LockerClosed(lockerId, station.id, station.orgId, actorType, actorId, rentalId, now.toISOString()),
    );
    await this.relockScheduler.cancel(lockerId);
  }

  private async resolve(lockerId: string): Promise<{
    station: Station;
    locker: Locker;
    gateway: SmartLockGateway;
  }> {
    const orgId = this.requireOrgId();
    const locker = await this.lockers.findById(orgId, lockerId);
    if (!locker) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.LOCKER_NOT_FOUND, 'locations.locker_not_found');
    }
    const station = await this.stations.findById(orgId, locker.stationId);
    if (!station) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.STATION_NOT_FOUND, 'locations.station_not_found');
    }
    const gateway = this.gatewayFactory.forStation(station.id, station.haConfig.toState());
    return { station, locker, gateway };
  }

  private mapGatewayError(error: unknown): never {
    if (error instanceof GatewayUnreachableError) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.LOCKER_STATION_OFFLINE, 'locations.locker_station_offline');
    }
    if (error instanceof GatewayCommandError) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, ErrorCode.LOCKER_OPEN_FAILED, 'locations.locker_open_failed');
    }
    throw error;
  }

  private requireOrgId(): string {
    const orgId = TenantContext.getOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_NOT_FOUND, 'auth.tenant_not_found');
    }
    return orgId;
  }
}
