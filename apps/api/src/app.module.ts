import { Module } from '@nestjs/common';
import { SharedKernelModule } from './shared-kernel/shared-kernel.module';

@Module({
  imports: [SharedKernelModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
