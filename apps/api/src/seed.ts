import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { organizations } from './organizations/infrastructure/database/organizations.schema';
import { adminAccounts } from './iam/infrastructure/database/admin-accounts.schema';

const BCRYPT_ROUNDS = 12;

async function main() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for seeding');
  }

  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@rentiq.dev';
  const adminPassword = process.env['ADMIN_PASSWORD'] ?? 'rentiq-admin-dev';
  const botSecret = process.env['RENTIQ_DEV_TELEGRAM_SECRET'] ?? 'rentiq-dev-bot-secret';

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const existingOrg = await db.select().from(organizations).where(eq(organizations.slug, 'rentiq')).limit(1);
  let orgId: string;
  if (existingOrg.length > 0) {
    orgId = existingOrg[0].id;
    console.log('[seed] Organization "rentiq-dev" (slug=rentiq) already exists — skipping');
  } else {
    orgId = randomUUID();
    const botSecretHash = await bcrypt.hash(botSecret, BCRYPT_ROUNDS);
    await db.insert(organizations).values({
      id: orgId,
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
    console.log('[seed] Organization "rentiq-dev" (slug=rentiq) created');
  }

  const existingAdmin = await db
    .select()
    .from(adminAccounts)
    .where(eq(adminAccounts.email, adminEmail))
    .limit(1);
  if (existingAdmin.length > 0) {
    console.log(`[seed] SUPER_ADMIN ${adminEmail} already exists — skipping`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    await db.insert(adminAccounts).values({
      id: randomUUID(),
      orgId: null,
      email: adminEmail,
      passwordHash,
      role: 'SUPER_ADMIN',
      assignedStationIds: [],
      locale: 'uk',
      status: 'ACTIVE',
    });
    console.log(`[seed] SUPER_ADMIN ${adminEmail} created`);
  }

  await pool.end();
  console.log('[seed] Done');
}

main().catch((error) => {
  console.error('[seed] Failed:', error);
  process.exit(1);
});
