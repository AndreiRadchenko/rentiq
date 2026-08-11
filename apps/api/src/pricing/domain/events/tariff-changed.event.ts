import { DomainEvent } from '../../../shared-kernel/domain/events/domain-event';

export type TariffChangeType = 'CREATED' | 'UPDATED' | 'DELETED';

export class TariffChanged extends DomainEvent {
  readonly eventType = 'TariffChanged';
  constructor(
    public readonly tariffId: string,
    public readonly orgId: string,
    public readonly actorId: string,
    public readonly changeType: TariffChangeType,
    public readonly kitType: string,
    public readonly dayType: string,
    public readonly durationMinutes: number,
  ) {
    super();
  }
}
