import { Controller, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared-kernel/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared-kernel/interface/guards/roles.guard';
import { Roles } from '../../shared-kernel/interface/guards/roles.decorator';
import { AuditableAction } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { AuthenticatedRequest } from '../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { LockersService } from '../application/lockers.service';
import { LockerAccessService } from '../application/locker-access.service';
import { CreateLockerRequest, UpdateLockerRequest, LockerResponse } from './dto/locker.dto';
import type { LockerState } from '../domain/locker.aggregate';

@Controller('v1/lockers')
export class LockersController {
  constructor(
    private readonly lockersService: LockersService,
    private readonly lockerAccessService: LockerAccessService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @AuditableAction('LockerCreated')
  async create(@Body() body: CreateLockerRequest, @Req() req: AuthenticatedRequest): Promise<LockerResponse> {
    const locker = await this.lockersService.create(body, req.auth!.sub!);
    return this.toResponse(locker);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @AuditableAction('LockerUpdated')
  async update(@Param('id') id: string, @Body() body: UpdateLockerRequest, @Req() req: AuthenticatedRequest): Promise<LockerResponse> {
    const locker = await this.lockersService.update(id, body, req.auth!.sub!);
    return this.toResponse(locker);
  }

  @Post(':id/open')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'STATION_OPERATOR')
  @AuditableAction('LockerManuallyOpened')
  async open(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ acknowledged: true }> {
    await this.lockerAccessService.openLocker(id, 'ADMIN', req.auth!.sub ?? null);
    return { acknowledged: true };
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'STATION_OPERATOR')
  @AuditableAction('LockerManuallyClosed')
  async close(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ acknowledged: true }> {
    await this.lockerAccessService.closeLocker(id, 'ADMIN', req.auth!.sub ?? null);
    return { acknowledged: true };
  }

  private toResponse(locker: { id: string; currentState: LockerState }): LockerResponse {
    const s = locker.currentState;
    return {
      id: s.id,
      stationId: s.stationId,
      name: s.name,
      status: s.status,
      haLockEntityId: s.haLockEntityId,
      haDoorSensorEntityId: s.haDoorSensorEntityId,
      currentRentalId: s.currentRentalId,
      inventoryKitId: s.inventoryKitId,
      createdAt: new Date(s.createdAt).toISOString(),
    };
  }
}
