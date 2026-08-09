import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class AdminAccountDisabled extends DomainEvent {
  public readonly eventType = 'AdminAccountDisabled';

  constructor(
    public readonly adminAccountId: string,
    public readonly orgId: string | null,
  ) {
    super();
  }
}
