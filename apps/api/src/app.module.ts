import { Module } from '@nestjs/common';
import { SharedKernelModule } from './shared-kernel/shared-kernel.module';
import { IamModule } from './iam/iam.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { LocationsModule } from './locations/locations.module';
import { PricingModule } from './pricing/pricing.module';

@Module({
  imports: [SharedKernelModule, IamModule, OrganizationsModule, PricingModule, LocationsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
