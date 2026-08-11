import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { EntityId } from '../../shared-kernel/domain/value-objects/entity-id';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';
import { EVENT_BUS, EventBus } from '../../shared-kernel/application/ports/event-bus';
import { AuditableLogger } from '../../shared-kernel/infrastructure/audit/auditable-action.decorator';
import { Tariff, DuplicateTariffError } from '../domain/tariff.aggregate';
import { TARIFF_REPOSITORY, TariffRepository } from './ports/tariff.repository';
import { TariffChanged } from '../domain/events/tariff-changed.event';
import type { DayType } from '../domain/day-type';

export interface CreateTariffInput {
  kitType: string;
  dayType: DayType;
  durationMinutes: number;
  priceMinor: number;
  currency?: string;
}

export interface UpdateTariffInput {
  priceMinor?: number;
  currency?: string;
}

export interface TariffListFilter {
  kitType?: string;
  dayType?: DayType;
}

@Injectable()
export class TariffService {
  constructor(
    @Inject(TARIFF_REPOSITORY) private readonly tariffs: TariffRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly audit: AuditableLogger,
  ) {}

  async create(input: CreateTariffInput, actorId: string): Promise<Tariff> {
    const orgId = this.requireOrgId();
    this.validateDayType(input.dayType);
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.TARIFF_DURATION_INVALID, 'pricing.duration_invalid');
    }
    if (!Number.isInteger(input.priceMinor) || input.priceMinor < 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.TARIFF_PRICE_INVALID, 'pricing.price_invalid');
    }

    const tariff = Tariff.create({
      id: EntityId.generate().toString(),
      orgId,
      kitType: input.kitType,
      dayType: input.dayType,
      durationMinutes: input.durationMinutes,
      priceMinor: input.priceMinor,
      currency: input.currency,
    });

    try {
      await this.tariffs.save(tariff);
    } catch (error) {
      if (error instanceof DuplicateTariffError) {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.DUPLICATE_TARIFF, 'pricing.duplicate_tariff');
      }
      throw error;
    }
    this.audit.log('TariffCreated', actorId, orgId, { tariffId: tariff.id });
    await this.eventBus.publish(
      new TariffChanged(tariff.id, orgId, actorId, 'CREATED', tariff.kitType, tariff.dayType, tariff.durationMinutes),
    );
    return tariff;
  }

  async update(id: string, input: UpdateTariffInput, actorId: string): Promise<Tariff> {
    const orgId = this.requireOrgId();
    const tariff = await this.tariffs.findById(orgId, id);
    if (!tariff) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TARIFF_NOT_FOUND, 'pricing.tariff_not_found');
    }
    if (input.priceMinor !== undefined || input.currency !== undefined) {
      tariff.updatePrice(input.priceMinor ?? tariff.currentState.priceMinor, input.currency);
    }
    await this.tariffs.save(tariff);
    const state = tariff.currentState;
    this.audit.log('TariffUpdated', actorId, orgId, { tariffId: tariff.id });
    await this.eventBus.publish(
      new TariffChanged(tariff.id, orgId, actorId, 'UPDATED', state.kitType, state.dayType, state.durationMinutes),
    );
    return tariff;
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const orgId = this.requireOrgId();
    const tariff = await this.tariffs.findById(orgId, id);
    if (!tariff) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TARIFF_NOT_FOUND, 'pricing.tariff_not_found');
    }
    tariff.softDelete();
    await this.tariffs.save(tariff);
    const state = tariff.currentState;
    this.audit.log('TariffDeleted', actorId, orgId, { tariffId: tariff.id });
    await this.eventBus.publish(
      new TariffChanged(tariff.id, orgId, actorId, 'DELETED', state.kitType, state.dayType, state.durationMinutes),
    );
  }

  async list(filter: TariffListFilter): Promise<Tariff[]> {
    return this.tariffs.list(this.requireOrgId(), filter);
  }

  private validateDayType(dayType: string): void {
    if (dayType !== 'WEEKDAY' && dayType !== 'WEEKEND') {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.TARIFF_DAY_TYPE_INVALID, 'pricing.day_type_invalid');
    }
  }

  private requireOrgId(): string {
    const orgId = TenantContext.getOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_NOT_FOUND, 'auth.tenant_not_found');
    }
    return orgId;
  }
}
