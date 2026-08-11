import { Injectable, Inject, Logger, HttpStatus } from '@nestjs/common';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { EVENT_BUS, EventBus } from '../../shared-kernel/application/ports/event-bus';
import { LOCKER_REPOSITORY, LockerRepository } from './ports/locker.repository';
import { UnauthorizedDoorOpenDetected } from '../domain/events/unauthorized-door-open-detected.event';
import { LockerOpened } from '../domain/events/locker-opened.event';
import { LockerClosed } from '../domain/events/locker-closed.event';
import { LockerAccessService } from './locker-access.service';
import { STATION_REPOSITORY, StationRepository } from './ports/station.repository';
import { Station } from '../domain/station.aggregate';
import type { DoorState } from '../domain/smart-lock-gateway.port';

export interface DoorEventInput {
  stationId: string;
  doorSensor: string;
  doorState?: DoorState;
  eventTimestamp?: string;
}

@Injectable()
export class DoorEventHandler {
  private readonly logger = new Logger('DoorEventHandler');

  constructor(
    @Inject(LOCKER_REPOSITORY) private readonly lockers: LockerRepository,
    @Inject(STATION_REPOSITORY) private readonly stations: StationRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly lockerAccessService: LockerAccessService,
  ) {}

  async handle(input: DoorEventInput, sharedSecret?: string): Promise<void> {
    const station = await this.stations.findByIdUnscoped(input.stationId);
    if (!station) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.STATION_NOT_FOUND, 'locations.station_not_found');
    }
    await this.validateSharedSecret(station, sharedSecret);
    const orgId = station.orgId;
    const eventTimestamp = input.eventTimestamp ?? new Date().toISOString();

    const locker = await this.lockers.findByDoorSensorEntityId(station.id, input.doorSensor);
    if (!locker) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.LOCKER_NOT_FOUND, 'locations.locker_not_found');
    }

    if (input.doorState === 'OPEN') {
      if (locker.currentRentalId === null) {
        this.logger.warn(
          `Unauthorized door open detected: locker ${locker.id} opened without an active rental (station ${locker.stationId}, org ${orgId}, at ${eventTimestamp})`,
        );
        await this.eventBus.publish(
          new UnauthorizedDoorOpenDetected(locker.id, locker.stationId, orgId, eventTimestamp),
        );
      } else {
        await this.eventBus.publish(
          new LockerOpened(locker.id, locker.stationId, orgId, 'SYSTEM', null, locker.currentRentalId, eventTimestamp),
        );
      }
    } else if (input.doorState === 'CLOSED') {
      await this.eventBus.publish(
        new LockerClosed(locker.id, locker.stationId, orgId, 'SYSTEM', null, locker.currentRentalId, eventTimestamp),
      );
    } else {
      this.logger.warn(`UNKNOWN door state for locker ${locker.id}; logged for admin awareness`);
    }
  }

  private async validateSharedSecret(station: Station, sharedSecret?: string): Promise<void> {
    if (!sharedSecret || station.haWebhookSecret !== sharedSecret) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.WEBHOOK_SECRET_INVALID, 'locations.webhook_secret_invalid');
    }
  }
}
