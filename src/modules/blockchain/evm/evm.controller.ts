import { Body, Controller, Param, Post } from '@nestjs/common';

import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { EvmEventParser } from '@/modules/blockchain/evm/utils/evm-event-parser';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

@Controller('evm')
export class EVMController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post(':chainID')
  async processIntent(@Param('chainID') chainID: string, @Body() intent: object) {
    const log = JSON.stringify(intent);
    const _intent = EvmEventParser.parseIntentPublish(
      BigInt(chainID),
      BigintSerializer.deserialize(log),
    );
    await this.fulfillmentService.submitIntent(_intent);
  }
}
