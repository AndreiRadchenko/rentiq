import { z } from 'zod';

export const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection URL' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection URL' }),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
