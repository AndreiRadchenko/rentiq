import { Controller, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared-kernel/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared-kernel/interface/guards/roles.guard';
import { Roles } from '../../shared-kernel/interface/guards/roles.decorator';
import { AuthenticatedRequest } from '../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { OrganizationService } from '../application/organization.service';
import { CreateOrganizationRequest, CreateOrganizationResponse, OrganizationBrandingResponse } from './dto/create-organization.dto';
import { UpdateBrandingRequest, MaintenanceWindowRequest, OrganizationConfigResponse, MaintenanceWindowResponse } from './dto/organization-config.dto';

@Controller('v1/organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

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
