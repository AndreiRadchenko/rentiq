import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from './infrastructure/config/config.module';
import { DatabaseModule } from './infrastructure/database/connection';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { SharedI18nModule } from './infrastructure/i18n/i18n.module';
import { JwtModule } from './infrastructure/jwt/jwt.module';
import { PasswordHasher } from './infrastructure/crypto/password-hasher';
import { DrizzleHealthIndicator } from './infrastructure/health/drizzle-health.indicator';
import { RedisHealthIndicator } from './infrastructure/health/redis-health.indicator';
import { HealthController } from './interface/health/health.controller';
import { TenantMiddleware } from './interface/middleware/tenant.middleware';
import { JwtAuthMiddleware } from './interface/middleware/jwt-auth.middleware';
import { I18nBridgeMiddleware } from './infrastructure/i18n/i18n-bridge.middleware';
import { ApiErrorFilter } from './interface/filters/api-error.filter';
import { APP_FILTER } from '@nestjs/core';

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventBusModule,
    SharedI18nModule,
    JwtModule,
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiErrorFilter,
    },
    DrizzleHealthIndicator,
    RedisHealthIndicator,
    PasswordHasher,
    I18nBridgeMiddleware,
  ],
  exports: [
    ConfigModule,
    DatabaseModule,
    EventBusModule,
    SharedI18nModule,
    JwtModule,
    PasswordHasher,
  ],
})
export class SharedKernelModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware, JwtAuthMiddleware, I18nBridgeMiddleware)
      .forRoutes('*');
  }
}
