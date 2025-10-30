import { Module } from '@nestjs/common'
import { RetryInfeasableIntentsService } from '@/intervals/retry-infeasable-intents.service'
import { QUEUES } from '@/common/redis/constants'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { IntentModule } from '@/intent/intent.module'
import { ProverModule } from '@/prover/prover.module'
import { IntervalProcessor } from '@/bullmq/processors/interval.processor'

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
