import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'

export interface CheckEverclearIntentJobData {
  txHash: Hex
  id?: string
  [key: string]: unknown
}

export type CheckEverclearIntentJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_EVERCLEAR_INTENT,
  CheckEverclearIntentJobData,
  { status: 'pending' | 'complete' | 'failed'; intentId?: string }
>

export class CheckEverclearIntentJobManager extends LiquidityManagerJobManager<CheckEverclearIntentJob> {
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
        delay: 5_000, // 5 seconds
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
    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: CheckEverclearIntentJob: processing intent status check',
        id,
        properties: { txHash },
      }),
    )
    return processor.everclearProviderService.checkIntentStatus(txHash)
  }

  async onComplete(
    job: CheckEverclearIntentJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    if (job.returnvalue.status === 'pending') {
      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'Everclear: Intent still pending, re-queuing check.',
          id: job.data.id,
          properties: { ...job.returnvalue, txHash: job.data.txHash },
        }),
      )
      await CheckEverclearIntentJobManager.start(processor.queue, job.data, 5_000) // Re-check in 5s
    } else {
      processor.logger.log(
        EcoLogMessage.withId({
          message: `Everclear: Intent check complete with status: ${job.returnvalue.status}`,
          id: job.data.id,
          properties: { ...job.returnvalue, txHash: job.data.txHash },
        }),
      )
    }
  }

  onFailed(job: CheckEverclearIntentJob, processor: LiquidityManagerProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withErrorAndId({
        message: 'Everclear: Intent check failed',
        id: job.data.id,
        error: error as any,
        properties: {
          data: job.data,
        },
      }),
    )
  }
}
