import { Queue } from 'bullmq'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { Hex } from 'viem/_types/types/misc'

export enum IntentFulfillmentJobName {
  FULFILL_INTENT = 'FULFILL_INTENT',
}

export type IntentFulfillmentQueueDataType = {
  intentHash: Hex
  chainId: number
}

export type IntentFulfillmentQueueType = Queue<
  IntentFulfillmentQueueDataType,
  unknown,
  IntentFulfillmentJobName
>

export class IntentFulfillmentQueue {
  public static readonly prefix = '{intent-fulfillment}'
  public static readonly queueName = 'IntentFulfillment'

  constructor(private readonly queue: IntentFulfillmentQueueType) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return initBullMQ(
      { queue: this.queueName, prefix: IntentFulfillmentQueue.prefix },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    )
  }

  addFulfillIntentJob(jobData: any) {
    return this.queue.add(IntentFulfillmentJobName.FULFILL_INTENT, jobData)
  }
}
