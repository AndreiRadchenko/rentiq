import { Injectable, Logger } from '@nestjs/common';
import {
  SmartLockGateway,
  DoorState,
  HaEntityId,
  GatewayUnreachableError,
  GatewayCommandError,
} from '../domain/smart-lock-gateway.port';
import type { HaConnectionConfigState } from '../domain/ha-connection-config.vo';

const CONNECT_TIMEOUT_MS = 3000;
const READ_TIMEOUT_MS = 5000;

@Injectable()
export class HomeAssistantGateway implements SmartLockGateway {
  private readonly logger = new Logger('HomeAssistantGateway');
  private readonly config: HaConnectionConfigState;

  constructor(config: HaConnectionConfigState) {
    this.config = config;
  }

  async readDoorState(entityId: HaEntityId): Promise<DoorState> {
    try {
      const resp = await this.haGet(`/api/states/${entityId}`);
      if (!resp.ok) return 'UNKNOWN';
      const body = (await resp.json()) as { state?: string };
      const state = body?.state;
      if (state === 'on' || state === 'open') return 'OPEN';
      if (state === 'off' || state === 'closed') return 'CLOSED';
      return 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }

  async unlock(entityId: HaEntityId): Promise<void> {
    await this.haCallAction(entityId, 'unlock');
  }

  async lock(entityId: HaEntityId): Promise<void> {
    await this.haCallAction(entityId, 'lock');
  }

  private async haCallAction(entityId: string, action: 'lock' | 'unlock'): Promise<void> {
    const domain = entityId.split('.')[0];
    if (domain === 'lock') {
      await this.haCall('lock', action, entityId);
      return;
    }
    if (domain === 'switch') {
      const service = action === 'unlock' ? 'turn_on' : 'turn_off';
      await this.haCall('switch', service, entityId);
      return;
    }
    throw new GatewayCommandError(`Unsupported HA entity domain for locker: ${domain}`);
  }

  async isReachable(): Promise<boolean> {
    try {
      const resp = await this.haGet('/api/', CONNECT_TIMEOUT_MS);
      return resp.ok;
    } catch {
      return false;
    }
  }

  private async haCall(domain: string, service: string, entityId: string): Promise<void> {
    const exists = await this.haGet(`/api/states/${entityId}`);
    if (exists.status === 404) {
      throw new GatewayCommandError(`HA entity not found: ${entityId}`);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
    try {
      const resp = await fetch(`${this.normalizeUrl()}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new GatewayCommandError(`HA ${service} failed: ${resp.status}`);
      }
      const body = (await resp.json().catch(() => null)) as { state?: string }[] | null;
      if (Array.isArray(body) && body.length === 0) {
        throw new GatewayCommandError(`HA ${service} matched no entity: ${entityId}`);
      }
    } catch (error) {
      if (error instanceof GatewayCommandError) throw error;
      throw new GatewayUnreachableError(`HA unreachable: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async haGet(path: string, timeoutMs = READ_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${this.normalizeUrl()}${path}`, {
        headers: { Authorization: `Bearer ${this.config.token}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeUrl(): string {
    let url = this.config.urlOrIp;
    if (!/^https?:\/\//.test(url)) {
      url = `http://${url}`;
    }
    return url.replace(/\/$/, '');
  }
}
