import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from './infrastructure/config/config.module';
import { DatabaseModule } from './infrastructure/database/connection';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { SharedI18nModule } from './infrastructure/i18n/i18n.module';
import { JwtModule } from './infrastructure/jwt/jwt.module';
import { PasswordHasher } from './infrastructure/crypto/password-hasher';
import { CryptoService } from './infrastructure/crypto/crypto.service';
import { DrizzleHealthIndicator } from './infrastructure/health/drizzle-health.indicator';
import { RedisHealthIndicator } from './infrastructure/health/redis-health.indicator';
import { HealthController } from './interface/health/health.controller';
import { JwtAuthMiddleware } from './interface/middleware/jwt-auth.middleware';
import { I18nBridgeMiddleware } from './infrastructure/i18n/i18n-bridge.middleware';
import { ApiErrorFilter } from './interface/filters/api-error.filter';
import { AuditableLogger } from './infrastructure/audit/auditable-action.decorator';
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
    CryptoService,
    I18nBridgeMiddleware,
    AuditableLogger,
  ],
  exports: [
    ConfigModule,
    DatabaseModule,
    EventBusModule,
    SharedI18nModule,
    JwtModule,
    PasswordHasher,
    CryptoService,
    AuditableLogger,
  ],
})
export class SharedKernelModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtAuthMiddleware, I18nBridgeMiddleware)
      .forRoutes('*');
  }
}
