import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly client: Redis;

  constructor() {
    super();
    this.client = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      lazyConnect: true,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.client.connect();
      const result = await this.client.ping();
      await this.client.disconnect();
      if (result === 'PONG') {
        return this.getStatus(key, true);
      }
      throw new Error('Unexpected Redis response');
    } catch (error) {
      try {
        await this.client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      throw new HealthCheckError(
        `${key} is not available`,
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    }
  }
}
