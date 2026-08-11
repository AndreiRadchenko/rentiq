import { Injectable, Inject, Logger } from '@nestjs/common';
import { EVENT_BUS, EventBus } from '../../shared-kernel/application/ports/event-bus';
import { StationHealthChanged } from '../domain/events/station-health-changed.event';
import { StationHealthEvaluator, HealthEvaluatorState } from '../domain/station-health-evaluator';
import {
  SmartLockGateway,
  SmartLockGatewayFactory,
} from '../domain/smart-lock-gateway.port';
import { STATION_REPOSITORY, StationRepository } from './ports/station.repository';
import { Station } from '../domain/station.aggregate';
import type { StationHealthStatus } from '../infrastructure/drizzle/schema/stations.schema';

@Injectable()
export class StationHealthCheckerService {
  private readonly logger = new Logger('StationHealthChecker');
  private readonly evaluatorState = new Map<string, HealthEvaluatorState>();

  constructor(
    @Inject(STATION_REPOSITORY) private readonly stations: StationRepository,
    @Inject('SMART_LOCK_GATEWAY_FACTORY') private readonly gatewayFactory: SmartLockGatewayFactory,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async checkOne(station: Station): Promise<void> {
    const gateway = this.gatewayFactory.forStation(station.id, station.haConfig.toState());
    const isReachable = await this.safeIsReachable(gateway);
    const state = this.getOrCreateState(station.id, station.currentState.healthStatus);
    const outcome = StationHealthEvaluator.onCheckResult(state, isReachable);

    if (outcome.transitioned) {
      const previous = station.currentState.healthStatus;
      station.transitionHealth(outcome.newStatus, new Date());
      await this.stations.save(station);
      await this.eventBus.publish(
        new StationHealthChanged(
          station.id,
          station.orgId,
          outcome.newStatus === 'ONLINE',
          previous,
          outcome.newStatus,
          new Date().toISOString(),
        ),
      );
      this.logger.log(
        `Station ${station.id} health transitioned ${previous} -> ${outcome.newStatus}`,
      );
    }
  }

  async checkAllActive(): Promise<void> {
    const allOrgs: string[] = [];
    for (const station of await this.collectActiveStations(allOrgs)) {
      await this.checkOne(station);
    }
  }

  private async collectActiveStations(_orgs: string[]): Promise<Station[]> {
    return [];
  }

  private async safeIsReachable(gateway: SmartLockGateway): Promise<boolean> {
    try {
      return await gateway.isReachable();
    } catch {
      return false;
    }
  }

  private getOrCreateState(stationId: string, currentStatus: StationHealthStatus): HealthEvaluatorState {
    let state = this.evaluatorState.get(stationId);
    if (!state) {
      state = StationHealthEvaluator.initialState(currentStatus);
      this.evaluatorState.set(stationId, state);
    }
    return state;
  }
}
