import { BaseJobManager } from '@/common/bullmq/base-job'
import { FulfillIntentJob } from '@/intent/fulfillment-processor/job-managers/fulfill-intent-job-manager'

export type FulfillmentProcessorJob = FulfillIntentJob

export abstract class FulfillmentProcessorJobManager<
  Job extends FulfillmentProcessorJob = FulfillmentProcessorJob,
> extends BaseJobManager<Job> {}
