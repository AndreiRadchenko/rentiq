import type { HaConnectionConfigState } from './ha-connection-config.vo';

export type DoorState = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type HaEntityId = string;

export class GatewayUnreachableError extends Error {
  constructor(message = 'Smart-lock gateway is unreachable') {
    super(message);
    this.name = 'GatewayUnreachableError';
  }
}

export class GatewayCommandError extends Error {
  constructor(message = 'Smart-lock gateway command failed') {
    super(message);
    this.name = 'GatewayCommandError';
  }
}

export interface SmartLockGateway {
  readDoorState(entityId: HaEntityId): Promise<DoorState>;
  unlock(entityId: HaEntityId): Promise<void>;
  lock(entityId: HaEntityId): Promise<void>;
  isReachable(): Promise<boolean>;
}

export const SMART_LOCK_GATEWAY = 'SMART_LOCK_GATEWAY';
export const SMART_LOCK_GATEWAY_FACTORY = 'SMART_LOCK_GATEWAY_FACTORY';

export interface SmartLockGatewayFactory {
  forStation(stationId: string, config: HaConnectionConfigState): SmartLockGateway;
}
