import { Controller, Get, Patch, Post, Body, UseGuards, Req } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { RenterAuthGuard } from '../../../shared-kernel/interface/guards/renter-auth.guard';
import { AuthenticatedRequest } from '../../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { ApiException } from '../../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../../shared-kernel/interface/dto/api-error';
import { RenterService } from '../../application/renter/renter.service';
import { RenterProfileResponse } from './dto/register-renter.dto';
import { UpdateRenterLocaleRequest, ReConsentRequest } from './dto/renter-me.dto';

@Controller('v1/renters')
@UseGuards(RenterAuthGuard)
export class RenterMeController {
  constructor(private readonly renterService: RenterService) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest): Promise<{ renter: RenterProfileResponse }> {
    const { sub, orgId } = this.identity(request);
    const profile = await this.renterService.getProfile(orgId, sub);
    return { renter: profile };
  }

  @Patch('me')
  async updateLocale(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateRenterLocaleRequest,
  ): Promise<{ renter: RenterProfileResponse }> {
    const { sub, orgId } = this.identity(request);
    const profile = await this.renterService.changeLocale(orgId, sub, body.locale);
    return { renter: profile };
  }

  @Post('me/re-consent')
  async reConsent(
    @Req() request: AuthenticatedRequest,
    @Body() body: ReConsentRequest,
  ): Promise<{ renter: RenterProfileResponse }> {
    const { sub, orgId } = this.identity(request);
    const profile = await this.renterService.reConsent(orgId, sub, body.consentVersion);
    return { renter: profile };
  }

  private identity(request: AuthenticatedRequest): { sub: string; orgId: string } {
    const sub = request.auth?.sub;
    const orgId = request.auth?.orgId ?? null;
    if (!sub || !orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'auth.forbidden');
    }
    return { sub, orgId };
  }
}
