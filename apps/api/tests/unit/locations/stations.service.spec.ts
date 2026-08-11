import { HttpStatus } from '@nestjs/common';
import { TenantContext } from '../../../src/shared-kernel/interface/middleware/tenant-context';
import { FakeEventBus } from '../helpers/fakes';
import { AuditableLogger } from '../../../src/shared-kernel/infrastructure/audit/auditable-action.decorator';
import { CryptoService } from '../../../src/shared-kernel/infrastructure/crypto/crypto.service';
import { makeCryptoService } from '../helpers/locations-fakes';
import { StationsService } from '../../../src/locations/application/stations.service';
import { LockersService } from '../../../src/locations/application/lockers.service';
import { InventoryKitService } from '../../../src/locations/application/inventory-kit.service';
import {
  FakeStationRepository,
  FakeLockerRepository,
  FakeInventoryKitRepository,
  makeStation,
  makeLocker,
  makeKit,
} from '../helpers/locations-fakes';

const ORG = '00000000-0000-4000-8000-0000000000aa';
const ACTOR = 'actor-1';

function withOrg<T>(fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(ORG, fn) as Promise<T>;
}

async function expectApiError(promise: Promise<unknown>, code: string, status: number) {
  try {
    await promise;
    throw new Error(`Expected ApiException ${code}`);
  } catch (error) {
    expect(error).toHaveProperty('code', code);
    expect((error as { getStatus(): number }).getStatus()).toBe(status);
  }
}

describe('StationsService (US2 admin CRUD)', () => {
  function build() {
    const stations = new FakeStationRepository();
    const lockers = new FakeLockerRepository();
    const kits = new FakeInventoryKitRepository();
    const eventBus = new FakeEventBus();
    const audit = new AuditableLogger();
    const crypto = makeCryptoService();
    const service = new StationsService(stations, lockers, eventBus, audit, crypto);
    return { service, stations, lockers, kits, eventBus, crypto };
  }

  it('creates a station with defaults isActive=true, isVisibleToClients=false, WORKING, UNKNOWN', async () => {
    const { service, stations, eventBus } = build();
    const station = await withOrg(() =>
      service.create({ name: 'Poshtova', haUrlOrIp: 'http://10.0.0.42:8123', haToken: 'ref', haWebhookSecret: 'secret' }, ACTOR),
    );
    const s = station.currentState;
    expect(s.isActive).toBe(true);
    expect(s.adminIntendedIsActive).toBe(true);
    expect(s.isVisibleToClients).toBe(false);
    expect(s.workingStatus).toBe('WORKING');
    expect(s.healthStatus).toBe('UNKNOWN');
    expect(s.autoLockDelaySec).toBe(30);
    expect(stations.store.has(station.id)).toBe(true);
    expect(eventBus.events.some((e) => e.constructor.name === 'StationCreated')).toBe(true);
  });

  it('independent active/visible toggles (FR-004)', async () => {
    const { service, stations } = build();
    const station = makeStation();
    stations.store.set(station.id, station);
    await withOrg(() =>
      service.update(station.id, { isActive: false }, ACTOR),
    );
    expect(station.currentState.adminIntendedIsActive).toBe(false);
    expect(station.currentState.isActive).toBe(false);
    expect(station.currentState.isVisibleToClients).toBe(false);

    await withOrg(() => service.update(station.id, { isVisibleToClients: true }, ACTOR));
    expect(station.currentState.isVisibleToClients).toBe(true);
    expect(station.currentState.adminIntendedIsActive).toBe(false);
  });

  it('rejects autoLockDelaySec <= 0', async () => {
    const { service } = build();
    await expectApiError(
      withOrg(() => service.create({ name: 'X', haUrlOrIp: 'http://x', haToken: 'r', haWebhookSecret: 's', autoLockDelaySec: 0 }, ACTOR)),
      'STATION_AUTOLOCK_INVALID',
      HttpStatus.BAD_REQUEST,
    );
  });

  it('rejects empty haToken', async () => {
    const { service } = build();
    await expectApiError(
      withOrg(() => service.create({ name: 'X', haUrlOrIp: 'http://x', haToken: '', haWebhookSecret: 's' }, ACTOR)),
      'STATION_TOKEN_REF_EMPTY',
      HttpStatus.BAD_REQUEST,
    );
  });

  it('visible+inactive station is NOT in bookable list', async () => {
    const { service, stations } = build();
    const s = makeStation({ isVisibleToClients: true, adminIntendedIsActive: false, isActive: false });
    stations.store.set(s.id, s);
    const bookable = await withOrg(() => service.listBookable());
    expect(bookable).toHaveLength(0);
  });
});

describe('LockersService (US2)', () => {
  function build() {
    const stations = new FakeStationRepository();
    const lockers = new FakeLockerRepository();
    const kits = new FakeInventoryKitRepository();
    const audit = new AuditableLogger();
    const lockersService = new LockersService(lockers, stations, kits, audit);
    const kitService = new InventoryKitService(kits, stations, lockers, audit);
    return { lockersService, kitService, stations, lockers, kits };
  }

  it('assigns and unassigns a kit; misconfiguration flagged (FR-002)', async () => {
    const { lockersService, kitService, stations, lockers, kits } = build();
    const station = makeStation();
    stations.store.set(station.id, station);
    const locker = makeLocker();
    lockers.store.set(locker.id, locker);
    const kit = makeKit();
    await withOrg(() => kitService.create({ stationId: station.id, name: 'SUP', kitType: 'SUP_BOARD' }, ACTOR));
    kits.store.set(kit.id, kit);

    await withOrg(() => lockersService.update(locker.id, { inventoryKitId: kit.id }, ACTOR));
    expect(locker.currentState.inventoryKitId).toBe(kit.id);

    const listed = await withOrg(() => lockersService.listForStation(station.id));
    expect(listed[0].misconfigured).toBe(false);

    await withOrg(() => lockersService.update(locker.id, { inventoryKitId: null }, ACTOR));
    expect(locker.currentState.inventoryKitId).toBeNull();
    const listed2 = await withOrg(() => lockersService.listForStation(station.id));
    expect(listed2[0].misconfigured).toBe(true);
  });

  it('MAINTENANCE toggle (FR-033)', async () => {
    const { lockersService, stations, lockers } = build();
    stations.store.set(makeStation().id, makeStation());
    const locker = makeLocker();
    lockers.store.set(locker.id, locker);
    await withOrg(() => lockersService.update(locker.id, { status: 'MAINTENANCE' }, ACTOR));
    expect(locker.currentState.status).toBe('MAINTENANCE');
    await withOrg(() => lockersService.update(locker.id, { status: 'AVAILABLE' }, ACTOR));
    expect(locker.currentState.status).toBe('AVAILABLE');
  });
});
