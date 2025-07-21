/* eslint-disable prettier/prettier */
import { FulfillIntentJobData, FulfillIntentJobManager } from '@/intent/fulfillment-processor/job-managers/fulfill-intent-job-manager'
import { FulfillsCronJobManager } from '@/intent/fulfillment-processor/job-managers/fulfills-cron-job-manager'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { Job, Queue } from 'bullmq'

export enum FulfillmentProcessorJobName {
  FULFILL_INTENTS = 'FULFILL_INTENTS',
}

export type FulfillmentProcessorQueueDataType = any

export type FulfillmentProcessorQueueType = Queue<
  FulfillmentProcessorQueueDataType,
  unknown,
  FulfillmentProcessorJobName
>

export class FulfillmentProcessorQueue {
  public static readonly prefix = '{intent-processor}'
  public static readonly queueName = FulfillmentProcessorQueue.name

  constructor(private readonly queue: FulfillmentProcessorQueueType) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return initBullMQ(
      { queue: this.queueName, prefix: FulfillmentProcessorQueue.prefix },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    )
  }

  startFulfillsCronJob(interval: number) {
    return FulfillsCronJobManager.start(this.queue, interval)
  }

  addFulfillIntentsJob(jobsData: FulfillIntentJobData): Promise<Job[]> {
    const job = FulfillIntentJobManager.createJob(jobsData)
    return this.queue.addBulk([job])
  }
}
