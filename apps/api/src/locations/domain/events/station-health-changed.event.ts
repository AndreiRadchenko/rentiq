import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class StationHealthChanged extends DomainEvent {
  readonly eventType = 'StationHealthChanged';
  constructor(
    public readonly stationId: string,
    public readonly orgId: string,
    public readonly isOnline: boolean,
    public readonly previousStatus: string,
    public readonly currentStatus: string,
    public readonly checkedAt: string,
  ) {
    super();
  }
}
