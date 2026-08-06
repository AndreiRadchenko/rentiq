import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class OrganizationSuspended extends DomainEvent {
  public readonly eventType = 'OrganizationSuspended';

  constructor(public readonly orgId: string) {
    super();
  }
}
