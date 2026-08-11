import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class UnauthorizedDoorOpenDetected extends DomainEvent {
  readonly eventType = 'UnauthorizedDoorOpenDetected';
  constructor(
    public readonly lockerId: string,
    public readonly stationId: string,
    public readonly orgId: string,
    public readonly detectedAt: string,
  ) {
    super();
  }
}
