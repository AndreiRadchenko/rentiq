import { HaConnectionConfig } from './ha-connection-config.vo';
import type { StationWorkingStatus, StationHealthStatus } from './station-types';

export { type StationWorkingStatus, type StationHealthStatus };

export interface StationState {
  id: string;
  orgId: string;
  name: string;
  address: string | null;
  workingStatus: StationWorkingStatus;
  isActive: boolean;
  adminIntendedIsActive: boolean;
  isVisibleToClients: boolean;
  sortOrder: number;
  haUrlOrIp: string;
  haToken: string;
  haWebhookSecret: string;
  autoLockDelaySec: number;
  healthStatus: StationHealthStatus;
  lastHealthCheckAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CreateStationInput {
  id: string;
  orgId: string;
  name: string;
  address?: string | null;
  haUrlOrIp: string;
  haToken: string;
  haWebhookSecret: string;
  autoLockDelaySec?: number;
  sortOrder?: number;
}

export type HealthTransition = 'ONLINE_TO_OFFLINE' | 'OFFLINE_TO_ONLINE' | 'UNKNOWN_TO_ONLINE' | 'UNKNOWN_TO_OFFLINE' | 'NONE';

export class Station {
  private constructor(private readonly state: StationState) {}

  static create(input: CreateStationInput): Station {
    const config = HaConnectionConfig.create({
      urlOrIp: input.haUrlOrIp,
      token: input.haToken,
      autoLockDelaySeconds: input.autoLockDelaySec ?? 30,
    });
    if (!input.haWebhookSecret?.trim()) {
      throw new Error('Station haWebhookSecret must not be empty');
    }
    return new Station({
      id: input.id,
      orgId: input.orgId,
      name: input.name.trim(),
      address: input.address ?? null,
      workingStatus: 'WORKING',
      isActive: true,
      adminIntendedIsActive: true,
      isVisibleToClients: false,
      sortOrder: input.sortOrder ?? 0,
      haUrlOrIp: config.url,
      haToken: config.token,
      haWebhookSecret: input.haWebhookSecret.trim(),
      autoLockDelaySec: config.autoLockDelaySec,
      healthStatus: 'UNKNOWN',
      lastHealthCheckAt: null,
      createdAt: new Date(),
      deletedAt: null,
    });
  }

  static reconstitute(state: StationState): Station {
    return new Station({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get orgId(): string {
    return this.state.orgId;
  }

  get name(): string {
    return this.state.name;
  }

  get currentState(): StationState {
    return { ...this.state };
  }

  get isBookableActive(): boolean {
    return this.state.adminIntendedIsActive && this.state.healthStatus !== 'OFFLINE';
  }

  get isVisibleToClients(): boolean {
    return this.state.isVisibleToClients;
  }

  get workingStatus(): StationWorkingStatus {
    return this.state.workingStatus;
  }

  get healthStatus(): StationHealthStatus {
    return this.state.healthStatus;
  }

  get haConfig() {
    return HaConnectionConfig.create({
      urlOrIp: this.state.haUrlOrIp,
      token: this.state.haToken,
      autoLockDelaySeconds: this.state.autoLockDelaySec,
    });
  }

  get haWebhookSecret(): string {
    return this.state.haWebhookSecret;
  }

  update(patch: Partial<Pick<StationState, 'name' | 'address' | 'sortOrder'>>): void {
    if (patch.name !== undefined) this.state.name = patch.name.trim();
    if (patch.address !== undefined) this.state.address = patch.address;
    if (patch.sortOrder !== undefined) this.state.sortOrder = patch.sortOrder;
  }

  setActive(value: boolean): void {
    this.state.adminIntendedIsActive = value;
    this.state.isActive = value && this.state.healthStatus !== 'OFFLINE';
  }

  setVisible(value: boolean): void {
    this.state.isVisibleToClients = value;
  }

  markMaintenance(): void {
    this.state.workingStatus = 'MAINTENANCE';
  }

  setWorking(): void {
    this.state.workingStatus = 'WORKING';
  }

  setWorkingStatus(value: StationWorkingStatus): void {
    this.state.workingStatus = value;
  }

  updateHaConfig(urlOrIp: string, haToken: string, autoLockDelaySec: number, haWebhookSecret?: string): void {
    const config = HaConnectionConfig.create({ urlOrIp, token: haToken, autoLockDelaySeconds: autoLockDelaySec });
    this.state.haUrlOrIp = config.url;
    this.state.haToken = config.token;
    this.state.autoLockDelaySec = config.autoLockDelaySec;
    if (haWebhookSecret !== undefined) {
      if (!haWebhookSecret.trim()) throw new Error('Station haWebhookSecret must not be empty');
      this.state.haWebhookSecret = haWebhookSecret.trim();
    }
  }

  transitionHealth(newStatus: StationHealthStatus, now: Date = new Date()): HealthTransition {
    const previous = this.state.healthStatus;
    if (previous === newStatus) {
      this.state.lastHealthCheckAt = now;
      return 'NONE';
    }
    let transition: HealthTransition = 'NONE';
    if (previous === 'ONLINE' && newStatus === 'OFFLINE') transition = 'ONLINE_TO_OFFLINE';
    else if (previous === 'OFFLINE' && newStatus === 'ONLINE') transition = 'OFFLINE_TO_ONLINE';
    else if (previous === 'UNKNOWN' && newStatus === 'ONLINE') transition = 'UNKNOWN_TO_ONLINE';
    else if (previous === 'UNKNOWN' && newStatus === 'OFFLINE') transition = 'UNKNOWN_TO_OFFLINE';

    this.state.healthStatus = newStatus;
    this.state.lastHealthCheckAt = now;
    this.state.isActive = this.state.adminIntendedIsActive && newStatus !== 'OFFLINE';
    return transition;
  }

  softDelete(now: Date = new Date()): void {
    this.state.deletedAt = now;
  }
}
