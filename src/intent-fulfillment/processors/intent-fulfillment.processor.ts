import { InjectQueue, Processor } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import {
  IntentFulfillmentQueueType,
  INTENT_FULFILLMENT_QUEUE_NAME,
} from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { GroupedJobsProcessor } from '@/common/bullmq/grouped-jobs.processor'
import {
  FulfillIntentJob,
  FulfillIntentJobManager,
} from '@/intent-fulfillment/jobs/fulfill-intent.job'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'

const CONCURRENCY = 10
@Injectable()
@Processor(INTENT_FULFILLMENT_QUEUE_NAME, { concurrency: CONCURRENCY })
export class IntentFulfillmentProcessor extends GroupedJobsProcessor<FulfillIntentJob> {
  constructor(
    @InjectQueue(INTENT_FULFILLMENT_QUEUE_NAME)
    public readonly queue: IntentFulfillmentQueueType,
    public readonly fulfillIntentService: FulfillIntentService,
  ) {
    super('chainId', IntentFulfillmentProcessor.name, [new FulfillIntentJobManager()])
  }
}
