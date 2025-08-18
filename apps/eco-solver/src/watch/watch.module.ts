import { Module } from '@nestjs/common'
import { initBullMQ } from '@eco-solver/bullmq/bullmq.helper'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { WatchCreateIntentService } from '@eco-solver/watch/intent/watch-create-intent.service'
import { TransactionModule } from '@eco-solver/transaction/transaction.module'
import { WatchFulfillmentService } from '@eco-solver/watch/intent/watch-fulfillment.service'
import { IntentFundedEventsModule } from '@eco-solver/watch/intent/intent-funded-events/intent-funded-events.module'

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
