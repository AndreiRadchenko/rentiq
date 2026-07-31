import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
} from '@nestjs/terminus';
import { DrizzleHealthIndicator } from '../../infrastructure/health/drizzle-health.indicator';
import { RedisHealthIndicator } from '../../infrastructure/health/redis-health.indicator';
import { HealthCheckResponse } from '../dto/health';

@Controller('v1/health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private drizzleHealth: DrizzleHealthIndicator,
    private redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResponse> {
    const result = await this.health.check([
      () => this.drizzleHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);

    const response: HealthCheckResponse = {
      status: result.status === 'ok' ? 'ok' : 'error',
      db: 'ok',
      redis: 'ok',
    };

    if (result.status === 'error') {
      response.details = {};
      for (const [component, info] of Object.entries(result.details)) {
        if (info.status === 'down') {
          if (component === 'database') {
            response.db = 'error';
            response.details.db = {
              status: 'down',
              message: info['message'] || 'Database connection failed',
            };
          }
          if (component === 'redis') {
            response.redis = 'error';
            response.details.redis = {
              status: 'down',
              message: info['message'] || 'Redis connection failed',
            };
          }
        }
      }
    }

    return response;
  }
}
