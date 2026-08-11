import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { MockSmartLockGateway } from '../mock-smart-lock.gateway';

interface RelockJobData {
  lockerId: string;
  lockAt: string;
}

@Injectable()
export class AutoRelockWorker implements OnModuleInit {
  private readonly logger = new Logger('AutoRelockWorker');
  private worker?: Worker;

  constructor(private readonly mockGateway: MockSmartLockGateway) {}

  setConnection(connection: { host: string; port: number }): void {
    this.worker = new Worker(
      'auto-relock',
      async (job: Job<RelockJobData>) => this.process(job),
      { connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Auto-relock job ${job?.id} failed: ${err.message}`);
    });
  }

  private async process(job: Job<RelockJobData>): Promise<void> {
    const { lockerId, lockAt } = job.data;
    const deadline = new Date(lockAt);
    if (Date.now() < deadline.getTime()) {
      const delay = deadline.getTime() - Date.now();
      await job.moveToDelayed(Date.now() + delay, job.token ?? '');
      return;
    }
    try {
      await this.mockGateway.lock(lockerId);
      this.logger.log(`Auto-relocked locker ${lockerId} (SYSTEM)`);
    } catch (error) {
      this.logger.error(`Failed to auto-relock ${lockerId}: ${(error as Error).message}`);
      throw error;
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.worker) {
      this.logger.warn('BullMQ worker not configured (no Redis connection); auto-relock disabled');
    }
  }
}
