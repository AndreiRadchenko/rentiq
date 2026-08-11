import { Controller, Post, Patch, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared-kernel/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared-kernel/interface/guards/roles.guard';
import { Roles } from '../../shared-kernel/interface/guards/roles.decorator';
import { AuthenticatedRequest } from '../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { CryptoService } from '../../shared-kernel/infrastructure/crypto/crypto.service';
import { OrganizationService } from '../application/organization.service';
import { Organization } from '../domain/organization';
import { CreateOrganizationRequest, CreateOrganizationResponse, OrganizationBrandingResponse } from './dto/create-organization.dto';
import { UpdateBrandingRequest, MaintenanceWindowRequest, OrganizationConfigResponse, MaintenanceWindowResponse } from './dto/organization-config.dto';
import {
  UpdatePaymentCredsRequest,
  UpdatePaymentDetailsRequest,
  UpdateCheckboxConfigRequest,
  OrganizationCredentialsResponse,
} from './dto/credentials.dto';

@Controller('v1/organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly crypto: CryptoService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Body() body: CreateOrganizationRequest): Promise<CreateOrganizationResponse> {
    return this.organizationService.create({
      name: body.name,
      slug: body.slug,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      defaultLocale: body.defaultLocale,
      supportedLocales: body.supportedLocales,
      businessName: body.businessName,
      telegramBotSecret: body.telegramBotSecret,
    });
  }

  @Patch(':id/branding')
  @Roles('SUPER_ADMIN')
  async updateBranding(
    @Param('id') id: string,
    @Body() body: UpdateBrandingRequest,
  ): Promise<OrganizationConfigResponse> {
    const organization = await this.organizationService.updateBranding(id, {
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      businessName: body.businessName,
      supportedLocales: body.supportedLocales,
      defaultLocale: body.defaultLocale,
    });
    const state = organization.currentState;
    return {
      id: state.id,
      status: state.status,
      branding: this.toBrandingResponse(state.branding),
    };
  }

  @Post(':id/maintenance-window')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  async setMaintenanceWindow(
    @Param('id') id: string,
    @Body() body: MaintenanceWindowRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganizationConfigResponse> {
    if (request.auth?.role === 'ORG_ADMIN' && request.auth.orgId !== id) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'auth.forbidden');
    }
    const organization = await this.organizationService.setMaintenanceWindow(id, {
      startTime: body.startTime,
      endTime: body.endTime,
      timezone: body.timezone,
    });
    const state = organization.currentState;
    return {
      id: state.id,
      status: state.status,
      maintenanceWindow: this.toMaintenanceWindowResponse(state.maintenanceWindow),
    };
  }

  @Patch(':id/payment-creds')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  async updatePaymentCreds(
    @Param('id') id: string,
    @Body() body: UpdatePaymentCredsRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganizationCredentialsResponse> {
    this.requireOrgAccess(request, id);
    const org = await this.organizationService.updatePaymentCreds(id, body);
    return this.toCredentialsResponse(org);
  }

  @Patch(':id/payment-details')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  async updatePaymentDetails(
    @Param('id') id: string,
    @Body() body: UpdatePaymentDetailsRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganizationCredentialsResponse> {
    this.requireOrgAccess(request, id);
    const org = await this.organizationService.updatePaymentDetails(id, body);
    return this.toCredentialsResponse(org);
  }

  @Patch(':id/checkbox-config')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  async updateCheckboxConfig(
    @Param('id') id: string,
    @Body() body: UpdateCheckboxConfigRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganizationCredentialsResponse> {
    this.requireOrgAccess(request, id);
    const org = await this.organizationService.updateCheckboxConfig(id, body);
    return this.toCredentialsResponse(org);
  }

  @Get('id/:id/credentials')
  async getCredentials(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganizationCredentialsResponse> {
    this.requireOrgAccess(request, id);
    const org = await this.organizationService.getActive(id);
    return this.toCredentialsResponse(org);
  }

  private requireOrgAccess(request: AuthenticatedRequest, orgId: string): void {
    if (request.auth?.role === 'ORG_ADMIN' && request.auth.orgId !== orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'auth.forbidden');
    }
  }

  private toCredentialsResponse(org: Organization): OrganizationCredentialsResponse {
    const state = org.currentState;
    const pc = state.paymentCreds;
    const cc = state.checkboxConfig;
    return {
      id: state.id,
      paymentCreds: {
        mode: pc.mode,
        testToken: pc.testTokenEncrypted ? this.crypto.mask(this.crypto.decrypt(pc.testTokenEncrypted)) : '',
        liveToken: pc.liveTokenEncrypted ? this.crypto.mask(this.crypto.decrypt(pc.liveTokenEncrypted)) : '',
        redirectUrl: pc.redirectUrl,
        enabled: pc.enabled,
      },
      paymentDetails: state.paymentDetails,
      checkboxConfig: cc
        ? {
            mode: cc.mode,
            licenseKey: cc.licenseKeyEncrypted ? this.crypto.mask(this.crypto.decrypt(cc.licenseKeyEncrypted)) : '',
            testToken: cc.testTokenEncrypted ? this.crypto.mask(this.crypto.decrypt(cc.testTokenEncrypted)) : '',
            liveToken: cc.liveTokenEncrypted ? this.crypto.mask(this.crypto.decrypt(cc.liveTokenEncrypted)) : '',
            enabled: cc.enabled,
          }
        : null,
    };
  }

  private toBrandingResponse(branding: OrganizationBrandingResponse): OrganizationBrandingResponse {
    return {
      businessName: branding.businessName,
      supportedLocales: branding.supportedLocales,
      defaultLocale: branding.defaultLocale,
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? null,
    };
  }

  private toMaintenanceWindowResponse(window: MaintenanceWindowResponse | null): MaintenanceWindowResponse | null {
    return window
      ? {
          startTime: window.startTime,
          endTime: window.endTime,
          timezone: window.timezone,
        }
      : null;
  }
}
