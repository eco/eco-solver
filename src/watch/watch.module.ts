import { Module } from '@nestjs/common'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { QUEUES } from '@/common/redis/constants'
import { WatchCreateIntentService } from '@/watch/intent/watch-create-intent.service'
import { TransactionModule } from '@/transaction/transaction.module'
import { MongooseModule } from '@nestjs/mongoose'
import { IntentSourceModel, IntentSourceSchema } from '@/intent/schemas/intent-source.schema'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: IntentSourceModel.name, schema: IntentSourceSchema }]),
    initBullMQ(QUEUES.SOURCE_INTENT),
    TransactionModule
  ],
  providers: [
    WatchCreateIntentService,
  ],
  exports: [
    WatchCreateIntentService
  ],
})
export class WatchModule {}
