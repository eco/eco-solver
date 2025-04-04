import { Injectable } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { BaseProcessor } from '@/liquidity-manager/processors/base.processor'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { RebalanceJobManager } from '@/liquidity-manager/jobs/rebalance.job'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'

/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
@Injectable()
@Processor(LiquidityManagerQueue.queueName)
export class LiquidityManagerProcessor extends BaseProcessor {
  /**
   * Constructs a new LiquidityManagerProcessor.
   * @param queue - The queue to process jobs from.
   * @param liquidityManagerService - The service for managing liquidity.
   */
  constructor(
    @InjectQueue(LiquidityManagerQueue.queueName)
    protected readonly queue: LiquidityManagerQueueType,
    public readonly liquidityManagerService: LiquidityManagerService,
  ) {
    super(LiquidityManagerProcessor.name, [
      new CheckBalancesCronJobManager(),
      new RebalanceJobManager(),
    ])
  }
}
