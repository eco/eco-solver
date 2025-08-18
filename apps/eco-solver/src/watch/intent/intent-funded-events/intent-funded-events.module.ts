import { initBullMQ } from '@eco-solver/bullmq/bullmq.helper'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { WatchIntentFundedService } from '@eco-solver/watch/intent/intent-funded-events/services/watch-intent-funded.service'
import {
  IntentFundedEventModel,
  IntentFundedEventSchema,
} from '@eco-solver/watch/intent/intent-funded-events/schemas/intent-funded-events.schema'
import { IntentFundedEventRepository } from '@eco-solver/watch/intent/intent-funded-events/repositories/intent-funded-event.repository'
import { TransactionModule } from '@eco-solver/transaction/transaction.module'
import { IntentModule } from '@eco-solver/intent/intent.module'

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
