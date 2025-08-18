import { Module } from '@nestjs/common'
import { SignModule } from '@eco-solver/sign/sign.module'
import { BalanceModule } from '@eco-solver/balance/balance.module'
import { TransactionModule } from '@eco-solver/transaction/transaction.module'
import { IndexerModule } from '@eco-solver/indexer/indexer.module'
import { IntentProcessorQueue } from '@eco-solver/intent-processor/queues/intent-processor.queue'
import { IntentProcessorService } from '@eco-solver/intent-processor/services/intent-processor.service'
import { IntentProcessor } from '@eco-solver/intent-processor/processors/intent.processor'

@Module({
  imports: [
    BalanceModule,
    TransactionModule,
    IndexerModule,
    SignModule,
    IntentProcessorQueue.init(),
  ],
  providers: [IntentProcessorService, IntentProcessor],
  exports: [],
})
export class IntentProcessorModule {}
