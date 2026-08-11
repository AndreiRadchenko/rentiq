export interface CreateStationRequest {
  name: string;
  address?: string | null;
  haUrlOrIp: string;
  haToken: string;
  haWebhookSecret: string;
  autoLockDelaySec?: number;
  sortOrder?: number;
}

export interface UpdateStationRequest {
  name?: string;
  address?: string | null;
  isActive?: boolean;
  isVisibleToClients?: boolean;
  workingStatus?: 'WORKING' | 'MAINTENANCE';
  autoLockDelaySec?: number;
  haUrlOrIp?: string;
  haToken?: string;
  haWebhookSecret?: string;
  sortOrder?: number;
}

export interface StationResponse {
  id: string;
  name: string;
  address: string | null;
  workingStatus: string;
  isActive: boolean;
  adminIntendedIsActive: boolean;
  isVisibleToClients: boolean;
  sortOrder: number;
  haUrlOrIp: string;
  haToken: string;
  haWebhookSecret: string;
  autoLockDelaySec: number;
  healthStatus: string;
  lastHealthCheckAt: string | null;
  createdAt: string;
}

export interface RenterStationResponse {
  id: string;
  name: string;
  address: string | null;
  availableLockersCount: number;
  sortOrder: number;
  displayStatus: 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE';
}

export interface StationHealthResponse {
  id: string;
  healthStatus: string;
  lastHealthCheckAt: string | null;
  adminIntendedIsActive: boolean;
  isActiveForBookability: boolean;
}

export interface RenterLockerResponse {
  id: string;
  name: string;
  kitType: string;
  tariffs: { tariffId: string; durationMinutes: number; priceMinor: number; currency: string }[];
}
