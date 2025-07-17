import { initBullMQ } from '@/bullmq/bullmq.helper'
import { IntentModule } from '@/intent/intent.module'
import { IntentProcessorModule } from '@/intent-processor/intent-processor.module'
import { Module } from '@nestjs/common'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'
import { PublicNegativeIntentRebalanceService } from '@/negative-intents/services/public-negative-intent-rebalance.service'
import { QUEUES } from '@/common/redis/constants'

@Module({
  imports: [initBullMQ(QUEUES.SOURCE_INTENT), IntentModule, IntentProcessorModule],
  providers: [PublicNegativeIntentRebalanceService, NegativeIntentAnalyzerService],
  exports: [PublicNegativeIntentRebalanceService, NegativeIntentAnalyzerService],
})
export class NegativeIntentsModule {}
