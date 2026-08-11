export interface AutoRelockScheduler {
  schedule(lockerId: string, lockAt: Date): Promise<void>;
  cancel(lockerId: string): Promise<void>;
}

export const AUTO_RELOCK_SCHEDULER = 'AUTO_RELOCK_SCHEDULER';
