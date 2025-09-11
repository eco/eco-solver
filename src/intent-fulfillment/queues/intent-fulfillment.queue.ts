import { Queue } from 'bullmq'
import { BullModule } from '@nestjs/bullmq'
import { Hex } from 'viem/_types/types/misc'
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

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

export const INTENT_FULFILLMENT_QUEUE_NAME = 'IntentFulfillment'

@Injectable()
export class IntentFulfillmentQueue {
  public static readonly prefix = '{intent-fulfillment}'
  public static readonly queueName = INTENT_FULFILLMENT_QUEUE_NAME

  constructor(
    @InjectQueue(INTENT_FULFILLMENT_QUEUE_NAME)
    private readonly queue: IntentFulfillmentQueueType,
  ) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return BullModule.registerQueue({
      name: this.queueName,
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true,
      },
    })
  }

  @LogOperation('add_fulfill_intent_job', GenericOperationLogger)
  addFulfillIntentJob(@LogContext jobData: any) {
    return this.queue.add(IntentFulfillmentJobName.FULFILL_INTENT, jobData)
  }
}
