/* eslint-disable prettier/prettier */
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FulfillmentProcessor } from '@/intent/fulfillment-processor/processors/fulfillment.processor'
import { FulfillmentProcessorJobManager, FulfillmentProcessorJob } from '@/intent/fulfillment-processor/job-managers/fulfillment-processor-job-manager'
import { FulfillmentProcessorJobName } from '@/intent/fulfillment-processor/queues/fulfillment-processor.queue'
import { Job, Queue } from 'bullmq'
import { removeJobSchedulers } from '@/bullmq/utils/queue'

export type FulfillsJob = Job<undefined, undefined, FulfillmentProcessorJobName.FULFILL_INTENTS>

export class FulfillsCronJobManager extends FulfillmentProcessorJobManager {
  static readonly jobSchedulerName = 'job-scheduler-send-batch'

  static async start(queue: Queue, interval: number): Promise<void> {
    await removeJobSchedulers(queue, FulfillmentProcessorJobName.FULFILL_INTENTS)

    await queue.upsertJobScheduler(
      FulfillsCronJobManager.jobSchedulerName,
      { every: interval },
      {
        name: FulfillmentProcessorJobName.FULFILL_INTENTS,
        opts: {
          removeOnComplete: true,
        },
      },
    )
  }

  is(job: FulfillmentProcessorJob): boolean {
    return job.name === FulfillmentProcessorJobName.FULFILL_INTENTS
  }

  async process(job: FulfillmentProcessorJob, processor: FulfillmentProcessor): Promise<void> {
    processor.logger.log(
      EcoLogMessage.fromDefault({ message: `${FulfillsCronJobManager.name}: process` }),
    )

    await processor.fulfillmentProcessorService.getNextFulfills()
  }

  onFailed(job: FulfillmentProcessorJob, processor: FulfillmentProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${FulfillsCronJobManager.name}: Failed`,
        properties: { error: (error as any)?.message ?? error },
      }),
    )
  }
}
