import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class OrganizationCreated extends DomainEvent {
  public readonly eventType = 'OrganizationCreated';

  constructor(
    public readonly orgId: string,
    public readonly slug: string,
  ) {
    super();
  }
}
