import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export type LockerActorType = 'RENTER' | 'ADMIN' | 'SYSTEM';

export class LockerOpened extends DomainEvent {
  readonly eventType = 'LockerOpened';
  constructor(
    public readonly lockerId: string,
    public readonly stationId: string,
    public readonly orgId: string,
    public readonly actorType: LockerActorType,
    public readonly actorId: string | null,
    public readonly rentalId: string | null,
    public readonly openedAt: string,
  ) {
    super();
  }
}
