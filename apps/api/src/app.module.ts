import { Module } from '@nestjs/common';
import { SharedKernelModule } from './shared-kernel/shared-kernel.module';
import { IamModule } from './iam/iam.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [SharedKernelModule, IamModule, OrganizationsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
