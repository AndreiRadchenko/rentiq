import { Locker } from '../../domain/locker.aggregate';

export const LOCKER_REPOSITORY = 'LOCKER_REPOSITORY';

export interface LockerRepository {
  save(locker: Locker): Promise<void>;
  findById(orgId: string, id: string): Promise<Locker | null>;
  findByDoorSensorEntityId(stationId: string, sensorEntityId: string): Promise<Locker | null>;
  listForStation(orgId: string, stationId: string): Promise<Locker[]>;
  listAvailableForStation(orgId: string, stationId: string): Promise<Locker[]>;
  reserveAtomic(orgId: string, lockerId: string, rentalId: string): Promise<boolean>;
  release(orgId: string, lockerId: string): Promise<boolean>;
}
