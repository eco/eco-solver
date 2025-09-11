import { Module } from '@nestjs/common'
import { SignModule } from '@/sign/sign.module'
import { BalanceModule } from '@/balance/balance.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { IndexerModule } from '@/indexer/indexer.module'
import { QUEUES } from '@/common/redis/constants'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'

@Module({
  imports: [
    BalanceModule,
    TransactionModule,
    IndexerModule,
    SignModule,
    initBullMQ(QUEUES.INTENT_PROCESSOR),
  ],
  providers: [IntentProcessorService],
  exports: [],
})
export class IntentProcessorModule {}
