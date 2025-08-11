import { Module } from '@nestjs/common'
import { RetryInfeasableIntentsService } from './retry-infeasable-intents.service'
import { initBullMQ, QUEUES } from '@libs/messaging'
import { IntervalProcessor } from '@libs/messaging/processors'
import { IntentModule, ProverModule } from '@libs/domain'

@Module({
  imports: [
    initBullMQ(QUEUES.INTERVAL),
    initBullMQ(QUEUES.SOURCE_INTENT),
    IntentModule,
    ProverModule,
  ],
  providers: [RetryInfeasableIntentsService, IntervalProcessor],
})
export class IntervalModule {}
