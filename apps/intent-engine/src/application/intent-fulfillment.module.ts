import { Module, forwardRef } from '@nestjs/common'
import { IntentFulfillmentProcessor } from './processors/intent-fulfillment.processor'
import { IntentFulfillmentQueue } from './queues/intent-fulfillment.queue'
import { IntentModule } from '../domain/intent.module'

@Module({
  imports: [IntentFulfillmentQueue.init(), forwardRef(() => IntentModule)],
  providers: [IntentFulfillmentProcessor, IntentFulfillmentQueue],
  exports: [IntentFulfillmentQueue],
})
export class IntentFulfillmentModule {}
