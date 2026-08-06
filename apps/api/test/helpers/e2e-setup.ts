import { generateKeyPairSync, randomUUID } from 'crypto';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { adminAccounts } from '../../src/iam/infrastructure/database/admin-accounts.schema';
import { organizations } from '../../src/organizations/infrastructure/database/organizations.schema';

export const E2E_ADMIN_EMAIL = 'super@rentiq.dev';
export const E2E_ADMIN_PASSWORD = 'change-me';
export const E2E_BOT_SECRET = 'rentiq-dev-bot-secret';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://rentiq:test_password@localhost:5432/rentiq_test';

export function ensureE2EEnv(): void {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const required: Record<string, string> = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    MINIO_ENDPOINT: 'localhost',
    MINIO_ACCESS_KEY: 'minio',
    MINIO_SECRET_KEY: 'minio-secret',
    MINIO_BUCKET: 'rentiq',
    TELEGRAM_BOT_TOKEN: '123456:TEST',
    JWT_PRIVATE_KEY: privateKey.export({ type: 'pkcs1', format: 'pem' }),
    JWT_PUBLIC_KEY: publicKey.export({ type: 'pkcs1', format: 'pem' }),
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_REFRESH_TTL_SECONDS: '604800',
    ADMIN_EMAIL: E2E_ADMIN_EMAIL,
    ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
    RENTIQ_DEV_TELEGRAM_SECRET: E2E_BOT_SECRET,
  };
  for (const [key, value] of Object.entries(required)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export async function prepareDatabase(): Promise<void> {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const db = drizzle(pool);

  await migrate(db, {
    migrationsFolder: path.join(
      __dirname,
      '..',
      '..',
      'src',
      'infra',
      'database',
      'migrations',
    ),
  });

  const existingOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, 'rentiq'))
    .limit(1);
  if (existingOrg.length === 0) {
    const botSecretHash = await bcrypt.hash(E2E_BOT_SECRET, 4);
    await db.insert(organizations).values({
      id: randomUUID(),
      name: 'rentiq-dev',
      slug: 'rentiq',
      status: 'ACTIVE',
      branding: {
        businessName: 'rentiq-dev',
        logoUrl: null,
        primaryColor: null,
        supportedLocales: ['uk', 'en'],
        defaultLocale: 'uk',
      },
      paymentCredsRef: { gateway: 'monobank', secretRef: '', enabled: false },
      telegramConfig: { botSecretHash, botUsername: 'rentiq_dev_bot' },
      maintenanceWindow: null,
      checkboxConfig: { cashierProfileId: null, enabled: false },
    });
  }

  const existingAdmin = await db
    .select()
    .from(adminAccounts)
    .where(eq(adminAccounts.email, E2E_ADMIN_EMAIL))
    .limit(1);
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash(E2E_ADMIN_PASSWORD, 4);
    await db.insert(adminAccounts).values({
      id: randomUUID(),
      orgId: null,
      email: E2E_ADMIN_EMAIL,
      passwordHash,
      role: 'SUPER_ADMIN',
      assignedStationIds: [],
      locale: 'uk',
      status: 'ACTIVE',
    });
  }

  await pool.end();
}

export interface TestApp {
  app: INestApplication;
  moduleFixture: TestingModule;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return { app, moduleFixture };
}
