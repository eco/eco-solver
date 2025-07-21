/* eslint-disable prettier/prettier */
import { BulkJobOptions, Job } from 'bullmq'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FulfillmentProcessor } from '@/intent/fulfillment-processor/processors/fulfillment.processor'
import { FulfillmentProcessorJobManager, FulfillmentProcessorJob } from '@/intent/fulfillment-processor/job-managers/fulfillment-processor-job-manager'
import { FulfillmentProcessorJobName } from '@/intent/fulfillment-processor/queues/fulfillment-processor.queue'
import { IntentProcessingJobData } from '@/intent/interfaces/intent-processing-job-data.interface'

export type FulfillIntentJobData = {
  chainId: number
  intents: IntentProcessingJobData[]
}

export type FulfillIntentJob = Job<
  Serialize<FulfillIntentJobData>,
  unknown,
  FulfillmentProcessorJobName.FULFILL_INTENTS
>

export class FulfillIntentJobManager extends FulfillmentProcessorJobManager<FulfillIntentJob> {
  static createJob(jobData: FulfillIntentJobData): {
    name: FulfillIntentJob['name']
    data: FulfillIntentJob['data']
    opts?: BulkJobOptions
  } {
    return {
      name: FulfillmentProcessorJobName.FULFILL_INTENTS,
      data: serialize(jobData),
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }
  }

  /**
   * Type guard to check if the given job is an instance of FulfillIntentJob.
   * @param job - The job to check.
   * @returns True if the job is a FulfillIntentJob.
   */
  is(job: FulfillmentProcessorJob): job is FulfillIntentJob {
    return job.name === FulfillmentProcessorJobName.FULFILL_INTENTS
  }

  async process(job: FulfillmentProcessorJob, processor: FulfillmentProcessor): Promise<void> {
    if (this.is(job)) {
      return processor.fulfillmentProcessorService.executeFulfills(deserialize(job.data))
    }
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: FulfillmentProcessorJob, processor: FulfillmentProcessor, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `FulfillIntentJob: Failed`,
        properties: { error: error.message },
      }),
    )
  }
}
