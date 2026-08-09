import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';
import { AdminRole } from '../../domain/admin-account';

export class AdminAccountCreated extends DomainEvent {
  public readonly eventType = 'AdminAccountCreated';

  constructor(
    public readonly adminAccountId: string,
    public readonly orgId: string | null,
    public readonly role: AdminRole,
  ) {
    super();
  }
}
