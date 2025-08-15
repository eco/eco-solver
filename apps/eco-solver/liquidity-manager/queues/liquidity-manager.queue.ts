import { initBullMQ, initFlowBullMQ } from '@/bullmq/bullmq.helper'
import { LiquidityManagerJobName } from '@/liquidity-manager/constants/job-names'
import {
  LiquidityManagerQueueType,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/types/queue.types'

// Re-export types and enums for backward compatibility
export { LiquidityManagerJobName, LiquidityManagerQueueType }

export class LiquidityManagerQueue {
  public static readonly prefix = '{liquidity-manager}'
  public static readonly queueName = LiquidityManagerQueue.name
  public static readonly flowName = `flow-liquidity-manager`

  constructor(private readonly queue: LiquidityManagerQueueType) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return initBullMQ(
      { queue: this.queueName, prefix: LiquidityManagerQueue.prefix },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    )
  }

  static initFlow() {
    return initFlowBullMQ({ queue: this.flowName, prefix: LiquidityManagerQueue.prefix })
  }

  // Job creation methods moved to LiquidityManagerJobFactory to break circular dependencies
}
