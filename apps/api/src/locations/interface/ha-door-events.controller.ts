import { Controller, Post, Body, Headers } from '@nestjs/common';
import { DoorEventHandler } from '../application/door-event.handler';

interface DoorEventBody {
  stationId: string;
  doorSensor: string;
  doorState?: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  eventTimestamp?: string;
}

@Controller('v1/webhooks/ha/door-events')
export class HaDoorEventsController {
  constructor(private readonly handler: DoorEventHandler) {}

  @Post()
  async handle(@Body() body: DoorEventBody, @Headers('x-ha-webhook-secret') secret?: string): Promise<{ acknowledged: true }> {
    await this.handler.handle(
      {
        stationId: body.stationId,
        doorSensor: body.doorSensor,
        doorState: body.doorState,
        eventTimestamp: body.eventTimestamp,
      },
      secret,
    );
    return { acknowledged: true };
  }
}
