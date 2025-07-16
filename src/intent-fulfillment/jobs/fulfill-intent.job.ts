import { JobsOptions, Job } from 'bullmq'
import { Hex } from 'viem'
import { BaseJobManager } from '@/common/bullmq/base-job'
import { IntentFulfillmentJobName } from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { serialize, Serialize, deserialize } from '@/common/utils/serialize'
import { getIntentJobId } from '@/common/utils/strings'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

export type FulfillIntentJobData = {
  intentHash: Hex
  chainId: number
}

export type FulfillIntentJob = Job<
  Serialize<FulfillIntentJobData>,
  unknown,
  IntentFulfillmentJobName.FULFILL_INTENT
>

export abstract class IntentFulfillmentJobManager extends BaseJobManager<FulfillIntentJob> {}

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

  async process(job: FulfillIntentJob, processor: any): Promise<void> {
    if (this.is(job)) {
      return processor.fulfillIntentService.fulfill(deserialize(job.data).intentHash)
    }
  }

  onFailed(job: FulfillIntentJob, processor: any, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${FulfillIntentJobManager.name}: Failed`,
        properties: {
          job: { id: job.id, data: deserialize(job.data) },
          error: error.message,
        },
      }),
    )
  }
}
