import { TenantContext } from '../../../src/shared-kernel/interface/middleware/tenant-context';
import { FakeEventBus } from '../helpers/fakes';
import { LockerAccessService } from '../../../src/locations/application/locker-access.service';
import { DoorEventHandler } from '../../../src/locations/application/door-event.handler';
import {
  FakeStationRepository,
  FakeLockerRepository,
  FakeAutoRelockScheduler,
  FakeGatewayFactory,
  makeStation,
  makeLocker,
} from '../helpers/locations-fakes';

const ORG = '00000000-0000-4000-8000-0000000000aa';
const ACTOR = 'admin-1';
function withOrg<T>(fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(ORG, fn) as Promise<T>;
}

describe('LockerAccessService (US4 open/close + auto-relock)', () => {
  function build() {
    const stations = new FakeStationRepository();
    const lockers = new FakeLockerRepository();
    const factory = new FakeGatewayFactory();
    const scheduler = new FakeAutoRelockScheduler();
    const eventBus = new FakeEventBus();
    const service = new LockerAccessService(stations, lockers, factory, scheduler, eventBus);
    return { service, stations, lockers, factory, scheduler, eventBus };
  }

  it('openLocker schedules auto-relock at now + autoLockDelaySec and publishes LockerOpened', async () => {
    const { service, stations, lockers, scheduler, eventBus } = build();
    const station = makeStation({ autoLockDelaySec: 30 });
    stations.store.set(station.id, station);
    const locker = makeLocker();
    lockers.store.set(locker.id, locker);

    const before = Date.now();
    await withOrg(() => service.openLocker(locker.id, 'ADMIN', ACTOR));

    expect(scheduler.scheduled).toHaveLength(1);
    expect(scheduler.scheduled[0].lockerId).toBe(locker.id);
    expect(scheduler.scheduled[0].lockAt.getTime()).toBeGreaterThanOrEqual(before + 29000);
    expect(scheduler.scheduled[0].lockAt.getTime()).toBeLessThanOrEqual(before + 35000);
    expect(eventBus.events.some((e) => e.constructor.name === 'LockerOpened')).toBe(true);
  });

  it('closeLocker cancels pending job and publishes LockerClosed', async () => {
    const { service, stations, lockers, scheduler, eventBus } = build();
    const station = makeStation();
    stations.store.set(station.id, station);
    const locker = makeLocker();
    lockers.store.set(locker.id, locker);

    await withOrg(() => service.openLocker(locker.id, 'ADMIN', ACTOR));
    await withOrg(() => service.closeLocker(locker.id, 'ADMIN', ACTOR));

    expect(scheduler.cancelled).toContain(locker.id);
    expect(eventBus.events.some((e) => e.constructor.name === 'LockerClosed')).toBe(true);
  });
});

describe('DoorEventHandler (US5 unauthorized door open)', () => {
  function build() {
    const stations = new FakeStationRepository();
    const lockers = new FakeLockerRepository();
    const factory = new FakeGatewayFactory();
    const scheduler = new FakeAutoRelockScheduler();
    const eventBus = new FakeEventBus();
    const lockerAccess = new LockerAccessService(stations, lockers, factory, scheduler, eventBus);
    const handler = new DoorEventHandler(lockers, stations, eventBus, lockerAccess);
    return { handler, stations, lockers, eventBus };
  }

  it('OPEN on AVAILABLE locker (no rental) → UnauthorizedDoorOpenDetected', async () => {
    const { handler, stations, lockers, eventBus } = build();
    const station = makeStation();
    stations.store.set(station.id, station);
    const locker = makeLocker({ currentRentalId: null, status: 'AVAILABLE' });
    lockers.store.set(locker.id, locker);
    await withOrg(() =>
      handler.handle(
        { stationId: station.id, doorSensor: locker.haDoorSensorEntityId, doorState: 'OPEN' },
        'fake-webhook-secret',
      ),
    );
    expect(eventBus.events.some((e) => e.constructor.name === 'UnauthorizedDoorOpenDetected')).toBe(true);
  });

  it('OPEN with active rental → LockerOpened (FR-018)', async () => {
    const { handler, stations, lockers, eventBus } = build();
    const station = makeStation();
    stations.store.set(station.id, station);
    const locker = makeLocker({ currentRentalId: 'rental-1', status: 'RENTED' });
    lockers.store.set(locker.id, locker);
    await withOrg(() =>
      handler.handle(
        { stationId: station.id, doorSensor: locker.haDoorSensorEntityId, doorState: 'OPEN' },
        'fake-webhook-secret',
      ),
    );
    expect(eventBus.events.some((e) => e.constructor.name === 'LockerOpened')).toBe(true);
    expect(eventBus.events.some((e) => e.constructor.name === 'UnauthorizedDoorOpenDetected')).toBe(false);
  });

  it('CLOSED → LockerClosed', async () => {
    const { handler, stations, lockers, eventBus } = build();
    const station = makeStation();
    stations.store.set(station.id, station);
    const locker = makeLocker();
    lockers.store.set(locker.id, locker);
    await withOrg(() =>
      handler.handle(
        { stationId: station.id, doorSensor: locker.haDoorSensorEntityId, doorState: 'CLOSED' },
        'fake-webhook-secret',
      ),
    );
    expect(eventBus.events.some((e) => e.constructor.name === 'LockerClosed')).toBe(true);
  });

  it('MAINTENANCE does not suppress unauthorized alert (FR-017)', async () => {
    const { handler, stations, lockers, eventBus } = build();
    const station = makeStation({ workingStatus: 'MAINTENANCE' });
    stations.store.set(station.id, station);
    const locker = makeLocker({ stationId: station.id, currentRentalId: null, status: 'AVAILABLE' });
    lockers.store.set(locker.id, locker);
    await withOrg(() =>
      handler.handle(
        { stationId: station.id, doorSensor: locker.haDoorSensorEntityId, doorState: 'OPEN' },
        'fake-webhook-secret',
      ),
    );
    expect(eventBus.events.some((e) => e.constructor.name === 'UnauthorizedDoorOpenDetected')).toBe(true);
  });
});
