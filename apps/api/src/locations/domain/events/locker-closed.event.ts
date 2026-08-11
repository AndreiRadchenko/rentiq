import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';
import type { LockerActorType } from './locker-opened.event';

export class LockerClosed extends DomainEvent {
  readonly eventType = 'LockerClosed';
  constructor(
    public readonly lockerId: string,
    public readonly stationId: string,
    public readonly orgId: string,
    public readonly actorType: LockerActorType,
    public readonly actorId: string | null,
    public readonly rentalId: string | null,
    public readonly closedAt: string,
  ) {
    super();
  }
}
