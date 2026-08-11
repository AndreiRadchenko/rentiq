import { Injectable } from '@nestjs/common';
import {
  SmartLockGateway,
  DoorState,
  HaEntityId,
  GatewayUnreachableError,
  GatewayCommandError,
} from '../domain/smart-lock-gateway.port';

interface MockState {
  door: DoorState;
  locked: boolean;
}

@Injectable()
export class MockSmartLockGateway implements SmartLockGateway {
  private readonly doorState = new Map<HaEntityId, MockState>();
  private readonly unreachableStations = new Set<string>();
  private stationForLocker: (lockerId: HaEntityId) => string | undefined = () => undefined;

  setStationResolver(resolver: (lockerId: HaEntityId) => string | undefined): void {
    this.stationForLocker = resolver;
  }

  setReachable(stationId: string, reachable: boolean): void {
    if (reachable) {
      this.unreachableStations.delete(stationId);
    } else {
      this.unreachableStations.add(stationId);
    }
  }

  setDoorState(lockerId: HaEntityId, state: DoorState): void {
    this.ensure(lockerId).door = state;
  }

  setLocked(lockerId: HaEntityId, locked: boolean): void {
    this.ensure(lockerId).locked = locked;
  }

  getDoorState(lockerId: HaEntityId): DoorState {
    return this.ensure(lockerId).door;
  }

  isLocked(lockerId: HaEntityId): boolean {
    return this.ensure(lockerId).locked;
  }

  async readDoorState(lockerId: HaEntityId): Promise<DoorState> {
    await this.delay();
    if (this.isLockerUnreachable(lockerId)) return 'UNKNOWN';
    return this.ensure(lockerId).door;
  }

  async unlock(lockerId: HaEntityId): Promise<void> {
    await this.delay();
    if (this.isLockerUnreachable(lockerId)) {
      throw new GatewayUnreachableError(`Mock gateway unreachable for locker ${lockerId}`);
    }
    this.ensure(lockerId).locked = false;
    this.ensure(lockerId).door = 'OPEN';
  }

  async lock(lockerId: HaEntityId): Promise<void> {
    await this.delay();
    if (this.isLockerUnreachable(lockerId)) {
      throw new GatewayUnreachableError(`Mock gateway unreachable for locker ${lockerId}`);
    }
    this.ensure(lockerId).locked = true;
    this.ensure(lockerId).door = 'CLOSED';
  }

  async isReachable(): Promise<boolean> {
    await this.delay();
    return true;
  }

  isStationReachable(stationId: string): boolean {
    return !this.unreachableStations.has(stationId);
  }

  forceCommandFailure(_lockerId: HaEntityId): void {
    throw new GatewayCommandError('Forced command failure');
  }

  reset(): void {
    this.doorState.clear();
    this.unreachableStations.clear();
  }

  private ensure(lockerId: HaEntityId): MockState {
    let state = this.doorState.get(lockerId);
    if (!state) {
      state = { door: 'CLOSED', locked: true };
      this.doorState.set(lockerId, state);
    }
    return state;
  }

  private isLockerUnreachable(lockerId: HaEntityId): boolean {
    const stationId = this.stationForLocker(lockerId);
    return stationId !== undefined && this.unreachableStations.has(stationId);
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 10));
  }
}
