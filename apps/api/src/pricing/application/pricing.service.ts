import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { ok, err, Result } from '../../shared-kernel/domain/result';
import { Money } from '../../shared-kernel/domain/value-objects/money';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';
import { TARIFF_REPOSITORY, TariffRepository } from './ports/tariff.repository';
import { DayTypeResolver } from '../infrastructure/day-type-resolver';
import type { DayType } from '../domain/day-type';

export type QuoteError = 'TARIFF_NOT_FOUND';

@Injectable()
export class PricingService {
  private readonly dayTypeResolver = new DayTypeResolver();

  constructor(@Inject(TARIFF_REPOSITORY) private readonly tariffs: TariffRepository) {}

  async quote(
    orgId: string,
    kitType: string,
    dayType: DayType,
    durationMinutes: number,
  ): Promise<Result<{ money: Money; tariffId: string }, QuoteError>> {
    const tariff = await this.tariffs.findForQuote(orgId, kitType, dayType, durationMinutes);
    if (!tariff) {
      return err('TARIFF_NOT_FOUND' as const);
    }
    return ok({ money: tariff.lockPrice(), tariffId: tariff.id });
  }

  async quoteOrThrow(orgId: string, kitType: string, dayType: DayType, durationMinutes: number): Promise<{ money: Money; tariffId: string }> {
    const result = await this.quote(orgId, kitType, dayType, durationMinutes);
    if (result.isErr()) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TARIFF_NOT_FOUND, 'pricing.tariff_not_found');
    }
    return result.unwrap();
  }

  async listTariffsForKitType(
    orgId: string,
    kitType: string,
    dayType: DayType,
  ): Promise<{ tariffId: string; durationMinutes: number; priceMinor: number; currency: string }[]> {
    const tariffs = await this.tariffs.listForKitType(orgId, kitType, dayType);
    return tariffs.map((t) => {
      const s = t.currentState;
      return { tariffId: t.id, durationMinutes: s.durationMinutes, priceMinor: s.priceMinor, currency: s.currency };
    });
  }

  resolveDayType(date: Date, orgTimezone = 'Europe/Kyiv'): DayType {
    return this.dayTypeResolver.resolve(date, orgTimezone);
  }

  requireOrgId(): string {
    const orgId = TenantContext.getOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_NOT_FOUND, 'auth.tenant_not_found');
    }
    return orgId;
  }
}
