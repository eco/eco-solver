import { Injectable } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { GroupedJobsProcessor } from '@libs/messaging'
import { FulfillIntentService } from '../../domain/fulfill-intent.service'
import {
  IntentFulfillmentQueue,
  IntentFulfillmentQueueType,
} from '../queues/intent-fulfillment.queue'
import {
  FulfillIntentJob,
  FulfillIntentJobManager,
} from '../jobs/fulfill-intent.job'

const CONCURRENCY = 10
@Injectable()
@Processor(IntentFulfillmentQueue.queueName, { concurrency: CONCURRENCY })
export class IntentFulfillmentProcessor extends GroupedJobsProcessor<FulfillIntentJob> {
  constructor(
    @InjectQueue(IntentFulfillmentQueue.queueName)
    public readonly queue: IntentFulfillmentQueueType,
    public readonly fulfillIntentService: FulfillIntentService,
  ) {
    super('chainId', IntentFulfillmentProcessor.name, [new FulfillIntentJobManager()])
  }
}
