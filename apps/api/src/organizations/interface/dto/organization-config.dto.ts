import { OrganizationBrandingResponse } from './create-organization.dto';

export interface UpdateBrandingRequest {
  logoUrl?: string | null;
  primaryColor?: string | null;
  businessName?: string;
  supportedLocales?: string[];
  defaultLocale?: string;
}

export interface MaintenanceWindowRequest {
  startTime: string;
  endTime: string;
  timezone?: string;
}

export interface MaintenanceWindowResponse {
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface OrganizationConfigResponse {
  id: string;
  status: string;
  branding?: OrganizationBrandingResponse;
  maintenanceWindow?: MaintenanceWindowResponse | null;
}
