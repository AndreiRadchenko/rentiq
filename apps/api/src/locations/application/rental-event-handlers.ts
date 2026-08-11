import { Injectable, Inject, Logger } from '@nestjs/common';
import { LOCKER_REPOSITORY, LockerRepository } from './ports/locker.repository';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';

interface RentalFinishedPayload {
  rentalId: string;
  orgId: string;
  lockerIds: string[];
}

interface RentalCancelledPayload extends RentalFinishedPayload {}

@Injectable()
export class RentalEventHandlers {
  private readonly logger = new Logger('RentalEventHandlers');

  constructor(@Inject(LOCKER_REPOSITORY) private readonly lockers: LockerRepository) {}

  async onRentalFinished(payload: RentalFinishedPayload): Promise<void> {
    await this.releaseLockers(payload.orgId, payload.lockerIds, 'RentalFinished');
  }

  async onRentalCancelled(payload: RentalCancelledPayload): Promise<void> {
    await this.releaseLockers(payload.orgId, payload.lockerIds, 'RentalCancelled');
  }

  private async releaseLockers(orgId: string, lockerIds: string[], eventName: string): Promise<void> {
    TenantContext.run(orgId, async () => {
      for (const lockerId of lockerIds) {
        const released = await this.lockers.release(orgId, lockerId);
        if (!released) {
          this.logger.warn(`${eventName}: locker ${lockerId} not found or already released`);
        }
      }
    });
  }
}
