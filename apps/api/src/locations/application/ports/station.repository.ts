import { Station } from '../../domain/station.aggregate';

export const STATION_REPOSITORY = 'STATION_REPOSITORY';

export interface StationRepository {
  save(station: Station): Promise<void>;
  findById(orgId: string, id: string): Promise<Station | null>;
  findByIdUnscoped(id: string): Promise<Station | null>;
  listAdmin(orgId: string): Promise<Station[]>;
  listBookable(orgId: string): Promise<Station[]>;
}
