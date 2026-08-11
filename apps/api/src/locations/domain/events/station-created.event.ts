import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class StationCreated extends DomainEvent {
  readonly eventType = 'StationCreated';
  constructor(
    public readonly stationId: string,
    public readonly orgId: string,
    public readonly name: string,
    public readonly actorId: string,
  ) {
    super();
  }
}
