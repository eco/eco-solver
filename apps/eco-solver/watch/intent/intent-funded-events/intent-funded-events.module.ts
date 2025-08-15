import { initBullMQ } from '@/bullmq/bullmq.helper'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { QUEUES } from '@eco/infrastructure-redis'
import { WatchIntentFundedService } from '@/watch/intent/intent-funded-events/services/watch-intent-funded.service'
import {
  IntentFundedEventModel,
  IntentFundedEventSchema,
} from '@eco/infrastructure-database'
import { IntentFundedEventRepository } from './repositories/intent-funded-event.repository'
import { TransactionModule } from '@/transaction/transaction.module'
import { IntentModule } from '@/intent/intent.module'

@Module({
  imports: [
    TransactionModule,
    initBullMQ(QUEUES.SOURCE_INTENT),
    MongooseModule.forFeature([
      { name: IntentFundedEventModel.name, schema: IntentFundedEventSchema },
    ]),
    IntentModule,
  ],
  providers: [WatchIntentFundedService, IntentFundedEventRepository],
  exports: [WatchIntentFundedService, IntentFundedEventRepository, MongooseModule],
})
export class IntentFundedEventsModule {}
