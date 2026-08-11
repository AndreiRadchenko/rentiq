import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class LockerReconciliationJob {
  private readonly logger = new Logger('LockerReconciliationJob');

  @Interval(60 * 60 * 1000)
  async reconcile(): Promise<void> {
    this.logger.debug('LockerReconciliationJob tick — no-op until rentals (Phase 5) publishes events');
  }
}
