import { Module, Global } from '@nestjs/common';
import { validateEnv } from './env';

@Global()
@Module({
  providers: [
    {
      provide: 'ENV_CONFIG',
      useFactory: () => {
        return validateEnv();
      },
    },
  ],
  exports: ['ENV_CONFIG'],
})
export class ConfigModule {}
