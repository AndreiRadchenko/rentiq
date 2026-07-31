import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

@Global()
@Module({
  providers: [
    {
      provide: 'DRIZZLE_DB',
      useFactory: async (config: { DATABASE_URL: string }) => {
        const pool = new Pool({
          connectionString: config.DATABASE_URL,
        });
        return drizzle(pool);
      },
      inject: ['ENV_CONFIG'],
    },
  ],
  exports: ['DRIZZLE_DB'],
})
export class DatabaseModule {}
