import { JobsOptions, Job } from 'bullmq'
import { Hex } from 'viem'
import { BaseJobManager } from '@/common/bullmq/base-job'
import { IntentFulfillmentJobName } from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { serialize, Serialize, deserialize } from '@/common/utils/serialize'
import { getIntentJobId } from '@/common/utils/strings'
import { IntentFulfillmentProcessor } from '@/intent-fulfillment/processors/intent-fulfillment.processor'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

export type FulfillIntentJobData = {
  intentHash: Hex
  chainId: number
}

export type FulfillIntentJob = Job<
  Serialize<FulfillIntentJobData>,
  unknown,
  IntentFulfillmentJobName.FULFILL_INTENT
>

export abstract class IntentFulfillmentJobManager extends BaseJobManager<
  FulfillIntentJob,
  IntentFulfillmentProcessor
> {}

export class FulfillIntentJobManager extends IntentFulfillmentJobManager {
  static createJob(jobData: FulfillIntentJobData): {
    name: FulfillIntentJob['name']
    data: FulfillIntentJob['data']
    opts?: JobsOptions
  } {
    const jobId = getIntentJobId('fulfill', jobData.intentHash, jobData.chainId)
    return {
      name: IntentFulfillmentJobName.FULFILL_INTENT,
      data: serialize(jobData),
      opts: {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }
  }

  is(job: FulfillIntentJob): job is FulfillIntentJob {
    return job.name === IntentFulfillmentJobName.FULFILL_INTENT
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async process(
    @LogContext job: FulfillIntentJob,
    processor: IntentFulfillmentProcessor,
  ): Promise<void> {
    if (this.is(job)) {
      const jobData = deserialize(job.data)
      await processor.fulfillIntentService.fulfill(jobData.intentHash)
    }
  }

  @LogOperation('job_execution', GenericOperationLogger)
  onFailed(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @LogContext job: FulfillIntentJob,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    processor: IntentFulfillmentProcessor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @LogContext error: Error,
  ) {
    // Error details are automatically captured by the decorator
    // No need to re-throw the error as it's already been processed
  }
}
