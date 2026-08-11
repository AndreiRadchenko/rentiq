import { Module } from '@nestjs/common';
import { TARIFF_REPOSITORY } from './application/ports/tariff.repository';
import { DrizzleTariffRepository } from './infrastructure/drizzle/tariffs.repository';
import { DayTypeResolver } from './infrastructure/day-type-resolver';
import { TariffService } from './application/tariff.service';
import { PricingService } from './application/pricing.service';
import { TariffsController } from './interface/tariffs.controller';

@Module({
  controllers: [TariffsController],
  providers: [
    TariffService,
    PricingService,
    DayTypeResolver,
    { provide: TARIFF_REPOSITORY, useClass: DrizzleTariffRepository },
  ],
  exports: [PricingService, TariffService, DayTypeResolver],
})
export class PricingModule {}
