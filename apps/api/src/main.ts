import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './shared-kernel/infrastructure/config/env';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(3000);
}
bootstrap();
