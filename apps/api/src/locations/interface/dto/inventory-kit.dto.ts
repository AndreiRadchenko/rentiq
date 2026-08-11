export interface CreateKitRequest {
  stationId: string;
  name: string;
  kitType: string;
}

export interface UpdateKitRequest {
  name?: string;
  kitType?: string;
  lockerId?: string | null;
}

export interface KitResponse {
  id: string;
  stationId: string;
  lockerId: string | null;
  name: string;
  kitType: string;
  createdAt: string;
}
