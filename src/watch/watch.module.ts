import { Module } from '@nestjs/common'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { QUEUES } from '@/common/redis/constants'
import { WatchCreateIntentService } from '@/watch/intent/watch-create-intent.service'
import { TransactionModule } from '@/transaction/transaction.module'
import { WatchFulfillmentService } from '@/watch/intent/watch-fulfillment.service'
import { WatchWithdrawalService } from '@/watch/intent/watch-withdrawal.service'
import { IntentFundedEventsModule } from '@/watch/intent/intent-funded-events/intent-funded-events.module'
import { WatchTokensService } from '@/watch/balance/watch-tokens.service'
import { WatchNativeService } from '@/watch/balance/watch-native.service'

@Module({
  imports: [
    initBullMQ(QUEUES.SOURCE_INTENT),
    initBullMQ(QUEUES.INBOX),
    initBullMQ(QUEUES.WATCH_RPC),
    TransactionModule,
    IntentFundedEventsModule,
  ],
  providers: [
    WatchCreateIntentService,
    WatchFulfillmentService,
    WatchWithdrawalService,
    WatchTokensService,
    WatchNativeService,
  ],
  exports: [
    WatchCreateIntentService,
    WatchFulfillmentService,
    WatchWithdrawalService,
    WatchTokensService,
    WatchNativeService,
    IntentFundedEventsModule,
  ],
})
export class WatchModule {}
