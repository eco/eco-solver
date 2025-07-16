import { InjectQueue, Processor } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import {
  IntentFulfillmentQueue,
  IntentFulfillmentQueueType,
} from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { GroupedJobsProcessor } from '@/common/bullmq/grouped-jobs.processor'
import {
  FulfillIntentJob,
  FulfillIntentJobManager,
} from '@/intent-fulfillment/jobs/fulfill-intent.job'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'

@Injectable()
@Processor(IntentFulfillmentQueue.queueName, { concurrency: 10 })
export class IntentFulfillmentProcessor extends GroupedJobsProcessor<FulfillIntentJob> {
  constructor(
    @InjectQueue(IntentFulfillmentQueue.queueName)
    public readonly queue: IntentFulfillmentQueueType,
    public readonly fulfillIntentService: FulfillIntentService,
  ) {
    super('chainId', IntentFulfillmentProcessor.name, [new FulfillIntentJobManager()])
  }
}
