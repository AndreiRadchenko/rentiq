import { Module, Global } from '@nestjs/common';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { InProcessEventBus } from './event-bus.impl';
import { EVENT_BUS } from '../../application/ports/event-bus';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    {
      provide: EVENT_BUS,
      useFactory: (eventEmitter: EventEmitter2) => new InProcessEventBus(eventEmitter),
      inject: [EventEmitter2],
    },
  ],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
