import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { RENTER_REPOSITORY, RenterRepository } from '../ports/renter.repository';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '../../../organizations/application/ports/organization.repository';
import { EVENT_BUS, EventBus } from '../../../shared-kernel/application/ports/event-bus';
import { JwtTokenService } from '../../../shared-kernel/infrastructure/jwt/jwt-token.service';
import { TenantContext } from '../../../shared-kernel/interface/middleware/tenant-context';
import { PhoneNumber } from '../../../shared-kernel/domain/value-objects/phone-number';
import { EntityId } from '../../../shared-kernel/domain/value-objects/entity-id';
import { ApiException } from '../../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../../shared-kernel/interface/dto/api-error';
import { Renter } from '../../domain/renter';
import { ConsentStatementRegistry } from './consent-statement.registry';
import { RenterAnonymizer } from './renter-anonymizer';
import { validateLocaleAgainstOrg } from './locale.validation';
import { RenterRegistered } from '../../infrastructure/events/renter-registered.event';

export const DEFAULT_ORG_SLUG = 'rentiq';

export interface RegisterRenterInput {
  name: string;
  phone: string;
  consentGiven: boolean;
  consentVersion: string;
  locale: string;
  telegramId?: number;
}

export interface RegisterRenterResult {
  renter: Renter;
  accessToken: string;
  expiresIn: number;
  alreadyRegistered: boolean;
}

export interface RenterProfile {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  consentGivenAt: string;
  consentVersion: string;
  locale: string;
  status: string;
}

@Injectable()
export class RenterService {
  constructor(
    @Inject(RENTER_REPOSITORY) private readonly renterRepository: RenterRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly jwtTokenService: JwtTokenService,
    private readonly consentStatementRegistry: ConsentStatementRegistry,
    private readonly renterAnonymizer: RenterAnonymizer,
  ) {}

