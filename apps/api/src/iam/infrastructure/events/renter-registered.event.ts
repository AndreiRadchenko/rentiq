import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class RenterRegistered extends DomainEvent {
  public readonly eventType = 'RenterRegistered';

  constructor(
    public readonly renterId: string,
    public readonly orgId: string,
    public readonly locale: string,
  ) {
    super();
  }
}
