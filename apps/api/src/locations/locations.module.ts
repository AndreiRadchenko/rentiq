import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { STATION_REPOSITORY } from './application/ports/station.repository';
import { LOCKER_REPOSITORY } from './application/ports/locker.repository';
import { INVENTORY_KIT_REPOSITORY } from './application/ports/inventory-kit.repository';
import { DrizzleStationRepository } from './infrastructure/drizzle/stations.repository';
import { DrizzleLockerRepository } from './infrastructure/drizzle/lockers.repository';
import { DrizzleInventoryKitRepository } from './infrastructure/drizzle/inventory-kits.repository';
import { MockSmartLockGateway } from './infrastructure/mock-smart-lock.gateway';
import { SmartLockGatewayFactoryImpl } from './infrastructure/smart-lock-gateway.factory';
import { AutoRelockProducer } from './infrastructure/bullmq/auto-relock.producer';
import { AutoRelockWorker } from './infrastructure/bullmq/auto-relock.worker';
import { StationsService } from './application/stations.service';
import { LockersService } from './application/lockers.service';
import { InventoryKitService } from './application/inventory-kit.service';
import { BookableStationsService } from './application/bookable-stations.service';
import { LockerAccessService } from './application/locker-access.service';
import { StationHealthCheckerService } from './application/station-health-checker.service';
import { DoorEventHandler } from './application/door-event.handler';
import { RentalEventHandlers } from './application/rental-event-handlers';
import { StationsController } from './interface/stations.controller';
import { LockersController } from './interface/lockers.controller';
import { InventoryKitsController } from './interface/inventory-kits.controller';
import { HaDoorEventsController } from './interface/ha-door-events.controller';
import { StationHealthCheckerCron } from './infrastructure/jobs/station-health-checker.cron';
import { LockerReconciliationJob } from './infrastructure/jobs/locker-reconciliation.job';
import { PricingModule } from '../pricing/pricing.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [ScheduleModule.forRoot(), PricingModule, OrganizationsModule],
  controllers: [
    StationsController,
    LockersController,
    InventoryKitsController,
    HaDoorEventsController,
  ],
  providers: [
    StationsService,
    LockersService,
    InventoryKitService,
    BookableStationsService,
    LockerAccessService,
    StationHealthCheckerService,
    DoorEventHandler,
    RentalEventHandlers,
    StationHealthCheckerCron,
    LockerReconciliationJob,
    MockSmartLockGateway,
    { provide: 'SMART_LOCK_GATEWAY_FACTORY', useClass: SmartLockGatewayFactoryImpl },
    { provide: STATION_REPOSITORY, useClass: DrizzleStationRepository },
    { provide: LOCKER_REPOSITORY, useClass: DrizzleLockerRepository },
    { provide: INVENTORY_KIT_REPOSITORY, useClass: DrizzleInventoryKitRepository },
    AutoRelockWorker,
    {
      provide: AutoRelockProducer,
      useFactory: (queue: Queue | null) => {
        const producer = new AutoRelockProducer();
        if (queue) producer.setQueue(queue);
        return producer;
      },
      inject: ['AUTO_RELOCK_QUEUE'],
    },
    {
      provide: 'AUTO_RELOCK_QUEUE',
      useFactory: (): Queue | null => {
        const redisUrl = process.env['REDIS_URL'];
        if (!redisUrl) return null;
        try {
          const url = new URL(redisUrl);
          return new Queue('auto-relock', { connection: { host: url.hostname, port: Number(url.port) || 6379 } });
        } catch {
          return null;
        }
      },
    },
    {
      provide: 'AUTO_RELOCK_CONNECTION',
      useFactory: (): { host: string; port: number } | null => {
        const redisUrl = process.env['REDIS_URL'];
        if (!redisUrl) return null;
        try {
          const url = new URL(redisUrl);
          return { host: url.hostname, port: Number(url.port) || 6379 };
        } catch {
          return null;
        }
      },
    },
    {
      provide: 'AUTO_RELOCK_SCHEDULER',
      useExisting: AutoRelockProducer,
    },
  ],
  exports: [StationsService, LockersService, LockerAccessService, RentalEventHandlers],
})
export class LocationsModule {
  constructor(
    private readonly producer: AutoRelockProducer,
    private readonly worker: AutoRelockWorker,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) return;
    try {
      const url = new URL(redisUrl);
      const connection = { host: url.hostname, port: Number(url.port) || 6379 };
      this.worker.setConnection(connection);
    } catch {
      // ignore
    }
  }
}
