import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export class UnverifiedLockerFinish extends DomainEvent {
  readonly eventType = 'UnverifiedLockerFinish';
  constructor(
    public readonly rentalId: string,
    public readonly lockerIds: string[],
    public readonly orgId: string,
    public readonly reason: string,
  ) {
    super();
  }
}
