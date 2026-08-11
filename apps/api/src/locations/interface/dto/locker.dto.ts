export interface CreateLockerRequest {
  stationId: string;
  name: string;
  haLockEntityId: string;
  haDoorSensorEntityId: string;
}

export interface UpdateLockerRequest {
  name?: string;
  haLockEntityId?: string;
  haDoorSensorEntityId?: string;
  inventoryKitId?: string | null;
  status?: 'AVAILABLE' | 'MAINTENANCE';
}

export interface LockerResponse {
  id: string;
  stationId: string;
  name: string;
  status: string;
  haLockEntityId: string;
  haDoorSensorEntityId: string;
  currentRentalId: string | null;
  inventoryKitId: string | null;
  misconfigured?: boolean;
  createdAt: string;
}
