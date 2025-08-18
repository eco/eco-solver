import { Module } from '@nestjs/common'
import { RetryInfeasableIntentsService } from '@eco-solver/intervals/retry-infeasable-intents.service'
import { initBullMQ } from '@eco-solver/bullmq/bullmq.helper'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { IntentModule } from '@eco-solver/intent/intent.module'
import { ProverModule } from '@eco-solver/prover/prover.module'
import { IntervalProcessor } from '@eco-solver/bullmq/processors/interval.processor'

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
