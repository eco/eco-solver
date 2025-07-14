/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { IntentModule } from '@/intent/intent.module'
import { Module } from '@nestjs/common'
import { QUEUES } from '@/common/redis/constants'
import { TransactionModule } from '@/transaction/transaction.module'
import { WatchIntentProvenService } from '@/watch/intent/intent-proven-events/services/watch-intent-proven.service'

@Module({
  imports: [TransactionModule, initBullMQ(QUEUES.SOURCE_INTENT), IntentModule],
  providers: [WatchIntentProvenService],
  exports: [WatchIntentProvenService],
})
export class IntentProvenEventsModule {}
