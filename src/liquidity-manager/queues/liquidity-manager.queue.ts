import { Queue } from 'bullmq'
import { initBullMQ, initFlowBullMQ } from '@/bullmq/bullmq.helper'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron-job.manager'

export enum LiquidityManagerJobName {
  REBALANCE = 'REBALANCE',
  CHECK_BALANCES = 'CHECK_BALANCES',
}

export type LiquidityManagerQueueDataType = { network: string; [k: string]: unknown }

export type LiquidityManagerQueueType = Queue<
  LiquidityManagerQueueDataType,
  unknown,
  LiquidityManagerJobName
>

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

  startCronJobs(interval: number) {
    return CheckBalancesCronJobManager.start(this.queue, interval)
  }
}
