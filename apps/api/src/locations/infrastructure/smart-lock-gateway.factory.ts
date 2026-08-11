import { Injectable, Logger } from '@nestjs/common';
import {
  SmartLockGateway,
  SmartLockGatewayFactory,
} from '../domain/smart-lock-gateway.port';
import { MockSmartLockGateway } from './mock-smart-lock.gateway';
import { HomeAssistantGateway } from './home-assistant.gateway';
import type { HaConnectionConfigState } from '../domain/ha-connection-config.vo';

@Injectable()
export class SmartLockGatewayFactoryImpl implements SmartLockGatewayFactory {
  private readonly logger = new Logger('SmartLockGatewayFactory');
  private readonly cache = new Map<string, SmartLockGateway>();

  constructor(private readonly mock: MockSmartLockGateway) {}

  forStation(stationId: string, config: HaConnectionConfigState): SmartLockGateway {
    const cached = this.cache.get(stationId);
    if (cached) return cached;

    const gateway = this.isMockConfig(config) ? this.mock : new HomeAssistantGateway(config);
    this.cache.set(stationId, gateway);
    return gateway;
  }

  private isMockConfig(config: HaConnectionConfigState): boolean {
    const url = config.urlOrIp.trim();
    return url === 'mock://' || url.startsWith('mock://');
  }
}