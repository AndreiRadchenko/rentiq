import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared-kernel/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared-kernel/interface/guards/roles.guard';
import { Roles } from '../../shared-kernel/interface/guards/roles.decorator';
import { AuditableAction } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { CryptoService } from '../../shared-kernel/infrastructure/crypto/crypto.service';
import { AuthenticatedRequest } from '../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { StationsService } from '../application/stations.service';
import { BookableStationsService } from '../application/bookable-stations.service';
import {
  CreateStationRequest,
  UpdateStationRequest,
  StationResponse,
  RenterStationResponse,
  StationHealthResponse,
  RenterLockerResponse,
} from './dto/station.dto';
import type { StationState } from '../domain/station.aggregate';

@Controller('v1/stations')
export class StationsController {
  constructor(
    private readonly stationsService: StationsService,
    private readonly bookableService: BookableStationsService,
    private readonly crypto: CryptoService,
  ) {}

  @Get()
  async list(
    @Query('visible') visible?: string,
    @Query('active') active?: string,
  ): Promise<{ items: StationResponse[] | RenterStationResponse[] }> {
    if (visible === 'true' && active === 'true') {
      const items = await this.bookableService.listForRenter();
      return { items };
    }
    const stations = await this.stationsService.listAdmin();
    return { items: stations.map((s) => this.toAdminResponse(s)) };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @AuditableAction('StationCreated')
  async create(@Body() body: CreateStationRequest, @Req() req: AuthenticatedRequest): Promise<StationResponse> {
    const station = await this.stationsService.create(
      {
        name: body.name,
        address: body.address,
        haUrlOrIp: body.haUrlOrIp,
        haToken: body.haToken,
        haWebhookSecret: body.haWebhookSecret,
        autoLockDelaySec: body.autoLockDelaySec,
        sortOrder: body.sortOrder,
      },
      req.auth!.sub!,
    );
    return this.toAdminResponse(station);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'STATION_OPERATOR')
  async getById(@Param('id') id: string): Promise<StationResponse> {
    const station = await this.stationsService.getById(id);
    return this.toAdminResponse(station);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @AuditableAction('StationUpdated')
  async update(@Param('id') id: string, @Body() body: UpdateStationRequest, @Req() req: AuthenticatedRequest): Promise<StationResponse> {
    const station = await this.stationsService.update(id, body, req.auth!.sub!);
    return this.toAdminResponse(station);
  }

  @Get(':id/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'STATION_OPERATOR')
  async health(@Param('id') id: string): Promise<StationHealthResponse> {
    const station = await this.stationsService.getById(id);
    const s = station.currentState;
    return {
      id: station.id,
      healthStatus: s.healthStatus,
      lastHealthCheckAt: s.lastHealthCheckAt ? s.lastHealthCheckAt.toISOString() : null,
      adminIntendedIsActive: s.adminIntendedIsActive,
      isActiveForBookability: station.isBookableActive,
    };
  }

  @Get(':id/lockers')
  async lockers(
    @Param('id') id: string,
    @Query('visible') visible?: string,
  ): Promise<{ items: RenterLockerResponse[] }> {
    if (visible === 'true') {
      const items = await this.bookableService.listBookableLockers(id);
      return { items };
    }
    const items = await this.bookableService.listBookableLockers(id);
    return { items };
  }

  private toAdminResponse(station: { id: string; currentState: StationState }): StationResponse {
    const s = station.currentState;
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      workingStatus: s.workingStatus,
      isActive: s.isActive,
      adminIntendedIsActive: s.adminIntendedIsActive,
      isVisibleToClients: s.isVisibleToClients,
      sortOrder: s.sortOrder,
      haUrlOrIp: s.haUrlOrIp,
      haToken: s.haToken ? this.crypto.mask(s.haToken) : '',
      haWebhookSecret: s.haWebhookSecret ? this.crypto.mask(s.haWebhookSecret) : '',
      autoLockDelaySec: s.autoLockDelaySec,
      healthStatus: s.healthStatus,
      lastHealthCheckAt: s.lastHealthCheckAt ? new Date(s.lastHealthCheckAt).toISOString() : null,
      createdAt: new Date(s.createdAt).toISOString(),
    };
  }
}
