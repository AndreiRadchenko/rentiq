import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '../../../src/shared-kernel/interface/health/health.controller';
import { DrizzleHealthIndicator } from '../../../src/shared-kernel/infrastructure/health/drizzle-health.indicator';
import { RedisHealthIndicator } from '../../../src/shared-kernel/infrastructure/health/redis-health.indicator';

describe('Health Check', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        {
          provide: DrizzleHealthIndicator,
          useValue: { isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up' } }) },
        },
        {
          provide: RedisHealthIndicator,
          useValue: { isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health should return 200', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body.status).toBe('ok');
      });
  });
});
