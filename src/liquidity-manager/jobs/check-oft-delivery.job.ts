import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { Queue, UnrecoverableError } from 'bullmq'
import { Hex } from 'viem'
import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

export interface CheckOFTDeliveryJobData extends LiquidityManagerQueueDataType {
  sourceChainId: number
  destinationChainId: number
  txHash: Hex // source tx hash
  walletAddress: Hex
  amountLD: string
}

export type CheckOFTDeliveryJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_OFT_DELIVERY,
  CheckOFTDeliveryJobData,
  { status: 'pending' | 'complete' }
>

export class CheckOFTDeliveryJobManager extends LiquidityManagerJobManager<CheckOFTDeliveryJob> {
  @AutoInject(EcoConfigService)
  private ecoConfigService: EcoConfigService

  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(queue: Queue, data: CheckOFTDeliveryJobData, delay?: number): Promise<void> {
    await queue.add(LiquidityManagerJobName.CHECK_OFT_DELIVERY, data, {
      removeOnFail: false,
      delay,
      attempts: 20,
      backoff: { type: 'exponential', delay: 10_000 },
    })
  }

  is(job: LiquidityManagerJob): job is CheckOFTDeliveryJob {
    return job.name === LiquidityManagerJobName.CHECK_OFT_DELIVERY
  }

