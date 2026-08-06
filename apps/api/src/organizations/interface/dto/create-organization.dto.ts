export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  defaultLocale?: string;
  supportedLocales?: string[];
  businessName?: string;
  telegramBotSecret: string;
}

export interface OrganizationBrandingResponse {
  businessName: string;
  supportedLocales: string[];
  defaultLocale: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface OrganizationSummaryResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
  branding: OrganizationBrandingResponse;
}

export interface BootstrapAdminResponse {
  id: string;
  orgId: string | null;
  role: string;
  email: string;
}

export interface CreateOrganizationResponse {
  organization: OrganizationSummaryResponse;
  bootstrapAdmin: BootstrapAdminResponse;
}