  async register(input: RegisterRenterInput): Promise<RegisterRenterResult> {
    if (input.consentGiven !== true) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.CONSENT_REQUIRED, 'renters.consent_required');
    }

    const name = (input.name ?? '').trim();
    if (!name || name.length > 255) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'renters.validation_error');
    }

    let phone: PhoneNumber;
    try {
      phone = PhoneNumber.from(input.phone);
    } catch {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'renters.validation_error');
    }

    const consentStatement = this.consentStatementRegistry.findByVersion(input.consentVersion);
    if (!consentStatement) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'renters.validation_error');
    }
    if (!this.consentStatementRegistry.isCurrent(input.consentVersion)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.RE_CONSENT_REQUIRED, 'renters.re_consent_required');
    }

    const orgId = await this.resolveOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'renters.validation_error');
    }

    const locale = (input.locale ?? 'uk').toLowerCase();
    const organization = await this.organizationRepository.findById(orgId);
    const supportedLocales = organization
      ? organization.currentState.branding.supportedLocales
      : ['uk', 'en'];
    try {
      validateLocaleAgainstOrg(locale, supportedLocales);
    } catch {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'renters.validation_error');
    }

    const existing = await this.renterRepository.findByOrgAndPhone(orgId, phone.toString());
    if (existing) {
      if (existing.status === 'DISABLED') {
        throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.RENTER_DISABLED, 'renters.renter_disabled');
      }
      const accessToken = this.jwtTokenService.signAccessToken({
        sub: existing.id,
        orgId,
        locale: existing.currentState.locale,
        type: 'renter',
      });
      return { renter: existing, accessToken, expiresIn: this.jwtTokenService.accessTtlSeconds, alreadyRegistered: true };
    }

    const renter = Renter.register({
      id: EntityId.generate().toString(),
      orgId,
      telegramId: input.telegramId,
      phone: phone.toString(),
      name,
      consentGivenAt: new Date(),
      consentVersion: input.consentVersion,
      locale,
    });

    await this.renterRepository.save(renter);
    await this.eventBus.publish(
      new RenterRegistered(renter.id, orgId, locale),
    );

    const accessToken = this.jwtTokenService.signAccessToken({
      sub: renter.id,
      orgId,
      locale,
      type: 'renter',
    });

    return { renter, accessToken, expiresIn: this.jwtTokenService.accessTtlSeconds, alreadyRegistered: false };
  }

  async getProfile(orgId: string, renterId: string): Promise<RenterProfile> {
    const renter = await this.renterRepository.findById(orgId, renterId);
    if (!renter) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'renters.renter_not_registered');
    }
    return this.toProfile(renter);
  }

  async changeLocale(orgId: string, renterId: string, locale: string): Promise<RenterProfile> {
    const normalized = locale.toLowerCase();
    const organization = await this.organizationRepository.findById(orgId);
    const supportedLocales = organization
      ? organization.currentState.branding.supportedLocales
      : ['uk', 'en'];
    try {
      validateLocaleAgainstOrg(normalized, supportedLocales);
    } catch {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'renters.validation_error');
    }

    const renter = await this.renterRepository.findById(orgId, renterId);
    if (!renter) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'renters.renter_not_registered');
    }
    renter.changeLocale(normalized);
    await this.renterRepository.save(renter);
    return this.toProfile(renter);
  }

  async reConsent(orgId: string, renterId: string, consentVersion: string): Promise<RenterProfile> {
    const statement = this.consentStatementRegistry.findByVersion(consentVersion);
    if (!statement) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'renters.validation_error');
    }
    if (!this.consentStatementRegistry.isCurrent(consentVersion)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.RE_CONSENT_REQUIRED, 'renters.re_consent_required');
    }

    const renter = await this.renterRepository.findById(orgId, renterId);
    if (!renter) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'renters.renter_not_registered');
    }
    renter.reConsent(consentVersion);
    await this.renterRepository.save(renter);
    return this.toProfile(renter);
  }

  async requestDeletion(orgId: string, renterId: string): Promise<void> {
    const renter = await this.renterRepository.findById(orgId, renterId);
    if (!renter) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'renters.renter_not_registered');
    }
    this.assertNoOpenObligations(renter);
    renter.disableByDeletionRequest();
    await this.renterRepository.save(renter);
  }

  async disableByAdmin(orgId: string, renterId: string): Promise<RenterProfile> {
    const renter = await this.renterRepository.findById(orgId, renterId);
    if (!renter) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'renters.renter_not_registered');
    }
    renter.disableByAdmin();
    await this.renterRepository.save(renter);
    return this.toProfile(renter);
  }

  async reEnableByAdmin(orgId: string, renterId: string): Promise<RenterProfile> {
    const renter = await this.renterRepository.findById(orgId, renterId);
    if (!renter) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'renters.renter_not_registered');
    }
    if (renter.disableReason === 'DELETION_REQUEST') {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.RENTER_DISABLED, 'renters.renter_disabled');
    }
    renter.reEnable();
    await this.renterRepository.save(renter);
    return this.toProfile(renter);
  }

  async runAnonymizationIfEligible(renterId: string, orgId: string): Promise<boolean> {
    const renter = await this.renterRepository.findById(orgId, renterId);
    if (!renter) {
      return false;
    }
    const state = renter.currentState;
    return this.renterAnonymizer.anonymizeIfEligible(
      {
        id: state.id,
        orgId: state.orgId,
        status: state.status,
        consentGivenAt: state.consentGivenAt,
        name: state.name,
        phone: state.phone,
      },
      new Date(),
    );
  }

  requiresReConsent(renter: Renter): boolean {
    return this.consentStatementRegistry.requiresReConsent(renter.consentVersion);
  }

  private async resolveOrgId(): Promise<string | null> {
    const tenantOrgId = TenantContext.getOrgId();
    if (tenantOrgId) {
      return tenantOrgId;
    }
    const defaultOrg = await this.organizationRepository.findBySlug(DEFAULT_ORG_SLUG);
    return defaultOrg ? defaultOrg.id : null;
  }

  private assertNoOpenObligations(_renter: Renter): void {}

  toProfile(renter: Renter): RenterProfile {
    const state = renter.currentState;
    return {
      id: state.id,
      orgId: state.orgId,
      name: state.name,
      phone: state.phone,
      consentGivenAt: state.consentGivenAt.toISOString(),
      consentVersion: state.consentVersion,
      locale: state.locale,
      status: state.status,
    };
  }
}
