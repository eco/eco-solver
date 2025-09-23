import { Module } from '@nestjs/common'
import { SignModule } from '@/sign/sign.module'
import { BalanceModule } from '@/balance/balance.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { IndexerModule } from '@/indexer/indexer.module'
import { IntentModule } from '@/intent/intent.module'
import { IntentProcessorQueue } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'

@Module({
  imports: [
    BalanceModule,
    TransactionModule,
    IndexerModule,
    SignModule,
    IntentModule,
    IntentProcessorQueue.init(),
  ],
  providers: [IntentProcessorService, IntentProcessor],
  exports: [],
})
export class IntentProcessorModule {}
