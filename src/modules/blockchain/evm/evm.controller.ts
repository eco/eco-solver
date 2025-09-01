import { Body, Controller, Param, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { parseIntentPublish } from '@/modules/blockchain/evm/utils/events';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

@Controller('evm')
export class EVMController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Post(':chainID')
  async processIntent(@Param('chainID') chainID: string, @Body() intent: object) {
    const log = JSON.stringify(intent);
    const _intent = parseIntentPublish(BigInt(chainID), QueueSerializer.deserialize(log));
    this.eventEmitter.emit('intent.discovered', { intent: _intent, strategy: 'standard' });
  }
}
