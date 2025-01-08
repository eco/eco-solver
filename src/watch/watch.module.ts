import { Module } from '@nestjs/common'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { QUEUES } from '@/common/redis/constants'
import { WatchCreateIntentService } from '@/watch/intent/watch-create-intent.service'
import { TransactionModule } from '@/transaction/transaction.module'
import { WatchFulfillmentService } from '@/watch/intent/watch-fulfillment.service'

@Module({
  imports: [initBullMQ(QUEUES.SOURCE_INTENT), initBullMQ(QUEUES.INBOX), TransactionModule],
  providers: [WatchCreateIntentService, WatchFulfillmentService],
  exports: [WatchCreateIntentService, WatchFulfillmentService],
})
export class WatchModule {}
