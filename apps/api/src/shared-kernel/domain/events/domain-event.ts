import { EntityId } from '../value-objects/entity-id';

export abstract class DomainEvent {
  public readonly eventId: EntityId;
  public readonly occurredAt: Date;
  public abstract readonly eventType: string;

  constructor() {
    this.eventId = EntityId.generate();
    this.occurredAt = new Date();
  }
}
