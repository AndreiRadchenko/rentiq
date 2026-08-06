import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from './ports/organization.repository';
import { AdminAccountService, AdminAccountSummary } from '../../iam/application/admin-account/admin-account.service';
import { EVENT_BUS, EventBus } from '../../shared-kernel/application/ports/event-bus';
import { PasswordHasher } from '../../shared-kernel/infrastructure/crypto/password-hasher';
import { EntityId } from '../../shared-kernel/domain/value-objects/entity-id';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { Organization, BrandingConfig, TelegramBotConfig, MaintenanceWindow } from '../domain/organization';
import { OrganizationCreated } from '../infrastructure/events/organization-created.event';
import { OrganizationSuspended } from '../infrastructure/events/organization-suspended.event';
import { OrganizationBrandingChanged } from '../infrastructure/events/organization-branding-changed.event';

export const DEFAULT_ORG_SLUG = 'rentiq';
const SUPPORTED_SYSTEM_LOCALES = ['uk', 'en'];

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  defaultLocale?: string;
  supportedLocales?: string[];
  businessName?: string;
  telegramBotSecret: string;
}

export interface CreateOrganizationResult {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    branding: {
      businessName: string;
      supportedLocales: string[];
      defaultLocale: string;
    };
  };
  bootstrapAdmin: AdminAccountSummary;
}

export interface UpdateBrandingInput {
  logoUrl?: string | null;
  primaryColor?: string | null;
  businessName?: string;
  supportedLocales?: string[];
  defaultLocale?: string;
}

export interface MaintenanceWindowInput {
  startTime: string;
  endTime: string;
  timezone?: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    private readonly adminAccountService: AdminAccountService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async create(input: CreateOrganizationInput): Promise<CreateOrganizationResult> {
    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,63}$/.test(slug)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }
    const name = input.name.trim();
    if (!name || name.length > 255) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }

    const existing = await this.organizationRepository.findBySlug(slug);
    if (existing) {
      throw new ApiException(HttpStatus.CONFLICT, ErrorCode.SLUG_TAKEN, 'organizations.slug_taken');
    }

    const branding = this.buildBranding({
      businessName: input.businessName ?? name,
      supportedLocales: input.supportedLocales,
      defaultLocale: input.defaultLocale,
    });

    const telegramConfig: TelegramBotConfig = {
      botSecretHash: await this.passwordHasher.hash(input.telegramBotSecret),
      botUsername: '',
    };

    const organization = Organization.create({
      id: EntityId.generate().toString(),
      name,
      slug,
      branding,
      paymentCredsRef: {
        gateway: '',
        secretRef: '',
        enabled: false,
      },
      telegramConfig,
      maintenanceWindow: null,
      checkboxConfig: null,
    });

    await this.organizationRepository.save(organization);

    const bootstrapAdmin = await this.adminAccountService.createAdmin({
      orgId: organization.id,
      email: input.adminEmail,
      password: input.adminPassword,
      role: 'ORG_ADMIN',
      locale: branding.defaultLocale,
    });

    await this.eventBus.publish(
      new OrganizationCreated(organization.id, organization.slug),
    );

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.currentState.status,
        branding: {
          businessName: branding.businessName,
          supportedLocales: branding.supportedLocales,
          defaultLocale: branding.defaultLocale,
        },
      },
      bootstrapAdmin,
    };
  }

  async updateBranding(orgId: string, input: UpdateBrandingInput): Promise<Organization> {
    const organization = await this.getActive(orgId);
    const current = organization.currentState.branding;
    const branding = this.buildBranding({
      businessName: input.businessName ?? current.businessName,
      supportedLocales: input.supportedLocales ?? current.supportedLocales,
      defaultLocale: input.defaultLocale ?? current.defaultLocale,
      logoUrl: input.logoUrl === undefined ? current.logoUrl : input.logoUrl,
      primaryColor: input.primaryColor === undefined ? current.primaryColor : input.primaryColor,
    });

    organization.updateBranding(branding);
    await this.organizationRepository.save(organization);
    await this.eventBus.publish(
      new OrganizationBrandingChanged(organization.id),
    );
    return organization;
  }

  async setMaintenanceWindow(orgId: string, input: MaintenanceWindowInput): Promise<Organization> {
    const organization = await this.getActive(orgId);
    const window = this.buildMaintenanceWindow(input);
    organization.setMaintenanceWindow(window);
    await this.organizationRepository.save(organization);
    return organization;
  }

  async suspend(orgId: string): Promise<Organization> {
    const organization = await this.organizationRepository.findById(orgId);
    if (!organization) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'organizations.org_not_found');
    }
    if (!organization.isSuspended) {
      organization.suspend();
      await this.organizationRepository.save(organization);
      await this.eventBus.publish(new OrganizationSuspended(organization.id));
    }
    return organization;
  }

  async getDefaultOrgId(): Promise<string | null> {
    const organization = await this.organizationRepository.findBySlug(DEFAULT_ORG_SLUG);
    return organization ? organization.id : null;
  }

  private async getActive(orgId: string): Promise<Organization> {
    const organization = await this.organizationRepository.findById(orgId);
    if (!organization) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'organizations.org_not_found');
    }
    if (organization.isSuspended) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.ORG_SUSPENDED, 'organizations.org_suspended');
    }
    return organization;
  }

  private buildBranding(input: {
    businessName: string;
    supportedLocales?: string[];
    defaultLocale?: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
  }): BrandingConfig {
    const businessName = (input.businessName ?? '').trim();
    if (!businessName || businessName.length > 255) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }

    const supportedLocales = input.supportedLocales ?? ['uk', 'en'];
    if (
      supportedLocales.length === 0 ||
      supportedLocales.some((locale) => !SUPPORTED_SYSTEM_LOCALES.includes(locale))
    ) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }

    const defaultLocale = input.defaultLocale ?? supportedLocales[0];
    if (!supportedLocales.includes(defaultLocale)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }

    if (input.primaryColor !== undefined && input.primaryColor !== null && !/^#[0-9a-fA-F]{6}$/.test(input.primaryColor)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }

    return {
      logoUrl: input.logoUrl ?? null,
      primaryColor: input.primaryColor ?? null,
      businessName,
      supportedLocales,
      defaultLocale,
    };
  }

  private buildMaintenanceWindow(input: MaintenanceWindowInput): MaintenanceWindow {
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(input.startTime) || !timeRegex.test(input.endTime)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }
    if (input.startTime >= input.endTime) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'organizations.validation_error');
    }
    return {
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone ?? 'Europe/Kyiv',
    };
  }
}
