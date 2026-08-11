import type { LockerStatus } from './locker-types';

export { type LockerStatus };

export interface LockerState {
  id: string;
  stationId: string;
  name: string;
  status: LockerStatus;
  haLockEntityId: string;
  haDoorSensorEntityId: string;
  currentRentalId: string | null;
  inventoryKitId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CreateLockerInput {
  id: string;
  stationId: string;
  name: string;
  haLockEntityId: string;
  haDoorSensorEntityId: string;
}

export class LockerAlreadyReservedError extends Error {
  constructor(message = 'Locker is already reserved') {
    super(message);
    this.name = 'LockerAlreadyReservedError';
  }
}

export class Locker {
  private constructor(private readonly state: LockerState) {}

  static create(input: CreateLockerInput): Locker {
    if (!input.name.trim()) throw new Error('Locker name must not be empty');
    if (!input.haLockEntityId.trim()) throw new Error('haLockEntityId must not be empty');
    if (!input.haDoorSensorEntityId.trim()) throw new Error('haDoorSensorEntityId must not be empty');
    return new Locker({
      id: input.id,
      stationId: input.stationId,
      name: input.name.trim(),
      status: 'AVAILABLE',
      haLockEntityId: input.haLockEntityId.trim(),
      haDoorSensorEntityId: input.haDoorSensorEntityId.trim(),
      currentRentalId: null,
      inventoryKitId: null,
      createdAt: new Date(),
      deletedAt: null,
    });
  }

  static reconstitute(state: LockerState): Locker {
    return new Locker({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get stationId(): string {
    return this.state.stationId;
  }

  get haLockEntityId(): string {
    return this.state.haLockEntityId;
  }

  get haDoorSensorEntityId(): string {
    return this.state.haDoorSensorEntityId;
  }

  get currentState(): LockerState {
    return { ...this.state };
  }

  get status(): LockerStatus {
    return this.state.status;
  }

  get inventoryKitId(): string | null {
    return this.state.inventoryKitId;
  }

  get currentRentalId(): string | null {
    return this.state.currentRentalId;
  }

  get isAvailable(): boolean {
    return this.state.status === 'AVAILABLE' && this.state.currentRentalId === null;
  }

  update(patch: Partial<Pick<LockerState, 'name'>>): void {
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new Error('Locker name must not be empty');
      this.state.name = patch.name.trim();
    }
  }

  updateHaEntityIds(lockEntityId: string, doorSensorEntityId: string): void {
    if (!lockEntityId.trim()) throw new Error('haLockEntityId must not be empty');
    if (!doorSensorEntityId.trim()) throw new Error('haDoorSensorEntityId must not be empty');
    this.state.haLockEntityId = lockEntityId.trim();
    this.state.haDoorSensorEntityId = doorSensorEntityId.trim();
  }

  assignKit(kitId: string): void {
    this.state.inventoryKitId = kitId;
  }

  unassignKit(): void {
    this.state.inventoryKitId = null;
  }

  setMaintenance(): void {
    this.state.status = 'MAINTENANCE';
  }

  setAvailable(): void {
    if (this.state.currentRentalId !== null) {
      throw new Error('Cannot set locker AVAILABLE while a rental is active');
    }
    this.state.status = 'AVAILABLE';
  }

  reserveFor(rentalId: string): void {
    if (this.state.currentRentalId !== null) {
      throw new LockerAlreadyReservedError();
    }
    this.state.currentRentalId = rentalId;
    this.state.status = 'RESERVED';
  }

  release(): void {
    this.state.currentRentalId = null;
    this.state.status = 'AVAILABLE';
  }

  softDelete(now: Date = new Date()): void {
    this.state.deletedAt = now;
  }
}
