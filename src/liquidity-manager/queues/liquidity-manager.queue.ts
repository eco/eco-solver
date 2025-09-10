import { Queue } from 'bullmq'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { GatewayTopUpJobData, GatewayTopUpJobManager } from '../jobs/gateway-topup.job'
import { initBullMQ, initFlowBullMQ } from '@/bullmq/bullmq.helper'
import {
  CheckCCTPAttestationJob,
  CheckCCTPAttestationJobManager,
} from '@/liquidity-manager/jobs/check-cctp-attestation.job'
import {
  CCTPLiFiDestinationSwapJobData,
  CCTPLiFiDestinationSwapJobManager,
} from '@/liquidity-manager/jobs/cctp-lifi-destination-swap.job'
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
  GATEWAY_TOP_UP = 'GATEWAY_TOP_UP',
}

export interface LiquidityManagerQueueDataType {
  /**
   * Correlation / tracking identifier that will propagate through every job handled by the
   * Liquidity Manager queue. Having this always present allows us to group logs that belong
   * to the same high-level operation or request.
   */
  groupID: string // GroupID for tracking related jobs
  rebalanceJobID: string // JobID for tracking the rebalance job
  id?: string
  [k: string]: unknown // Index signature for BullMQ compatibility
}

export type LiquidityManagerQueueType = Queue<
  LiquidityManagerQueueDataType,
  unknown,
  LiquidityManagerJobName
>

export const LIQUIDITY_MANAGER_QUEUE_NAME = 'LiquidityManagerQueue'
export const LIQUIDITY_MANAGER_FLOW_NAME = 'flow-liquidity-manager'

export class LiquidityManagerQueue {
  public static readonly prefix = '{liquidity-manager}'
  public static readonly queueName = LIQUIDITY_MANAGER_QUEUE_NAME
  public static readonly flowName = LIQUIDITY_MANAGER_FLOW_NAME

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

  // Note: CHECK_BALANCES cron has been moved to a dedicated queue/processor.

  @LogOperation('start_cctp_attestation_check', LiquidityManagerLogger)
  startCCTPAttestationCheck(@LogContext data: CheckCCTPAttestationJob['data']): Promise<void> {
    return CheckCCTPAttestationJobManager.start(this.queue, data)
  }

  @LogOperation('start_cctp_lifi_destination_swap', LiquidityManagerLogger)
  startCCTPLiFiDestinationSwap(@LogContext data: CCTPLiFiDestinationSwapJobData): Promise<void> {
    return CCTPLiFiDestinationSwapJobManager.start(this.queue, data)
  }

  @LogOperation('start_execute_cctp_mint', LiquidityManagerLogger)
  startExecuteCCTPMint(@LogContext data: ExecuteCCTPMintJob['data']): Promise<void> {
    return ExecuteCCTPMintJobManager.start(this.queue, data)
  }

  @LogOperation('start_cctpv2_attestation_check', LiquidityManagerLogger)
  startCCTPV2AttestationCheck(@LogContext data: CheckCCTPV2AttestationJobData): Promise<void> {
    return CheckCCTPV2AttestationJobManager.start(this.queue, data)
  }

  @LogOperation('start_execute_cctpv2_mint', LiquidityManagerLogger)
  startExecuteCCTPV2Mint(@LogContext data: ExecuteCCTPV2MintJob['data']): Promise<void> {
    return ExecuteCCTPV2MintJobManager.start(this.queue, data)
  }

  @LogOperation('start_check_everclear_intent', LiquidityManagerLogger)
  startCheckEverclearIntent(@LogContext data: CheckEverclearIntentJobData): Promise<void> {
    return CheckEverclearIntentJobManager.start(this.queue, data)
  }

  @LogOperation('start_gateway_top_up', LiquidityManagerLogger)
  startGatewayTopUp(@LogContext data: GatewayTopUpJobData): Promise<void> {
    return GatewayTopUpJobManager.start(this.queue, data)
  }
}
