export interface CreateTariffRequest {
  kitType: string;
  dayType: 'WEEKDAY' | 'WEEKEND';
  durationMinutes: number;
  priceMinor: number;
  currency?: string;
}

export interface UpdateTariffRequest {
  priceMinor?: number;
  currency?: string;
}

export interface TariffResponse {
  id: string;
  kitType: string;
  dayType: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  deletedAt: string | null;
  createdAt: string;
}

export interface TariffQuoteResponse {
  priceMinor: number;
  currency: string;
  tariffId: string;
}
