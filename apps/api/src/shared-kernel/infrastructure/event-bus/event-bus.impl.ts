import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventBus } from '../../application/ports/event-bus';
import { DomainEvent } from '../../domain/events/domain-event';

@Injectable()
export class InProcessEventBus implements EventBus {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    this.eventEmitter.emit(event.eventType, event);
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    this.eventEmitter.on(eventType, handler);
  }
}
