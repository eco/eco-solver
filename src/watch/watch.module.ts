import { Module } from '@nestjs/common'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { QUEUES } from '@/common/redis/constants'
import { WatchCreateIntentService } from '@/watch/intent/watch-create-intent.service'
import { TransactionModule } from '@/transaction/transaction.module'
import { WatchFulfillmentService } from '@/watch/intent/watch-fulfillment.service'
import { IntentFundedEventsModule } from '@/watch/intent/intent-funded-events/intent-funded-events.module'

@Module({
  imports: [
    initBullMQ(QUEUES.SOURCE_INTENT),
    initBullMQ(QUEUES.INBOX),
    TransactionModule,
    IntentFundedEventsModule,
  ],
  providers: [WatchCreateIntentService, WatchFulfillmentService],
  exports: [WatchCreateIntentService, WatchFulfillmentService, IntentFundedEventsModule],
})
export class WatchModule {}
