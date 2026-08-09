import * as path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for migrating');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  await pool.end();
  console.log('[migrate] Done');
}

main().catch((error) => {
  console.error('[migrate] Failed:', error);
  process.exit(1);
});
