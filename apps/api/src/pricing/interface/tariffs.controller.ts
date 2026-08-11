import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared-kernel/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared-kernel/interface/guards/roles.guard';
import { Roles } from '../../shared-kernel/interface/guards/roles.decorator';
import { AuditableAction } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { AuthenticatedRequest } from '../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { HttpStatus } from '@nestjs/common';
import { TariffService } from '../application/tariff.service';
import { PricingService } from '../application/pricing.service';
import { CreateTariffRequest, UpdateTariffRequest, TariffResponse, TariffQuoteResponse } from './dto/tariff.dto';
import type { TariffState } from '../domain/tariff.aggregate';

@Controller('v1/tariffs')
export class TariffsController {
  constructor(
    private readonly tariffService: TariffService,
    private readonly pricingService: PricingService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  async list(@Query('kitType') kitType?: string, @Query('dayType') dayType?: 'WEEKDAY' | 'WEEKEND'): Promise<{ items: TariffResponse[] }> {
    const tariffs = await this.tariffService.list({ kitType, dayType });
    return { items: tariffs.map((t) => this.toResponse(t)) };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @AuditableAction('TariffCreated')
  async create(@Body() body: CreateTariffRequest, @Req() req: AuthenticatedRequest): Promise<TariffResponse> {
    const tariff = await this.tariffService.create(body, req.auth!.sub!);
    return this.toResponse(tariff);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @AuditableAction('TariffUpdated')
  async update(@Param('id') id: string, @Body() body: UpdateTariffRequest, @Req() req: AuthenticatedRequest): Promise<TariffResponse> {
    const tariff = await this.tariffService.update(id, body, req.auth!.sub!);
    return this.toResponse(tariff);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @AuditableAction('TariffDeleted')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ acknowledged: true }> {
    await this.tariffService.softDelete(id, req.auth!.sub!);
    return { acknowledged: true };
  }

  @Get('quote')
  @UseGuards(JwtAuthGuard)
  async quote(
    @Query('kitType') kitType?: string,
    @Query('dayType') dayType?: 'WEEKDAY' | 'WEEKEND',
    @Query('durationMinutes') durationMinutes?: string,
  ): Promise<TariffQuoteResponse> {
    if (!kitType || !dayType || !durationMinutes) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'pricing.quote_missing_params');
    }
    const orgId = this.pricingService.requireOrgId();
    const result = await this.pricingService.quote(orgId, kitType, dayType, Number(durationMinutes));
    if (result.isErr()) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TARIFF_NOT_FOUND, 'pricing.tariff_not_found');
    }
    const { money, tariffId } = result.unwrap();
    return { priceMinor: money.getAmountMinor(), currency: money.getCurrency(), tariffId };
  }

  private toResponse(tariff: { id: string; currentState: TariffState }): TariffResponse {
    const s = tariff.currentState;
    return {
      id: s.id,
      kitType: s.kitType,
      dayType: s.dayType,
      durationMinutes: s.durationMinutes,
      priceMinor: s.priceMinor,
      currency: s.currency,
      deletedAt: s.deletedAt ? new Date(s.deletedAt).toISOString() : null,
      createdAt: new Date(s.createdAt).toISOString(),
    };
  }
}
