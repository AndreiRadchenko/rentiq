import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { TenantContext } from '../../shared-kernel/interface/middleware/tenant-context';
import { ApiException } from '../../shared-kernel/interface/dto/api-exception';
import { ErrorCode } from '../../shared-kernel/interface/dto/api-error';
import { STATION_REPOSITORY, StationRepository } from './ports/station.repository';
import { LOCKER_REPOSITORY, LockerRepository } from './ports/locker.repository';
import { INVENTORY_KIT_REPOSITORY, InventoryKitRepository } from './ports/inventory-kit.repository';
import { BookabilityRule } from '../domain/bookability-rule';
import { PricingService } from '../../pricing/application/pricing.service';

export interface RenterStationView {
  id: string;
  name: string;
  address: string | null;
  availableLockersCount: number;
  sortOrder: number;
  displayStatus: 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE';
}

export interface RenterLockerTariffView {
  tariffId: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
}

export interface RenterLockerView {
  id: string;
  name: string;
  kitType: string;
  tariffs: RenterLockerTariffView[];
}

@Injectable()
export class BookableStationsService {
  constructor(
    @Inject(STATION_REPOSITORY) private readonly stations: StationRepository,
    @Inject(LOCKER_REPOSITORY) private readonly lockers: LockerRepository,
    @Inject(INVENTORY_KIT_REPOSITORY) private readonly kits: InventoryKitRepository,
    private readonly pricingService: PricingService,
  ) {}

  async listForRenter(): Promise<RenterStationView[]> {
    const orgId = this.requireOrgId();
    const stations = await this.stations.listBookable(orgId);
    const views: RenterStationView[] = [];
    for (const station of stations) {
      const available = await this.lockers.listAvailableForStation(orgId, station.id);
      views.push({
        id: station.id,
        name: station.name,
        address: station.currentState.address,
        availableLockersCount: available.length,
        sortOrder: station.currentState.sortOrder,
        displayStatus: 'AVAILABLE',
      });
    }
    return views;
  }

  async listBookableLockers(stationId: string): Promise<RenterLockerView[]> {
    const orgId = this.requireOrgId();
    const station = await this.stations.findById(orgId, stationId);
    if (!station) {
      throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.STATION_NOT_FOUND, 'locations.station_not_found');
    }
    const dayType = this.pricingService.resolveDayType(new Date());
    const lockers = await this.lockers.listAvailableForStation(orgId, stationId);
    const views: RenterLockerView[] = [];
    for (const locker of lockers) {
      if (!locker.inventoryKitId) continue;
      const kit = await this.kits.findById(orgId, locker.inventoryKitId);
      if (!kit) continue;
      const tariffs = await this.pricingService.listTariffsForKitType(orgId, kit.kitType, dayType);
      if (tariffs.length === 0) continue;
      if (!BookabilityRule.evaluate({ station: station.currentState, locker: locker.currentState, tariffsForToday: tariffs })) {
        continue;
      }
      views.push({
        id: locker.id,
        name: locker.currentState.name,
        kitType: kit.kitType,
        tariffs,
      });
    }
    return views;
  }

  private requireOrgId(): string {
    const orgId = TenantContext.getOrgId();
    if (!orgId) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_NOT_FOUND, 'auth.tenant_not_found');
    }
    return orgId;
  }
}
