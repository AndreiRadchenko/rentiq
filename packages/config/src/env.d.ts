import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
    MINIO_ENDPOINT: z.ZodString;
    MINIO_ACCESS_KEY: z.ZodString;
    MINIO_SECRET_KEY: z.ZodString;
    MINIO_BUCKET: z.ZodString;
    TELEGRAM_BOT_TOKEN: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
    LOG_LEVEL: "debug" | "info" | "warn" | "error";
    DATABASE_URL: string;
    REDIS_URL: string;
    MINIO_ENDPOINT: string;
    MINIO_ACCESS_KEY: string;
    MINIO_SECRET_KEY: string;
    MINIO_BUCKET: string;
    TELEGRAM_BOT_TOKEN: string;
}, {
    DATABASE_URL: string;
    REDIS_URL: string;
    MINIO_ENDPOINT: string;
    MINIO_ACCESS_KEY: string;
    MINIO_SECRET_KEY: string;
    MINIO_BUCKET: string;
    TELEGRAM_BOT_TOKEN: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    LOG_LEVEL?: "debug" | "info" | "warn" | "error" | undefined;
}>;
export type Env = z.infer<typeof envSchema>;
export declare function validateEnv(): Env;
export {};
//# sourceMappingURL=env.d.ts.map