import { initBullMQ } from '@/bullmq/bullmq.helper'
import { IntentFundedEventsModule } from '@/watch/intent/intent-funded-events/intent-funded-events.module'
import { IntentProvenEventsModule } from '@/watch/intent/intent-proven-events/intent-proven-events.module'
import { Module } from '@nestjs/common'
import { QUEUES } from '@/common/redis/constants'
import { TransactionModule } from '@/transaction/transaction.module'
import { WatchCreateIntentService } from '@/watch/intent/watch-create-intent.service'
import { WatchFulfillmentService } from '@/watch/intent/watch-fulfillment.service'

@Module({
  imports: [
    initBullMQ(QUEUES.SOURCE_INTENT),
    initBullMQ(QUEUES.INBOX),
    TransactionModule,
    IntentFundedEventsModule,
    IntentProvenEventsModule,
  ],
  providers: [WatchCreateIntentService, WatchFulfillmentService],
  exports: [
    WatchCreateIntentService,
    WatchFulfillmentService,
    IntentFundedEventsModule,
    IntentProvenEventsModule,
  ],
})
export class WatchModule {}
