import { DomainEvent } from '../../domain/events/domain-event';
import { EVENT_BUS } from './tokens';

export { EVENT_BUS };

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}
