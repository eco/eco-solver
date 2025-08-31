import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { gatewayWalletAbi } from '@/liquidity-manager/services/liquidity-providers/Gateway/constants/abis'
import { Hex, encodeFunctionData, erc20Abi } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { Queue } from 'bullmq'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { Serialize, deserialize } from '@/common/utils/serialize'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

export interface GatewayTopUpJobData extends LiquidityManagerQueueDataType {
  chainId: number
  usdc: Hex
  gatewayWallet: Hex
  amount: Serialize<bigint>
  depositor: Hex
}

export type GatewayTopUpJob = LiquidityManagerJob<
  LiquidityManagerJobName.GATEWAY_TOP_UP,
  GatewayTopUpJobData,
  Hex
>

export class GatewayTopUpJobManager extends LiquidityManagerJobManager<GatewayTopUpJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(queue: Queue, data: GatewayTopUpJobData): Promise<void> {
    const amountStr = (deserialize(data.amount) as bigint).toString()
    await queue.add(LiquidityManagerJobName.GATEWAY_TOP_UP, data, {
      jobId: `${LiquidityManagerJobName.GATEWAY_TOP_UP}-${data.id}-${data.chainId}-${amountStr}`,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
    })
  }

  is(job: LiquidityManagerJob): job is GatewayTopUpJob {
    return job.name === LiquidityManagerJobName.GATEWAY_TOP_UP
  }

  async process(job: GatewayTopUpJob, processor: LiquidityManagerProcessor): Promise<Hex> {
    const { chainId, usdc, gatewayWallet, id } = job.data
    const amount = deserialize(job.data.amount) as bigint

    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'GatewayTopUp: Starting top-up',
        id,
        properties: { chainId, usdc, gatewayWallet, amount: amount.toString() },
      }),
    )

    // Build approve + depositFor batch via Kernel
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [gatewayWallet, amount],
    })

    const depositForData = encodeFunctionData({
      abi: gatewayWalletAbi,
      functionName: 'depositFor',
      args: [usdc, job.data.depositor, amount],
    })

    const client =
      await processor.liquidityManagerService.kernelAccountClientService.getClient(chainId)

    // Idempotency: if a previous attempt already broadcasted a tx, resume waiting for it
    const existingTxHash = (job.progress as any)?.txHash as Hex | undefined
    if (existingTxHash) {
      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'GatewayTopUp: Resuming existing transaction',
          id,
          properties: { chainId, txHash: existingTxHash },
        }),
      )

      await client.waitForTransactionReceipt({ hash: existingTxHash })

      processor.logger.log(
        EcoLogMessage.withId({
          message: 'GatewayTopUp: Completed',
          id,
          properties: { chainId, txHash: existingTxHash },
        }),
      )
      return existingTxHash
    }

    let txHash: Hex
    try {
      txHash = await client.execute([
        { to: usdc, data: approveData },
        { to: gatewayWallet, data: depositForData },
      ])

      // Persist txHash so retries will not double-spend
      await job.updateProgress({ txHash })
    } catch (error) {
      processor.logger.error(
        EcoLogMessage.withId({
          message: 'GatewayTopUp: Broadcast failed',
          id,
          properties: { chainId, error: (error as any)?.message ?? error },
        }),
      )
      throw error
    }

    await client.waitForTransactionReceipt({ hash: txHash })

    processor.logger.log(
      EcoLogMessage.withId({
        message: 'GatewayTopUp: Completed',
        id,
        properties: { chainId, txHash },
      }),
    )
    return txHash
  }

  async onComplete(job: GatewayTopUpJob, processor: LiquidityManagerProcessor) {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData

    processor.logger.log(
      EcoLogMessage.withId({
        message: `GatewayTopUpJob: Completed!`,
        id: job.data.id,
        properties: {
          groupID,
          rebalanceJobID,
          chainId: job.data.chainId,
          txHash: job.returnvalue,
        },
      }),
    )

    await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
  }

  async onFailed(job: GatewayTopUpJob, processor: LiquidityManagerProcessor, error: unknown) {
    let errorMessage = 'GatewayTopUpJob: Failed'
    if (this.isFinalAttempt(job, error)) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    } else {
      errorMessage += ': Retrying...'
    }

    processor.logger.error(
      EcoLogMessage.withErrorAndId({
        message: errorMessage,
        id: job.data.id,
        error: error as any,
        properties: {
          data: job.data,
        },
      }),
    )
  }
}
