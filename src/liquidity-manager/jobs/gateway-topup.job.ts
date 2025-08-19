import { Queue } from 'bullmq'
import { Hex, encodeFunctionData, erc20Abi } from 'viem'
import { Serialize, deserialize } from '@/common/utils/serialize'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { gatewayWalletAbi } from '@/liquidity-manager/services/liquidity-providers/Gateway/constants/abis'

export interface GatewayTopUpJobData {
  chainId: number
  usdc: Hex
  gatewayWallet: Hex
  amount: Serialize<bigint>
  depositor: Hex
  id?: string
  [k: string]: unknown
}

export type GatewayTopUpJob = LiquidityManagerJob<
  LiquidityManagerJobName.GATEWAY_TOP_UP,
  GatewayTopUpJobData,
  Hex
>

export class GatewayTopUpJobManager extends LiquidityManagerJobManager<GatewayTopUpJob> {
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

    const txHash = await client.execute([
      { to: usdc, data: approveData },
      { to: gatewayWallet, data: depositForData },
    ])
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

  onFailed(job: GatewayTopUpJob, processor: LiquidityManagerProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withId({
        message: 'GatewayTopUp: Failed',
        id: job.data.id,
        properties: { error: (error as any)?.message ?? error },
      }),
    )
  }
}
