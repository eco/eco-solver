import { Queue } from 'bullmq'
import { initBullMQ } from '@eco-solver/bullmq/bullmq.helper'
import { Hex } from 'viem/_types/types/misc'
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'

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
@Injectable()
export class IntentFulfillmentQueue {
  public static readonly prefix = '{intent-fulfillment}'
  public static readonly queueName = 'IntentFulfillment'

  constructor(
    @InjectQueue(IntentFulfillmentQueue.queueName)
    private readonly queue: IntentFulfillmentQueueType,
  ) {}

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
