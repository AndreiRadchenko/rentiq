export interface TelegramExchangeRequest {
  telegramId: number;
}

export interface RenterIdentityResponse {
  id: string;
  orgId: string;
  name: string;
  locale: string;
  status: string;
}

export interface TelegramExchangeResponse {
  accessToken: string;
  expiresIn: number;
  renter: RenterIdentityResponse;
}
