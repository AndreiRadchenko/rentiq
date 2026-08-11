import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class StationVisibilityChanged extends DomainEvent {
  readonly eventType = 'StationVisibilityChanged';
  constructor(
    public readonly stationId: string,
    public readonly orgId: string,
    public readonly actorId: string,
    public readonly isActive: boolean,
    public readonly isVisibleToClients: boolean,
    public readonly workingStatus: string,
  ) {
    super();
  }
}
