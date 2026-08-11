import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection URL' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection URL' }),
  MINIO_ENDPOINT: z.string().min(1, { message: 'MINIO_ENDPOINT is required' }),
  MINIO_ACCESS_KEY: z.string().min(1, { message: 'MINIO_ACCESS_KEY is required' }),
  MINIO_SECRET_KEY: z.string().min(1, { message: 'MINIO_SECRET_KEY is required' }),
  MINIO_BUCKET: z.string().min(1, { message: 'MINIO_BUCKET is required' }),
  TELEGRAM_BOT_TOKEN: z.string().min(1, { message: 'TELEGRAM_BOT_TOKEN is required' }),
  JWT_PRIVATE_KEY: z.string().min(1, { message: 'JWT_PRIVATE_KEY is required (RS256 PEM private key)' }),
  JWT_PUBLIC_KEY: z.string().min(1, { message: 'JWT_PUBLIC_KEY is required (RS256 PEM public key)' }),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  ADMIN_EMAIL: z.string().email().default('admin@rentiq.dev'),
  ADMIN_PASSWORD: z.string().min(8).default('rentiq-admin-dev'),
  RENTIQ_DEV_TELEGRAM_SECRET: z.string().min(8).default('rentiq-dev-bot-secret'),
  MASTER_KEY: z
    .string()
    .min(32, { message: 'MASTER_KEY must be at least 32 bytes (hex 64 chars or base64 44 chars) for AES-256-GCM encryption of per-tenant secrets' }),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n');

    console.error(`\n❌ Environment validation failed:\n${formatted}\n`);
    process.exit(1);
  }

  return parsed.data;
}
