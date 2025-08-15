import { Module } from '@nestjs/common'
import { IntentFulfillmentProcessor } from '@/intent-fulfillment/processors/intent-fulfillment.processor'
import { IntentFulfillmentQueue } from '@/intent-fulfillment/queues/intent-fulfillment.queue'

@Module({
  imports: [IntentFulfillmentQueue.init()],
  providers: [IntentFulfillmentProcessor, IntentFulfillmentQueue],
  exports: [IntentFulfillmentQueue],
})
export class IntentFulfillmentModule {}
