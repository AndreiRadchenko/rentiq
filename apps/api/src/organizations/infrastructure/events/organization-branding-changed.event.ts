import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class OrganizationBrandingChanged extends DomainEvent {
  public readonly eventType = 'OrganizationBrandingChanged';

  constructor(public readonly orgId: string) {
    super();
  }
}
