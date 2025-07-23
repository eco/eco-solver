import { initBullMQ } from '@/bullmq/bullmq.helper'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { QUEUES } from '@/common/redis/constants'
import { WatchIntentFundedService } from '@/watch/intent/intent-funded-events/services/watch-intent-funded.service'
import {
  IntentFundedEventModel,
  IntentFundedEventSchema,
} from '@/watch/intent/intent-funded-events/schemas/intent-funded-events.schema'
import { IntentFundedEventRepository } from '@/watch/intent/intent-funded-events/repositories/intent-funded-event.repository'
import { TransactionModule } from '@/transaction/transaction.module'
import { IntentModule } from '@/intent/intent.module'
import { QuoteModule } from '@/quote/quote.module'

@Module({
  imports: [
    TransactionModule,
    initBullMQ(QUEUES.SOURCE_INTENT),
    MongooseModule.forFeature([
      { name: IntentFundedEventModel.name, schema: IntentFundedEventSchema },
    ]),
    IntentModule,
    QuoteModule,
  ],
  providers: [WatchIntentFundedService, IntentFundedEventRepository],
  exports: [WatchIntentFundedService, IntentFundedEventRepository, MongooseModule],
})
export class IntentFundedEventsModule {}
