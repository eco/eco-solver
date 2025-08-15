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
import { IntentFulfillmentProcessorInterface } from '@/intent-fulfillment/types/processor.interface'

const CONCURRENCY = 10
@Injectable()
@Processor(IntentFulfillmentQueue.queueName, { concurrency: CONCURRENCY })
export class IntentFulfillmentProcessor extends GroupedJobsProcessor<FulfillIntentJob> implements IntentFulfillmentProcessorInterface {
  constructor(
    @InjectQueue(IntentFulfillmentQueue.queueName)
    public readonly queue: IntentFulfillmentQueueType,
    public readonly fulfillIntentService: FulfillIntentService,
  ) {
    super('chainId', IntentFulfillmentProcessor.name, [new FulfillIntentJobManager()])
  }
}
