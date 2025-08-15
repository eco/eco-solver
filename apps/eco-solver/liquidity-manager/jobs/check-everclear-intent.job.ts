import { DelayedError, Queue, UnrecoverableError } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { BaseLiquidityManagerJob, CheckEverclearIntentJobData } from '@/liquidity-manager/types/job.types'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { LiquidityManagerJobName } from '@/liquidity-manager/constants/job-names'
import { LiquidityManagerProcessorInterface } from '@/liquidity-manager/types/processor.interface'

export type CheckEverclearIntentJob = BaseLiquidityManagerJob<
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
    processor: LiquidityManagerProcessorInterface,
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
        await job.moveToDelayed(Date.now() + 5_000, job.token)
        // we need to exit from the processor by throwing this error that will signal to the worker
        // that the job has been delayed so that it does not try to complete (or fail the job) instead
        throw new DelayedError()
      case 'complete':
        return result
      case 'failed':
        // this will move the job to the failed set without performing any retries
        throw new UnrecoverableError(`Everclear: Intent failed to complete for txHash: ${txHash}`)
      default:
        throw new UnrecoverableError(`Everclear: Unknown intent status: ${result.status}`)
    }
  }

  async onComplete(
    job: CheckEverclearIntentJob,
    processor: LiquidityManagerProcessorInterface,
  ): Promise<void> {
    processor.logger.log(
      EcoLogMessage.withId({
        message: `Everclear: Intent check complete with status: ${job.returnvalue.status}`,
        id: job.data.id,
        properties: { ...job.returnvalue, txHash: job.data.txHash },
      }),
    )
  }

  onFailed(job: CheckEverclearIntentJob, processor: LiquidityManagerProcessorInterface, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withErrorAndId({
        message: 'Everclear: Intent check failed',
        id: job.data.id,
        error: error as any,
        properties: {
          ...job.returnvalue,
          txHash: job.data.txHash,
        },
      }),
    )
  }
}
