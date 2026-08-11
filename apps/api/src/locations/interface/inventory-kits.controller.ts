import { Controller, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared-kernel/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared-kernel/interface/guards/roles.guard';
import { Roles } from '../../shared-kernel/interface/guards/roles.decorator';
import { AuditableAction } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { AuthenticatedRequest } from '../../shared-kernel/interface/middleware/jwt-auth.middleware';
import { InventoryKitService } from '../application/inventory-kit.service';
import { CreateKitRequest, UpdateKitRequest, KitResponse } from './dto/inventory-kit.dto';
import type { InventoryKitState } from '../domain/inventory-kit.entity';

@Controller('v1/inventory-kits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ORG_ADMIN')
export class InventoryKitsController {
  constructor(private readonly kitService: InventoryKitService) {}

  @Post()
  @AuditableAction('InventoryKitCreated')
  async create(@Body() body: CreateKitRequest, @Req() req: AuthenticatedRequest): Promise<KitResponse> {
    const kit = await this.kitService.create(body, req.auth!.sub!);
    return this.toResponse(kit);
  }

  @Patch(':id')
  @AuditableAction('InventoryKitUpdated')
  async update(@Param('id') id: string, @Body() body: UpdateKitRequest, @Req() req: AuthenticatedRequest): Promise<KitResponse> {
    const kit = await this.kitService.update(id, body, req.auth!.sub!);
    return this.toResponse(kit);
  }

  @Delete(':id')
  @AuditableAction('InventoryKitRetired')
  async retire(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ acknowledged: true }> {
    await this.kitService.retire(id, req.auth!.sub!);
    return { acknowledged: true };
  }

  private toResponse(kit: { id: string; currentState: InventoryKitState }): KitResponse {
    const s = kit.currentState;
    return {
      id: s.id,
      stationId: s.stationId,
      lockerId: s.lockerId,
      name: s.name,
      kitType: s.kitType,
      createdAt: new Date(s.createdAt).toISOString(),
    };
  }
}
