import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { Queue, UnrecoverableError } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

const EVERCLEAR_RETRY_DELAY_MS = 5_000

export interface CheckEverclearIntentJobData extends LiquidityManagerQueueDataType {
  txHash: Hex
}

export type CheckEverclearIntentJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_EVERCLEAR_INTENT,
  CheckEverclearIntentJobData,
  { status: 'pending' | 'complete' | 'failed'; intentId?: string }
>

export class CheckEverclearIntentJobManager extends LiquidityManagerJobManager<CheckEverclearIntentJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(
    queue: Queue,
    data: CheckEverclearIntentJobData,
    delay?: number,
  ): Promise<void> {
    await queue.add(LiquidityManagerJobName.CHECK_EVERCLEAR_INTENT, data, {
      removeOnComplete: true,
      delay,
      attempts: 10, // Retry up to 10 times for long-running intents
      backoff: {
        type: 'exponential',
        delay: EVERCLEAR_RETRY_DELAY_MS,
      },
    })
  }

  is(job: LiquidityManagerJob): job is CheckEverclearIntentJob {
    return job.name === LiquidityManagerJobName.CHECK_EVERCLEAR_INTENT
  }

  async process(
    job: CheckEverclearIntentJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CheckEverclearIntentJob['returnvalue']> {
    const { txHash, id } = job.data
    const result = await processor.everclearProviderService.checkIntentStatus(txHash)
    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: Intent status check result',
        id,
        properties: { result },
      }),
    )

    switch (result.status) {
      case 'pending':
        this.delay(job, EVERCLEAR_RETRY_DELAY_MS)
      case 'complete':
        return result
      case 'failed':
        // this will move the job to the failed set without performing any retries
        throw new UnrecoverableError(`Everclear: Intent failed to complete for txHash: ${txHash}`)
    }
  }

  async onComplete(
    job: CheckEverclearIntentJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData

    processor.logger.log(
      EcoLogMessage.withId({
        message: `Everclear: Intent check complete with status: ${job.returnvalue.status}`,
        id: job.data.id,
        properties: {
          groupID,
          rebalanceJobID,
          ...job.returnvalue,
          txHash: job.data.txHash,
        },
      }),
    )

    await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
  }

  async onFailed(
    job: CheckEverclearIntentJob,
    processor: LiquidityManagerProcessor,
    error: unknown,
  ) {
    const isFinal = this.isFinalAttempt(job, error)

    const errorMessage = isFinal
      ? 'Everclear: CheckEverclearIntentJob: FINAL FAILURE'
      : 'Everclear: CheckEverclearIntentJob: Failed: Retrying...'

    if (isFinal) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
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
