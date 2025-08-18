import { Queue } from 'bullmq'
import { initBullMQ, initFlowBullMQ } from '@eco-solver/bullmq/bullmq.helper'
import { CheckBalancesCronJobManager } from '@eco-solver/liquidity-manager/jobs/check-balances-cron.job'
import {
  CheckCCTPAttestationJob,
  CheckCCTPAttestationJobManager,
} from '@eco-solver/liquidity-manager/jobs/check-cctp-attestation.job'
import {
  CCTPLiFiDestinationSwapJobData,
  CCTPLiFiDestinationSwapJobManager,
} from '@eco-solver/liquidity-manager/jobs/cctp-lifi-destination-swap.job'
import { ExecuteCCTPMintJob, ExecuteCCTPMintJobManager } from '../jobs/execute-cctp-mint.job'
import {
  CheckCCTPV2AttestationJobData,
  CheckCCTPV2AttestationJobManager,
} from '../jobs/check-cctpv2-attestation.job'
import { ExecuteCCTPV2MintJob, ExecuteCCTPV2MintJobManager } from '../jobs/execute-cctpv2-mint.job'
import {
  CheckEverclearIntentJobData,
  CheckEverclearIntentJobManager,
} from '../jobs/check-everclear-intent.job'

export enum LiquidityManagerJobName {
  REBALANCE = 'REBALANCE',
  CHECK_BALANCES = 'CHECK_BALANCES',
  CHECK_CCTP_ATTESTATION = 'CHECK_CCTP_ATTESTATION',
  EXECUTE_CCTP_MINT = 'EXECUTE_CCTP_MINT',
  CCTP_LIFI_DESTINATION_SWAP = 'CCTP_LIFI_DESTINATION_SWAP',
  CHECK_CCTPV2_ATTESTATION = 'CHECK_CCTPV2_ATTESTATION',
  EXECUTE_CCTPV2_MINT = 'EXECUTE_CCTPV2_MINT',
  CHECK_EVERCLEAR_INTENT = 'CHECK_EVERCLEAR_INTENT',
}

export type LiquidityManagerQueueDataType = {
  /**
   * Correlation / tracking identifier that will propagate through every job handled by the
   * Liquidity Manager queue. Having this always present allows us to group logs that belong
   * to the same high-level operation or request.
   */
  id?: string
  [k: string]: unknown
}

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

  startCronJobs(interval: number, walletAddress: string): Promise<void> {
    return CheckBalancesCronJobManager.start(this.queue, interval, walletAddress)
  }

  startCCTPAttestationCheck(data: CheckCCTPAttestationJob['data']): Promise<void> {
    return CheckCCTPAttestationJobManager.start(this.queue, data)
  }

  startCCTPLiFiDestinationSwap(data: CCTPLiFiDestinationSwapJobData): Promise<void> {
    return CCTPLiFiDestinationSwapJobManager.start(this.queue, data)
  }

  startExecuteCCTPMint(data: ExecuteCCTPMintJob['data']): Promise<void> {
    return ExecuteCCTPMintJobManager.start(this.queue, data)
  }

  startCCTPV2AttestationCheck(data: CheckCCTPV2AttestationJobData): Promise<void> {
    return CheckCCTPV2AttestationJobManager.start(this.queue, data)
  }

  startExecuteCCTPV2Mint(data: ExecuteCCTPV2MintJob['data']): Promise<void> {
    return ExecuteCCTPV2MintJobManager.start(this.queue, data)
  }

  startCheckEverclearIntent(data: CheckEverclearIntentJobData): Promise<void> {
    return CheckEverclearIntentJobManager.start(this.queue, data)
  }
}