  async process(
    job: CheckOFTDeliveryJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CheckOFTDeliveryJob['returnvalue']> {
    processor.logger.debug(
      { operationType: 'job_execution', status: 'started' },
      'USDT0: CheckOFTDeliveryJob: Start',
      { id: job.data.id, job },
    )

    const cfg = this.ecoConfigService.getUSDT0()
    const dst = this.requireDestinationChain(cfg, job, processor)

    try {
      const result = await this.checkLayerZeroScanAPI(cfg, dst, job, processor)
      if (result === 'complete') {
        return { status: 'complete' }
      }
    } catch (error) {
      processor.logger.error(
        { operationType: 'job_execution', status: 'error' },
        'USDT0: CheckOFTDeliveryJob: Log query failed',
        error as Error,
        {
          id: job.data.id,
          destinationChainId: job.data.destinationChainId,
        },
      )
      throw error
    }

    await this.delay(job, 10_000)
    return { status: 'pending' }
  }

  private requireDestinationChain(
    cfgUSDT0: ReturnType<EcoConfigService['getUSDT0']>,
    job: CheckOFTDeliveryJob,
    processor: LiquidityManagerProcessor,
  ) {
    const dst = cfgUSDT0.chains.find((c) => c.chainId === job.data.destinationChainId)
    if (!dst) {
      processor.logger.error(
        { operationType: 'job_execution', status: 'error' },
        'USDT0: CheckOFTDeliveryJob: Destination chain not configured',
        undefined,
        { id: job.data.id, destinationChainId: job.data.destinationChainId },
      )
      throw new UnrecoverableError(
        `Destination chain ${job.data.destinationChainId} not configured`,
      )
    }
    return dst
  }

  private buildScanContext(
    cfgUSDT0: ReturnType<EcoConfigService['getUSDT0']>,
    job: CheckOFTDeliveryJob,
  ) {
    const src = cfgUSDT0.chains.find((c) => c.chainId === job.data.sourceChainId)
    const baseUrl = cfgUSDT0.scanApiBaseUrl
    const fetchFn: any = (globalThis as any).fetch
    const url = `${baseUrl}/messages/tx/${job.data.txHash}`
    return { src, baseUrl, fetchFn, url }
  }

  private async checkLayerZeroScanAPI(
    cfgUSDT0: ReturnType<EcoConfigService['getUSDT0']>,
    dst: any,
    job: CheckOFTDeliveryJob,
    processor: LiquidityManagerProcessor,
  ): Promise<'pending' | 'complete'> {
    const { src, baseUrl, fetchFn, url } = this.buildScanContext(cfgUSDT0, job)
    processor.logger.debug(
      { operationType: 'external_api_call', status: 'started' },
      'USDT0: CheckOFTDeliveryJob: Querying LayerZero Scan',
      {
        id: job.data.id,
        url,
        baseUrl,
        sourceChainId: job.data.sourceChainId,
        destinationChainId: job.data.destinationChainId,
        srcEid: src?.eid,
        dstEid: dst.eid,
      },
    )

    try {
      const res = await fetchFn(url)
      if (!res?.ok) {
        processor.logger.warn(
          { operationType: 'external_api_call', status: 'warning' },
          'USDT0: CheckOFTDeliveryJob: Scan query non-OK response',
          { id: job.data.id, status: res?.status, statusText: res?.statusText },
        )
        return 'pending'
      }

      const body = await res.json()
      const messages: any[] = body?.data ?? []

      const message = this.selectRelevantMessage(messages, src?.eid, dst.eid)
      const dest = message?.destination
      const destStatus: string | undefined = dest?.status
      const topLevelStatus: string | undefined = message?.status?.name
      const dstTxHash: Hex | undefined = dest?.tx?.txHash

      processor.logger.debug(
        { operationType: 'external_api_call', status: 'completed' },
        'USDT0: CheckOFTDeliveryJob: Scan status',
        {
          id: job.data.id,
          topLevelStatus,
          destinationStatus: destStatus,
          dstTxHash,
          matched: Boolean(message),
        },
      )

      const evalResult = this.evaluateScanStatuses(topLevelStatus, destStatus)
      if (evalResult === 'complete') {
        return 'complete'
      }
      if (evalResult === 'failed') {
        throw new UnrecoverableError('LayerZero message status FAILED')
      }
      return 'pending'
    } catch (apiError) {
      if (apiError instanceof UnrecoverableError) {
        throw apiError
      }
      processor.logger.warn(
        { operationType: 'external_api_call', status: 'warning' },
        'USDT0: CheckOFTDeliveryJob: Scan query failed (will retry)',
        { id: job.data.id, url, error: apiError },
      )
      return 'pending'
    }
  }

  private selectRelevantMessage(messages: any[], srcEid: number | undefined, dstEid: number) {
    const filtered = messages.filter((m) => {
      const pathway = m?.pathway ?? {}
      const srcOk = srcEid ? pathway.srcEid === srcEid : true
      const dstOk = pathway.dstEid === dstEid
      return srcOk && dstOk
    })
    return filtered[0] ?? messages[0]
  }

  private evaluateScanStatuses(
    topLevelStatus: string | undefined,
    destStatus: string | undefined,
  ): 'pending' | 'complete' | 'failed' {
    if (
      topLevelStatus === 'DELIVERED' ||
      destStatus === 'SUCCEEDED' ||
      destStatus === 'DELIVERED'
    ) {
      return 'complete'
    }
    if (topLevelStatus === 'FAILED' || destStatus === 'FAILED') {
      return 'failed'
    }
    return 'pending'
  }

  async onComplete(job: CheckOFTDeliveryJob, processor: LiquidityManagerProcessor): Promise<void> {
    if (job.returnvalue.status === 'complete') {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { groupID, rebalanceJobID } = jobData

      processor.logger.log(
        { operationType: 'job_execution', status: 'completed' },
        'USDT0: Delivery confirmed',
        {
          id: job.data.id,
          groupID,
          rebalanceJobID,
          destinationChainId: job.data.destinationChainId,
          walletAddress: job.data.walletAddress,
          amountLD: job.data.amountLD,
        },
      )

      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
    }
  }

  async onFailed(job: CheckOFTDeliveryJob, processor: LiquidityManagerProcessor, error: unknown) {
    const isFinal = this.isFinalAttempt(job, error)
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { rebalanceJobID } = jobData

    if (isFinal) {
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    }

    processor.logger.error(
      { operationType: 'job_execution', status: 'error' },
      isFinal
        ? 'USDT0: CheckOFTDeliveryJob: FINAL FAILURE'
        : 'USDT0: CheckOFTDeliveryJob: Failed: Retrying...',
      error as Error,
      { id: job.data.id, data: job.data },
    )
  }
}
