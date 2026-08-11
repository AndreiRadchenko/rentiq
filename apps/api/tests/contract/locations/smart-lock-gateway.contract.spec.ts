import { MockSmartLockGateway } from '../../../src/locations/infrastructure/mock-smart-lock.gateway';
import {
  GatewayUnreachableError,
  GatewayCommandError,
} from '../../../src/locations/domain/smart-lock-gateway.port';

describe('SmartLockGateway contract — MockSmartLockGateway (Principle II contract equivalence)', () => {
  let gateway: MockSmartLockGateway;

  beforeEach(() => {
    gateway = new MockSmartLockGateway();
    gateway.setStationResolver(() => 'station-1');
  });

  it('readDoorState defaults to CLOSED for an unknown locker', async () => {
    expect(await gateway.readDoorState('locker-1')).toBe('CLOSED');
  });

  it('unlock then lock is idempotent — locking an already-locked locker is a no-op (FR-015)', async () => {
    await gateway.unlock('locker-1');
    expect(gateway.isLocked('locker-1')).toBe(false);
    await gateway.lock('locker-1');
    expect(gateway.isLocked('locker-1')).toBe(true);
    await gateway.lock('locker-1');
    expect(gateway.isLocked('locker-1')).toBe(true);
    expect(gateway.getDoorState('locker-1')).toBe('CLOSED');
  });

  it('unlock then unlock again is idempotent', async () => {
    await gateway.unlock('locker-1');
    await gateway.unlock('locker-1');
    expect(gateway.isLocked('locker-1')).toBe(false);
  });

  it('readDoorState returns UNKNOWN when station is unreachable', async () => {
    gateway.setReachable('station-1', false);
    expect(await gateway.readDoorState('locker-1')).toBe('UNKNOWN');
  });

  it('unlock rejects with GatewayUnreachableError when station unreachable', async () => {
    gateway.setReachable('station-1', false);
    await expect(gateway.unlock('locker-1')).rejects.toBeInstanceOf(GatewayUnreachableError);
  });

  it('isReachable() returns true by default', async () => {
    expect(await gateway.isReachable()).toBe(true);
  });

  it('isStationReachable false when set unreachable', () => {
    gateway.setReachable('station-1', false);
    expect(gateway.isStationReachable('station-1')).toBe(false);
    gateway.setReachable('station-1', true);
    expect(gateway.isStationReachable('station-1')).toBe(true);
  });

  it('forceCommandFailure throws GatewayCommandError', () => {
    expect(() => gateway.forceCommandFailure('locker-1')).toThrow(GatewayCommandError);
  });
});
