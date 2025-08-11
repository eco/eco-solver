import { Module } from '@nestjs/common'
import { IntentProcessorService } from './services/intent-processor.service'
import { IntentProcessor } from './processors/intent.processor'
import { IntentProcessorQueue } from './queues/intent-processor.queue'

// TODO: Import these from the correct libraries once they are available
// import { BalanceModule } from '@libs/...'
// import { TransactionModule } from '@libs/...'
// import { IndexerModule } from '@libs/...'
// import { SignModule } from '@libs/...'

@Module({
  imports: [
    // BalanceModule,
    // TransactionModule,
    // IndexerModule,
    // SignModule,
    IntentProcessorQueue.init(),
  ],
  providers: [IntentProcessorService, IntentProcessor],
  exports: [],
})
export class IntentProcessorModule {}
