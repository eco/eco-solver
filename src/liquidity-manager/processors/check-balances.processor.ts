import { Injectable } from '@nestjs/common'
import { Processor } from '@nestjs/bullmq'
import { BaseProcessor } from '@/common/bullmq/base.processor'
import { LiquidityManagerJob } from '@/liquidity-manager/jobs/liquidity-manager.job'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'

@Injectable()
@Processor(CheckBalancesQueue.queueName, {
  concurrency: 1,
  limiter: {
    // Prevent bursts across instances; tune as needed
    max: 1,
    duration: 1000,
  },
})
export class CheckBalancesProcessor extends BaseProcessor<LiquidityManagerJob> {
  constructor(public readonly liquidityManagerService: LiquidityManagerService) {
    super(CheckBalancesProcessor.name, [new CheckBalancesCronJobManager()])
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'CheckBalancesProcessor initialized',
        properties: { queue: CheckBalancesQueue.queueName },
      }),
    )
  }
}
