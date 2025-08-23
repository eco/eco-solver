import { initBullMQ } from '../../../bullmq/bullmq.helper'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { QUEUES } from '../../../common/redis/constants'
import { WatchIntentFundedService } from './services/watch-intent-funded.service'
import {
  IntentFundedEventModel,
  IntentFundedEventSchema,
} from './schemas/intent-funded-events.schema'
import { IntentFundedEventRepository } from './repositories/intent-funded-event.repository'
import { TransactionModule } from '../../../transaction/transaction.module'
import { IntentModule } from '../../../intent/intent.module'

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
