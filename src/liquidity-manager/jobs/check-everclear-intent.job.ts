import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { DelayedError, Queue, UnrecoverableError } from 'bullmq'
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
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

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
        delay: 5_000, // 5 seconds
      },
    })
  }

  is(job: LiquidityManagerJob): job is CheckEverclearIntentJob {
    return job.name === LiquidityManagerJobName.CHECK_EVERCLEAR_INTENT
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async process(
    @LogContext job: CheckEverclearIntentJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CheckEverclearIntentJob['returnvalue']> {
    const { txHash, id } = job.data
    const result = await processor.everclearProviderService.checkIntentStatus(txHash)
    processor.logger.debug(
      { operationType: 'job_execution' },
      'Everclear: Intent status check result',
      {
        id,
        result,
      },
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
    }
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async onComplete(
    @LogContext job: CheckEverclearIntentJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData

    processor.logger.log(
      { operationType: 'job_execution', status: 'completed' },
      `Everclear: Intent check complete with status: ${job.returnvalue.status}`,
      {
        id: job.data.id,
        groupID,
        rebalanceJobID,
        ...job.returnvalue,
        txHash: job.data.txHash,
      },
    )

    await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async onFailed(
    @LogContext job: CheckEverclearIntentJob,
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
    const errorObj = error instanceof Error ? error : new Error(String(error))
    throw errorObj
  }
}
