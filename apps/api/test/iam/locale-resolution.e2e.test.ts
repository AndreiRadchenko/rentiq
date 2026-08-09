import { Controller, Get, INestApplication, Module, MiddlewareConsumer, NestModule, UseGuards } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { generateKeyPairSync } from 'crypto';
import request from 'supertest';
import { ApiErrorFilter } from '../../src/shared-kernel/interface/filters/api-error.filter';
import { JwtAuthGuard } from '../../src/shared-kernel/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/shared-kernel/interface/guards/roles.guard';
import { Roles } from '../../src/shared-kernel/interface/guards/roles.decorator';
import { TenantMiddleware } from '../../src/shared-kernel/interface/middleware/tenant.middleware';
import { JwtAuthMiddleware } from '../../src/shared-kernel/interface/middleware/jwt-auth.middleware';
import { I18nBridgeMiddleware } from '../../src/shared-kernel/infrastructure/i18n/i18n-bridge.middleware';
import { SharedI18nModule } from '../../src/shared-kernel/infrastructure/i18n/i18n.module';
import { JwtTokenService } from '../../src/shared-kernel/infrastructure/jwt/jwt-token.service';

@Controller('locale-test')
@UseGuards(JwtAuthGuard, RolesGuard)
class LocaleTestController {
  @Get('admin-only')
  @Roles('SUPER_ADMIN')
  adminOnly(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({
  imports: [SharedI18nModule],
  controllers: [LocaleTestController],
  providers: [
    JwtTokenService,
    { provide: 'ENV_CONFIG', useValue: {} },
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
class LocaleTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware, JwtAuthMiddleware, I18nBridgeMiddleware).forRoutes('*');
  }
}

describe('ADR-006 locale resolution precedence', () => {
  let app: INestApplication;
  let jwtService: JwtTokenService;

  beforeAll(async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [LocaleTestModule],
    })
      .overrideProvider('ENV_CONFIG')
      .useValue({
        JWT_PRIVATE_KEY: privateKey.export({ type: 'pkcs1', format: 'pem' }),
        JWT_PUBLIC_KEY: publicKey.export({ type: 'pkcs1', format: 'pem' }),
        JWT_ACCESS_TTL_SECONDS: 900,
        JWT_REFRESH_TTL_SECONDS: 604800,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    jwtService = moduleFixture.get(JwtTokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  function orgAdminToken(locale: string): string {
    return jwtService.signAccessToken({
      sub: 'admin-1',
      orgId: 'org-1',
      role: 'ORG_ADMIN',
      locale,
      type: 'admin',
    });
  }

  it('JWT locale claim wins over Accept-Language', () => {
    const token = orgAdminToken('uk');
    return request(app.getHttpServer())
      .get('/api/locale-test/admin-only')
      .set('Accept-Language', 'en')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.code).toBe('FORBIDDEN');
        expect(res.body.message).toBe('Доступ заборонено');
      });
  });

  it('JWT locale claim en wins over Accept-Language uk', () => {
    const token = orgAdminToken('en');
    return request(app.getHttpServer())
      .get('/api/locale-test/admin-only')
      .set('Accept-Language', 'uk')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.code).toBe('FORBIDDEN');
        expect(res.body.message).toBe('Access forbidden');
      });
  });

  it('falls back to Accept-Language when no JWT locale is present', () => {
    return request(app.getHttpServer())
      .get('/api/locale-test/admin-only')
      .set('Accept-Language', 'en')
      .expect(401)
      .expect((res) => {
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
        expect(res.body.message).toBe('Authentication required');
      });
  });

  it('falls back to the default locale (uk) when nothing resolves', () => {
    return request(app.getHttpServer())
      .get('/api/locale-test/admin-only')
      .expect(401)
      .expect((res) => {
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
        expect(res.body.message).toBe('Необхідна авторизація');
      });
  });
});
