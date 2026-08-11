import { Tariff } from '../../domain/tariff.aggregate';
import type { DayType } from '../../domain/day-type';

export const TARIFF_REPOSITORY = 'TARIFF_REPOSITORY';

export interface TariffRepository {
  save(tariff: Tariff): Promise<void>;
  findById(orgId: string, id: string): Promise<Tariff | null>;
  list(orgId: string, filter?: { kitType?: string; dayType?: DayType }): Promise<Tariff[]>;
  findForQuote(
    orgId: string,
    kitType: string,
    dayType: DayType,
    durationMinutes: number,
  ): Promise<Tariff | null>;
  listForKitType(orgId: string, kitType: string, dayType: DayType): Promise<Tariff[]>;
  findExistingByKey(
    orgId: string,
    kitType: string,
    dayType: DayType,
    durationMinutes: number,
  ): Promise<Tariff | null>;
}
