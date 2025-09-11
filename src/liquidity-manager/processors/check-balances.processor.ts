import { Injectable } from '@nestjs/common'
import { Processor } from '@nestjs/bullmq'
import { BaseProcessor } from '@/common/bullmq/base.processor'
import { LiquidityManagerJob } from '@/liquidity-manager/jobs/liquidity-manager.job'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
import { CHECK_BALANCES_QUEUE_NAME } from '@/liquidity-manager/constants/queue.constants'
import { HealthOperationLogger } from '@/common/logging/loggers'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'

@Injectable()
@Processor(CHECK_BALANCES_QUEUE_NAME, {
  concurrency: 1,
  limiter: {
    // Prevent bursts across instances; tune as needed
    max: 1,
    duration: 1000,
  },
})
export class CheckBalancesProcessor extends BaseProcessor<LiquidityManagerJob> {
  // Health-specific logger for structured monitoring logging
  public readonly healthLogger: HealthOperationLogger
  constructor(public readonly liquidityManagerService: LiquidityManagerService) {
    super(CheckBalancesProcessor.name, [new CheckBalancesCronJobManager()])
    // Create health-specific logger for monitoring
    this.healthLogger = new HealthOperationLogger('CheckBalancesProcessor')
    this.healthLogger.log(
      {
        healthCheck: 'balance-monitoring',
        status: 'started',
      },
      'CheckBalancesProcessor initialized',
      { queue: CheckBalancesQueue.queueName },
    )
  }
}
