import type { StationHealthStatus } from './station-types';

export interface HealthCheckOutcome {
  newStatus: StationHealthStatus;
  transitioned: boolean;
  shouldPublish: boolean;
}

export interface HealthEvaluatorState {
  consecutiveFailures: number;
  currentStatus: StationHealthStatus;
}

export class StationHealthEvaluator {
  static onCheckResult(state: HealthEvaluatorState, isReachable: boolean): HealthCheckOutcome {
    let newStatus: StationHealthStatus = state.currentStatus;
    let transitioned = false;

    if (isReachable) {
      if (state.currentStatus === 'OFFLINE' || state.currentStatus === 'UNKNOWN') {
        newStatus = 'ONLINE';
        transitioned = true;
      }
      state.consecutiveFailures = 0;
    } else {
      state.consecutiveFailures += 1;
      if (state.consecutiveFailures >= 2 && state.currentStatus !== 'OFFLINE') {
        newStatus = 'OFFLINE';
        transitioned = true;
      }
    }

    state.currentStatus = newStatus;
    return { newStatus, transitioned, shouldPublish: transitioned };
  }

  static initialState(currentStatus: StationHealthStatus): HealthEvaluatorState {
    return { consecutiveFailures: 0, currentStatus };
  }
}
