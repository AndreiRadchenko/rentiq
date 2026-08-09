export interface RegisterRenterRequest {
  name: string;
  phone: string;
  consentGiven: boolean;
  consentVersion: string;
  locale?: string;
  telegramId?: number;
}

export interface RenterProfileResponse {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  consentGivenAt: string;
  consentVersion: string;
  locale: string;
  status: string;
}

export interface RegisterRenterResponse {
  renter: RenterProfileResponse;
  accessToken: string;
  expiresIn: number;
  alreadyRegistered: boolean;
}
