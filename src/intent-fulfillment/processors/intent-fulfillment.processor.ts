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
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

const CONCURRENCY = 10
@Injectable()
@Processor(IntentFulfillmentQueue.queueName, { concurrency: CONCURRENCY })
export class IntentFulfillmentProcessor extends GroupedJobsProcessor<FulfillIntentJob> {
  private readonly fulfillmentEnabled: boolean

  constructor(
    @InjectQueue(IntentFulfillmentQueue.queueName)
    public readonly queue: IntentFulfillmentQueueType,
    public readonly fulfillIntentService: FulfillIntentService,
    private readonly ecoConfigService: EcoConfigService,
  ) {
    super('chainId', IntentFulfillmentProcessor.name, [new FulfillIntentJobManager()])
    // Check enabled status at initialization
    const config = this.ecoConfigService.getFulfill()
    this.fulfillmentEnabled = config?.enabled !== false
  }

  async process(job: FulfillIntentJob): Promise<any> {
    // Check if fulfillments are disabled
    if (!this.fulfillmentEnabled) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Fulfillment job skipped - fulfillments disabled by configuration',
          properties: {
            jobId: job.id,
            jobName: job.name,
            intentHash: job.data?.intentHash,
          },
        }),
      )
      // Return without processing to complete the job
      return { skipped: true, reason: 'fulfillments_disabled' }
    }

    // Delegate to parent class process method
    return super.process(job)
  }
}
