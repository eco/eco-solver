import { Module } from '@nestjs/common'
import { IntentFulfillmentProcessor } from '@/intent-fulfillment/processors/intent-fulfillment.processor'
import { IntentFulfillmentQueue } from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { IntentModule } from '@/intent/intent.module'

@Module({
  imports: [IntentFulfillmentQueue.init(), IntentModule],
  providers: [IntentFulfillmentProcessor],
  exports: [IntentFulfillmentQueue.init()],
})
export class IntentFulfillmentModule {}
