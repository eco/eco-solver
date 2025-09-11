import { forwardRef, Module } from '@nestjs/common'
import { IntentFulfillmentProcessor } from '@/intent-fulfillment/processors/intent-fulfillment.processor'
import {
  IntentFulfillmentQueue,
  INTENT_FULFILLMENT_QUEUE_NAME,
} from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { IntentModule } from '@/intent/intent.module'
import { initBullMQ } from '@/bullmq/bullmq.helper'

@Module({
  imports: [
    initBullMQ(
      { queue: INTENT_FULFILLMENT_QUEUE_NAME, prefix: '{intent-fulfillment}' },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    ),
    forwardRef(() => IntentModule),
  ],
  providers: [IntentFulfillmentProcessor, IntentFulfillmentQueue],
  exports: [IntentFulfillmentQueue],
})
export class IntentFulfillmentModule {}
