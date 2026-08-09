import { Renter } from '../../domain/renter';

export const RENTER_REPOSITORY = 'RENTER_REPOSITORY';

export interface RenterRepository {
  findById(orgId: string, id: string): Promise<Renter | null>;
  findByOrgAndPhone(orgId: string, phone: string): Promise<Renter | null>;
  findByOrgAndTelegramId(orgId: string, telegramId: number): Promise<Renter | null>;
  save(renter: Renter): Promise<void>;
  anonymize(targetId: string, orgId: string, anonymousName: string, anonymousPhone: string): Promise<void>;
}
