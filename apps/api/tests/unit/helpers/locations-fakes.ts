import { Station } from '../../../src/locations/domain/station.aggregate';
import { Locker } from '../../../src/locations/domain/locker.aggregate';
import { InventoryKit } from '../../../src/locations/domain/inventory-kit.entity';
import { Tariff } from '../../../src/pricing/domain/tariff.aggregate';
import { StationRepository } from '../../../src/locations/application/ports/station.repository';
import { LockerRepository } from '../../../src/locations/application/ports/locker.repository';
import { InventoryKitRepository } from '../../../src/locations/application/ports/inventory-kit.repository';
import { TariffRepository } from '../../../src/pricing/application/ports/tariff.repository';
import { AutoRelockScheduler } from '../../../src/locations/domain/auto-relock-scheduler.port';
import { SmartLockGateway, SmartLockGatewayFactory, DoorState } from '../../../src/locations/domain/smart-lock-gateway.port';
import type { DayType } from '../../../src/pricing/domain/day-type';

const ORG = '00000000-0000-4000-8000-0000000000aa';

export function makeStation(overrides: Partial<Station['currentState']> = {}): Station {
  const base = Station.create({
    id: '10000000-0000-4000-8000-000000000001',
    orgId: ORG,
    name: 'Poshtova',
    haUrlOrIp: 'http://10.0.0.42:8123',
    haToken: 'fake-ha-token',
    haWebhookSecret: 'fake-webhook-secret',
    autoLockDelaySec: 30,
  });
  const state = { ...base.currentState, ...overrides };
  return Station.reconstitute(state);
}

export function makeLocker(overrides: Partial<Locker['currentState']> = {}): Locker {
  const base = Locker.create({
    id: '20000000-0000-4000-8000-000000000002',
    stationId: '10000000-0000-4000-8000-000000000001',
    name: 'Locker 1',
    haLockEntityId: 'lock.l1',
    haDoorSensorEntityId: 'binary_sensor.l1_door',
  });
  return Locker.reconstitute({ ...base.currentState, ...overrides });
}

export function makeKit(overrides: Partial<InventoryKit['currentState']> = {}): InventoryKit {
  const base = InventoryKit.create({
    id: '30000000-0000-4000-8000-000000000003',
    stationId: '10000000-0000-4000-8000-000000000001',
    name: 'SUP Board',
    kitType: 'SUP_BOARD',
  });
  return InventoryKit.reconstitute({ ...base.currentState, ...overrides });
}

export function makeTariff(overrides: Partial<Tariff['currentState']> = {}): Tariff {
  const base = Tariff.create({
    id: '40000000-0000-4000-8000-000000000004',
    orgId: ORG,
    kitType: 'SUP_BOARD',
    dayType: 'WEEKDAY',
    durationMinutes: 60,
    priceMinor: 10000,
  });
  return Tariff.reconstitute({ ...base.currentState, ...overrides });
}

export class FakeStationRepository implements StationRepository {
  store = new Map<string, Station>();
  async save(station: Station): Promise<void> {
    this.store.set(station.id, station);
  }
  async findById(orgId: string, id: string): Promise<Station | null> {
    const s = this.store.get(id);
    return s && s.currentState.orgId === orgId ? s : null;
  }
  async findByIdUnscoped(id: string): Promise<Station | null> {
    return this.store.get(id) ?? null;
  }
  async listAdmin(orgId: string): Promise<Station[]> {
    return [...this.store.values()].filter((s) => s.currentState.orgId === orgId && !s.currentState.deletedAt);
  }
  async listBookable(orgId: string): Promise<Station[]> {
    return this.listAdmin(orgId).then((list) =>
      list.filter(
        (s) =>
          s.currentState.isActive &&
          s.currentState.isVisibleToClients &&
          s.currentState.workingStatus === 'WORKING',
      ),
    );
  }
}

export class FakeLockerRepository implements LockerRepository {
  store = new Map<string, Locker>();
  async save(locker: Locker): Promise<void> {
    this.store.set(locker.id, locker);
  }
  async findById(orgId: string, id: string): Promise<Locker | null> {
    const l = this.store.get(id);
    return l ?? null;
  }
  async findByDoorSensorEntityId(stationId: string, sensorEntityId: string): Promise<Locker | null> {
    return (
      [...this.store.values()].find(
        (l) =>
          l.currentState.stationId === stationId &&
          l.currentState.haDoorSensorEntityId === sensorEntityId &&
          !l.currentState.deletedAt,
      ) ?? null
    );
  }
  async listForStation(_orgId: string, stationId: string): Promise<Locker[]> {
    return [...this.store.values()].filter((l) => l.currentState.stationId === stationId && !l.currentState.deletedAt);
  }
  async listAvailableForStation(_orgId: string, stationId: string): Promise<Locker[]> {
    return this.listForStation(_orgId, stationId).then((list) =>
      list.filter((l) => l.currentState.status === 'AVAILABLE' && l.currentState.currentRentalId === null),
    );
  }
  async reserveAtomic(_orgId: string, lockerId: string, rentalId: string): Promise<boolean> {
    const l = this.store.get(lockerId);
    if (!l || l.currentState.currentRentalId !== null) return false;
    l.reserveFor(rentalId);
    return true;
  }
  async release(_orgId: string, lockerId: string): Promise<boolean> {
    const l = this.store.get(lockerId);
    if (!l) return false;
    l.release();
    return true;
  }
}

