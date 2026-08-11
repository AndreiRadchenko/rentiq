export interface UpdatePaymentCredsRequest {
  mode?: 'test' | 'live';
  testToken?: string;
  liveToken?: string;
  redirectUrl?: string;
  enabled?: boolean;
}

export interface UpdatePaymentDetailsRequest {
  payerName?: string;
  iban?: string;
  edrpou?: string;
  purpose?: string;
}

export interface UpdateCheckboxConfigRequest {
  mode?: 'test' | 'live';
  licenseKey?: string;
  testToken?: string;
  liveToken?: string;
  enabled?: boolean;
}

export interface PaymentCredsResponse {
  mode: string;
  testToken: string;
  liveToken: string;
  redirectUrl: string;
  enabled: boolean;
}

export interface PaymentDetailsResponse {
  payerName: string;
  iban: string;
  edrpou: string;
  purpose: string;
}

export interface CheckboxConfigResponse {
  mode: string;
  licenseKey: string;
  testToken: string;
  liveToken: string;
  enabled: boolean;
}

export interface OrganizationCredentialsResponse {
  id: string;
  paymentCreds: PaymentCredsResponse;
  paymentDetails: PaymentDetailsResponse;
  checkboxConfig: CheckboxConfigResponse | null;
}
