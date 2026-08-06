export interface BrandingConfig {
  logoUrl: string | null;
  primaryColor: string | null;
  businessName: string;
  supportedLocales: string[];
  defaultLocale: string;
}

export interface PaymentGatewayCredentialsRef {
  gateway: string;
  secretRef: string;
  enabled: boolean;
}

export interface TelegramBotConfig {
  botSecretHash: string;
  botUsername: string;
}

export interface MaintenanceWindow {
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface CheckboxConfig {
  cashierProfileId: string | null;
  enabled: boolean;
}

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';

export interface OrganizationState {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  branding: BrandingConfig;
  paymentCredsRef: PaymentGatewayCredentialsRef;
  telegramConfig: TelegramBotConfig;
  maintenanceWindow: MaintenanceWindow | null;
  checkboxConfig: CheckboxConfig | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CreateOrganizationInput {
  id: string;
  name: string;
  slug: string;
  branding: BrandingConfig;
  paymentCredsRef: PaymentGatewayCredentialsRef;
  telegramConfig: TelegramBotConfig;
  maintenanceWindow?: MaintenanceWindow | null;
  checkboxConfig?: CheckboxConfig | null;
}

export class Organization {
  private constructor(private readonly state: OrganizationState) {}

  static create(input: CreateOrganizationInput): Organization {
    return new Organization({
      id: input.id,
      name: input.name,
      slug: input.slug,
      status: 'ACTIVE',
      branding: input.branding,
      paymentCredsRef: input.paymentCredsRef,
      telegramConfig: input.telegramConfig,
      maintenanceWindow: input.maintenanceWindow ?? null,
      checkboxConfig: input.checkboxConfig ?? null,
      createdAt: new Date(),
      deletedAt: null,
    });
  }

  static reconstitute(state: OrganizationState): Organization {
    return new Organization({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  get slug(): string {
    return this.state.slug;
  }

  get currentState(): OrganizationState {
    return { ...this.state };
  }

  get isSuspended(): boolean {
    return this.state.status === 'SUSPENDED';
  }

  updateBranding(branding: BrandingConfig): void {
    this.state.branding = branding;
  }

  suspend(): void {
    this.state.status = 'SUSPENDED';
  }

  activate(): void {
    this.state.status = 'ACTIVE';
  }

  setMaintenanceWindow(window: MaintenanceWindow): void {
    this.state.maintenanceWindow = window;
  }
}
