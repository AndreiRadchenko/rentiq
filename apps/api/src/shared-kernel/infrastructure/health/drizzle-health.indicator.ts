import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { DRIZZLE_DB } from '../../application/ports/tokens';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleHealthIndicator extends HealthIndicator {
  constructor(@Inject(DRIZZLE_DB) private readonly db: ReturnType<typeof drizzle>) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        `${key} is not available`,
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    }
  }
}
