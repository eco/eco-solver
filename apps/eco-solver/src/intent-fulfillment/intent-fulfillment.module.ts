import { forwardRef, Module } from '@nestjs/common'
import { IntentFulfillmentProcessor } from '@eco-solver/intent-fulfillment/processors/intent-fulfillment.processor'
import { IntentFulfillmentQueue } from '@eco-solver/intent-fulfillment/queues/intent-fulfillment.queue'
import { IntentModule } from '@eco-solver/intent/intent.module'

@Module({
  imports: [IntentFulfillmentQueue.init(), forwardRef(() => IntentModule)],
  providers: [IntentFulfillmentProcessor, IntentFulfillmentQueue],
  exports: [IntentFulfillmentQueue],
})
export class IntentFulfillmentModule {}
