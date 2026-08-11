import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AutoRelockScheduler } from '../../domain/auto-relock-scheduler.port';

@Injectable()
export class AutoRelockProducer implements AutoRelockScheduler, OnModuleDestroy {
  private readonly logger = new Logger('AutoRelockProducer');
  private queue?: Queue;

  constructor() {}

  setQueue(queue: Queue): void {
    this.queue = queue;
  }

  async schedule(lockerId: string, lockAt: Date): Promise<void> {
    if (!this.queue) {
      this.logger.warn(`BullMQ queue not configured; skipping auto-relock schedule for ${lockerId}`);
      return;
    }
    const delay = Math.max(0, lockAt.getTime() - Date.now());
    await this.queue.add(
      'relock',
      { lockerId, lockAt: lockAt.toISOString() },
      { jobId: `relock_${lockerId}`, delay, removeOnComplete: true, removeOnFail: false },
    );
  }

  async cancel(lockerId: string): Promise<void> {
    if (!this.queue) return;
    const job = await this.queue.getJob(`relock_${lockerId}`);
    if (job) {
      await job.remove();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
