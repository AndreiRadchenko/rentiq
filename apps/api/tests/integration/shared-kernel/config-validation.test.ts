import { validateEnv } from '../../../src/shared-kernel/infrastructure/config/env';

describe('Config Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should fail with missing DATABASE_URL', () => {
    delete process.env.DATABASE_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    validateEnv();

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalled();

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should fail with invalid DATABASE_URL', () => {
    process.env.DATABASE_URL = 'not-a-valid-url';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    validateEnv();

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalled();

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should succeed with valid config', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';

    const result = validateEnv();
    expect(result).toBeDefined();
    expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/test');
  });
});
