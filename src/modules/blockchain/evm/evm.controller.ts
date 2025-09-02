import { Body, Controller, Param, Post } from '@nestjs/common';

import { parseIntentPublish } from '@/modules/blockchain/evm/utils/events';
import { EventsService } from '@/modules/events/events.service';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

@Controller('evm')
export class EVMController {
  constructor(private readonly eventsService: EventsService) {}

  @Post(':chainID')
  async processIntent(@Param('chainID') chainID: string, @Body() intent: object) {
    const log = JSON.stringify(intent);
    const _intent = parseIntentPublish(BigInt(chainID), QueueSerializer.deserialize(log));
    this.eventsService.emit('intent.discovered', { intent: _intent, strategy: 'standard' });
  }
}
