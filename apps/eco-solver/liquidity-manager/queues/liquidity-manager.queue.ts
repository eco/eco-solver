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

  // Job management methods
  async startCronJobs(intervalDuration: number, walletAddress: string) {
    const { CheckBalancesCronJobManager } = await import('@/liquidity-manager/jobs/check-balances-cron.job')
    return CheckBalancesCronJobManager.start(this.queue, intervalDuration, walletAddress)
  }

  async startCCTPAttestationCheck(data: any) {
    const { CheckCCTPAttestationJobManager } = await import('@/liquidity-manager/jobs/check-cctp-attestation.job')
    return CheckCCTPAttestationJobManager.start(this.queue, data)
  }

  async startCCTPV2AttestationCheck(data: any) {
    const { CheckCCTPV2AttestationJobManager } = await import('@/liquidity-manager/jobs/check-cctpv2-attestation.job')
    return CheckCCTPV2AttestationJobManager.start(this.queue, data)
  }

  async startEverclearIntentCheck(data: any, delay?: number) {
    const { CheckEverclearIntentJobManager } = await import('@/liquidity-manager/jobs/check-everclear-intent.job')
    return CheckEverclearIntentJobManager.start(this.queue, data, delay)
  }
}