export class FakeInventoryKitRepository implements InventoryKitRepository {
  store = new Map<string, InventoryKit>();
  async save(kit: InventoryKit): Promise<void> {
    this.store.set(kit.id, kit);
  }
  async findById(_orgId: string, id: string): Promise<InventoryKit | null> {
    return this.store.get(id) ?? null;
  }
  async listForStation(_orgId: string, stationId: string): Promise<InventoryKit[]> {
    return [...this.store.values()].filter((k) => k.currentState.stationId === stationId);
  }
  async findByLocker(_orgId: string, lockerId: string): Promise<InventoryKit | null> {
    return [...this.store.values()].find((k) => k.currentState.lockerId === lockerId) ?? null;
  }
}

export class FakeTariffRepository implements TariffRepository {
  store = new Map<string, Tariff>();
  async save(tariff: Tariff): Promise<void> {
    const existing = await this.findExistingByKey(
      tariff.currentState.orgId,
      tariff.currentState.kitType,
      tariff.currentState.dayType,
      tariff.currentState.durationMinutes,
    );
    if (!tariff.currentState.deletedAt && existing && existing.id !== tariff.id) {
      const { DuplicateTariffError } = await import('../../../src/pricing/domain/tariff.aggregate');
      throw new DuplicateTariffError(existing.id);
    }
    this.store.set(tariff.id, tariff);
  }
  async findById(orgId: string, id: string): Promise<Tariff | null> {
    const t = this.store.get(id);
    return t && t.currentState.orgId === orgId ? t : null;
  }
  async list(orgId: string, filter?: { kitType?: string; dayType?: DayType }): Promise<Tariff[]> {
    return [...this.store.values()].filter((t) => {
      if (t.currentState.orgId !== orgId) return false;
      if (t.currentState.deletedAt) return false;
      if (filter?.kitType && t.currentState.kitType !== filter.kitType) return false;
      if (filter?.dayType && t.currentState.dayType !== filter.dayType) return false;
      return true;
    });
  }
  async findForQuote(orgId: string, kitType: string, dayType: DayType, durationMinutes: number): Promise<Tariff | null> {
    return (
      [...this.store.values()].find(
        (t) =>
          t.currentState.orgId === orgId &&
          t.currentState.kitType === kitType &&
          t.currentState.dayType === dayType &&
          t.currentState.durationMinutes === durationMinutes &&
          !t.currentState.deletedAt,
      ) ?? null
    );
  }
  async listForKitType(orgId: string, kitType: string, dayType: DayType): Promise<Tariff[]> {
    return [...this.store.values()]
      .filter(
        (t) =>
          t.currentState.orgId === orgId &&
          t.currentState.kitType === kitType &&
          t.currentState.dayType === dayType &&
          !t.currentState.deletedAt,
      )
      .sort((a, b) => a.currentState.durationMinutes - b.currentState.durationMinutes);
  }
  async findExistingByKey(orgId: string, kitType: string, dayType: DayType, durationMinutes: number): Promise<Tariff | null> {
    return (
      [...this.store.values()].find(
        (t) =>
          t.currentState.orgId === orgId &&
          t.currentState.kitType === kitType &&
          t.currentState.dayType === dayType &&
          t.currentState.durationMinutes === durationMinutes &&
          !t.currentState.deletedAt,
      ) ?? null
    );
  }
}

import { CryptoService } from '../../../src/shared-kernel/infrastructure/crypto/crypto.service';

export class FakeCryptoService extends CryptoService {
  encrypt(plaintext: string): string {
    return plaintext ? `enc:${plaintext}` : '';
  }
  decrypt(encrypted: string): string {
    return encrypted.startsWith('enc:') ? encrypted.slice(4) : encrypted;
  }
  mask(value: string): string {
    if (!value || value.length <= 4) return '****';
    return '****' + value.slice(-4);
  }
}

export function makeCryptoService(): CryptoService {
  return new FakeCryptoService({ MASTER_KEY: 'a'.repeat(64) } as never);
}

export class FakeAutoRelockScheduler implements AutoRelockScheduler {
  scheduled: { lockerId: string; lockAt: Date }[] = [];
  cancelled: string[] = [];
  async schedule(lockerId: string, lockAt: Date): Promise<void> {
    this.scheduled.push({ lockerId, lockAt });
  }
  async cancel(lockerId: string): Promise<void> {
    this.cancelled.push(lockerId);
  }
}

export class FakeSmartLockGateway implements SmartLockGateway {
  doorStates = new Map<string, DoorState>();
  locked = new Map<string, boolean>();
  reachable = true;
  async readDoorState(lockerId: string): Promise<DoorState> {
    if (!this.reachable) return 'UNKNOWN';
    return this.doorStates.get(lockerId) ?? 'CLOSED';
  }
  async unlock(lockerId: string): Promise<void> {
    if (!this.reachable) throw new (await import('../../../src/locations/domain/smart-lock-gateway.port')).GatewayUnreachableError();
    this.locked.set(lockerId, false);
    this.doorStates.set(lockerId, 'OPEN');
  }
  async lock(lockerId: string): Promise<void> {
    if (!this.reachable) throw new (await import('../../../src/locations/domain/smart-lock-gateway.port')).GatewayUnreachableError();
    this.locked.set(lockerId, true);
    this.doorStates.set(lockerId, 'CLOSED');
  }
  async isReachable(): Promise<boolean> {
    return this.reachable;
  }
}

export class FakeGatewayFactory implements SmartLockGatewayFactory {
  gateway = new FakeSmartLockGateway();
  forStation(): SmartLockGateway {
    return this.gateway;
  }
}
