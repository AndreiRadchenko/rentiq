import { defineConfig } from 'drizzle-kit';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for drizzle-kit');
}

export default defineConfig({
  schema: './src/**/schema.ts',
  out: './src/infra/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
});
