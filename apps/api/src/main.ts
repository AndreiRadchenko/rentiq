import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    const { execSync } = await import('child_process');
    try {
      execSync('npm run db:migrate', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Migration failed. Refusing to start in production with pending migrations.');
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
