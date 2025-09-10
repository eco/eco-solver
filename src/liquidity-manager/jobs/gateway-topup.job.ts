import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'
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

  @LogOperation('job_execution', GenericOperationLogger)
  async process(
    @LogContext job: GatewayTopUpJob,
    processor: LiquidityManagerProcessor,
  ): Promise<Hex> {
    const { chainId, usdc, gatewayWallet, id } = job.data
    const amount = deserialize(job.data.amount) as bigint

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
        { operationType: 'job_execution' },
        'GatewayTopUp: Resuming existing transaction',
        {
          id,
          chainId,
          txHash: existingTxHash,
        },
      )

      await client.waitForTransactionReceipt({ hash: existingTxHash })

      processor.logger.log(
        { operationType: 'job_execution', status: 'completed' },
        'GatewayTopUp: Completed',
        {
          id,
          chainId,
          txHash: existingTxHash,
        },
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
        { operationType: 'job_execution', status: 'failed' },
        'GatewayTopUp: Broadcast failed',
        error,
        {
          id,
          chainId,
        },
      )
      throw error
    }

    await client.waitForTransactionReceipt({ hash: txHash })

    processor.logger.log(
      { operationType: 'job_execution', status: 'completed' },
      'GatewayTopUp: Completed',
      {
        id,
        chainId,
        txHash,
      },
    )
    return txHash
  }

  @LogOperation('job_execution', GenericOperationLogger)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onComplete(@LogContext job: GatewayTopUpJob, processor: LiquidityManagerProcessor) {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { rebalanceJobID } = jobData

    await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async onFailed(
    @LogContext job: GatewayTopUpJob,
    processor: LiquidityManagerProcessor,
    @LogContext error: unknown,
  ) {
    const isFinal = this.isFinalAttempt(job, error)

    if (isFinal) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    }

    // Error details are automatically captured by the decorator
    throw error
  }
}
