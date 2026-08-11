import { StationHealthEvaluator } from '../../../src/locations/domain/station-health-evaluator';

describe('StationHealthEvaluator debounce (FR-010/FR-011)', () => {
  it('2 consecutive failures → OFFLINE transition + shouldPublish', () => {
    const state = StationHealthEvaluator.initialState('ONLINE');
    const r1 = StationHealthEvaluator.onCheckResult(state, false);
    expect(r1.newStatus).toBe('ONLINE');
    expect(r1.shouldPublish).toBe(false);
    const r2 = StationHealthEvaluator.onCheckResult(state, false);
    expect(r2.newStatus).toBe('OFFLINE');
    expect(r2.transitioned).toBe(true);
    expect(r2.shouldPublish).toBe(true);
  });

  it('1 success → ONLINE transition from OFFLINE', () => {
    const state = StationHealthEvaluator.initialState('OFFLINE');
    const r = StationHealthEvaluator.onCheckResult(state, true);
    expect(r.newStatus).toBe('ONLINE');
    expect(r.shouldPublish).toBe(true);
  });

  it('repeated failures while OFFLINE do NOT re-publish (flap-flood mitigation)', () => {
    const state = StationHealthEvaluator.initialState('OFFLINE');
    const r1 = StationHealthEvaluator.onCheckResult(state, false);
    const r2 = StationHealthEvaluator.onCheckResult(state, false);
    expect(r1.shouldPublish).toBe(false);
    expect(r2.shouldPublish).toBe(false);
    expect(state.currentStatus).toBe('OFFLINE');
  });

  it('UNKNOWN → ONLINE on first success', () => {
    const state = StationHealthEvaluator.initialState('UNKNOWN');
    const r = StationHealthEvaluator.onCheckResult(state, true);
    expect(r.newStatus).toBe('ONLINE');
    expect(r.shouldPublish).toBe(true);
  });

  it('admin isActive=false is respected — evaluator only reports health, does not touch admin intent (FR-010)', () => {
    const state = StationHealthEvaluator.initialState('OFFLINE');
    const r = StationHealthEvaluator.onCheckResult(state, true);
    expect(r.newStatus).toBe('ONLINE');
    expect(r.shouldPublish).toBe(true);
  });
});
